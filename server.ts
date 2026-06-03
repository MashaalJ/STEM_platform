import "dotenv/config";
import dns from "node:dns/promises";
import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import { fileURLToPath } from "url";
import bcrypt from "bcryptjs";
import { supabaseAdmin, hasSupabaseAdmin } from "./lib/supabaseAdmin";
import {
  db,
  selectOne,
  selectMany,
  insertOne,
  insertMany,
  updateRow,
  countRows,
  countRowsGte,
  insertIgnore,
  isUuid,
  optionalUuid,
  startOfTodayIso,
  findStudentByName,
  findSectorByName,
  usernameExists,
  joinCodeExists,
  type DbRow,
} from "./lib/db";
import * as Curriculum from "./lib/curriculum.ts";
import * as SQ from "./lib/serverQueries";
import {
  encodeToolActivityEmbed,
  encodeMissionScreensEmbed,
  type ToolActivityConfig,
  type MissionScreensEmbedConfig,
} from "./src/lib/toolActivity.ts";
import { generateUniqueStudentUsername } from "./src/lib/usernameGen.ts";
import {
  asyncRoute,
  V,
  createRateLimiters,
  createAuthMiddleware,
  getReqUser,
  setSessionUser,
  type AuthRequest,
  type SessionUser,
} from "./src/routes/_middleware.ts";
import createAuthRouter from "./src/routes/auth.ts";
import createSectorsRouter from "./src/routes/sectors.ts";
import createClassesRouter, { ensureClassAccess } from "./src/routes/classes.ts";
import createStudentsRouter from "./src/routes/students.ts";
import createChallengesRouter from "./src/routes/challenges.ts";
import createAdminRouter from "./src/routes/admin.ts";
import createParentRouter from "./src/routes/parent.ts";
import createChatRouter from "./src/routes/chat.ts";
import createToolActivityRouter from "./src/routes/toolActivity.ts";
import createSchoolsRouter from "./src/routes/schools.ts";
import createActivitiesRouter from "./src/routes/activities.ts";

// Schema managed in Supabase dashboard

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const hashPassword = (plain: string) => bcrypt.hashSync(plain, 12);

const ALLOWED_GENDERS = new Set(["female", "male", "non_binary", "prefer_not_say", "other"]);

const normalizeGender = (raw: unknown): string | null => {
  const s = String(raw || "")
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, "_");
  if (!s) return null;
  if (s === "nonbinary") return "non_binary";
  if (ALLOWED_GENDERS.has(s)) return s;
  return null;
};

const normalizeCountryCode = (raw: unknown): string | null => {
  const s = String(raw || "")
    .trim()
    .toUpperCase();
  if (s.length === 2 && /^[A-Z]{2}$/.test(s)) return s;
  return null;
};

const DARK_CITY_SECTOR_NAME = "Dark City";
const ELECTRICITY_PRE_FLOW_EMBED = "stemverse://electricity-pre-flow";

const lastActiveThrottle = new Map<string, number>();
const LAST_ACTIVE_MIN_MS = 15 * 60 * 1000;

const bumpLastActive = async (userId: string) => {
  if (!isUuid(userId)) return;
  const now = Date.now();
  const prev = lastActiveThrottle.get(userId) || 0;
  if (now - prev < LAST_ACTIVE_MIN_MS) return;
  lastActiveThrottle.set(userId, now);
  try {
    await updateRow("students", { id: userId }, { last_active_at: new Date().toISOString() });
  } catch {
    /* ignore */
  }
};

const generateJoinCode = (): string => {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "";
  for (let i = 0; i < 6; i++) code += chars[Math.floor(Math.random() * chars.length)];
  return code;
};

const ensureUniqueJoinCode = async (): Promise<string> => {
  let code = generateJoinCode();
  while (await joinCodeExists(code)) code = generateJoinCode();
  return code;
};

const normalizeUsername = (raw: string): string => {
  const base = raw
    .toLowerCase()
    .trim()
    .replace(/\s+/g, "")
    .replace(/[^a-z0-9_]/g, "");
  return base || "player";
};

const ensureUniqueUsername = async (raw: string): Promise<string> => {
  const base = normalizeUsername(raw);
  let candidate = base;
  let i = 1;
  while (await usernameExists(candidate)) {
    i += 1;
    candidate = `${base}${i}`;
  }
  return candidate;
};

const isBcryptHash = (s: string | null) => typeof s === "string" && /^\$2[aby]\$\d+\$/.test(s);

async function ensureDarkCityStarterContent() {
  let sector = await findSectorByName(DARK_CITY_SECTOR_NAME);

  if (!sector) {
    const allSectors = await selectMany<DbRow>("sectors", "id, sort_order, is_starter");
    for (const s of allSectors) {
      if (!s.is_starter) {
        await updateRow("sectors", { id: s.id as string }, { sort_order: (Number(s.sort_order) || 0) + 1 });
      }
    }
    sector = await insertOne("sectors", {
      name: DARK_CITY_SECTOR_NAME,
      description: "Restore power to the grid. Learn circuits and LEDs with NOVA in the neon dark.",
      xp_reward: 500,
      required_level: 1,
      mastery_percent: 0,
      status: "active",
      image_url: "https://picsum.photos/seed/dark-city-electricity/400/400",
      sort_order: 0,
      is_starter: true,
    });
  } else {
    await updateRow("sectors", { id: sector.id as string }, {
      sort_order: 0,
      is_starter: true,
      status: "active",
      required_level: 1,
      description: "Restore power to the grid. Learn circuits and LEDs with NOVA in the neon dark.",
    });
  }

  const sectorId = String(sector.id);
  const missions = await selectMany<DbRow>("missions", "*", { sector_id: sectorId });
  let mission = missions.find(
    (m) =>
      String(m.embed_code || "").toLowerCase() === ELECTRICITY_PRE_FLOW_EMBED.toLowerCase() ||
      String(m.title || "").includes("Circuit Rescue"),
  );

  if (!mission) {
    mission = await insertOne("missions", {
      sector_id: sectorId,
      title: "Circuit Rescue: Power the Grid",
      description: "NOVA's 5-step electricity pre-flow — build circuits, then launch into Dark City.",
      difficulty: "Easy",
      grade_level: "",
      xp_reward: 200,
      status: "available",
      image_url: "https://picsum.photos/seed/dark-city-circuit/400/300",
      embed_code: ELECTRICITY_PRE_FLOW_EMBED,
      domains_json: JSON.stringify(["Electronics"]),
      learning_outcomes_json: JSON.stringify([
        "Define a circuit and its parts",
        "Build a closed circuit",
        "Compare open vs closed circuits",
      ]),
    });
  } else {
    await updateRow("missions", { id: mission.id as string }, {
      embed_code: ELECTRICITY_PRE_FLOW_EMBED,
      status: "available",
      sector_id: sectorId,
    });
  }

  const classes = await selectMany<{ id: string; teacher_id: string | null }>("classes", "id, teacher_id");
  for (const c of classes) {
    const row: DbRow = { class_id: c.id, mission_id: mission.id };
    if (c.teacher_id) row.assigned_by = c.teacher_id;
    await insertIgnore("class_missions", row, "class_id,mission_id");
  }

  return { sectorId, missionId: String(mission.id) };
}

async function checkSupabaseHost(): Promise<{ ok: boolean; hostname: string; reason?: string }> {
  const raw = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || "";
  if (!raw) return { ok: false, hostname: "", reason: "SUPABASE_URL not set" };
  let hostname = raw;
  try {
    hostname = new URL(raw).hostname;
    await dns.lookup(hostname);
    return { ok: true, hostname };
  } catch (err) {
    return {
      ok: false,
      hostname,
      reason: err instanceof Error ? err.message : String(err),
    };
  }
}

async function verifySupabaseSchema(): Promise<boolean> {
  if (!hasSupabaseAdmin) return false;
  const hostCheck = await checkSupabaseHost();
  if (!hostCheck.ok) return false;
  try {
    const { error: studentsErr } = await db().from("students").select("id").limit(1);
    if (studentsErr) {
      console.error(
        "[stemverse] Database schema is missing or incomplete (students table).\n" +
          "  → Open Supabase Dashboard → SQL Editor\n" +
          "  → Paste and run: supabase/migrations/001_stemverse_schema.sql\n" +
          "  → Restart: npm run dev",
      );
      return false;
    }
    const { error: sectorsErr } = await db().from("sectors").select("id, image_url").limit(1);
    if (sectorsErr) {
      console.error(
        "[stemverse] Database schema is outdated (sectors table).\n" +
          "  → Run supabase/migrations/001_stemverse_schema.sql in Supabase SQL Editor, then restart.",
      );
      return false;
    }
    return true;
  } catch (err) {
    console.error("[stemverse] Schema check failed:", err instanceof Error ? err.message : err);
    return false;
  }
}

async function bootstrapData() {
  if (!hasSupabaseAdmin || !supabaseAdmin) {
    console.warn(
      "[stemverse] Supabase not configured — skipping data bootstrap. " +
        "Copy .env.example to .env and set SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY.",
    );
    return;
  }
  const hostCheck = await checkSupabaseHost();
  if (!hostCheck.ok) {
    console.warn(
      `[stemverse] Skipping data bootstrap — cannot reach Supabase (${hostCheck.hostname || "unknown"}). ` +
        "Check SUPABASE_URL in .env (Supabase Dashboard → Settings → API → Project URL).",
    );
    return;
  }
  try {
    if ((await countRows("sectors")) === 0) {
    await insertOne("sectors", {
      name: DARK_CITY_SECTOR_NAME,
      description: "Restore power to the grid. Learn circuits and LEDs with NOVA in the neon dark.",
      xp_reward: 500,
      required_level: 1,
      mastery_percent: 0,
      status: "active",
      image_url: "https://picsum.photos/seed/dark-city-electricity/400/400",
      sort_order: 0,
      is_starter: true,
    });
    await insertMany("sectors", [
      {
        name: "Quantum Mechanics",
        description: "Navigate the subatomic world.",
        xp_reward: 1000,
        required_level: 1,
        mastery_percent: 100,
        status: "locked",
        image_url:
          "https://lh3.googleusercontent.com/aida-public/AB6AXuDXHBpzwclGGdMn6hXD2NIggtnHTgO40Tn-JWyUpvmQTs-J9le-zT-UJrgi1VWc2tYhx8kmdgcvm5GdfblMLlGaNKc8VXekyIv1yOEcjXCTd5zi2paH3Ijf86_uiT_u5th485TnF65Y5IyPSaHJyiAUbHBy8UCLZoaZ38bIX-EEz6Y49gbzLhlh6ZRlaowrvba-T0woONYDwbNWBj2WzkeTXmyTjfuwN4e2AlT8ICLOiOiLJRlJq57Sux0F8YfloV_MixuF4Say-Qgc",
        sort_order: 1,
        is_starter: false,
      },
      {
        name: "Robotics Lab",
        description: "Build and program advanced automatons.",
        xp_reward: 1000,
        required_level: 10,
        mastery_percent: 0,
        status: "locked",
        image_url:
          "https://lh3.googleusercontent.com/aida-public/AB6AXuDVea3b3rIa3oFe4eljXprd3h6SQUlc9O7_CIe3IIB3XTdw4l_1Q8Oy2tVhhveJaWU-_TXuzey3qqk9tiZpplM0DVtpMO05SYgTiNdirAx9iaMf8dHsDLiiXGfQmL5o9lyl31CPpzgKeFX_GOOlnyKZwiA2Rv4MXj0iR5dFDFvsuj-vm4-gdNP_rWCARfIggBjG9AqTJNredrtmNLciGG4kkKdHbloafqaujzhYbuAlLlD52mtfA-MzvvW54uppyW37_FxRR_N9eZL3",
        sort_order: 2,
        is_starter: false,
      },
      {
        name: "Bio-Engineering",
        description: "Edit the code of life itself.",
        xp_reward: 1000,
        required_level: 20,
        mastery_percent: 68,
        status: "locked",
        image_url:
          "https://lh3.googleusercontent.com/aida-public/AB6AXuBZVjiI-ihuKWjerO_v5LRt1eAcUZVNUN2GPHVWKcIM_1aMWZqppLwtzIGbOrE0NbY7jVFmmvXRO4qtf8pd1URIIp4KodOdPEcumtJan8d9XULDBPjqAncMyxSCQ8m0dsbBb5i2Q3xUpbWhwm3_DDRhDg4sXbFpC7-n_SillCtE0zS5aFrCnEXELsjDgArVzxOPHpE6CGENZQ08jC6Z_ftiSibXwCgNcogES4QeDtOqNO3NgW_Fn20P2MycTXxZDppbr4oXSH3bLW19",
        sort_order: 3,
        is_starter: false,
      },
      {
        name: "Astrophysics",
        description: "Explore the mysteries of the cosmos.",
        xp_reward: 1200,
        required_level: 15,
        mastery_percent: 0,
        status: "locked",
        image_url:
          "https://lh3.googleusercontent.com/aida-public/AB6AXuBqBx-UKRVrJND2UTvghlrFvdPgdX0b87Nhg_r940aHk8howkvoyFhj44MDXEIkalOB7qHtunXockNyxBH6YItau2fFbJwBTlhk6NPt5fvNBkY3eqW5MOfY_Qn8-rH0vauyiUIVT_3vdpUeHXO-HG81MGYrZwFQA6CQ-g42o-xfDs9OzAa6kqhprizFXlAwj9M7EQE9Bl81e8wB89h9cUMBPTBPJcCJy-hyWtYMo8LgauetV_xLsnJubM1NGbvFi6H3LviT_RyK-yF3",
        sort_order: 4,
        is_starter: false,
      },
    ]);

    const darkCity = await findSectorByName(DARK_CITY_SECTOR_NAME);
    if (darkCity) {
      await insertOne("missions", {
        sector_id: darkCity.id,
        title: "Circuit Rescue: Power the Grid",
        description: "NOVA's electricity pre-flow — your first mission in Dark City.",
        difficulty: "Easy",
        xp_reward: 200,
        status: "available",
        image_url: "https://picsum.photos/seed/dark-city-circuit/400/300",
        embed_code: ELECTRICITY_PRE_FLOW_EMBED,
        domains_json: JSON.stringify(["Electronics"]),
      });
      const bio = await findSectorByName("Bio-Engineering");
      if (bio) {
        await insertMany("missions", [
          {
            sector_id: bio.id,
            title: "Protein Folding Protocol",
            description: "Master the 3D geometry of amino acids.",
            difficulty: "Hard",
            xp_reward: 500,
            status: "available",
            image_url:
              "https://lh3.googleusercontent.com/aida-public/AB6AXuBTnHhMk1Nhi765AAmaKvSiMJImDRG4oTQ1kmGGFapcUkh4rq3o0Jl349xR26hdbA7f4XfqqFv8cefjXtobBbuQ4ozwEN5kqFkvItAiZAo9-fZjxy5kmDYBVExp9pr8DVUj4TxODYISMJO8ZHXJ7GHZ6bcfFHzkswGM_MEi0eMXkWrEtQ7EgHJcOr9WlEp1eAypnP27jHg5uX4bx-HOXYhWUvcgX6VEwn-Ud6itbZQ3fGy2GhrhhSyvc1YZ6wSiCE5W5feMB181yyDs",
          },
          {
            sector_id: bio.id,
            title: "Enzyme Matcher",
            description: "Catalyze chemical reactions.",
            difficulty: "Medium",
            xp_reward: 350,
            status: "available",
            image_url:
              "https://lh3.googleusercontent.com/aida-public/AB6AXuAwcHWGbjlsrOR2oCWHOJLI34ZupiabZlWa-UJhEhoI8HRq4Ha5flXhG4I7GKSchD3YSZJY1LEgRgCJ8s-kG3oCpu3XV-Wp6yaRZw34aSw6FoFsu5tvSQeDICvVIodY8FaU_vta-rDeRcfQfcETjbv0z6zl7aWEp-yJoodRWCQQaJmY4R9YVq9kJf4FLuH-ew4fOqHQklxNRe_t9eCOuy_SNCD2eauNa0X1xjiOt0-eSObzUO92OHdC_gYOnBR09NDKEQQAYcavh_wC",
          },
        ]);
      }
    }
    }

  await ensureDarkCityStarterContent();

  const { data: nullJoinClasses } = await db().from("classes").select("id").or("join_code.is.null,join_code.eq.");
  for (const row of nullJoinClasses || []) {
    await updateRow("classes", { id: (row as { id: string }).id }, { join_code: await ensureUniqueJoinCode() });
  }

  const DEMO_ACCOUNTS = [
    { name: "Alex Rivera", username: "alexrivera", email: "student@example.com", role: "student", password: "student123" },
    { name: "Professor Nova", username: "professornova", email: "teacher@example.com", role: "teacher", password: "teacher123" },
    { name: "Admin Core", username: "admincore", email: "admin@example.com", role: "admin", password: "admin123" },
  ] as const;

  for (const { name, username, email, role, password } of DEMO_ACCOUNTS) {
    const { data: rows } = await db()
      .from("students")
      .select("id, password")
      .or(`email.ilike.${email},name.ilike.${name}`)
      .limit(1);
    const row = rows?.[0] as { id: string; password?: string } | undefined;
    if (!row) continue;
    if (!isBcryptHash(row.password || null)) {
      await updateRow("students", { id: row.id }, { password: hashPassword(password) });
    }
    await updateRow("students", { id: row.id }, { name, username, email, role });
  }

  try {
    await db()
      .from("students")
      .update({
        gender: "male",
        country_code: "US",
        region: "CA",
        subscription_status: "trial",
        subscription_plan: "pro",
        billing_provider: "manual",
        mrr_cents: 0,
      })
      .ilike("email", "student@example.com");
    await db()
      .from("students")
      .update({
        gender: "female",
        country_code: "CA",
        region: "ON",
        subscription_status: "active",
        subscription_plan: "school",
        billing_provider: "manual",
        mrr_cents: 2999,
        ltv_cents: 8997,
      })
      .ilike("email", "teacher@example.com");
    await db()
      .from("students")
      .update({
        country_code: "US",
        subscription_status: "free",
        subscription_plan: "free",
        billing_provider: "none",
        mrr_cents: 0,
      })
      .ilike("email", "admin@example.com");
  } catch {
    /* ignore */
  }
  } catch (err) {
    console.warn(
      "[stemverse] Data bootstrap failed (is the schema applied in Supabase?):",
      err instanceof Error ? err.message : err,
    );
  }
}

async function startServer() {
  try {
    await bootstrapData();
  } catch (err) {
    console.warn("[stemverse] Bootstrap error:", err instanceof Error ? err.message : err);
  }

  if (!hasSupabaseAdmin) {
    console.warn(
      "[stemverse] Running without Supabase admin client — auth and API routes will return 503 until .env is configured.",
    );
  } else {
    const schemaOk = await verifySupabaseSchema();
    if (!schemaOk) {
      console.warn("[stemverse] Login and signup will not work until the schema SQL has been applied.");
    }
  }

  const isProduction = process.env.NODE_ENV === "production";
  const ENABLE_TEST_ACCOUNTS =
    String(process.env.ENABLE_TEST_ACCOUNTS || "true").toLowerCase() === "true";
  const ALLOW_LOCAL_AUTH_FALLBACK =
    String(process.env.ALLOW_LOCAL_AUTH_FALLBACK || (isProduction ? "false" : "true")).toLowerCase() === "true";

  const app = express();
  const PORT = Number(process.env.PORT) || 3000;
  // Required on platforms like Render/Cloud Run so secure cookies work behind a reverse proxy.
  app.set("trust proxy", 1);

  /** Pages that may load inside same-origin iframes (mission embed player). */
  const FRAMEABLE_PATHS = new Set(["/electricity.html", "/stemverse-tool-player.html"]);

  // Security headers (reduce XSS, clickjacking, MIME sniffing)
  app.use((req, res, next) => {
    res.setHeader("X-Content-Type-Options", "nosniff");
    // Dev: allow same-origin mission iframes. Prod: only explicit embed pages (e.g. electricity.html).
    const allowSameOriginFrame = !isProduction || FRAMEABLE_PATHS.has(req.path);
    res.setHeader("X-Frame-Options", allowSameOriginFrame ? "SAMEORIGIN" : "DENY");
    res.setHeader("X-XSS-Protection", "1; mode=block");
    if (isProduction) {
      res.setHeader("Strict-Transport-Security", "max-age=31536000; includeSubDomains");
    }
    next();
  });

  app.use(express.json({ limit: "256kb" }));

  /** Drop revenue fields for non-admin viewers (admin UI loads full rows via session). */
  const sanitizeUser = (user: any, viewerRole?: string) => {
    if (!user) return null;
    const { password: _pw, ...rest } = user;
    if (viewerRole !== "admin") {
      delete rest.mrr_cents;
      delete rest.ltv_cents;
      delete rest.billing_provider;
    }
    return rest;
  };

  const toEmbeddableUrl = (rawUrl: string): string => {
    const url = rawUrl.trim();
    // YouTube: watch?v= -> /embed/
    const ytWatch = url.match(/^https?:\/\/(?:www\.)?youtube\.com\/watch\?v=([^&]+).*/i);
    if (ytWatch?.[1]) return `https://www.youtube.com/embed/${encodeURIComponent(ytWatch[1])}`;
    const ytShort = url.match(/^https?:\/\/youtu\.be\/([^?&/]+).*/i);
    if (ytShort?.[1]) return `https://www.youtube.com/embed/${encodeURIComponent(ytShort[1])}`;

    // Vimeo: vimeo.com/<id> -> player.vimeo.com/video/<id>
    const vimeo = url.match(/^https?:\/\/(?:www\.)?vimeo\.com\/(\d+).*/i);
    if (vimeo?.[1]) return `https://player.vimeo.com/video/${encodeURIComponent(vimeo[1])}`;

    // Scratch: scratch.mit.edu/projects/<id>/ -> embed
    const scratch = url.match(/^https?:\/\/scratch\.mit\.edu\/projects\/(\d+)\/?$/i);
    if (scratch?.[1]) return `https://scratch.mit.edu/projects/${encodeURIComponent(scratch[1])}/embed`;

    return url;
  };

  /** Normalize and sanitize embed input: plain URL -> safe iframe; iframe snippet -> safe iframe only. */
  const sanitizeEmbedCode = (input: string): string | null => {
    const s = input.trim();
    if (!s) return null;
    const token = s.toLowerCase();
    if (
      token === "stemverse://arduino-uno-blockly" ||
      token === "stemverse://arduino-blockly" ||
      token === "stemverse://arduino-ide"
    ) {
      return "stemverse://arduino-uno-blockly";
    }
    if (token === "stemverse://electricity-pre-flow" || token.endsWith("/electricity.html")) {
      return "stemverse://electricity-pre-flow";
    }
    if (token.startsWith("stemverse://tool-activity")) {
      return s;
    }
    if (token.includes("/stemverse-tool-player.html")) {
      return s;
    }
    // Plain URL (http/https)
    if (/^https?:\/\/[^\s<>"']+$/i.test(s)) {
      try {
        const parsed = new URL(s);
        if (parsed.pathname === "/" || parsed.pathname === "") {
          return "stemverse://electricity-pre-flow";
        }
      } catch {
        /* ignore */
      }
      const url = toEmbeddableUrl(s).replace(/["'<>]/g, "");
      return `<iframe src="${url}" class="w-full h-full min-h-[400px]" allowfullscreen></iframe>`;
    }
    // Extract iframe src from HTML snippet (src with or without leading space)
    const iframeMatch = s.match(/<iframe[^>]*\s*src\s*=\s*["']([^"']+)["'][^>]*>/i) || s.match(/<iframe[^>]*>/i);
    if (iframeMatch) {
      const src = (iframeMatch[1] || "").trim();
      if (src && /^https?:\/\//i.test(src)) {
        const url = toEmbeddableUrl(src).replace(/["'<>]/g, "");
        return `<iframe src="${url}" class="w-full h-full min-h-[400px]" allowfullscreen></iframe>`;
      }
    }
    // Allow existing safe iframe as-is if it contains only one iframe with safe src (simple check)
    if (/<iframe\s[^>]*src\s*=\s*["']https?:\/\/[^"']+["'][^>]*>/i.test(s) && !/<(script|object|embed)/i.test(s)) {
      const srcMatch = s.match(/src\s*=\s*["'](https?:\/\/[^"']+)["']/i);
      if (srcMatch) {
        const url = toEmbeddableUrl(srcMatch[1]).replace(/["'<>]/g, "");
        return `<iframe src="${url}" class="w-full h-full min-h-[400px]" allowfullscreen></iframe>`;
      }
    }
    return null;
  };

  // --- AI Infrastructure (server-side only; never expose keys to frontend) ---
  const AI_API_KEY = process.env.OPENAI_API_KEY || process.env.AI_API_KEY || "";
  const AI_MODEL = process.env.OPENAI_MODEL || "gpt-4o-mini";
  const AI_BASE_URL = process.env.OPENAI_BASE_URL || "https://api.openai.com/v1";
  const AI_DAILY_GLOBAL_LIMIT = Number(process.env.AI_DAILY_GLOBAL_LIMIT || 500);
  const AI_DAILY_QUIZ_LIMIT_PER_USER = Number(process.env.AI_DAILY_QUIZ_LIMIT_PER_USER || 3);
  const AI_DAILY_RECOMMEND_LIMIT_PER_USER = Number(process.env.AI_DAILY_RECOMMEND_LIMIT_PER_USER || 5);
  const AI_DAILY_STEMBOT_LIMIT_PER_USER = Number(process.env.AI_DAILY_STEMBOT_LIMIT_PER_USER || 40);

  const safeJsonParse = <T = unknown>(raw: string): T | null => {
    try {
      return JSON.parse(raw) as T;
    } catch {
      return null;
    }
  };

  const callAiJson = async <T = unknown>(system: string, user: string): Promise<T | null> => {
    if (!AI_API_KEY) return null;
    try {
      const res = await fetch(`${AI_BASE_URL}/chat/completions`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${AI_API_KEY}`,
        },
        body: JSON.stringify({
          model: AI_MODEL,
          temperature: 0.6,
          response_format: { type: "json_object" },
          messages: [
            { role: "system", content: system },
            { role: "user", content: user },
          ],
        }),
      });
      if (!res.ok) return null;
      const data = (await res.json()) as any;
      const content = data?.choices?.[0]?.message?.content;
      if (!content || typeof content !== "string") return null;
      return safeJsonParse<T>(content);
    } catch {
      return null;
    }
  };

  const callAiChat = async (
    messages: Array<{ role: "system" | "user" | "assistant"; content: string }>,
  ): Promise<string | null> => {
    if (!AI_API_KEY) return null;
    try {
      const res = await fetch(`${AI_BASE_URL}/chat/completions`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${AI_API_KEY}`,
        },
        body: JSON.stringify({
          model: AI_MODEL,
          temperature: 0.7,
          max_tokens: 600,
          messages,
        }),
      });
      if (!res.ok) {
        const errText = await res.text().catch(() => "");
        console.error("[stemverse] STEMbot AI error:", res.status, errText.slice(0, 300));
        return null;
      }
      const data = (await res.json()) as { choices?: Array<{ message?: { content?: string } }> };
      const content = data?.choices?.[0]?.message?.content;
      return typeof content === "string" ? content.trim() : null;
    } catch (err) {
      console.error("[stemverse] STEMbot AI request failed:", err);
      return null;
    }
  };

  const getAiUsageCountToday = async (endpoint?: string, userId?: string) => {
    const since = startOfTodayIso();
    if (endpoint && userId) {
      return countRowsGte("ai_usage_logs", "created_at", since, { endpoint, user_id: userId });
    }
    if (endpoint) {
      return countRowsGte("ai_usage_logs", "created_at", since, { endpoint });
    }
    return countRowsGte("ai_usage_logs", "created_at", since);
  };

  const logAiUsage = async (
    endpoint: "generate_quiz" | "recommendations" | "stembot_chat",
    userId: string,
    success: 0 | 1,
    reason?: string,
  ) => {
    try {
      await insertOne("ai_usage_logs", {
        endpoint,
        user_id: userId,
        success,
        reason: reason || null,
      });
    } catch (err) {
      console.warn(
        "[stemverse] ai_usage_logs insert skipped:",
        err instanceof Error ? err.message : err,
      );
    }
  };

  const checkAndLogAiQuota = async (
    endpoint: "generate_quiz" | "recommendations" | "stembot_chat",
    userId: string,
  ) => {
    const globalCount = await getAiUsageCountToday();
    if (globalCount >= AI_DAILY_GLOBAL_LIMIT) {
      await logAiUsage(endpoint, userId, 0, "global_limit");
      return {
        ok: false,
        message: "AI daily platform limit reached. Please try again tomorrow.",
      } as const;
    }
    const perUserLimit =
      endpoint === "generate_quiz"
        ? AI_DAILY_QUIZ_LIMIT_PER_USER
        : endpoint === "stembot_chat"
          ? AI_DAILY_STEMBOT_LIMIT_PER_USER
          : AI_DAILY_RECOMMEND_LIMIT_PER_USER;
    const userCount = await getAiUsageCountToday(endpoint, userId);
    if (userCount >= perUserLimit) {
      await logAiUsage(endpoint, userId, 0, "user_limit");
      return {
        ok: false,
        message: `Daily AI limit reached for this feature (${perUserLimit}/day). Please try again tomorrow.`,
      } as const;
    }
    await logAiUsage(endpoint, userId, 1, "accepted");
    return { ok: true, message: "" } as const;
  };

  /** Upsert students row keyed by auth user UUID (students.id = auth.users.id). */
  const linkSupabaseUserToLocalStudent = async (
    sbUser: { id: string; email?: string | null },
    metadata: Record<string, any>,
  ): Promise<SessionUser | undefined> => {
    const email = sbUser.email || null;
    const rawRole = String(metadata.role || "student").toLowerCase();
    let desiredRole =
      rawRole === "teacher" || rawRole === "educator"
        ? "teacher"
        : rawRole === "admin"
          ? "admin"
          : rawRole === "parent"
            ? "parent"
            : rawRole === "school_admin" || rawRole === "principal"
              ? "school_admin"
              : "student";
    const displayName = String(
      metadata.display_name || metadata.full_name || metadata.name || (email ? email.split("@")[0] : "Student"),
    ).trim();
    const preferredUsername = await ensureUniqueUsername(displayName);
    const avatarSeed = encodeURIComponent(displayName.toLowerCase().replace(/\s+/g, "-"));

    const { provisionRosterStudent } = await import("./lib/db.ts");
    const parentProfile = await selectOne<{ id: string }>("parents", "id", { auth_id: sbUser.id });
    if (parentProfile) {
      desiredRole = "parent";
    }

    const existing = await selectOne<{ username?: string | null; role?: string }>("students", "id, username, role", {
      id: sbUser.id,
    });
    const existingRole = String(existing?.role || "").toLowerCase();
    if (existingRole === "parent" || existingRole === "admin" || existingRole === "teacher" || existingRole === "school_admin") {
      desiredRole = existingRole;
    }
    if (!existing) {
      await provisionRosterStudent({
        id: sbUser.id,
        name: displayName,
        username: preferredUsername,
        password: hashPassword(String(Math.random())),
        avatar_url: `https://picsum.photos/seed/${avatarSeed}/200`,
        email,
        role: desiredRole,
      });
    } else {
      await updateRow("students", { id: sbUser.id }, {
        name: displayName,
        role: desiredRole,
        email: email ?? undefined,
        ...(!existing.username ? { username: preferredUsername } : {}),
      });
    }

    if (desiredRole === "parent") {
      const existingParent = await selectOne("parents", "id", { auth_id: sbUser.id });
      if (!existingParent) {
        await insertOne("parents", {
          auth_id: sbUser.id,
          name: displayName,
          email: email || "",
          student_id: null,
        });
      }
    }

    const row = await selectOne<SessionUser>("students", "id, name, role", { id: sbUser.id });
    return row ?? undefined;
  };

  const { requireAuth, requireRole, requireStudentAccess } = createAuthMiddleware(linkSupabaseUserToLocalStudent);
  const { globalRateLimit, rateLimitLogin, rateLimitSignup, rateLimitLinkChild, rateLimitAi } =
    createRateLimiters();
  app.use(globalRateLimit);

  const ensureStudentUsername = () => generateUniqueStudentUsername(usernameExists);

  const enrollStudentInDefaultClass = async (studentId: string): Promise<void> => {
    try {
      const defaultClass = await Curriculum.findClassByName(Curriculum.STEMVERSE_DEFAULT_CLASS_NAME);
      if (!defaultClass) return;
      await insertIgnore(
        "class_students",
        { class_id: String(defaultClass.id), student_id: studentId },
        "class_id,student_id",
      );
    } catch {
      /* ignore */
    }
  };

  const isMissingColumnError = (msg: string) =>
    /could not find the .* column|column .* does not exist/i.test(msg);

  const insertRowWithColumnFallback = async (table: string, row: DbRow): Promise<DbRow> => {
    let payload = { ...row };
    for (let attempt = 0; attempt < 12; attempt++) {
      try {
        return await insertOne(table, payload);
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        if (!isMissingColumnError(msg)) throw err;
        const colMatch = msg.match(/'([^']+)' column/i);
        const col = colMatch?.[1];
        if (!col || !(col in payload)) throw err;
        delete payload[col];
        if (!Object.keys(payload).length) throw err;
      }
    }
    throw new Error(`${table} insert: too many column fallbacks`);
  };

  const updateRowWithColumnFallback = async (
    table: string,
    match: Record<string, unknown>,
    patch: DbRow,
  ): Promise<void> => {
    let payload = { ...patch };
    for (let attempt = 0; attempt < 12; attempt++) {
      try {
        await updateRow(table, match, payload);
        return;
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        if (!isMissingColumnError(msg)) throw err;
        const colMatch = msg.match(/'([^']+)' column/i);
        const col = colMatch?.[1];
        if (!col || !(col in payload)) throw err;
        delete payload[col];
        if (!Object.keys(payload).length) throw err;
      }
    }
    throw new Error(`${table} update: too many column fallbacks`);
  };

  const enrichSectorRow = (sector: DbRow, _allSectors: DbRow[]): DbRow => {
    const domainRaw = sector.domain_ids;
    let domain_ids: string[] | null = null;
    if (Array.isArray(domainRaw)) {
      domain_ids = domainRaw.map(String);
    } else if (typeof domainRaw === "string" && domainRaw.trim()) {
      try {
        const parsed = JSON.parse(domainRaw);
        domain_ids = Array.isArray(parsed) ? parsed.map(String) : null;
      } catch {
        domain_ids = null;
      }
    }
    return {
      ...sector,
      level_lock: Number(sector.required_level ?? sector.level_lock) || 1,
      ...(domain_ids ? { domain_ids } : {}),
    };
  };

  const sectorStudentCountMap = async (): Promise<Map<string, number>> => {
    const map = new Map<string, number>();
    try {
      const rows = await selectMany<{ sector_id: string }>("student_sector_mastery", "sector_id");
      for (const row of rows) {
        const id = String(row.sector_id);
        map.set(id, (map.get(id) || 0) + 1);
      }
    } catch {
      /* table may not exist yet */
    }
    return map;
  };

  const parseDomainIds = (raw: unknown): string[] | null => {
    if (raw == null) return null;
    if (Array.isArray(raw)) {
      const ids = raw.map((x) => String(x).trim()).filter((s) => isUuid(s));
      return ids.length ? ids : null;
    }
    return null;
  };

  const parseLearningOutcomes = (raw: unknown): string | null => {
    if (raw == null) return null;
    if (Array.isArray(raw)) {
      const arr = raw.map((x) => String(x).trim()).filter(Boolean);
      return arr.length ? JSON.stringify(arr) : null;
    }
    if (typeof raw === "string") {
      const s = raw.trim();
      return s || null;
    }
    return null;
  };

  const parsePrerequisiteIds = (raw: unknown): string | null => {
    if (raw == null || raw === "" || raw === 0) return null;
    if (Array.isArray(raw)) {
      const first = raw.find((x) => isUuid(String(x)));
      return first ? String(first) : null;
    }
    const s = String(raw).trim();
    return isUuid(s) ? s : optionalUuid(s);
  };

  const buildEmbedFromAdminInput = (body: Record<string, unknown>): string | null => {
    const embedType = String(body.embed_type || "").trim().toLowerCase();
    if (!embedType) return null;
    if (embedType === "arduino-blockly" || embedType === "arduino_blockly") {
      return "stemverse://arduino-uno-blockly";
    }
    if (embedType === "electricity") {
      return "stemverse://electricity-pre-flow";
    }
    if (embedType === "tool-activity" && body.embed_config && typeof body.embed_config === "object") {
      return encodeToolActivityEmbed(body.embed_config as ToolActivityConfig);
    }
    if (embedType === "screens-activity" && body.embed_config && typeof body.embed_config === "object") {
      return encodeMissionScreensEmbed(body.embed_config as MissionScreensEmbedConfig);
    }
    if (embedType === "custom") {
      const url = String(body.custom_embed_url || body.embed_url || "").trim();
      if (!url) return null;
      return sanitizeEmbedCode(url);
    }
    return null;
  };

  const ensureBuiltinTestAccounts = async () => {
    if (!hasSupabaseAdmin || !supabaseAdmin) return;
    if (String(process.env.ENABLE_TEST_ACCOUNTS || "true").toLowerCase() === "false") return;

    const hostCheck = await checkSupabaseHost();
    if (!hostCheck.ok) {
      console.warn(
        `[stemverse] Skipping test account sync — cannot reach Supabase (${hostCheck.hostname || "unknown"}).`,
      );
      return;
    }

    const accounts = [
      { email: "student@example.com", password: "student123", role: "student", name: "Alex Rivera" },
      { email: "teacher@example.com", password: "teacher123", role: "teacher", name: "Professor Nova" },
      { email: "admin@example.com", password: "admin123", role: "admin", name: "Admin Core" },
    ] as const;

    const asSupabaseRole = (role: string) => (role === "teacher" ? "educator" : role);

    try {
      const listed = await supabaseAdmin.auth.admin.listUsers({ page: 1, perPage: 1000 });
      if (listed.error) {
        console.warn("[stemverse] Test account sync skipped:", listed.error.message);
        return;
      }

      const byEmail = new Map<string, string>();
      for (const u of listed.data?.users || []) {
        if (u.email) byEmail.set(u.email.toLowerCase(), u.id);
      }

      for (const account of accounts) {
        try {
          const email = account.email.toLowerCase();
          const userId = byEmail.get(email);
          let finalId: string | null = null;

          if (userId) {
            const updated = await supabaseAdmin.auth.admin.updateUserById(userId, {
              password: account.password,
              email_confirm: true,
              user_metadata: {
                role: asSupabaseRole(account.role),
                display_name: account.name,
                name: account.name,
              },
            });
            if (updated.error) {
              console.warn(`[stemverse] Test account ${email}:`, updated.error.message);
              continue;
            }
            if (updated.data?.user) finalId = updated.data.user.id;
          } else {
            const created = await supabaseAdmin.auth.admin.createUser({
              email,
              password: account.password,
              email_confirm: true,
              user_metadata: {
                role: asSupabaseRole(account.role),
                display_name: account.name,
                name: account.name,
              },
            });
            if (created.error) {
              console.warn(`[stemverse] Test account ${email}:`, created.error.message);
              continue;
            }
            if (created.data?.user) finalId = created.data.user.id;
          }

          if (!finalId) continue;

          const linked = await linkSupabaseUserToLocalStudent(
            { id: finalId, email },
            { role: asSupabaseRole(account.role), display_name: account.name, name: account.name },
          );
          if (linked) {
            const username = await ensureUniqueUsername(account.name);
            await updateRow("students", { id: finalId }, {
              name: account.name,
              role: account.role,
              email,
              username,
              password: hashPassword(account.password),
            });
          }
        } catch (err) {
          console.warn(
            `[stemverse] Test account ${account.email} skipped:`,
            err instanceof Error ? err.message : err,
          );
        }
      }
    } catch (err) {
      console.warn(
        "[stemverse] Test account sync skipped:",
        err instanceof Error ? err.message : err,
      );
    }
  };

  await ensureBuiltinTestAccounts();

  app.get("/favicon.ico", (_req, res) => {
    res.redirect(302, "/icons/icon-192x192.svg");
  });

  app.use(
    "/api",
    createAuthRouter({
      requireAuth,
      requireRole,
      rateLimitSignup,
      rateLimitLogin,
      rateLimitLinkChild,
      linkSupabaseUserToLocalStudent,
      sanitizeUser,
      hashPassword,
      ensureStudentUsername,
      enrollStudentInDefaultClass,
      bumpLastActive,
      normalizeGender,
      normalizeCountryCode,
      isProduction,
      ALLOW_LOCAL_AUTH_FALLBACK,
      ENABLE_TEST_ACCOUNTS,
    }),
  );

  app.use("/api", createActivitiesRouter({ requireAuth }));

  app.use(
    "/api",
    createSectorsRouter({
      requireAuth,
      requireRole,
      isProduction,
      enrichSectorRow,
      sectorStudentCountMap,
      parseDomainIds,
      parseLearningOutcomes,
      parsePrerequisiteIds,
      insertRowWithColumnFallback,
      updateRowWithColumnFallback,
      buildEmbedFromAdminInput,
      sanitizeEmbedCode,
    }),
  );

  app.use(
    "/api",
    createClassesRouter({
      requireAuth,
      requireRole,
      getReqUser,
      isProduction,
      ensureUniqueJoinCode,
      hashPassword,
      ensureUniqueUsername,
      bumpLastActive,
      hasSupabaseAdmin,
      supabaseAdmin,
      findStudentByName,
    }),
  );

  app.use(
    "/api",
    createStudentsRouter({
      requireAuth,
      requireRole,
      requireStudentAccess,
      rateLimitAi,
      checkAndLogAiQuota,
      callAiJson,
      bumpLastActive,
    }),
  );

  app.use(
    "/api",
    createChallengesRouter({
      requireAuth,
      requireRole,
      bumpLastActive,
      insertRowWithColumnFallback,
      updateRowWithColumnFallback,
    }),
  );

  app.use(
    "/api",
    createAdminRouter({
      requireAuth,
      requireRole,
      sanitizeUser,
      normalizeGender,
      normalizeCountryCode,
      ensureClassAccess,
    }),
  );

  app.use(
    "/api",
    createSchoolsRouter({
      requireAuth,
      requireRole,
      sanitizeUser,
      bumpLastActive,
    }),
  );

  app.use(
    "/api",
    createParentRouter({
      requireAuth,
      requireRole,
      rateLimitLinkChild,
    }),
  );

  app.use(
    "/api",
    createChatRouter({
      requireAuth,
      rateLimitAi,
      callAiChat,
      checkAndLogAiQuota,
      aiConfigured: Boolean(AI_API_KEY),
    }),
  );

  const toolActivityRouters = createToolActivityRouter({ requireAuth });
  app.use("/api", toolActivityRouters.apiRouter);
  app.use("/", toolActivityRouters.projectsRouter);

  app.get("/api/quizzes", requireAuth, async (_req, res) => {
    res.json(await SQ.listQuizzes());
  });

  app.get("/api/quizzes/:id", requireAuth, async (req, res) => {
    if (!isUuid(req.params.id)) return res.status(400).json({ error: "Invalid quiz id" });
    const row = await selectOne("quizzes", "*", { id: req.params.id });
    if (!row) return res.status(404).json({ error: "Quiz not found" });
    res.json(row);
  });

  // AI-style quiz generation for a completed mission (unique per student/request)
  app.post(
    "/api/missions/:id/generate-quiz",
    requireAuth,
    requireRole(["student"]),
    rateLimitAi,
    async (req, res) => {
    const sessionUser = getReqUser(req)!;
    const quota = await checkAndLogAiQuota("generate_quiz", sessionUser.id);
    if (!quota.ok) {
      return res.status(429).json({ success: false, message: quota.message });
    }
    const missionId = req.params.id;
    if (!isUuid(missionId)) {
      return res.status(400).json({ success: false, message: "Invalid mission id" });
    }
    const mission = await SQ.getMissionBrief(missionId);
    if (!mission) return res.status(404).json({ success: false, message: "Mission not found" });

    const sector = await SQ.getSectorBrief(mission.sector_id);
    const topic = `${sector?.name || "STEM"} ${mission.title} ${mission.description || ""}`.trim();

    const conceptPool = [
      "core concept",
      "application",
      "analysis",
      "evaluation",
      "real-world transfer",
      "vocabulary",
      "data interpretation",
      "problem-solving strategy",
    ];
    const wrongPool = [
      "an unrelated claim",
      "a common misconception",
      "an overgeneralized statement",
      "a reversed relationship",
      "an unsupported conclusion",
      "a distractor with similar wording",
    ];
    const random = (seed: number) => {
      let x = Math.sin(seed) * 10000;
      return x - Math.floor(x);
    };
    const idSeed =
      sessionUser.id.split("").reduce((a, c) => a + c.charCodeAt(0), 0) +
      missionId.split("").reduce((a, c) => a + c.charCodeAt(0), 0);
    const seedBase = Date.now() + idSeed * 997;
    const pick = <T,>(arr: T[], seed: number) => arr[Math.floor(random(seed) * arr.length)];
    const shuffle = <T,>(arr: T[], seed: number) =>
      [...arr].sort((a, b) => (random(seed + String(a).length) - random(seed + String(b).length)));

    const fallbackQuestions = Array.from({ length: 5 }).map((_, i) => {
      const concept = pick(conceptPool, seedBase + i * 17);
      const prompt = `In the mission "${mission.title}", which statement best reflects the ${concept} for topic: ${topic}?`;
      const correct = `The best answer connects ${topic} to ${concept} using evidence from the mission context.`;
      const wrongs = shuffle(
        [
          `It focuses only on memorization and ignores ${concept}.`,
          `It claims ${topic} has no relation to ${concept}.`,
          `It chooses ${pick(wrongPool, seedBase + i * 31)}.`,
        ],
        seedBase + i * 73
      );
      const options = shuffle(
        [
          { text: correct, correct: true },
          { text: wrongs[0], correct: false },
          { text: wrongs[1], correct: false },
          { text: wrongs[2], correct: false },
        ],
        seedBase + i * 97
      );
      return {
        type: "multiple_choice",
        content: {
          question: prompt,
          multiple: false,
          options,
          partialScoring: false,
        },
      };
    });

    const finalizeAndSave = async (questions: unknown[]) => {
      const isMcq = (q: unknown): q is { type: string; content: { question: string; options: unknown[] } } =>
        Boolean(
          q &&
            typeof q === "object" &&
            (q as { type?: string }).type === "multiple_choice" &&
            (q as { content?: { question?: string; options?: unknown } }).content?.question &&
            Array.isArray((q as { content?: { options?: unknown } }).content?.options),
        );
      const normalized = (Array.isArray(questions) ? questions : []).filter(isMcq).slice(0, 5);
      const useQuestions = normalized.length === 5 ? normalized : fallbackQuestions;
      const title = `${mission.title} · Auto Quiz`;
      const quizId = await SQ.insertQuiz(title, JSON.stringify(useQuestions));
      res.json({ success: true, id: quizId, title, question_count: useQuestions.length });
    };

    const studentStats = await SQ.getStudentQuizStats(sessionUser.id);

    const aiSystem = `You generate adaptive STEM multiple-choice quizzes.
Return ONLY valid JSON with this exact shape:
{
  "questions": [
    {
      "type": "multiple_choice",
      "content": {
        "question": "string",
        "multiple": false,
        "options": [{"text":"string","correct":true|false}],
        "partialScoring": false
      }
    }
  ]
}
Rules:
- Exactly 5 questions.
- Each question has exactly 4 options and exactly 1 correct option.
- Difficulty should adapt to the student's profile.
- Avoid unsafe content.`;
    const aiUser = `Mission: ${mission.title}
Mission description: ${mission.description || ""}
Sector: ${sector?.name || "STEM"}
Topic: ${topic}
Student profile:
- avg_score_percent: ${Math.round(Number(studentStats?.avg_score || 0))}
- quizzes_completed: ${Number(studentStats?.quizzes_completed || 0)}
Create the quiz now.`;

    try {
      const ai = await callAiJson<{ questions?: unknown[] }>(aiSystem, aiUser);
      if (ai?.questions && Array.isArray(ai.questions)) await finalizeAndSave(ai.questions);
      else await finalizeAndSave(fallbackQuestions);
    } catch {
      await finalizeAndSave(fallbackQuestions);
    }
  });

  // --- Notifications ---
  app.get("/api/notifications", requireAuth, asyncRoute(async (req, res) => {
    const sessionUser = getReqUser(req)!;
    res.json(await SQ.listNotifications(sessionUser.id));
  }));

  app.patch("/api/notifications/:id/read", requireAuth, async (req, res) => {
    const sessionUser = getReqUser(req)!;
    const id = req.params.id;
    if (!isUuid(id)) return res.status(400).json({ error: "Invalid id" });
    const ok = await SQ.markNotificationRead(id, sessionUser.id);
    if (!ok) return res.status(404).json({ error: "Notification not found" });
    res.json({ success: true });
  });

  app.patch("/api/notifications/read-all", requireAuth, async (req, res) => {
    const sessionUser = getReqUser(req)!;
    await SQ.markAllNotificationsRead(sessionUser.id);
    res.json({ success: true });
  });

  app.post("/api/student-quizzes", requireAuth, async (req, res) => {
    const sessionUser = getReqUser(req)!;
    const { student_id, quiz_id, score, total_questions, auto_score, review_items } = req.body;
    if (sessionUser.role === "student" && String(student_id) !== sessionUser.id) {
      return res.status(403).json({ success: false, message: "Forbidden" });
    }
    if (!isUuid(student_id) || !isUuid(quiz_id)) {
      return res.status(400).json({ success: false, message: "Invalid student_id or quiz_id" });
    }
    const normalizedAutoScore = Number.isFinite(Number(auto_score)) ? Number(auto_score) : Number(score) || 0;
    const normalizedTotal = Number.isFinite(Number(total_questions)) ? Number(total_questions) : 0;
    const pendingItems = Array.isArray(review_items) ? review_items : [];
    const pendingCount = pendingItems.length;
    const { id: studentQuizId } = await insertOne("student_quizzes", {
      student_id,
      quiz_id,
      score: normalizedAutoScore,
      auto_score: normalizedAutoScore,
      reviewed_score: 0,
      pending_reviews: pendingCount,
      total_questions: normalizedTotal,
    });

    for (const item of pendingItems) {
      await insertOne("quiz_review_items", {
        student_quiz_id: studentQuizId,
        student_id,
        quiz_id,
        question_index: Number(item?.question_index || 0),
        question_type: String(item?.question_type || "short_answer"),
        prompt: String(item?.prompt || ""),
        response_text: String(item?.response_text || ""),
        max_score: Math.max(1, Number(item?.max_score || 1)),
        awarded_score: 0,
        review_status: "pending",
      });
    }
    await bumpLastActive(String(student_id));
    res.json({ success: true, pending_reviews: pendingCount });
  });

  const publicDir = path.join(__dirname, "public");
  app.get("/electricity.html", (_req, res) => {
    res.setHeader("X-Frame-Options", "SAMEORIGIN");
    res.sendFile(path.join(publicDir, "electricity.html"), (err) => {
      if (err) res.status(404).send("electricity.html not found");
    });
  });

  app.get("/stemverse-tool-player.html", (_req, res) => {
    res.setHeader("X-Frame-Options", "SAMEORIGIN");
    res.sendFile(path.join(publicDir, "stemverse-tool-player.html"), (err) => {
      if (err) res.status(404).send("stemverse-tool-player.html not found");
    });
  });

  app.use((err: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    console.error("[stemverse] Unhandled API error:", err instanceof Error ? err.message : err);
    if (!res.headersSent) {
      res.status(500).json({ error: err instanceof Error ? err.message : "Internal server error" });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: {
        middlewareMode: true,
        hmr: false,
      },
      appType: "spa",
      plugins: [
        {
          name: "stemverse-strip-vite-hmr-client",
          transformIndexHtml(html) {
            return html.replace(/<script type="module" src="\/@vite\/client"><\/script>\s*/g, "");
          },
        },
      ],
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.join(__dirname, "public")));
    app.use(express.static(path.join(__dirname, "dist")));
    app.get("*", (req, res) => {
      if (req.path.endsWith(".html")) {
        const publicFile = path.join(__dirname, "public", path.basename(req.path));
        return res.sendFile(publicFile, (err) => {
          if (err) res.sendFile(path.join(__dirname, "dist", "index.html"));
        });
      }
      res.sendFile(path.join(__dirname, "dist", "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`[stemverse] Server running at http://localhost:${PORT}`);
    if (hasSupabaseAdmin) {
      void checkSupabaseHost().then((check) => {
        if (!check.ok) {
          console.warn(
            `[stemverse] Supabase is unreachable (${check.hostname}) — login and API will fail until .env is fixed.`,
          );
        }
      });
    }
  }).on("error", (err: NodeJS.ErrnoException) => {
    if (err.code === "EADDRINUSE") {
      console.error(
        `[stemverse] Port ${PORT} is already in use. Another app may be running on http://localhost:${PORT}\n` +
          `  Try: PORT=${PORT + 1} npm run dev`,
      );
    } else {
      console.error("[stemverse] Server failed to start:", err.message);
    }
    process.exit(1);
  });
}

startServer().catch(err => {
  console.error('Failed to start server:', err);
});

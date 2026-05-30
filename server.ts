import "dotenv/config";
import dns from "node:dns/promises";
import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import { fileURLToPath } from "url";
import bcrypt from "bcryptjs";
import { createClient, type User } from "@supabase/supabase-js";
import { supabaseAdmin, hasSupabaseAdmin, supabaseAnonKey } from "./lib/supabaseAdmin";
import {
  db,
  selectOne,
  selectMany,
  insertOne,
  insertMany,
  updateRow,
  deleteRows,
  countRows,
  countRowsGte,
  upsertRow,
  insertIgnore,
  isUuid,
  optionalUuid,
  startOfTodayIso,
  STUDENT_SELECT_PUBLIC,
  getStudentPublic,
  getStudentRole,
  findStudentByName,
  findSectorByName,
  findStudentByEmailOrUsername,
  usernameExists,
  joinCodeExists,
  selectDistinctSchools,
  type DbRow,
} from "./lib/db";
import * as SQ from "./lib/serverQueries";

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

  const classes = await selectMany<{ id: string }>("classes", "id");
  for (const c of classes) {
    await insertIgnore("class_missions", { class_id: c.id, mission_id: mission.id }, "class_id,mission_id");
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

  const asyncRoute =
    (fn: (req: express.Request, res: express.Response) => Promise<unknown>) =>
    (req: express.Request, res: express.Response, next: express.NextFunction) => {
      Promise.resolve(fn(req, res)).catch(next);
    };

  type SessionUser = { id: string; name: string; role: string };

  /** req.user = Supabase auth user; req.sessionUser = linked students row for handlers. */
  type AuthRequest = express.Request & { user?: User; sessionUser?: SessionUser };

  const getReqUser = (req: express.Request): SessionUser | undefined => (req as AuthRequest).sessionUser;

  const setSessionUser = (req: express.Request, user: SessionUser) => {
    (req as AuthRequest).sessionUser = user;
  };

  const getSupabasePublicClient = () => {
    const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || "";
    if (!supabaseUrl || !supabaseAnonKey) return null;
    return createClient(supabaseUrl, supabaseAnonKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
  };

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
    endpoint: "generate_quiz" | "recommendations",
    userId: string,
    success: 0 | 1,
    reason?: string,
  ) => {
    await insertOne("ai_usage_logs", {
      endpoint,
      user_id: userId,
      success,
      reason: reason || null,
    });
  };

  const checkAndLogAiQuota = async (endpoint: "generate_quiz" | "recommendations", userId: string) => {
    const globalCount = await getAiUsageCountToday();
    if (globalCount >= AI_DAILY_GLOBAL_LIMIT) {
      await logAiUsage(endpoint, userId, 0, "global_limit");
      return {
        ok: false,
        message: "AI daily platform limit reached. Please try again tomorrow.",
      } as const;
    }
    const perUserLimit = endpoint === "generate_quiz" ? AI_DAILY_QUIZ_LIMIT_PER_USER : AI_DAILY_RECOMMEND_LIMIT_PER_USER;
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
    const desiredRole =
      rawRole === "teacher" || rawRole === "educator" ? "teacher" : rawRole === "admin" ? "admin" : "student";
    const displayName = String(
      metadata.display_name || metadata.full_name || metadata.name || (email ? email.split("@")[0] : "Student"),
    ).trim();
    const preferredUsername = await ensureUniqueUsername(displayName);
    const avatarSeed = encodeURIComponent(displayName.toLowerCase().replace(/\s+/g, "-"));

    const existing = await selectOne<{ username?: string | null }>("students", "username", { id: sbUser.id });
    if (!existing) {
      await insertOne("students", {
        id: sbUser.id,
        name: displayName,
        username: preferredUsername,
        password: hashPassword(String(Math.random())),
        level: 1,
        xp: 0,
        avatar_url: `https://picsum.photos/seed/${avatarSeed}/200`,
        role: desiredRole,
        email,
        subscription_status: "free",
        subscription_plan: "free",
        billing_provider: "none",
        mrr_cents: 0,
        ltv_cents: 0,
      });
    } else {
      await updateRow("students", { id: sbUser.id }, {
        name: displayName,
        role: desiredRole,
        email: email ?? undefined,
        ...(!existing.username ? { username: preferredUsername } : {}),
      });
    }

    const row = await selectOne<SessionUser>("students", "id, name, role", { id: sbUser.id });
    return row ?? undefined;
  };

  const tryAttachUserFromAuthorizationHeader = async (req: express.Request): Promise<boolean> => {
    if (!hasSupabaseAdmin || !supabaseAdmin) return false;
    const token = req.headers.authorization?.split("Bearer ")[1];
    if (!token) return false;
    const { data, error } = await supabaseAdmin.auth.getUser(token);
    if (error || !data?.user) return false;
    const authReq = req as AuthRequest;
    authReq.user = data.user;
    const meta = (data.user.user_metadata || {}) as Record<string, unknown>;
    const sessionUser = await linkSupabaseUserToLocalStudent(data.user, meta);
    if (!sessionUser) return false;
    authReq.sessionUser = sessionUser;
    return true;
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

  app.get("/api/auth/health", (_req, res) => {
    const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || "";
    const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
    res.json({
      success: true,
      auth: {
        mode: hasSupabaseAdmin ? "supabase_bearer" : "unconfigured",
        has_supabase_admin: hasSupabaseAdmin,
        has_supabase_url: Boolean(supabaseUrl),
        has_supabase_anon_key: Boolean(supabaseAnonKey),
        has_supabase_service_role_key: Boolean(supabaseServiceRoleKey),
        allow_local_auth_fallback: ALLOW_LOCAL_AUTH_FALLBACK,
        enable_test_accounts: String(process.env.ENABLE_TEST_ACCOUNTS || "true").toLowerCase() === "true",
      },
    });
  });

  const requireAuth: express.RequestHandler = async (req, res, next) => {
    if (!hasSupabaseAdmin || !supabaseAdmin) {
      return res.status(503).json({ error: "Auth not configured" });
    }
    const token = req.headers.authorization?.split("Bearer ")[1];
    if (!token) return res.status(401).json({ error: "No token" });
    const { data, error } = await supabaseAdmin.auth.getUser(token);
    if (error || !data?.user) return res.status(401).json({ error: "Invalid token" });
    const authReq = req as AuthRequest;
    authReq.user = data.user;
    const meta = (data.user.user_metadata || {}) as Record<string, unknown>;
    const sessionUser = await linkSupabaseUserToLocalStudent(data.user, meta);
    if (!sessionUser) return res.status(401).json({ error: "Invalid token" });
    authReq.sessionUser = sessionUser;
    next();
  };

  const optionalAuth: express.RequestHandler = async (req, _res, next) => {
    await tryAttachUserFromAuthorizationHeader(req);
    next();
  };

  const requireRole = (roles: Array<SessionUser["role"]>): express.RequestHandler => {
    return async (req, res, next) => {
      const authUser = (req as AuthRequest).user;
      if (!authUser) {
        return res.status(401).json({ error: "No token" });
      }
      const role = (await getStudentRole(authUser.id)) || getReqUser(req)?.role;
      if (!role || !roles.includes(role)) {
        return res.status(403).json({ success: false, message: "Forbidden" });
      }
      const sessionUser = getReqUser(req);
      if (sessionUser) setSessionUser(req, { ...sessionUser, role });
      next();
    };
  };

  /** Students can only access their own id; teachers/admins can access any student. */
  const requireStudentAccess: express.RequestHandler = async (req, res, next) => {
    const user = getReqUser(req);
    if (!user) return res.status(401).json({ success: false, message: "Unauthorized" });
    const studentId = req.params.id;
    if (!isUuid(studentId)) return res.status(400).json({ success: false, message: "Invalid id" });
    const role = (await getStudentRole(user.id)) || user.role;
    if (role === "student" && user.id !== studentId) {
      return res.status(403).json({ success: false, message: "Forbidden" });
    }
    next();
  };

  const ensureClassAccess = async (
    req: express.Request,
    res: express.Response,
    classId: string,
  ): Promise<{ ok: boolean }> => {
    const user = getReqUser(req);
    if (!user) {
      res.status(401).json({ success: false, message: "Unauthorized" });
      return { ok: false };
    }
    if (!isUuid(classId)) {
      res.status(400).json({ success: false, message: "Invalid class id" });
      return { ok: false };
    }
    const cls = await selectOne<{ id: string; teacher_id: string | null }>("classes", "id, teacher_id", { id: classId });
    if (!cls) {
      res.status(404).json({ success: false, message: "Class not found" });
      return { ok: false };
    }
    if (user.role === "admin" || cls.teacher_id === user.id) {
      return { ok: true };
    }
    res.status(403).json({ success: false, message: "Forbidden" });
    return { ok: false };
  };

  const loginAttempts: Record<string, { count: number; windowStart: number }> = {};
  const WINDOW_MS = 15 * 60 * 1000;
  const MAX_ATTEMPTS = 20;

  const rateLimitAuth: express.RequestHandler = (req, res, next) => {
    const ip = (req.headers["x-forwarded-for"] as string | undefined)?.split(",")[0]?.trim() || req.ip || "unknown";
    const now = Date.now();
    const record = loginAttempts[ip] || { count: 0, windowStart: now };

    if (now - record.windowStart > WINDOW_MS) {
      record.count = 0;
      record.windowStart = now;
    }

    record.count += 1;
    loginAttempts[ip] = record;

    if (record.count > MAX_ATTEMPTS) {
      return res.status(429).json({ success: false, message: "Too many attempts. Please try again later." });
    }

    next();
  };

  type SignupProfilePayload = {
    name: string;
    role: string;
    age?: number | null;
    grade?: string | null;
    school?: string | null;
    city?: string | null;
    email?: string | null;
    parent_email?: string | null;
    contact_number?: string | null;
    gender?: string | null;
    country_code?: string | null;
    region?: string | null;
    timezone?: string | null;
  };

  const syncLocalStudentProfile = async (
    supabaseUserId: string,
    profile: SignupProfilePayload,
  ): Promise<{ user: Record<string, unknown>; username: string } | null> => {
    const {
      name,
      role,
      age,
      grade,
      school,
      city,
      email,
      parent_email,
      contact_number,
      gender: genderRaw,
      country_code: countryRaw,
      region: regionRaw,
      timezone: timezoneRaw,
    } = profile;
    if (!name || !role || (role !== "student" && role !== "teacher")) return null;

    const gender = genderRaw != null ? normalizeGender(genderRaw) : null;
    const country_code = countryRaw != null ? normalizeCountryCode(countryRaw) : null;
    const region = regionRaw != null ? String(regionRaw).trim() || null : null;
    const timezone = timezoneRaw != null ? String(timezoneRaw).trim() || null : null;
    const normalizedSchool = String(school || "").trim();
    const avatarSeed = encodeURIComponent(name.trim().toLowerCase().replace(/\s+/g, "-"));
    const avatar_url = `https://picsum.photos/seed/${avatarSeed}/200`;
    const username = await ensureUniqueUsername(name);

    const user = await SQ.upsertStudentProfile(
      supabaseUserId,
      {
        name,
        role,
        username,
        avatar_url,
        age: age ?? null,
        grade: grade ?? null,
        school: normalizedSchool || null,
        city: city ?? null,
        email: email ?? null,
        parent_email: parent_email ?? null,
        contact_number: contact_number ?? null,
        gender,
        country_code,
        region,
        timezone,
      },
      hashPassword(String(Math.random())),
    );
    if (!user) return null;
    await bumpLastActive(supabaseUserId);
    return { user, username: String((user as { username?: string }).username || username) };
  };

  const resolveEmailForLoginIdentifier = async (identifier: string): Promise<string | null> => {
    const trimmed = identifier.trim();
    if (!trimmed) return null;
    if (trimmed.includes("@")) return trimmed;
    const row = await findStudentByEmailOrUsername(trimmed);
    return String(row?.email || "").trim() || null;
  };

  // API Routes
  app.get("/api/auth/resolve-email", rateLimitAuth, async (req, res) => {
    const identifier = String(req.query.identifier || "").trim();
    if (!identifier) {
      return res.status(400).json({ success: false, message: "identifier is required" });
    }
    const email = await resolveEmailForLoginIdentifier(identifier);
    if (!email) {
      return res.status(404).json({ success: false, message: "No account found for this username. Try email login once." });
    }
    res.json({ success: true, email });
  });

  app.post("/api/auth/complete-signup", requireAuth, async (req, res) => {
    const sessionUser = getReqUser(req)!;
    const authHeader = req.headers.authorization || "";
    const token = authHeader.match(/^Bearer\s+(.+)$/i)?.[1];
    if (!token || !hasSupabaseAdmin || !supabaseAdmin) {
      return res.status(401).json({ success: false, message: "Unauthorized" });
    }
    const { data, error } = await supabaseAdmin.auth.getUser(token);
    if (error || !data?.user) {
      return res.status(401).json({ success: false, message: "Invalid session" });
    }
    const supabaseUserId = data.user.id;
    if (sessionUser.id !== supabaseUserId) {
      return res.status(403).json({ success: false, message: "Forbidden" });
    }

    const {
      name,
      role,
      age,
      grade,
      school,
      city,
      email,
      parent_email,
      contact_number,
      gender: genderRaw,
      country_code: countryRaw,
      region: regionRaw,
      timezone: timezoneRaw,
    } = req.body;

    if (!name || !role) {
      return res.status(400).json({ success: false, message: "Missing required fields" });
    }
    if (role !== "student" && role !== "teacher") {
      return res.status(400).json({ success: false, message: "Invalid role" });
    }
    const normalizedSchool = String(school || "").trim();
    if (role === "teacher" && !normalizedSchool) {
      return res.status(400).json({ success: false, message: "Teacher signup requires a school selection." });
    }
    const gender = normalizeGender(genderRaw);
    if (genderRaw != null && String(genderRaw).trim() !== "" && gender === null) {
      return res.status(400).json({ success: false, message: "Invalid gender value" });
    }
    const country_code = normalizeCountryCode(countryRaw);
    if (countryRaw != null && String(countryRaw).trim() !== "" && country_code === null) {
      return res.status(400).json({ success: false, message: "country_code must be ISO 3166-1 alpha-2 (e.g. US)" });
    }
    const region = regionRaw != null ? String(regionRaw).trim() || null : null;
    const timezone = timezoneRaw != null ? String(timezoneRaw).trim() || null : null;

    const synced = await syncLocalStudentProfile(supabaseUserId, {
      name,
      role,
      age: age != null ? Number(age) : null,
      grade: grade || null,
      school: normalizedSchool || null,
      city: city || null,
      email: email || data.user.email || null,
      parent_email: parent_email || null,
      contact_number: contact_number || null,
      gender,
      country_code,
      region,
      timezone,
    });
    if (!synced) {
      return res.status(500).json({ success: false, message: "Could not create local profile" });
    }
    res.json({ success: true, username: synced.username, user: sanitizeUser(synced.user) });
  });

  app.get("/api/sectors", optionalAuth, async (req, res) => {
    const rows = await SQ.listSectorsOrdered();
    const sessionUser = getReqUser(req);
    let sectors = rows;

    if (sessionUser?.role === "student") {
      const starterDone = await SQ.studentCompletedStarterMission(sessionUser.id);
      if (!starterDone) {
        sectors = rows.map((s) => {
          const isStarter = Boolean(s.is_starter);
          if (isStarter) return s;
          return { ...s, status: "locked" };
        });
      }
    }

    res.json(sectors);
  });

  app.get("/api/sectors/:id", async (req, res) => {
    if (!isUuid(req.params.id)) return res.status(400).json({ error: "Invalid sector id" });
    const sector = await selectOne("sectors", "*", { id: req.params.id });
    if (!sector) return res.status(404).json({ error: "Sector not found" });
    res.json(sector);
  });

  app.post("/api/sectors", requireAuth, requireRole(["admin"]), async (req, res) => {
    const {
      name,
      description,
      xp_reward,
      required_level,
      mastery_percent,
      status,
      image_url,
    } = req.body || {};

    const trimmedName = String(name || "").trim();
    if (!trimmedName) {
      return res.status(400).json({ success: false, message: "Sector name is required" });
    }

    const safeDescription = String(description || "").trim();
    const safeXp = Math.max(0, Number.isFinite(Number(xp_reward)) ? Number(xp_reward) : 0);
    const safeRequiredLevel = Math.max(1, Number.isFinite(Number(required_level)) ? Number(required_level) : 1);
    const safeMastery = Math.min(100, Math.max(0, Number.isFinite(Number(mastery_percent)) ? Number(mastery_percent) : 0));
    const safeStatusRaw = String(status || "locked").toLowerCase();
    const safeStatus = ["active", "locked", "maintenance"].includes(safeStatusRaw) ? safeStatusRaw : "locked";
    const safeImageUrl = String(image_url || "").trim() || "https://picsum.photos/seed/sector/400/300";

    const created = await insertOne("sectors", {
      name: trimmedName,
      description: safeDescription,
      xp_reward: safeXp,
      required_level: safeRequiredLevel,
      mastery_percent: safeMastery,
      status: safeStatus,
      image_url: safeImageUrl,
    });
    return res.json({ success: true, sector: created });
  });

  /** Missions in this sector. Students see only missions assigned to their class(es); teachers/admins see all. */
  app.get("/api/sectors/:id/missions", requireAuth, async (req, res) => {
    const sectorId = req.params.id;
    if (!isUuid(sectorId)) return res.status(400).json({ error: "Invalid sector id" });
    const sector = await selectOne("sectors", "*", { id: sectorId });
    if (!sector) return res.status(404).json({ error: "Sector not found" });

    const sessionUser = getReqUser(req)!;
    if (sessionUser.role === "student") {
      const result = await SQ.getMissionsForSectorStudent(sectorId, sessionUser.id);
      return res.json(result);
    }
    const missions = await selectMany("missions", "*", { sector_id: sectorId }, { column: "created_at", ascending: true });
    res.json({ missions, completedMissionIds: [] });
  });

  app.get("/api/students", requireAuth, async (req, res) => {
    const sessionUser = getReqUser(req)!;
    const students = await SQ.listStudentsPublic(sessionUser.role === "admin");
    res.json(students);
  });

  app.get("/api/schools", async (_req, res) => {
    try {
      res.json(await SQ.selectDistinctSchools());
    } catch (err) {
      console.warn("[stemverse] /api/schools:", err instanceof Error ? err.message : err);
      res.json([]);
    }
  });

  app.post("/api/signup", rateLimitAuth, async (req, res) => {
    const {
      name,
      password,
      role,
      age,
      grade,
      school,
      city,
      email,
      parent_email,
      contact_number,
      gender: genderRaw,
      country_code: countryRaw,
      region: regionRaw,
      timezone: timezoneRaw,
    } = req.body;
    const gender = normalizeGender(genderRaw);
    if (genderRaw != null && String(genderRaw).trim() !== "" && gender === null) {
      return res.status(400).json({ success: false, message: "Invalid gender value" });
    }
    const country_code = normalizeCountryCode(countryRaw);
    if (countryRaw != null && String(countryRaw).trim() !== "" && country_code === null) {
      return res.status(400).json({ success: false, message: "country_code must be ISO 3166-1 alpha-2 (e.g. US)" });
    }
    const region = regionRaw != null ? String(regionRaw).trim() || null : null;
    const timezone = timezoneRaw != null ? String(timezoneRaw).trim() || null : null;

    if (!name || !password || !email || !role) {
      return res.status(400).json({ success: false, message: "Missing required fields" });
    }

    if (role !== "student" && role !== "teacher") {
      return res.status(400).json({ success: false, message: "Invalid role" });
    }

    const normalizedSchool = String(school || "").trim();
    if (role === "teacher" && !normalizedSchool) {
      return res.status(400).json({ success: false, message: "Teacher signup requires a school selection." });
    }

    if (!hasSupabaseAdmin || !supabaseAdmin) {
      return res.status(503).json({ success: false, message: "Supabase auth is not configured." });
    }

    const username = await ensureUniqueUsername(name);
    const mappedRole = role === "teacher" ? "educator" : role;

    const created = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: {
        role: mappedRole,
        username,
        display_name: name,
        age: age || null,
        grade_level: grade || null,
        school: normalizedSchool || null,
        city: city || null,
        parent_email: parent_email || null,
        contact_number: contact_number || null,
        gender: gender || null,
        country_code: country_code || null,
        region,
        timezone,
      },
    });

    if (created.error || !created.data.user) {
      const msg = String(created.error?.message || "Signup failed");
      if (/already|exists|registered/i.test(msg)) {
        const existingSignIn = await supabaseAdmin.auth.signInWithPassword({ email, password });
        if (!existingSignIn.error && existingSignIn.data.user && existingSignIn.data.session?.access_token) {
          const existingMeta = (existingSignIn.data.user.user_metadata || {}) as Record<string, unknown>;
          const linked = await linkSupabaseUserToLocalStudent(existingSignIn.data.user, existingMeta);
          const fullUser = linked ? await getStudentPublic(linked.id) : null;
          if (linked && fullUser) {
            await bumpLastActive(linked.id);
            return res.json({
              success: true,
              already_exists: true,
              message: "Account already existed. You are now signed in.",
              access_token: existingSignIn.data.session.access_token,
              user: sanitizeUser(fullUser, (fullUser as { role?: string }).role),
            });
          }
        }
        return res.status(409).json({ success: false, message: "User already exists. Please sign in instead." });
      }
      return res.status(400).json({ success: false, message: msg });
    }

    const sbNew = created.data.user;
    const synced = await syncLocalStudentProfile(sbNew.id, {
      name,
      role,
      age: age != null ? Number(age) : null,
      grade: grade || null,
      school: normalizedSchool || null,
      city: city || null,
      email: email || sbNew.email || null,
      parent_email: parent_email || null,
      contact_number: contact_number || null,
      gender,
      country_code,
      region,
      timezone,
    });
    if (!synced?.user) {
      return res.status(500).json({ success: false, message: "Could not create profile" });
    }

    const signIn = await supabaseAdmin.auth.signInWithPassword({ email, password });
    if (signIn.error || !signIn.data.session?.access_token) {
      return res.json({
        success: true,
        needs_email_confirmation: true,
        access_token: null,
        username: synced.username,
        user: sanitizeUser(synced.user),
        message: "Account created. Sign in with your email and password.",
      });
    }

    await bumpLastActive(sbNew.id);
    return res.json({
      success: true,
      access_token: signIn.data.session.access_token,
      username: synced.username,
      user: sanitizeUser(synced.user),
    });
  });

  app.post("/api/login", rateLimitAuth, async (req, res) => {
    try {
    const { name, username, email, password } = req.body;
    const identifier = String(email || username || name || "").trim();
    console.log(`Login attempt for: ${identifier}`);

    if (!hasSupabaseAdmin || !supabaseAdmin) {
      return res.status(503).json({ success: false, message: "Supabase auth is not configured." });
    }
    if (!identifier || !password) {
      return res.status(400).json({ success: false, message: "Username/email and password are required." });
    }
    let emailForAuth = identifier.includes("@") ? identifier : "";
    if (!emailForAuth) {
      emailForAuth = (await resolveEmailForLoginIdentifier(identifier)) || "";
    }
    if (!emailForAuth) {
      return res.status(401).json({ success: false, message: "No account found for this username. Try email login once." });
    }
    const signIn = await supabaseAdmin.auth.signInWithPassword({ email: emailForAuth, password });
    if (signIn.error || !signIn.data.user || !signIn.data.session?.access_token) {
      return res.status(401).json({
        success: false,
        message: signIn.error?.message || "Invalid credentials",
      });
    }
    const sbUser = signIn.data.user;
    const meta = (sbUser.user_metadata || {}) as Record<string, unknown>;
    const linked = await linkSupabaseUserToLocalStudent(sbUser, meta);
    if (!linked) {
      return res.status(500).json({
        success: false,
        message:
          "Could not link account to local profile. Run supabase/migrations/001_stemverse_schema.sql in Supabase SQL Editor, then restart the server.",
      });
    }

    const displayName = String(
      meta.display_name || meta.full_name || meta.name || (sbUser.email ? sbUser.email.split("@")[0] : "User"),
    );
    const avatar = `https://picsum.photos/seed/${encodeURIComponent(displayName.toLowerCase().replace(/\s+/g, "-"))}/200`;

    await updateRow("students", { id: linked.id }, {
      name: displayName,
      avatar_url: avatar,
      email: sbUser.email || undefined,
    });

    const fullUser = await getStudentPublic(linked.id);
    if (!fullUser) {
      return res.status(500).json({ success: false, message: "Could not load user profile." });
    }

    await bumpLastActive(linked.id);
    return res.json({
      success: true,
      access_token: signIn.data.session.access_token,
      user: sanitizeUser(fullUser),
    });
    } catch (err) {
      console.error("[stemverse] /api/login:", err instanceof Error ? err.message : err);
      return res.status(500).json({
        success: false,
        message:
          err instanceof Error && /students|schema cache/i.test(err.message)
            ? "Database schema not set up. Run supabase/migrations/001_stemverse_schema.sql in Supabase, then restart."
            : "Login failed due to a server error.",
      });
    }
  });

  app.get("/api/quizzes", requireAuth, async (_req, res) => {
    res.json(await SQ.listQuizzes());
  });

  app.get("/api/quizzes/:id", requireAuth, async (req, res) => {
    if (!isUuid(req.params.id)) return res.status(400).json({ error: "Invalid quiz id" });
    const row = await selectOne("quizzes", "*", { id: req.params.id });
    if (!row) return res.status(404).json({ error: "Quiz not found" });
    res.json(row);
  });

  app.get("/api/missions", async (_req, res) => {
    res.json(await SQ.listMissions());
  });

  // AI-style quiz generation for a completed mission (unique per student/request)
  app.post("/api/missions/:id/generate-quiz", requireAuth, requireRole(["student"]), async (req, res) => {
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

  // AI mission recommendations (adaptive next-skill path)
  app.get("/api/students/:id/recommendations", requireAuth, requireStudentAccess, asyncRoute(async (req, res) => {
    const sessionUser = getReqUser(req)!;
    const quota = await checkAndLogAiQuota("recommendations", sessionUser.id);
    if (!quota.ok) {
      return res.status(429).json({ success: false, message: quota.message, recommendations: [] });
    }
    const studentId = req.params.id;

    const studentRow = await selectOne<{ grade?: string | null }>("students", "grade", { id: studentId });
    const normalizedGrade = String(studentRow?.grade || "")
      .trim()
      .toLowerCase();

    let assigned: Array<DbRow & { sector_name?: string }> = [];
    const { data: classRows } = await db().from("class_students").select("class_id").eq("student_id", studentId);
    const classIds = (classRows || []).map((r) => (r as { class_id: string }).class_id);
    if (classIds.length) {
      const { data: cmRows } = await db().from("class_missions").select("mission_id").in("class_id", classIds);
      const missionIds = [...new Set((cmRows || []).map((r) => (r as { mission_id: string }).mission_id))];
      if (missionIds.length) {
        const missions = await selectMany<DbRow>("missions", "*");
        const sectors = await selectMany<{ id: string; name: string }>("sectors", "id, name");
        const sectorMap = new Map(sectors.map((s) => [s.id, s.name]));
        assigned = missions
          .filter((m) => missionIds.includes(String(m.id)))
          .map((m) => ({ ...m, sector_name: sectorMap.get(String(m.sector_id)) }));
      }
    }
    if (assigned.length === 0) {
      const allMissions = await selectMany<DbRow>("missions", "*", { status: "available" });
      const sectors = await selectMany<{ id: string; name: string }>("sectors", "id, name");
      const sectorMap = new Map(sectors.map((s) => [s.id, s.name]));
      assigned = allMissions
        .filter((m) => {
          if (!normalizedGrade) return true;
          const gl = String(m.grade_level || "").trim().toLowerCase();
          return !gl || gl === normalizedGrade;
        })
        .slice(0, 30)
        .map((m) => ({ ...m, sector_name: sectorMap.get(String(m.sector_id)) }));
    }
    const completions = await selectMany<{ mission_id: string }>("student_mission_completions", "mission_id", {
      student_id: studentId,
    });
    const completedSet = new Set(completions.map((r) => r.mission_id));
    const pending = assigned.filter((m) => !completedSet.has(String(m.id)));
    const interestRows = await selectMany<{ interest_key: string }>(
      "student_interest_votes",
      "interest_key",
      { student_id: studentId },
      { column: "weight", ascending: false },
    );
    const interestKeys = interestRows.map((r) => String(r.interest_key || "").toLowerCase());
    const scoreByInterest = (mission: any) => {
      const hay = `${mission?.title || ""} ${mission?.description || ""} ${mission?.sector_name || ""}`.toLowerCase();
      return interestKeys.reduce((acc, key) => (hay.includes(key.replace(/_/g, " ")) ? acc + 1 : acc), 0);
    };
    const stats = await SQ.getStudentQuizStats(studentId);

    const bySector = new Map<string, { sector_name: string; total: number; completed: number }>();
    for (const m of assigned) {
      const sid = String(m.sector_id);
      const cur = bySector.get(sid) || { sector_name: String(m.sector_name || ""), total: 0, completed: 0 };
      cur.total += 1;
      if (completedSet.has(String(m.id))) cur.completed += 1;
      bySector.set(sid, cur);
    }
    const sectorProgress = [...bySector.entries()].map(([sector_id, p]) => ({
      sector_id,
      sector_name: p.sector_name,
      completion_rate: p.total ? p.completed / p.total : 0,
      total: p.total,
      completed: p.completed,
    }));
    const weakest = [...sectorProgress].sort((a, b) => a.completion_rate - b.completion_rate)[0];
    const strongest = [...sectorProgress].sort((a, b) => b.completion_rate - a.completion_rate)[0];

    // Heuristic baseline recommendations from pending missions
    const easierFirst = pending
      .filter((m) => weakest ? m.sector_id === weakest.sector_id : true)
      .sort(
        (a, b) =>
          scoreByInterest(b) - scoreByInterest(a) ||
          String(a.difficulty || "").localeCompare(String(b.difficulty || "")) ||
          String(a.id).localeCompare(String(b.id)),
      )
      .slice(0, 2)
      .map((m) => ({ mission_id: m.id, title: m.title, difficulty: m.difficulty, sector: m.sector_name, reason: `Build fundamentals in ${m.sector_name} progressively.` }));
    const strongerStretch = pending
      .filter((m) => strongest ? m.sector_id === strongest.sector_id : true)
      .sort(
        (a, b) =>
          scoreByInterest(b) - scoreByInterest(a) ||
          String(b.difficulty || "").localeCompare(String(a.difficulty || "")) ||
          String(a.id).localeCompare(String(b.id)),
      )
      .slice(0, 2)
      .map((m) => ({ mission_id: m.id, title: m.title, difficulty: m.difficulty, sector: m.sector_name, reason: `Stretch in your stronger area: ${m.sector_name}.` }));
    let recommendations = [...easierFirst, ...strongerStretch].slice(0, 4);

    // AI refinement if key exists
    const aiSystem = `You are a learning-path recommender for STEM games.
Return ONLY valid JSON: {"recommendations":[{"mission_id":number,"reason":"string","difficulty_target":"easy|medium|hard"}]}
Prefer adaptive progression: easier for weaker domains, harder for stronger domains.`;
    const aiUser = JSON.stringify({
      student_id: studentId,
      avg_score_percent: Math.round(Number(stats?.avg_score || 0)),
      quizzes_completed: Number(stats?.quizzes_completed || 0),
      sector_progress: sectorProgress,
      pending_missions: pending.map((m) => ({ mission_id: m.id, title: m.title, sector: m.sector_name, difficulty: m.difficulty })),
      student_interests: interestKeys,
    });
    const ai = await callAiJson<{ recommendations?: Array<{ mission_id: number; reason?: string; difficulty_target?: string }> }>(aiSystem, aiUser);
    if (ai?.recommendations?.length) {
      const byId = new Map<string, DbRow>(pending.map((m) => [String(m.id), m]));
      const merged = ai.recommendations
        .map((r) => {
          const m = byId.get(String(r.mission_id));
          if (!m) return null;
          return {
            mission_id: m.id,
            title: m.title,
            difficulty: m.difficulty,
            sector: m.sector_name,
            reason: r.reason || `Recommended next step for ${m.sector_name}.`,
          };
        })
        .filter(Boolean) as any[];
      if (merged.length) recommendations = merged.slice(0, 4);
    }

    res.json({
      success: true,
      profile: {
        avg_score_percent: Math.round(Number(stats?.avg_score || 0)),
        quizzes_completed: Number(stats?.quizzes_completed || 0),
        weakest_sector: weakest?.sector_name || null,
        strongest_sector: strongest?.sector_name || null,
      },
      recommendations,
    });
  }));

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

  // --- Challenge Engine API (H5P-style interactive challenges) ---
  app.get("/api/challenges", requireAuth, async (req, res) => {
    const sessionUser = getReqUser(req)!;
    if (sessionUser.role === "student") {
      return res.json(await SQ.listChallengesForStudent(sessionUser.id));
    }
    res.json(await SQ.listAllChallenges());
  });

  app.get("/api/challenges/:id", requireAuth, async (req, res) => {
    if (!isUuid(req.params.id)) return res.status(400).json({ error: "Invalid challenge id" });
    const row = await selectOne("challenges", "*", { id: req.params.id });
    if (!row) return res.status(404).json({ error: "Challenge not found" });
    res.json(row);
  });

  app.post("/api/challenges", requireAuth, requireRole(["teacher", "admin"]), async (req, res) => {
    const { title, type, world, zone, grade_level, xp_reward, xp_bonus_first_try, xp_retry_penalty, content_json } = req.body;
    if (!title || !type || content_json === undefined) {
      return res.status(400).json({ error: "title, type, and content_json required" });
    }
    const created = await insertOne<{ id: string }>("challenges", {
      title,
      type,
      world: world || null,
      zone: zone || null,
      grade_level: String(grade_level || "").trim() || null,
      xp_reward: Number(xp_reward) || 100,
      xp_bonus_first_try: Number(xp_bonus_first_try) || 0,
      xp_retry_penalty: Number(xp_retry_penalty) || 0,
      content_json: typeof content_json === "string" ? content_json : JSON.stringify(content_json),
    });
    res.json({ success: true, id: created.id });
  });

  app.patch("/api/challenges/:id", requireAuth, requireRole(["teacher", "admin"]), async (req, res) => {
    const id = req.params.id;
    if (!isUuid(id)) return res.status(400).json({ error: "Invalid challenge id" });
    const existing = await selectOne("challenges", "id", { id });
    if (!existing) return res.status(404).json({ error: "Challenge not found" });
    const { title, type, world, zone, grade_level, xp_reward, xp_bonus_first_try, xp_retry_penalty, content_json } = req.body;
    const patch: DbRow = {};
    if (title !== undefined) patch.title = title;
    if (type !== undefined) patch.type = type;
    if (world !== undefined) patch.world = world;
    if (zone !== undefined) patch.zone = zone;
    if (grade_level !== undefined) patch.grade_level = String(grade_level || "").trim() || null;
    if (xp_reward !== undefined) patch.xp_reward = Number(xp_reward);
    if (xp_bonus_first_try !== undefined) patch.xp_bonus_first_try = Number(xp_bonus_first_try);
    if (xp_retry_penalty !== undefined) patch.xp_retry_penalty = Number(xp_retry_penalty);
    if (content_json !== undefined) {
      patch.content_json = typeof content_json === "string" ? content_json : JSON.stringify(content_json);
    }
    if (Object.keys(patch).length === 0) return res.json({ success: true });
    await updateRow("challenges", { id }, patch);
    res.json({ success: true });
  });

  app.delete("/api/challenges/:id", requireAuth, requireRole(["teacher", "admin"]), async (req, res) => {
    const id = req.params.id;
    if (!isUuid(id)) return res.status(400).json({ error: "Invalid challenge id" });
    await deleteRows("class_challenges", { challenge_id: id });
    await deleteRows("challenge_attempts", { challenge_id: id });
    await deleteRows("challenges", { id });
    res.json({ success: true });
  });

  app.post("/api/challenges/:id/attempt", requireAuth, requireRole(["student"]), async (req, res) => {
    const challengeId = req.params.id;
    if (!isUuid(challengeId)) return res.status(400).json({ error: "Invalid challenge id" });
    const sessionUser = getReqUser(req)!;
    const challenge = await selectOne<{
      id: string;
      xp_reward: number;
      xp_bonus_first_try: number;
      xp_retry_penalty: number;
    }>("challenges", "id, xp_reward, xp_bonus_first_try, xp_retry_penalty", { id: challengeId });
    if (!challenge) return res.status(404).json({ error: "Challenge not found" });
    const { score, correct, response, time_ms } = req.body;
    const scoreNum = typeof score === "number" ? score : correct ? 1 : 0;
    const correctNum = correct === true || scoreNum >= 1 ? 1 : 0;
    const prevAttempts = await countRows("challenge_attempts", { student_id: sessionUser.id, challenge_id: challengeId });
    const attemptNumber = prevAttempts + 1;
    await insertOne("challenge_attempts", {
      student_id: sessionUser.id,
      challenge_id: challengeId,
      attempt_number: attemptNumber,
      score: scoreNum,
      correct: correctNum,
      response_json: typeof response === "string" ? response : JSON.stringify(response ?? {}),
      time_ms: time_ms ?? null,
    });
    await bumpLastActive(sessionUser.id);
    let xpEarned = 0;
    if (correctNum) {
      xpEarned =
        Number(challenge.xp_reward) +
        (attemptNumber === 1 ? Number(challenge.xp_bonus_first_try) || 0 : 0) -
        (attemptNumber > 1 ? (Number(challenge.xp_retry_penalty) || 0) * (attemptNumber - 1) : 0);
      if (xpEarned < 0) xpEarned = 0;
      const studentRow = await selectOne<{ xp: number }>("students", "xp", { id: sessionUser.id });
      await updateRow("students", { id: sessionUser.id }, { xp: (Number(studentRow?.xp) || 0) + xpEarned });
    }
    const student = await selectOne<{ xp: number }>("students", "xp", { id: sessionUser.id });
    res.json({
      success: true,
      correct: !!correctNum,
      xp_earned: xpEarned,
      total_xp: student?.xp ?? 0,
      attempt_number: attemptNumber,
    });
  });

  app.get("/api/challenges/:id/assigned-classes", requireAuth, requireRole(["teacher", "admin"]), async (req, res) => {
    const sessionUser = getReqUser(req)!;
    const challengeId = req.params.id;
    if (!isUuid(challengeId)) return res.status(400).json({ error: "Invalid challenge id" });
    let q = db().from("class_challenges").select("assigned_at, classes(id, name, teacher_id)").eq("challenge_id", challengeId);
    if (sessionUser.role === "teacher") {
      q = q.eq("classes.teacher_id", sessionUser.id);
    }
    const { data } = await q;
    const rows = (data || []).map((row: DbRow) => ({
      id: (row.classes as { id: string }).id,
      name: (row.classes as { name: string }).name,
      assigned_at: row.assigned_at,
    }));
    res.json(rows);
  });

  app.post("/api/classes/:id/challenges", requireAuth, requireRole(["teacher", "admin"]), async (req, res) => {
    const classId = req.params.id;
    if (!isUuid(classId)) return res.status(400).json({ success: false, error: "Invalid class id" });
    if (!(await ensureClassAccess(req, res, classId)).ok) return;
    const clsTrack = await selectOne<{ curriculum_track?: string | null }>("classes", "curriculum_track", { id: classId });
    if (!clsTrack) return res.status(404).json({ success: false, error: "Class not found" });
    if (!clsTrack.curriculum_track || !String(clsTrack.curriculum_track).trim()) {
      return res.status(400).json({ success: false, error: "Set curriculum track first before deploying challenges." });
    }
    const { challenge_id } = req.body;
    if (!isUuid(challenge_id)) return res.status(400).json({ error: "challenge_id required" });
    const before = await countRows("class_challenges", { class_id: classId, challenge_id });
    await insertIgnore("class_challenges", { class_id: classId, challenge_id }, "class_id,challenge_id");
    const after = await countRows("class_challenges", { class_id: classId, challenge_id });
    if (after > before) {
      const cls = await selectOne<{ name: string }>("classes", "name", { id: classId });
      const ch = await selectOne<{ title: string }>("challenges", "title", { id: challenge_id });
      const students = await selectMany<{ student_id: string }>("class_students", "student_id", { class_id: classId });
      const title = "New assignment posted";
      const message = `${ch?.title || "A new challenge"} was assigned in ${cls?.name || "your class"}.`;
      const link = `challenge:${challenge_id}`;
      for (const s of students) {
        await insertOne("notifications", {
          user_id: s.student_id,
          type: "challenge_assigned",
          title,
          message,
          link,
          is_read: false,
        });
      }
    }
    res.json({ success: true });
  });

  app.delete("/api/classes/:id/challenges/:challengeId", requireAuth, requireRole(["teacher", "admin"]), async (req, res) => {
    const classId = req.params.id;
    if (!isUuid(classId)) return res.status(400).json({ success: false, error: "Invalid class id" });
    if (!(await ensureClassAccess(req, res, classId)).ok) return;
    await deleteRows("class_challenges", { class_id: classId, challenge_id: req.params.challengeId });
    res.json({ success: true });
  });

  app.get("/api/students/:id/assigned-challenges", requireAuth, requireStudentAccess, asyncRoute(async (req, res) => {
    const studentId = req.params.id;
    const baseChallenges = await SQ.listChallengesForStudent(studentId);
    const out = [];
    for (const c of baseChallenges) {
      const { data: attempts } = await db()
        .from("challenge_attempts")
        .select("score, correct, created_at")
        .eq("student_id", studentId)
        .eq("challenge_id", c.id)
        .order("created_at", { ascending: false })
        .limit(1);
      const latest = attempts?.[0] as DbRow | undefined;
      out.push({
        ...c,
        latest_score: latest?.score ?? null,
        latest_correct: latest?.correct ?? null,
        latest_attempted_at: latest?.created_at ?? null,
      });
    }
    res.json(out);
  }));

  app.get("/api/logs", requireAuth, requireRole(["admin"]), async (_req, res) => {
    res.json(await SQ.listLogs());
  });

  app.get("/api/admin/metrics", requireAuth, requireRole(["admin"]), async (_req, res) => {
    res.json(await SQ.getAdminMetrics());
  });

  app.patch("/api/admin/students/:id", requireAuth, requireRole(["admin"]), async (req, res) => {
    const id = req.params.id;
    if (!isUuid(id)) return res.status(400).json({ success: false, message: "Invalid id" });
    const row = await selectOne("students", "id", { id });
    if (!row) return res.status(404).json({ success: false, message: "User not found" });

    const allowed = [
      "subscription_status",
      "subscription_plan",
      "billing_provider",
      "mrr_cents",
      "ltv_cents",
      "gender",
      "country_code",
      "region",
      "timezone",
    ] as const;
    const updates: Record<string, unknown> = {};
    for (const key of allowed) {
      if (req.body[key] !== undefined) updates[key] = req.body[key];
    }
    if (updates.subscription_status !== undefined) {
      const s = String(updates.subscription_status || "").trim().toLowerCase();
      const ok = ["none", "free", "trial", "active", "past_due", "canceled"].includes(s);
      if (!ok) return res.status(400).json({ success: false, message: "Invalid subscription_status" });
      updates.subscription_status = s;
    }
    if (updates.subscription_plan !== undefined) {
      updates.subscription_plan = String(updates.subscription_plan || "free").trim() || "free";
    }
    if (updates.billing_provider !== undefined) {
      const b = String(updates.billing_provider || "none").trim().toLowerCase();
      if (!["none", "manual", "stripe"].includes(b)) {
        return res.status(400).json({ success: false, message: "Invalid billing_provider" });
      }
      updates.billing_provider = b;
    }
    if (updates.mrr_cents !== undefined) {
      const n = Number(updates.mrr_cents);
      if (!Number.isFinite(n) || n < 0) return res.status(400).json({ success: false, message: "Invalid mrr_cents" });
      updates.mrr_cents = Math.round(n);
    }
    if (updates.ltv_cents !== undefined) {
      const n = Number(updates.ltv_cents);
      if (!Number.isFinite(n) || n < 0) return res.status(400).json({ success: false, message: "Invalid ltv_cents" });
      updates.ltv_cents = Math.round(n);
    }
    if (updates.gender !== undefined) {
      const g = normalizeGender(updates.gender);
      if (req.body.gender != null && String(req.body.gender).trim() !== "" && g === null) {
        return res.status(400).json({ success: false, message: "Invalid gender" });
      }
      updates.gender = g;
    }
    if (updates.country_code !== undefined) {
      const cc = normalizeCountryCode(updates.country_code);
      if (req.body.country_code != null && String(req.body.country_code).trim() !== "" && cc === null) {
        return res.status(400).json({ success: false, message: "Invalid country_code" });
      }
      updates.country_code = cc;
    }
    if (updates.region !== undefined) updates.region = String(updates.region || "").trim() || null;
    if (updates.timezone !== undefined) updates.timezone = String(updates.timezone || "").trim() || null;

    if (Object.keys(updates).length === 0) {
      return res.status(400).json({ success: false, message: "No valid fields" });
    }
    await updateRow("students", { id }, updates);
    const user = await getStudentPublic(id);
    res.json({ success: true, user: sanitizeUser(user) });
  });

  app.post("/api/missions", requireAuth, requireRole(["teacher", "admin"]), async (req, res) => {
    const { sector_id, title, description, difficulty, grade_level, xp_reward, image_url, embed_code, prerequisite_mission_id, learning_outcomes, domains } = req.body;
    const sessionUser = getReqUser(req);
    // Allow both teachers and admins to save embed/game URL (normalized on client or as raw string; sanitized below)
    const rawEmbed = typeof embed_code === "string" && embed_code.trim() ? embed_code.trim() : null;
    const safeEmbed = rawEmbed ? sanitizeEmbedCode(rawEmbed) : null;

    const safeOutcomes = Array.isArray(learning_outcomes) ? JSON.stringify(learning_outcomes.map((x) => String(x).trim()).filter(Boolean)) : null;
    const safeDomains = Array.isArray(domains) ? JSON.stringify(domains.map((x) => String(x).trim()).filter(Boolean)) : null;
    const safePrereq = isUuid(prerequisite_mission_id) ? prerequisite_mission_id : optionalUuid(prerequisite_mission_id);
    const created = await insertOne<{ id: string }>("missions", {
      sector_id: optionalUuid(sector_id) ?? sector_id,
      title,
      description,
      difficulty,
      grade_level: String(grade_level || "").trim() || null,
      xp_reward,
      status: "available",
      image_url: image_url || "https://picsum.photos/seed/mission/400/300",
      embed_code: safeEmbed,
      prerequisite_mission_id: safePrereq,
      learning_outcomes_json: safeOutcomes,
      domains_json: safeDomains,
    });
    await SQ.insertLog(`New mission deployed: ${title}`, "system", 0);
    res.json({ success: true, id: created.id });
  });

  app.post("/projects/save", requireAuth, async (req, res) => {
    const sessionUser = getReqUser(req);
    if (!sessionUser) return res.status(401).json({ success: false, message: "Unauthorized" });
    const projectId = optionalUuid(req.body?.id);
    const missionId = optionalUuid(req.body?.mission_id);
    const title = String(req.body?.title || "Arduino Project").trim();
    const workspaceJson = String(req.body?.workspace_json || "").trim();
    const generatedCode = String(req.body?.generated_code || "");
    if (!workspaceJson) {
      return res.status(400).json({ success: false, message: "workspace_json is required" });
    }

    if (projectId) {
      const existing = await selectOne<{ id: string; student_id: string }>("coding_projects", "id, student_id", {
        id: projectId,
      });
      if (!existing) return res.status(404).json({ success: false, message: "Project not found" });
      if (existing.student_id !== sessionUser.id && sessionUser.role !== "teacher" && sessionUser.role !== "admin") {
        return res.status(403).json({ success: false, message: "Forbidden" });
      }
      await updateRow("coding_projects", { id: projectId }, {
        mission_id: missionId,
        title: title || null,
        workspace_json: workspaceJson,
        generated_code: generatedCode,
      });
      return res.json({ success: true, id: projectId });
    }

    const inserted = await insertOne<{ id: string }>("coding_projects", {
      student_id: sessionUser.id,
      mission_id: missionId,
      title: title || null,
      workspace_json: workspaceJson,
      generated_code: generatedCode,
    });
    return res.json({ success: true, id: inserted.id });
  });

  app.get("/api/tool-activity/progress", requireAuth, async (req, res) => {
    const sessionUser = getReqUser(req);
    if (!sessionUser) return res.status(401).json({ success: false, message: "Unauthorized" });
    const missionId = req.query.mission_id;
    if (!isUuid(missionId)) {
      return res.status(400).json({ success: false, message: "mission_id is required" });
    }
    const { data: rows } = await db()
      .from("coding_projects")
      .select("id, workspace_json, updated_at")
      .eq("student_id", sessionUser.id)
      .eq("mission_id", missionId)
      .order("updated_at", { ascending: false })
      .limit(1);
    const row = rows?.[0] as { id: string; workspace_json: string; updated_at: string } | undefined;
    if (!row) return res.json({ success: true, save: null });
    return res.json({
      success: true,
      save: { id: row.id, workspace_json: row.workspace_json, updated_at: row.updated_at },
    });
  });

  app.post("/api/tool-activity/save", requireAuth, async (req, res) => {
    const sessionUser = getReqUser(req);
    if (!sessionUser) return res.status(401).json({ success: false, message: "Unauthorized" });
    const missionId = optionalUuid(req.body?.mission_id);
    const title = String(req.body?.title || "Tool activity").trim();
    const workspaceJson = String(req.body?.workspace_json || "").trim();
    const projectId = optionalUuid(req.body?.id);
    if (!workspaceJson) {
      return res.status(400).json({ success: false, message: "workspace_json is required" });
    }

    if (projectId) {
      const existing = await selectOne<{ id: string; student_id: string }>("coding_projects", "id, student_id", {
        id: projectId,
      });
      if (!existing) return res.status(404).json({ success: false, message: "Save not found" });
      if (existing.student_id !== sessionUser.id && sessionUser.role !== "teacher" && sessionUser.role !== "admin") {
        return res.status(403).json({ success: false, message: "Forbidden" });
      }
      await updateRow("coding_projects", { id: projectId }, {
        mission_id: missionId,
        title,
        workspace_json: workspaceJson,
      });
      return res.json({ success: true, id: projectId });
    }

    const inserted = await insertOne<{ id: string }>("coding_projects", {
      student_id: sessionUser.id,
      mission_id: missionId,
      title,
      workspace_json: workspaceJson,
      generated_code: "tool_activity",
    });
    return res.json({ success: true, id: inserted.id });
  });

  app.get("/projects/:id", requireAuth, async (req, res) => {
    const sessionUser = getReqUser(req);
    if (!sessionUser) return res.status(401).json({ success: false, message: "Unauthorized" });
    const id = req.params.id;
    if (!isUuid(id)) return res.status(400).json({ success: false, message: "Invalid project id" });
    const project = await selectOne<DbRow>(
      "coding_projects",
      "id, student_id, mission_id, title, workspace_json, generated_code, created_at, updated_at",
      { id },
    );
    if (!project) return res.status(404).json({ success: false, message: "Project not found" });
    if (project.student_id !== sessionUser.id && sessionUser.role !== "teacher" && sessionUser.role !== "admin") {
      return res.status(403).json({ success: false, message: "Forbidden" });
    }
    return res.json({ success: true, project });
  });

  // Classroom Management
  app.get("/api/classes", requireAuth, requireRole(["teacher", "admin"]), async (req, res) => {
    const sessionUser = getReqUser(req)!;
    const classes = await SQ.listClassesWithMeta(sessionUser.role === "teacher" ? sessionUser.id : undefined);
    res.json(classes);
  });

  app.get("/api/classes/:id", requireAuth, requireRole(["teacher", "admin"]), async (req, res) => {
    const id = req.params.id;
    if (!isUuid(id)) return res.status(400).json({ error: "Invalid class id" });
    if (!(await ensureClassAccess(req, res, id)).ok) return;
    const cls = await selectOne("classes", "*", { id });
    if (!cls) return res.status(404).json({ error: "Class not found" });
    res.json(cls);
  });

  const handleEnsureJoinCode = async (req: express.Request, res: express.Response) => {
    const id = req.params.id ?? req.body?.class_id;
    const classId = id != null ? String(id) : "";
    if (!isUuid(classId)) {
      return res.status(400).json({ error: "Class id required" });
    }
    if (!(await ensureClassAccess(req, res, classId)).ok) return;
    const row = await selectOne<{ id: string; join_code: string | null }>("classes", "id, join_code", { id: classId });
    if (!row) return res.status(404).json({ error: "Class not found" });
    let code = row.join_code != null && String(row.join_code).trim() !== "" ? String(row.join_code).trim() : null;
    if (!code) {
      code = await ensureUniqueJoinCode();
      await updateRow("classes", { id: row.id }, { join_code: code });
    }
    res.json({ join_code: code });
  };
  app.patch("/api/classes/:id/ensure-join-code", requireAuth, requireRole(["teacher", "admin"]), handleEnsureJoinCode);

  app.post("/api/classes", requireAuth, requireRole(["teacher", "admin"]), async (req, res) => {
    const { name, teacher_id, description, curriculum_track } = req.body;
    const sessionUser = getReqUser(req)!;
    const effectiveTeacherId = sessionUser.role === "teacher" ? sessionUser.id : String(teacher_id || "");

    const trimmedName = typeof name === "string" ? name.trim() : "";
    if (!trimmedName) {
      return res.status(400).json({ success: false, error: "Class name is required" });
    }
    if (!isUuid(effectiveTeacherId)) {
      return res.status(400).json({ success: false, error: "Invalid teacher" });
    }

    const join_code = await ensureUniqueJoinCode();
    const created = await insertOne<{ id: string }>("classes", {
      name: trimmedName,
      teacher_id: effectiveTeacherId,
      description: description || "",
      join_code,
      curriculum_track: String(curriculum_track || "").trim() || null,
    });
    const starterMissionId = await SQ.getStarterMissionId();
    if (starterMissionId) {
      await insertIgnore("class_missions", { class_id: created.id, mission_id: starterMissionId }, "class_id,mission_id");
    }
    res.json({ success: true, id: created.id, join_code });
  });

  app.patch("/api/classes/:id/curriculum", requireAuth, requireRole(["teacher", "admin"]), async (req, res) => {
    const classId = req.params.id;
    if (!isUuid(classId)) return res.status(400).json({ success: false, error: "Invalid class id" });
    if (!(await ensureClassAccess(req, res, classId)).ok) return;
    const cls = await selectOne("classes", "id", { id: classId });
    if (!cls) return res.status(404).json({ success: false, error: "Class not found" });
    const curriculumTrack = String(req.body?.curriculum_track || "").trim();
    if (!curriculumTrack) return res.status(400).json({ success: false, error: "curriculum_track is required" });
    await updateRow("classes", { id: classId }, { curriculum_track: curriculumTrack });
    res.json({ success: true, curriculum_track: curriculumTrack });
  });

  app.post("/api/classes/join", requireAuth, requireRole(["student"]), async (req, res) => {
    const { join_code } = req.body;
    const sessionUser = getReqUser(req)!;
    if (!join_code || typeof join_code !== "string") {
      return res.status(400).json({ error: "join_code required" });
    }
    const code = String(join_code).trim().toUpperCase();
    const cls = await selectOne<{ id: string; name: string }>("classes", "id, name", { join_code: code });
    if (!cls) {
      return res.status(404).json({ error: "Invalid or expired class code" });
    }
    const existing = await selectOne("class_students", "class_id", { class_id: cls.id, student_id: sessionUser.id });
    if (existing) {
      return res.status(400).json({ error: "Already in this class" });
    }
    await insertOne("class_students", { class_id: cls.id, student_id: sessionUser.id });
    await bumpLastActive(sessionUser.id);
    res.json({ success: true, class_id: cls.id, class_name: cls.name });
  });

  /** Add students to class by name list; create new accounts for names that don't exist. */
  const handleAddStudentsByNames = async (req: express.Request, res: express.Response) => {
    try {
      const id = req.params.id ?? req.body?.class_id;
      const classId = id != null ? String(id) : "";
      if (!isUuid(classId)) {
        return res.status(400).json({ success: false, error: "Invalid class id" });
      }
      if (!(await ensureClassAccess(req, res, classId)).ok) return;
      const { names } = req.body;
      const rawNames = Array.isArray(names) ? names.map((n: unknown) => String(n).trim()).filter(Boolean) : [];
      const seen = new Set<string>();
      const uniqueNames = rawNames.filter((n) => {
        const key = n.toLowerCase();
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      });

      const defaultPassword = hashPassword("password123");
      const created: string[] = [];
      let added = 0;

      const makeSyntheticEmail = (username: string) =>
        `${username}.${Date.now()}.${Math.floor(Math.random() * 1_000_000)}@students.stemverse.local`;

      for (const name of uniqueNames) {
        let row = await findStudentByName(name);
        if (!row) {
          const avatarSeed = encodeURIComponent(name.toLowerCase().replace(/\s+/g, "-"));
          const avatar_url = `https://picsum.photos/seed/${avatarSeed}/200`;
          const username = await ensureUniqueUsername(name);
          let generatedEmail: string | null = null;
          let authUserId: string | null = null;

          if (hasSupabaseAdmin && supabaseAdmin) {
            for (let i = 0; i < 3 && !authUserId; i += 1) {
              const syntheticEmail = makeSyntheticEmail(username);
              const authCreated = await supabaseAdmin.auth.admin.createUser({
                email: syntheticEmail,
                password: "password123",
                email_confirm: true,
                user_metadata: {
                  role: "student",
                  username,
                  display_name: name,
                  generated_from_teacher_roster: true,
                },
              });
              if (!authCreated.error && authCreated.data?.user?.id) {
                authUserId = authCreated.data.user.id;
                generatedEmail = syntheticEmail;
              }
            }
          }

          if (!authUserId) {
            continue;
          }

          await insertOne("students", {
            id: authUserId,
            name,
            username,
            password: defaultPassword,
            level: 1,
            xp: 0,
            avatar_url,
            role: "student",
            email: generatedEmail,
          });
          row = { id: authUserId };
          created.push(name);
        }
        const before = await countRows("class_students", { class_id: classId, student_id: String(row.id) });
        await insertIgnore("class_students", { class_id: classId, student_id: String(row.id) }, "class_id,student_id");
        const after = await countRows("class_students", { class_id: classId, student_id: String(row.id) });
        if (after > before) added += 1;
      }

      res.json({ success: true, created, added });
    } catch (e: unknown) {
      const err = e as Error;
      console.error("by-names error:", e);
      res.status(500).json({ success: false, error: err?.message || "Failed to add students" });
    }
  };
  app.post("/api/classes/:id/add-students-by-names", requireAuth, requireRole(["teacher", "admin"]), handleAddStudentsByNames);

  app.post("/api/classes/:id/students/bulk", requireAuth, requireRole(["teacher", "admin"]), async (req, res) => {
    const classId = req.params.id;
    if (!isUuid(classId)) return res.status(400).json({ success: false, error: "Invalid class id" });
    if (!(await ensureClassAccess(req, res, classId)).ok) return;
    const { student_ids } = req.body;
    const ids = Array.isArray(student_ids)
      ? student_ids.map((x: unknown) => String(x)).filter((s) => isUuid(s))
      : [];
    let added = 0;
    for (const sid of ids) {
      const before = await countRows("class_students", { class_id: classId, student_id: sid });
      await insertIgnore("class_students", { class_id: classId, student_id: sid }, "class_id,student_id");
      const after = await countRows("class_students", { class_id: classId, student_id: sid });
      if (after > before) added += 1;
    }
    res.json({ success: true, added, total: ids.length });
  });

  app.post("/api/classes/:id/students", requireAuth, requireRole(["teacher", "admin"]), async (req, res) => {
    const classId = req.params.id;
    if (!isUuid(classId)) return res.status(400).json({ success: false, error: "Invalid class id" });
    if (!(await ensureClassAccess(req, res, classId)).ok) return;
    const { student_id } = req.body;
    if (!isUuid(student_id)) return res.status(400).json({ success: false, error: "Invalid student id" });
    await insertIgnore("class_students", { class_id: classId, student_id }, "class_id,student_id");
    res.json({ success: true });
  });

  app.post("/api/classes/:id/missions", requireAuth, requireRole(["teacher", "admin"]), async (req, res) => {
    const classId = req.params.id;
    if (!isUuid(classId)) return res.status(400).json({ success: false, error: "Invalid class id" });
    if (!(await ensureClassAccess(req, res, classId)).ok) return;
    const cls = await selectOne<{ curriculum_track?: string | null }>("classes", "curriculum_track", { id: classId });
    if (!cls) return res.status(404).json({ success: false, error: "Class not found" });
    if (!cls.curriculum_track || !String(cls.curriculum_track).trim()) {
      return res.status(400).json({ success: false, error: "Set curriculum track first before deploying missions." });
    }
    const { mission_id } = req.body;
    if (!isUuid(mission_id)) return res.status(400).json({ success: false, error: "Invalid mission id" });
    await insertIgnore("class_missions", { class_id: classId, mission_id }, "class_id,mission_id");
    res.json({ success: true });
  });

  app.post("/api/classes/:id/quizzes", requireAuth, requireRole(["teacher", "admin"]), async (req, res) => {
    const classId = req.params.id;
    if (!isUuid(classId)) return res.status(400).json({ success: false, error: "Invalid class id" });
    if (!(await ensureClassAccess(req, res, classId)).ok) return;
    const cls = await selectOne<{ curriculum_track?: string | null }>("classes", "curriculum_track", { id: classId });
    if (!cls) return res.status(404).json({ success: false, error: "Class not found" });
    if (!cls.curriculum_track || !String(cls.curriculum_track).trim()) {
      return res.status(400).json({ success: false, error: "Set curriculum track first before deploying quizzes." });
    }
    const { quiz_id } = req.body;
    if (!isUuid(quiz_id)) return res.status(400).json({ success: false, error: "Invalid quiz id" });
    await insertIgnore("class_quizzes", { class_id: classId, quiz_id }, "class_id,quiz_id");
    res.json({ success: true });
  });

  app.get("/api/classes/:id/content", requireAuth, requireRole(["teacher", "admin"]), async (req, res) => {
    const classId = req.params.id;
    if (!isUuid(classId)) return res.status(400).json({ success: false, error: "Invalid class id" });
    if (!(await ensureClassAccess(req, res, classId)).ok) return;
    const { data: cm } = await db().from("class_missions").select("mission_id").eq("class_id", classId);
    const missionIds = (cm || []).map((r) => (r as { mission_id: string }).mission_id);
    const missions = missionIds.length
      ? await db().from("missions").select("*").in("id", missionIds)
      : { data: [] };
    const { data: cq } = await db().from("class_quizzes").select("quiz_id").eq("class_id", classId);
    const quizIds = (cq || []).map((r) => (r as { quiz_id: string }).quiz_id);
    const quizzes = quizIds.length ? await db().from("quizzes").select("*").in("id", quizIds) : { data: [] };
    const { data: cc } = await db().from("class_challenges").select("challenge_id").eq("class_id", classId);
    const challengeIds = (cc || []).map((r) => (r as { challenge_id: string }).challenge_id);
    const challenges = challengeIds.length
      ? await db().from("challenges").select("*").in("id", challengeIds)
      : { data: [] };
    res.json({ missions: missions.data || [], quizzes: quizzes.data || [], challenges: challenges.data || [] });
  });

  app.delete("/api/classes/:id/missions/:missionId", requireAuth, requireRole(["teacher", "admin"]), async (req, res) => {
    const classId = req.params.id;
    if (!isUuid(classId)) return res.status(400).json({ success: false, error: "Invalid class id" });
    if (!(await ensureClassAccess(req, res, classId)).ok) return;
    await deleteRows("class_missions", { class_id: classId, mission_id: req.params.missionId });
    res.json({ success: true });
  });

  app.delete("/api/classes/:id/quizzes/:quizId", requireAuth, requireRole(["teacher", "admin"]), async (req, res) => {
    const classId = req.params.id;
    if (!isUuid(classId)) return res.status(400).json({ success: false, error: "Invalid class id" });
    if (!(await ensureClassAccess(req, res, classId)).ok) return;
    await deleteRows("class_quizzes", { class_id: classId, quiz_id: req.params.quizId });
    res.json({ success: true });
  });

  // Student Progress (students can only read own data)
  app.get("/api/students/:id/progress", requireAuth, requireStudentAccess, asyncRoute(async (req, res) => {
    const studentId = req.params.id;
    const badges = await selectMany("student_badges", "*", { student_id: studentId });
    const sqRows = await selectMany<DbRow>("student_quizzes", "*", { student_id: studentId });
    const quizzes = [];
    for (const sq of sqRows) {
      const q = await selectOne<{ title: string }>("quizzes", "title", { id: String(sq.quiz_id) });
      quizzes.push({ ...sq, title: q?.title });
    }
    const missions_completed = await countRows("student_mission_completions", { student_id: studentId });
    res.json({ badges, quizzes, missions_completed });
  }));

  app.get("/api/students/:id/interests", requireAuth, requireStudentAccess, asyncRoute(async (req, res) => {
    const selected = await selectMany<{ interest_key: string }>(
      "student_interest_votes",
      "interest_key",
      { student_id: req.params.id },
      { column: "weight", ascending: false },
    );
    res.json({ success: true, selected: selected.map((r) => r.interest_key) });
  }));

  app.post("/api/students/:id/interests", requireAuth, requireStudentAccess, asyncRoute(async (req, res) => {
    const studentId = req.params.id;
    const incoming = Array.isArray(req.body?.selected) ? req.body.selected : [];
    const selected = [...new Set(incoming.map((x: unknown) => String(x || "").trim().toLowerCase()).filter(Boolean))].slice(0, 6);
    if (selected.length < 2) {
      return res.status(400).json({ success: false, message: "Select at least 2 interests." });
    }
    await deleteRows("student_interest_votes", { student_id: studentId });
    await insertMany(
      "student_interest_votes",
      selected.map((key: string, idx: number) => ({
        student_id: studentId,
        interest_key: key,
        weight: Math.max(1, selected.length - idx),
      })),
    );
    res.json({ success: true, selected });
  }));

  app.get("/api/students/:id/assigned-quizzes", requireAuth, requireStudentAccess, asyncRoute(async (req, res) => {
    const studentId = req.params.id;
    const { data: classRows } = await db().from("class_students").select("class_id").eq("student_id", studentId);
    const classIds = (classRows || []).map((r) => (r as { class_id: string }).class_id);
    const quizIdSet = new Set<string>();
    if (classIds.length) {
      const { data: cq } = await db().from("class_quizzes").select("quiz_id").in("class_id", classIds);
      for (const row of cq || []) quizIdSet.add((row as { quiz_id: string }).quiz_id);
    }
    const out: DbRow[] = [];
    for (const qid of quizIdSet) {
      const q = await selectOne<DbRow>("quizzes", "*", { id: qid });
      if (!q) continue;
      const { data: sqRows } = await db()
        .from("student_quizzes")
        .select("*")
        .eq("student_id", studentId)
        .eq("quiz_id", qid)
        .order("completed_at", { ascending: false })
        .limit(1);
      const latest = sqRows?.[0] as DbRow | undefined;
      out.push({
        ...q,
        latest_score: latest?.score ?? null,
        latest_total_questions: latest?.total_questions ?? null,
        latest_completed_at: latest?.completed_at ?? null,
        latest_pending_reviews: latest?.pending_reviews ?? null,
      });
    }
    out.sort((a, b) => String(b.created_at).localeCompare(String(a.created_at)));
    return res.json(out);
  }));

  app.get("/api/students/:id/assigned-missions", requireAuth, requireStudentAccess, asyncRoute(async (req, res) => {
    const studentId = req.params.id;
    const completions = await selectMany<{ mission_id: string; completed_at: string }>(
      "student_mission_completions",
      "mission_id, completed_at",
      { student_id: studentId },
    );
    const completedMap = new Map(completions.map((c) => [c.mission_id, c.completed_at]));
    const { data: classRows } = await db().from("class_students").select("class_id").eq("student_id", studentId);
    const classIds = (classRows || []).map((r) => (r as { class_id: string }).class_id);
    let missionIds: string[] = [];
    if (classIds.length) {
      const { data: cm } = await db().from("class_missions").select("mission_id").in("class_id", classIds);
      missionIds = [...new Set((cm || []).map((r) => (r as { mission_id: string }).mission_id))];
    }
    let missions: DbRow[] = [];
    if (missionIds.length) {
      const all = await selectMany<DbRow>("missions", "*");
      missions = all.filter((m) => missionIds.includes(String(m.id)));
    }
    if (!missions.length) {
      const studentRow = await selectOne<{ grade?: string | null }>("students", "grade", { id: studentId });
      const normalizedGrade = String(studentRow?.grade || "").trim().toLowerCase();
      const all = await selectMany<DbRow>("missions", "*", { status: "available" });
      missions = all
        .filter((m) => {
          if (!normalizedGrade) return true;
          const gl = String(m.grade_level || "").trim().toLowerCase();
          return !gl || gl === normalizedGrade;
        })
        .slice(0, 24);
    }
    const filtered = missions.filter((m) => {
      const prereq = m.prerequisite_mission_id as string | null;
      if (!prereq) return true;
      if (completedMap.has(prereq)) return true;
      if (completedMap.has(String(m.id))) return true;
      return false;
    });
    const withCompleted = filtered.map((m) => ({
      ...m,
      latest_completed_at: completedMap.get(String(m.id)) ?? null,
    }));
    return res.json(withCompleted);
  }));

  app.post("/api/students/:id/missions/:missionId/complete", requireAuth, requireStudentAccess, async (req, res) => {
    const studentId = req.params.id;
    const missionId = req.params.missionId;
    const sessionUser = getReqUser(req)!;
    if (sessionUser.id !== studentId) return res.status(403).json({ error: "Forbidden" });
    await insertIgnore(
      "student_mission_completions",
      { student_id: studentId, mission_id: missionId },
      "student_id,mission_id",
    );
    await bumpLastActive(studentId);
    res.json({ success: true });
  });

  app.get("/api/students/:id/classes", requireAuth, requireStudentAccess, async (req, res) => {
    const studentId = req.params.id;
    const { data: memberships } = await db().from("class_students").select("class_id").eq("student_id", studentId);
    const classIds = (memberships || []).map((m) => (m as { class_id: string }).class_id);
    const out = [];
    for (const cid of classIds) {
      const c = await selectOne<DbRow>("classes", "*", { id: cid });
      if (!c) continue;
      const teacher = c.teacher_id
        ? await selectOne<{ name: string }>("students", "name", { id: String(c.teacher_id) })
        : null;
      const student_count = await countRows("class_students", { class_id: cid });
      out.push({ ...c, teacher_name: teacher?.name, student_count });
    }
    res.json(out);
  });

  app.get("/api/students/:id/classmates", requireAuth, requireStudentAccess, async (req, res) => {
    const studentId = req.params.id;
    const { data: myClasses } = await db().from("class_students").select("class_id").eq("student_id", studentId);
    const classIds = (myClasses || []).map((r) => (r as { class_id: string }).class_id);
    if (!classIds.length) return res.json([]);
    const { data: peers } = await db().from("class_students").select("student_id").in("class_id", classIds);
    const peerIds = [...new Set((peers || []).map((p) => (p as { student_id: string }).student_id))].filter(
      (id) => id !== studentId,
    );
    const classmates = [];
    for (const pid of peerIds) {
      const s = await selectOne<DbRow>("students", "id, name, level, xp, avatar_url, role", { id: pid });
      if (s && s.role === "student") classmates.push(s);
    }
    classmates.sort((a, b) => Number(b.xp) - Number(a.xp));
    res.json(classmates);
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

  app.get("/api/teacher/quiz-reviews/pending", requireAuth, requireRole(["teacher", "admin"]), async (req, res) => {
    const sessionUser = getReqUser(req)!;
    const classIdRaw = req.query.class_id;
    const classId = classIdRaw != null && String(classIdRaw).trim() ? String(classIdRaw) : null;
    if (classId && !isUuid(classId)) return res.status(400).json({ error: "Invalid class_id" });

    const pending = await selectMany<DbRow>("quiz_review_items", "*", { review_status: "pending" }, {
      column: "created_at",
      ascending: true,
    });
    const rows: DbRow[] = [];
    for (const qri of pending) {
      const csRows = await selectMany<{ class_id: string }>("class_students", "class_id", { student_id: qri.student_id });
      let allowed = false;
      for (const cs of csRows) {
        const cq = await selectOne("class_quizzes", "class_id", { class_id: cs.class_id, quiz_id: qri.quiz_id });
        if (!cq) continue;
        const cls = await selectOne<{ teacher_id: string }>("classes", "teacher_id", { id: cs.class_id });
        if (!cls) continue;
        if (classId && cs.class_id !== classId) continue;
        if (sessionUser.role === "admin" || cls.teacher_id === sessionUser.id) {
          allowed = true;
          break;
        }
      }
      if (!allowed) continue;
      const student = await selectOne<{ name: string }>("students", "name", { id: qri.student_id });
      const quiz = await selectOne<{ title: string }>("quizzes", "title", { id: qri.quiz_id });
      rows.push({
        id: qri.id,
        student_quiz_id: qri.student_quiz_id,
        student_id: qri.student_id,
        student_name: student?.name ?? "",
        quiz_id: qri.quiz_id,
        quiz_title: quiz?.title ?? "",
        question_index: qri.question_index,
        prompt: qri.prompt,
        response_text: qri.response_text,
        max_score: qri.max_score,
        created_at: qri.created_at,
      });
    }
    res.json(rows);
  });

  app.post("/api/teacher/quiz-reviews/:id/grade", requireAuth, requireRole(["teacher", "admin"]), async (req, res) => {
    const sessionUser = getReqUser(req)!;
    const reviewId = req.params.id;
    const awardedRaw = Number(req.body?.awarded_score);
    if (!isUuid(reviewId)) {
      return res.status(400).json({ success: false, message: "Invalid review id" });
    }

    const qri = await selectOne<DbRow>("quiz_review_items", "*", { id: reviewId });
    if (!qri) return res.status(404).json({ success: false, message: "Review item not found" });

    const csRows = await selectMany<{ class_id: string }>("class_students", "class_id", { student_id: qri.student_id });
    let teacherId: string | null = null;
    let hasAccess = false;
    for (const cs of csRows) {
      const cq = await selectOne("class_quizzes", "class_id", { class_id: cs.class_id, quiz_id: qri.quiz_id });
      if (!cq) continue;
      const cls = await selectOne<{ teacher_id: string }>("classes", "teacher_id", { id: cs.class_id });
      if (!cls) continue;
      teacherId = cls.teacher_id;
      hasAccess = true;
      break;
    }
    if (!hasAccess) return res.status(404).json({ success: false, message: "Review item not found" });
    if (sessionUser.role !== "admin" && teacherId !== sessionUser.id) {
      return res.status(403).json({ success: false, message: "Forbidden" });
    }
    if (qri.review_status !== "pending") {
      return res.status(400).json({ success: false, message: "This item is already reviewed" });
    }

    const awarded = Math.max(0, Math.min(Number(qri.max_score || 1), Number.isFinite(awardedRaw) ? awardedRaw : 0));
    await updateRow("quiz_review_items", { id: reviewId }, {
      awarded_score: awarded,
      review_status: "reviewed",
      reviewed_by: sessionUser.id,
      reviewed_at: new Date().toISOString(),
    });

    const allReviews = await selectMany<DbRow>("quiz_review_items", "awarded_score, review_status", {
      student_quiz_id: qri.student_quiz_id,
    });
    const reviewedSum = allReviews.reduce((sum, r) => sum + Number(r.awarded_score || 0), 0);
    const pendingCount = allReviews.filter((r) => r.review_status === "pending").length;

    const base = await selectOne<{ auto_score: number; total_questions: number }>("student_quizzes", "auto_score, total_questions", {
      id: qri.student_quiz_id,
    });
    if (base) {
      const total = Number(base.total_questions || 0);
      const combined = Math.max(0, Math.min(total, Number(base.auto_score || 0) + reviewedSum));
      await updateRow("student_quizzes", { id: qri.student_quiz_id }, {
        reviewed_score: reviewedSum,
        pending_reviews: pendingCount,
        score: combined,
      });
    }

    res.json({ success: true });
  });

  app.get("/api/report-card/:classId", requireAuth, requireRole(["teacher", "admin"]), async (req, res) => {
    const classId = req.params.classId;
    if (!isUuid(classId)) return res.status(400).json({ error: "Invalid class id" });
    if (!(await ensureClassAccess(req, res, classId)).ok) return;

    const roster = await selectMany<{ student_id: string }>("class_students", "student_id", { class_id: classId });
    const base: DbRow[] = [];
    for (const { student_id } of roster) {
      const s = await getStudentPublic(student_id);
      if (!s) continue;
      const quizzes = await selectMany<{ score: number; total_questions: number }>("student_quizzes", "score, total_questions", {
        student_id,
      });
      const quizzes_completed = quizzes.length;
      const scored = quizzes.filter((q) => Number(q.total_questions) > 0);
      const avg_quiz_score =
        scored.length > 0
          ? (scored.reduce((sum, q) => sum + Number(q.score) / Number(q.total_questions), 0) / scored.length) * 100
          : 0;
      base.push({
        id: s.id,
        name: s.name,
        level: s.level,
        xp: s.xp,
        quizzes_completed,
        avg_quiz_score,
      });
    }

    const mkRow = (row: DbRow) => {
      const avg = Number(row.avg_quiz_score || 0);
      const quizzes = Number(row.quizzes_completed || 0);
      const level = Number(row.level || 1);
      const xp = Number(row.xp || 0);
      const masteryDomains = avg >= 80 ? ["Core problem solving", "Scientific reasoning"] : ["Core problem solving"];
      const skillsLearned = [
        "Perseverance on multi-step problems",
        avg >= 70 ? "Conceptual understanding" : "Foundational recall",
        quizzes >= 5 ? "Assessment stamina" : "Early assessment practice",
      ];
      const topicsCovered = [
        "STEMverse missions and quizzes completed in this class",
        "Teacher-created challenges mapped to current units",
      ];
      let band = "Developing";
      if (avg >= 85 && level >= 20) band = "Exceeds expectations";
      else if (avg >= 70) band = "On track";
      const aiAssessment = `
${row.name} is currently level ${level} with ${xp} XP in this class. 
They have completed ${quizzes} recorded simulations/quizzes with an average score of ${Math.round(avg)}%.
Overall performance band: ${band}. Students in this band typically show ${band === "Exceeds expectations" ? "strong independent problem solving and can transfer skills to new contexts" : band === "On track" ? "solid understanding of the core objectives and are ready to deepen their skills" : "emerging skills and benefit from more guided practice and feedback"}.
Key focus for next term: continue to strengthen conceptual reasoning while applying skills across different mission types.
`.trim();
      return {
        ...row,
        mastery_domains: masteryDomains,
        skills_learned: skillsLearned,
        topics_covered: topicsCovered,
        ai_assessment: aiAssessment,
      };
    };

    res.json(base.map(mkRow));
  });

  app.post("/api/logs", requireAuth, requireRole(["teacher", "admin"]), async (req, res) => {
    const { message, type, xp_change } = req.body;
    await SQ.insertLog(message, type, xp_change);
    res.json({ success: true });
  });

  app.get("/api/me", requireAuth, async (req, res) => {
    const sessionUser = getReqUser(req);
    if (!sessionUser) return res.status(401).json({ authenticated: false });
    const user = await getStudentPublic(sessionUser.id);
    if (!user) {
      return res.status(401).json({ authenticated: false });
    }
    await bumpLastActive(sessionUser.id);
    res.json({ authenticated: true, user });
  });

  app.patch("/api/me", requireAuth, async (req, res) => {
    const sessionUser = getReqUser(req)!;
    const allowed = [
      "name",
      "avatar_url",
      "age",
      "grade",
      "school",
      "city",
      "email",
      "parent_email",
      "contact_number",
      "gender",
      "country_code",
      "region",
      "timezone",
    ];
    const updates: Record<string, unknown> = {};
    for (const key of allowed) {
      if (req.body[key] !== undefined) updates[key] = req.body[key];
    }
    if (updates.gender !== undefined) {
      const g = normalizeGender(updates.gender);
      if (req.body.gender != null && String(req.body.gender).trim() !== "" && g === null) {
        return res.status(400).json({ success: false, message: "Invalid gender value" });
      }
      updates.gender = g;
    }
    if (updates.country_code !== undefined) {
      const cc = normalizeCountryCode(updates.country_code);
      if (req.body.country_code != null && String(req.body.country_code).trim() !== "" && cc === null) {
        return res.status(400).json({ success: false, message: "country_code must be ISO 3166-1 alpha-2 (e.g. US)" });
      }
      updates.country_code = cc;
    }
    if (updates.region !== undefined) {
      updates.region = String(updates.region || "").trim() || null;
    }
    if (updates.timezone !== undefined) {
      updates.timezone = String(updates.timezone || "").trim() || null;
    }
    if (Object.keys(updates).length === 0) {
      return res.status(400).json({ success: false, message: "No valid fields to update" });
    }
    await updateRow("students", { id: sessionUser.id }, updates);
    const user = await getStudentPublic(sessionUser.id);
    res.json({ success: true, user: sanitizeUser(user) });
  });

  app.post("/api/me/change-password", requireAuth, async (req, res) => {
    const sessionUser = getReqUser(req)!;
    const { current_password, new_password } = req.body;
    if (!current_password || !new_password) {
      return res.status(400).json({ success: false, message: "Current password and new password required" });
    }
    if (new_password.length < 6) {
      return res.status(400).json({ success: false, message: "New password must be at least 6 characters" });
    }
    const row = await selectOne<{ email?: string | null }>("students", "email", { id: sessionUser.id });
    const email = String(row?.email || "").trim();
    const supabaseUserId = sessionUser.id;
    if (!email || !isUuid(supabaseUserId) || !hasSupabaseAdmin || !supabaseAdmin) {
      return res.status(400).json({ success: false, message: "Password change requires a Supabase-linked account with email." });
    }
    const supabasePublic = getSupabasePublicClient();
    if (!supabasePublic) {
      return res.status(500).json({ success: false, message: "Supabase environment is not configured." });
    }
    const verify = await supabasePublic.auth.signInWithPassword({ email, password: current_password });
    if (verify.error) {
      return res.status(401).json({ success: false, message: "Current password is incorrect" });
    }
    const updated = await supabaseAdmin.auth.admin.updateUserById(supabaseUserId, { password: new_password });
    if (updated.error) {
      return res.status(400).json({ success: false, message: updated.error.message || "Could not update password" });
    }
    await updateRow("students", { id: sessionUser.id }, { password: hashPassword(new_password) });
    res.json({ success: true });
  });

  app.post("/api/logout", async (req, res) => {
    const token = req.headers.authorization?.split("Bearer ")[1];
    if (token && supabaseAdmin) {
      try {
        const adminAuth = supabaseAdmin.auth.admin as {
          signOut: (idOrJwt: string, scope?: "global" | "local" | "others") => Promise<{ error: unknown }>;
        };
        await adminAuth.signOut(token, "global");
      } catch {
        const { data } = await supabaseAdmin.auth.getUser(token);
        if (data?.user) {
          await supabaseAdmin.auth.admin.signOut(data.user.id, "global");
        }
      }
    }
    res.json({ success: true });
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

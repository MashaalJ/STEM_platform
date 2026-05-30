/**
 * One-off: strip SQLite bootstrap from server.ts and apply baseline Supabase refactors.
 * Run: node scripts/convert-server-supabase.mjs
 */
import fs from "fs";
import path from "path";

const serverPath = path.join(process.cwd(), "server.ts");
let src = fs.readFileSync(serverPath, "utf8");

const startIdx = src.indexOf("async function startServer");
if (startIdx < 0) throw new Error("startServer not found");
let body = src.slice(startIdx);

const preamble = `import "dotenv/config";
import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import { fileURLToPath } from "url";
import bcrypt from "bcryptjs";
import { createClient } from "@supabase/supabase-js";
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

// Schema managed in Supabase dashboard

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const hashPassword = (plain: string) => bcrypt.hashSync(plain, 12);

const ALLOWED_GENDERS = new Set(["female", "male", "non_binary", "prefer_not_say", "other"]);

const normalizeGender = (raw: unknown): string | null => {
  const s = String(raw || "").trim().toLowerCase().replace(/[\\s-]+/g, "_");
  if (!s) return null;
  if (s === "nonbinary") return "non_binary";
  if (ALLOWED_GENDERS.has(s)) return s;
  return null;
};

const normalizeCountryCode = (raw: unknown): string | null => {
  const s = String(raw || "").trim().toUpperCase();
  if (s.length === 2 && /^[A-Z]{2}$/.test(s)) return s;
  return null;
};

const DARK_CITY_SECTOR_NAME = "Dark City";
const ELECTRICITY_PRE_FLOW_EMBED = "stemverse://electricity-pre-flow";

const STUDENT_SELECT_LOGIN = \`\${STUDENT_SELECT_PUBLIC.replace("role, age", "role, password, age")}\`;

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
  const base = raw.toLowerCase().trim().replace(/\\s+/g, "").replace(/[^a-z0-9_]/g, "");
  return base || "player";
};

const ensureUniqueUsername = async (raw: string): Promise<string> => {
  const base = normalizeUsername(raw);
  let candidate = base;
  let i = 1;
  while (await usernameExists(candidate)) {
    i += 1;
    candidate = \`\${base}\${i}\`;
  }
  return candidate;
};

const isBcryptHash = (s: string | null) => typeof s === "string" && /^\\$2[aby]\\$\\d+\\$/.test(s);

/** Idempotent: ensure Dark City starter planet + electricity pre-flow mission exist and are assigned. */
async function ensureDarkCityStarterContent() {
  let sector = await findSectorByName(DARK_CITY_SECTOR_NAME);

  if (!sector) {
    const nonStarters = await selectMany<{ id: string; sort_order?: number }>("sectors", "id, sort_order", undefined, {
      column: "sort_order",
      ascending: true,
    });
    for (const s of nonStarters) {
      if (!(s as { is_starter?: boolean }).is_starter) {
        await updateRow("sectors", { id: s.id }, { sort_order: (Number(s.sort_order) || 0) + 1 });
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
    await updateRow(
      "sectors",
      { id: sector.id as string },
      {
        sort_order: 0,
        is_starter: true,
        status: "active",
        required_level: 1,
        description: "Restore power to the grid. Learn circuits and LEDs with NOVA in the neon dark.",
      },
    );
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

async function bootstrapData() {
  const sectorCount = await countRows("sectors");
  if (sectorCount === 0) {
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

  const nullJoinClasses = await db()
    .from("classes")
    .select("id")
    .or("join_code.is.null,join_code.eq.");
  for (const row of nullJoinClasses.data || []) {
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
      .or(\`email.ilike.\${email},name.ilike.\${name}\`)
      .limit(1);
    const row = rows?.[0] as { id: string; password?: string } | undefined;
    if (!row) {
      continue;
    }
    if (!isBcryptHash(row.password || null)) {
      await updateRow("students", { id: row.id }, { password: hashPassword(password) });
    }
    await updateRow("students", { id: row.id }, {
      name,
      username,
      email,
      role,
    });
  }

  try {
    await db().from("students").update({
      gender: "male",
      country_code: "US",
      region: "CA",
      subscription_status: "trial",
      subscription_plan: "pro",
      billing_provider: "manual",
      mrr_cents: 0,
    }).ilike("email", "student@example.com");
    await db().from("students").update({
      gender: "female",
      country_code: "CA",
      region: "ON",
      subscription_status: "active",
      subscription_plan: "school",
      billing_provider: "manual",
      mrr_cents: 2999,
      ltv_cents: 8997,
    }).ilike("email", "teacher@example.com");
    await db().from("students").update({
      country_code: "US",
      subscription_status: "free",
      subscription_plan: "free",
      billing_provider: "none",
      mrr_cents: 0,
    }).ilike("email", "admin@example.com");
  } catch {
    /* ignore */
  }
}

`;

// Baseline textual replacements on startServer body
body = body.replace(/type SessionUser = \{ id: number;/, "type SessionUser = { id: string;");

body = body.replace(
  /const getSupabasePublicClient = \(\) => \{[\s\S]*?\};/,
  `const getSupabasePublicClient = () => {
    const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || "";
    if (!supabaseUrl || !supabaseAnonKey) return null;
    return createClient(supabaseUrl, supabaseAnonKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
  };`,
);

body = body.replace(
  /await ensureBuiltinTestAccounts\(\);/,
  `await bootstrapData();\n  try {\n    await ensureBuiltinTestAccounts();\n  } catch (err) {
    console.warn(
      "Supabase test account sync skipped:",
      err instanceof Error ? err.message : err,
    );
  }`,
);

body = body.replace(
  /try \{\s*await ensureBuiltinTestAccounts\(\);\s*\} catch \(err\) \{[\s\S]*?\}\s*\n\s*\n\s*app\.get\("\/api\/auth\/health"/,
  `app.get("/api/auth/health"`,
);

body = body.replace(
  /const supabaseAnonKey = process\.env\.VITE_SUPABASE_ANON_KEY \|\| "";/g,
  "const anonKey = supabaseAnonKey;",
);
body = body.replace(/has_supabase_anon_key: Boolean\(supabaseAnonKey\)/, "has_supabase_anon_key: Boolean(anonKey)");
body = body.replace(/if \(!supabaseUrl \|\| !supabaseAnonKey\)/g, "if (!supabaseUrl || !anonKey)");

fs.writeFileSync(serverPath, preamble + body);
console.log("Wrote", serverPath, "— run manual fixes + npm run lint");

import "dotenv/config";
import express from "express";
import { createServer as createViteServer } from "vite";
import Database from "better-sqlite3";
import path from "path";
import { fileURLToPath } from "url";
import bcrypt from "bcryptjs";
import cookieSession from "cookie-session";
import { createClient } from "@supabase/supabase-js";
import { supabaseAdmin, hasSupabaseAdmin } from "./lib/supabaseAdmin";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DB_PATH = process.env.DB_PATH || "stemverse.db";
const db = new Database(DB_PATH);

const hashPassword = (plain: string) => bcrypt.hashSync(plain, 12);

// Initialize Database
db.exec(`
  CREATE TABLE IF NOT EXISTS sectors (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    description TEXT,
    xp_reward INTEGER,
    required_level INTEGER,
    mastery_percent INTEGER DEFAULT 0,
    status TEXT DEFAULT 'locked',
    image_url TEXT
  );

  CREATE TABLE IF NOT EXISTS missions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    sector_id INTEGER,
    title TEXT NOT NULL,
    description TEXT,
    difficulty TEXT,
    xp_reward INTEGER,
    status TEXT DEFAULT 'available',
    image_url TEXT,
    embed_code TEXT,
    grade_level TEXT,
    prerequisite_mission_id INTEGER,
    learning_outcomes_json TEXT,
    domains_json TEXT,
    FOREIGN KEY(sector_id) REFERENCES sectors(id)
  );

  CREATE TABLE IF NOT EXISTS classes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    teacher_id INTEGER,
    description TEXT,
    curriculum_track TEXT,
    FOREIGN KEY(teacher_id) REFERENCES students(id)
  );

  CREATE TABLE IF NOT EXISTS class_students (
    class_id INTEGER,
    student_id INTEGER,
    PRIMARY KEY(class_id, student_id),
    FOREIGN KEY(class_id) REFERENCES classes(id),
    FOREIGN KEY(student_id) REFERENCES students(id)
  );

  CREATE TABLE IF NOT EXISTS class_missions (
    class_id INTEGER,
    mission_id INTEGER,
    assigned_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY(class_id, mission_id),
    FOREIGN KEY(class_id) REFERENCES classes(id),
    FOREIGN KEY(mission_id) REFERENCES missions(id)
  );

  CREATE TABLE IF NOT EXISTS class_quizzes (
    class_id INTEGER,
    quiz_id INTEGER,
    assigned_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY(class_id, quiz_id),
    FOREIGN KEY(class_id) REFERENCES classes(id),
    FOREIGN KEY(quiz_id) REFERENCES quizzes(id)
  );

  CREATE TABLE IF NOT EXISTS student_badges (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    student_id INTEGER,
    badge_name TEXT NOT NULL,
    badge_icon TEXT,
    earned_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(student_id) REFERENCES students(id)
  );

  CREATE TABLE IF NOT EXISTS student_mission_completions (
    student_id INTEGER NOT NULL,
    mission_id INTEGER NOT NULL,
    completed_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY(student_id, mission_id),
    FOREIGN KEY(student_id) REFERENCES students(id),
    FOREIGN KEY(mission_id) REFERENCES missions(id)
  );

  CREATE TABLE IF NOT EXISTS student_quizzes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    student_id INTEGER,
    quiz_id INTEGER,
    score INTEGER,
    auto_score INTEGER DEFAULT 0,
    reviewed_score INTEGER DEFAULT 0,
    pending_reviews INTEGER DEFAULT 0,
    total_questions INTEGER,
    completed_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(student_id) REFERENCES students(id),
    FOREIGN KEY(quiz_id) REFERENCES quizzes(id)
  );

  CREATE TABLE IF NOT EXISTS quiz_review_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    student_quiz_id INTEGER NOT NULL,
    student_id INTEGER NOT NULL,
    quiz_id INTEGER NOT NULL,
    question_index INTEGER NOT NULL,
    question_type TEXT NOT NULL,
    prompt TEXT,
    response_text TEXT,
    max_score INTEGER DEFAULT 1,
    awarded_score INTEGER DEFAULT 0,
    review_status TEXT DEFAULT 'pending',
    reviewed_by INTEGER,
    reviewed_at DATETIME,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(student_quiz_id) REFERENCES student_quizzes(id),
    FOREIGN KEY(student_id) REFERENCES students(id),
    FOREIGN KEY(quiz_id) REFERENCES quizzes(id),
    FOREIGN KEY(reviewed_by) REFERENCES students(id)
  );
  CREATE INDEX IF NOT EXISTS idx_quiz_review_items_pending ON quiz_review_items(review_status, created_at);
  CREATE INDEX IF NOT EXISTS idx_quiz_review_items_student_quiz ON quiz_review_items(student_quiz_id);

  CREATE TABLE IF NOT EXISTS students (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    username TEXT,
    password TEXT DEFAULT 'password123',
    level INTEGER DEFAULT 1,
    xp INTEGER DEFAULT 0,
    avatar_url TEXT,
    role TEXT CHECK(role IN ('student', 'teacher', 'admin')) DEFAULT 'student',
    age INTEGER,
    grade TEXT,
    school TEXT,
    city TEXT,
    email TEXT,
    parent_email TEXT,
    contact_number TEXT
  );

  CREATE TABLE IF NOT EXISTS quizzes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    grade_level TEXT,
    questions TEXT, -- JSON string
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS challenges (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    type TEXT NOT NULL,
    world TEXT,
    zone TEXT,
    grade_level TEXT,
    xp_reward INTEGER DEFAULT 100,
    xp_bonus_first_try INTEGER DEFAULT 0,
    xp_retry_penalty INTEGER DEFAULT 0,
    content_json TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS challenge_attempts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    student_id INTEGER NOT NULL,
    challenge_id INTEGER NOT NULL,
    attempt_number INTEGER DEFAULT 1,
    score REAL NOT NULL,
    correct INTEGER NOT NULL,
    response_json TEXT,
    time_ms INTEGER,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (student_id) REFERENCES students(id),
    FOREIGN KEY (challenge_id) REFERENCES challenges(id)
  );

  CREATE TABLE IF NOT EXISTS class_challenges (
    class_id INTEGER NOT NULL,
    challenge_id INTEGER NOT NULL,
    assigned_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (class_id, challenge_id),
    FOREIGN KEY (class_id) REFERENCES classes(id),
    FOREIGN KEY (challenge_id) REFERENCES challenges(id)
  );

  CREATE TABLE IF NOT EXISTS notifications (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    type TEXT NOT NULL,
    title TEXT NOT NULL,
    message TEXT NOT NULL,
    link TEXT,
    is_read INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES students(id)
  );

  CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON notifications(user_id);
  CREATE INDEX IF NOT EXISTS idx_notifications_user_read ON notifications(user_id, is_read);

  CREATE TABLE IF NOT EXISTS logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
    message TEXT NOT NULL,
    type TEXT,
    xp_change INTEGER
  );

  CREATE TABLE IF NOT EXISTS ai_usage_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    endpoint TEXT NOT NULL,
    user_id INTEGER,
    success INTEGER DEFAULT 1,
    reason TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );
  CREATE INDEX IF NOT EXISTS idx_ai_usage_logs_created_at ON ai_usage_logs(created_at);
  CREATE INDEX IF NOT EXISTS idx_ai_usage_logs_endpoint_created ON ai_usage_logs(endpoint, created_at);
  CREATE INDEX IF NOT EXISTS idx_ai_usage_logs_user_created ON ai_usage_logs(user_id, created_at);

  CREATE TABLE IF NOT EXISTS student_interest_votes (
    student_id INTEGER NOT NULL,
    interest_key TEXT NOT NULL,
    weight INTEGER DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY(student_id, interest_key),
    FOREIGN KEY(student_id) REFERENCES students(id)
  );
  CREATE INDEX IF NOT EXISTS idx_student_interest_votes_interest ON student_interest_votes(interest_key);
`);

// Add Supabase linkage columns without requiring a destructive migration.
try {
  db.exec("ALTER TABLE students ADD COLUMN supabase_user_id TEXT");
} catch {}
try {
  db.exec("CREATE UNIQUE INDEX IF NOT EXISTS idx_students_supabase_user_id ON students(supabase_user_id)");
} catch {}
try {
  db.exec("CREATE UNIQUE INDEX IF NOT EXISTS idx_students_username_nocase ON students(username COLLATE NOCASE)");
} catch {}

const ALLOWED_GENDERS = new Set(["female", "male", "non_binary", "prefer_not_say", "other"]);

const normalizeGender = (raw: unknown): string | null => {
  const s = String(raw || "").trim().toLowerCase().replace(/[\s-]+/g, "_");
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

/** Idempotent column adds for analytics / billing (existing DBs). */
const STUDENT_ANALYTICS_ALTER = [
  "ALTER TABLE students ADD COLUMN created_at DATETIME",
  "ALTER TABLE students ADD COLUMN gender TEXT",
  "ALTER TABLE students ADD COLUMN country_code TEXT",
  "ALTER TABLE students ADD COLUMN region TEXT",
  "ALTER TABLE students ADD COLUMN timezone TEXT",
  "ALTER TABLE students ADD COLUMN subscription_status TEXT DEFAULT 'free'",
  "ALTER TABLE students ADD COLUMN subscription_plan TEXT DEFAULT 'free'",
  "ALTER TABLE students ADD COLUMN billing_provider TEXT DEFAULT 'none'",
  "ALTER TABLE students ADD COLUMN mrr_cents INTEGER DEFAULT 0",
  "ALTER TABLE students ADD COLUMN ltv_cents INTEGER DEFAULT 0",
  "ALTER TABLE students ADD COLUMN last_active_at DATETIME",
];
for (const stmt of STUDENT_ANALYTICS_ALTER) {
  try {
    db.exec(stmt);
  } catch (e: any) {
    if (!/duplicate column name/i.test(e?.message || "")) {
      console.warn("students migration:", stmt, e?.message);
    }
  }
}

const STUDENT_QUIZZES_ALTER = [
  "ALTER TABLE student_quizzes ADD COLUMN auto_score INTEGER DEFAULT 0",
  "ALTER TABLE student_quizzes ADD COLUMN reviewed_score INTEGER DEFAULT 0",
  "ALTER TABLE student_quizzes ADD COLUMN pending_reviews INTEGER DEFAULT 0",
];
for (const stmt of STUDENT_QUIZZES_ALTER) {
  try {
    db.exec(stmt);
  } catch (e: any) {
    if (!/duplicate column name/i.test(e?.message || "")) {
      console.warn("student_quizzes migration:", stmt, e?.message);
    }
  }
}

const MISSIONS_ALTER = [
  "ALTER TABLE missions ADD COLUMN prerequisite_mission_id INTEGER",
  "ALTER TABLE missions ADD COLUMN learning_outcomes_json TEXT",
  "ALTER TABLE missions ADD COLUMN domains_json TEXT",
  "ALTER TABLE missions ADD COLUMN grade_level TEXT",
];
for (const stmt of MISSIONS_ALTER) {
  try {
    db.exec(stmt);
  } catch (e: any) {
    if (!/duplicate column name/i.test(e?.message || "")) {
      console.warn("missions migration:", stmt, e?.message);
    }
  }
}

const QUIZZES_ALTER = ["ALTER TABLE quizzes ADD COLUMN grade_level TEXT"];
for (const stmt of QUIZZES_ALTER) {
  try {
    db.exec(stmt);
  } catch (e: any) {
    if (!/duplicate column name/i.test(e?.message || "")) {
      console.warn("quizzes migration:", stmt, e?.message);
    }
  }
}

const CHALLENGES_ALTER = ["ALTER TABLE challenges ADD COLUMN grade_level TEXT"];
for (const stmt of CHALLENGES_ALTER) {
  try {
    db.exec(stmt);
  } catch (e: any) {
    if (!/duplicate column name/i.test(e?.message || "")) {
      console.warn("challenges migration:", stmt, e?.message);
    }
  }
}

try {
  db.exec(`UPDATE students SET created_at = CURRENT_TIMESTAMP WHERE created_at IS NULL`);
} catch {
  /* ignore */
}

const STUDENT_SELECT_PUBLIC =
  "id, name, username, level, xp, avatar_url, role, age, grade, school, city, email, parent_email, contact_number, created_at, gender, country_code, region, timezone, subscription_status, subscription_plan, billing_provider, mrr_cents, ltv_cents, last_active_at";

const STUDENT_SELECT_LOGIN = `${STUDENT_SELECT_PUBLIC.replace(
  "role, age",
  "role, password, age",
)}`;

const lastActiveThrottle = new Map<number, number>();
const LAST_ACTIVE_MIN_MS = 15 * 60 * 1000;

const bumpLastActive = (userId: number) => {
  if (!Number.isInteger(userId) || userId < 1) return;
  const now = Date.now();
  const prev = lastActiveThrottle.get(userId) || 0;
  if (now - prev < LAST_ACTIVE_MIN_MS) return;
  lastActiveThrottle.set(userId, now);
  try {
    db.prepare("UPDATE students SET last_active_at = CURRENT_TIMESTAMP WHERE id = ?").run(userId);
  } catch {
    /* ignore */
  }
};

// Migration: add join_code to classes if missing
try {
  db.exec(`ALTER TABLE classes ADD COLUMN join_code TEXT;`);
} catch (e: any) {
  if (!/duplicate column name/i.test(e?.message || "")) throw e;
}
try {
  db.exec(`ALTER TABLE classes ADD COLUMN curriculum_track TEXT;`);
} catch (e: any) {
  if (!/duplicate column name/i.test(e?.message || "")) throw e;
}
// Backfill join_code for existing classes (run after ensureUniqueJoinCode is defined below)

const generateJoinCode = (): string => {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "";
  for (let i = 0; i < 6; i++) code += chars[Math.floor(Math.random() * chars.length)];
  return code;
};

const ensureUniqueJoinCode = (): string => {
  let code = generateJoinCode();
  const exists = db.prepare("SELECT 1 FROM classes WHERE join_code = ?").get(code);
  if (exists) return ensureUniqueJoinCode();
  return code;
};

const normalizeUsername = (raw: string): string => {
  const base = raw.toLowerCase().trim().replace(/\s+/g, "").replace(/[^a-z0-9_]/g, "");
  return base || "player";
};

const ensureUniqueUsername = (raw: string): string => {
  const base = normalizeUsername(raw);
  let candidate = base;
  let i = 1;
  while (db.prepare("SELECT 1 FROM students WHERE username = ? COLLATE NOCASE LIMIT 1").get(candidate)) {
    i += 1;
    candidate = `${base}${i}`;
  }
  return candidate;
};

// Backfill join_code for existing classes
const nullJoinCodes = db.prepare("SELECT id FROM classes WHERE join_code IS NULL OR join_code = ''").all() as { id: number }[];
const updateJoinCode = db.prepare("UPDATE classes SET join_code = ? WHERE id = ?");
nullJoinCodes.forEach((row) => {
  updateJoinCode.run(ensureUniqueJoinCode(), row.id);
});

// Migration: Add password column if it doesn't exist
try {
  db.prepare("ALTER TABLE students ADD COLUMN password TEXT DEFAULT 'password123'").run();
} catch (e) {
  // Column already exists
}

// Migration: Add role check if needed (SQLite doesn't support easy check constraint changes, but we can ensure the column exists)
try {
  db.prepare("ALTER TABLE students ADD COLUMN role TEXT DEFAULT 'student'").run();
} catch (e) {
  // Column already exists
}

// Migration: Add additional profile fields if they don't exist
for (const column of [
  "username TEXT",
  "age INTEGER",
  "grade TEXT",
  "school TEXT",
  "city TEXT",
  "email TEXT",
  "parent_email TEXT",
  "contact_number TEXT",
]) {
  try {
    db.prepare(`ALTER TABLE students ADD COLUMN ${column}`).run();
  } catch (e) {
    // Column already exists
  }
}

// Seed initial data if empty
const sectorCount = db.prepare("SELECT COUNT(*) as count FROM sectors").get() as { count: number };
if (sectorCount.count === 0) {
  const insertSector = db.prepare("INSERT INTO sectors (name, description, xp_reward, required_level, mastery_percent, status, image_url) VALUES (?, ?, ?, ?, ?, ?, ?)");
  insertSector.run("Quantum Mechanics", "Navigate the subatomic world.", 1000, 1, 100, "active", "https://lh3.googleusercontent.com/aida-public/AB6AXuDXHBpzwclGGdMn6hXD2NIggtnHTgO40Tn-JWyUpvmQTs-J9le-zT-UJrgi1VWc2tYhx8kmdgcvm5GdfblMLlGaNKc8VXekyIv1yOEcjXCTd5zi2paH3Ijf86_uiT_u5th485TnF65Y5IyPSaHJyiAUbHBy8UCLZoaZ38bIX-EEz6Y49gbzLhlh6ZRlaowrvba-T0woONYDwbNWBj2WzkeTXmyTjfuwN4e2AlT8ICLOiOiLJRlJq57Sux0F8YfloV_MixuF4Say-Qgc");
  insertSector.run("Robotics Lab", "Build and program advanced automatons.", 1000, 10, 0, "maintenance", "https://lh3.googleusercontent.com/aida-public/AB6AXuDVea3b3rIa3oFe4eljXprd3h6SQUlc9O7_CIe3IIB3XTdw4l_1Q8Oy2tVhhveJaWU-_TXuzey3qqk9tiZpplM0DVtpMO05SYgTiNdirAx9iaMf8dHsDLiiXGfQmL5o9lyl31CPpzgKeFX_GOOlnyKZwiA2Rv4MXj0iR5dFDFvsuj-vm4-gdNP_rWCARfIggBjG9AqTJNredrtmNLciGG4kkKdHbloafqaujzhYbuAlLlD52mtfA-MzvvW54uppyW37_FxRR_N9eZL3");
  insertSector.run("Bio-Engineering", "Edit the code of life itself.", 1000, 20, 68, "active", "https://lh3.googleusercontent.com/aida-public/AB6AXuBZVjiI-ihuKWjerO_v5LRt1eAcUZVNUN2GPHVWKcIM_1aMWZqppLwtzIGbOrE0NbY7jVFmmvXRO4qtf8pd1URIIp4KodOdPEcumtJan8d9XULDBPjqAncMyxSCQ8m0dsbBb5i2Q3xUpbWhwm3_DDRhDg4sXbFpC7-n_SillCtE0zS5aFrCnEXELsjDgArVzxOPHpE6CGENZQ08jC6Z_ftiSibXwCgNcogES4QeDtOqNO3NgW_Fn20P2MycTXxZDppbr4oXSH3bLW19");
  insertSector.run("Astrophysics", "Explore the mysteries of the cosmos.", 1200, 15, 0, "locked", "https://lh3.googleusercontent.com/aida-public/AB6AXuBqBx-UKRVrJND2UTvghlrFvdPgdX0b87Nhg_r940aHk8howkvoyFhj44MDXEIkalOB7qHtunXockNyxBH6YItau2fFbJwBTlhk6NPt5fvNBkY3eqW5MOfY_Qn8-rH0vauyiUIVT_3vdpUeHXO-HG81MGYrZwFQA6CQ-g42o-xfDs9OzAa6kqhprizFXlAwj9M7EQE9Bl81e8wB89h9cUMBPTBPJcCJy-hyWtYMo8LgauetV_xLsnJubM1NGbvFi6H3LviT_RyK-yF3");
  
  const insertMission = db.prepare("INSERT INTO missions (sector_id, title, description, difficulty, xp_reward, status, image_url) VALUES (?, ?, ?, ?, ?, ?, ?)");
  insertMission.run(3, "Protein Folding Protocol", "Master the 3D geometry of amino acids.", "Hard", 500, "available", "https://lh3.googleusercontent.com/aida-public/AB6AXuBTnHhMk1Nhi765AAmaKvSiMJImDRG4oTQ1kmGGFapcUkh4rq3o0Jl349xR26hdbA7f4XfqqFv8cefjXtobBbuQ4ozwEN5kqFkvItAiZAo9-fZjxy5kmDYBVExp9pr8DVUj4TxODYISMJO8ZHXJ7GHZ6bcfFHzkswGM_MEi0eMXkWrEtQ7EgHJcOr9WlEp1eAypnP27jHg5uX4bx-HOXYhWUvcgX6VEwn-Ud6itbZQ3fGy2GhrhhSyvc1YZ6wSiCE5W5feMB181yyDs");
  insertMission.run(3, "Enzyme Matcher", "Catalyze chemical reactions.", "Medium", 350, "available", "https://lh3.googleusercontent.com/aida-public/AB6AXuAwcHWGbjlsrOR2oCWHOJLI34ZupiabZlWa-UJhEhoI8HRq4Ha5flXhG4I7GKSchD3YSZJY1LEgRgCJ8s-kG3oCpu3XV-Wp6yaRZw34aSw6FoFsu5tvSQeDICvVIodY8FaU_vta-rDeRcfQfcETjbv0z6zl7aWEp-yJoodRWCQQaJmY4R9YVq9kJf4FLuH-ew4fOqHQklxNRe_t9eCOuy_SNCD2eauNa0X1xjiOt0-eSObzUO92OHdC_gYOnBR09NDKEQQAYcavh_wC");
}

const studentCount = db.prepare("SELECT COUNT(*) as count FROM students").get() as { count: number };
if (studentCount.count === 0) {
  const insertStudent = db.prepare("INSERT INTO students (name, password, level, xp, avatar_url, role) VALUES (?, ?, ?, ?, ?, ?)");
  insertStudent.run("Alex Rivera", hashPassword("student123"), 24, 2400, "https://lh3.googleusercontent.com/aida-public/AB6AXuBGs2llALBKq9Rb7P9C8nAY2mYk963EhuwdMC2TX5aZ7RNBDSRI0O_uc5RVbLF31T7rIrnUdAmjmS0UKDL-RMkmX8syI6qtUoFqvHHE2tv9kzwKj34qwZUMyO-UVvfIFtMEozkoth1VRxbawNDHHr9G2HNEyrPsQt1yae30Hr0jJ1QQkXFjuVlxcV85UvNiHiYFdqviKHGW2_ZWmjPJPIG_OD3CdBWJSG32Jq6Jl0U_BLuR6W_ijCpW94vmdrfEFJo-AXgu_UwJDW82", "student");
  insertStudent.run("Professor Nova", hashPassword("teacher123"), 50, 10000, "https://picsum.photos/seed/teacher/200", "teacher");
  insertStudent.run("Admin Core", hashPassword("admin123"), 99, 99999, "https://picsum.photos/seed/admin/200", "admin");
}

// Ensure demo accounts always have correct bcrypt passwords (fixes DBs created before hashing or with plain-text default)
const DEMO_ACCOUNTS = [
  { name: "Alex Rivera", username: "alexrivera", email: "student@example.com", role: "student", password: "student123" },
  { name: "Professor Nova", username: "professornova", email: "teacher@example.com", role: "teacher", password: "teacher123" },
  { name: "Admin Core", username: "admincore", email: "admin@example.com", role: "admin", password: "admin123" },
] as const;
const isBcryptHash = (s: string | null) => typeof s === "string" && /^\$2[aby]\$\d+\$/.test(s);
const updatePasswordById = db.prepare("UPDATE students SET password = ? WHERE id = ?");
for (const { name, username, email, role, password } of DEMO_ACCOUNTS) {
  const row = db
    .prepare("SELECT id, password FROM students WHERE name = ? COLLATE NOCASE OR email = ? COLLATE NOCASE LIMIT 1")
    .get(name, email) as { id: number; password: string } | undefined;
  if (!row) {
    const insertStudent = db.prepare(
      "INSERT INTO students (name, username, password, level, xp, avatar_url, role, email) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
    );
    insertStudent.run(
      name,
      username,
      hashPassword(password),
      role === "admin" ? 99 : role === "teacher" ? 50 : 24,
      role === "admin" ? 99999 : role === "teacher" ? 10000 : 2400,
      `https://picsum.photos/seed/${encodeURIComponent(username)}/200`,
      role,
      email,
    );
    continue;
  }
  if (!isBcryptHash(row.password)) updatePasswordById.run(hashPassword(password), row.id);
  db.prepare("UPDATE students SET name = ?, username = COALESCE(username, ?), email = COALESCE(email, ?), role = ? WHERE id = ?")
    .run(name, username, email, role, row.id);
}

/** Sample demographics / billing for dev quick-access accounts (idempotent). */
try {
  db.prepare(
    `UPDATE students SET gender = 'male', country_code = 'US', region = 'CA', created_at = COALESCE(created_at, CURRENT_TIMESTAMP),
     subscription_status = 'trial', subscription_plan = 'pro', billing_provider = 'manual', mrr_cents = 0
     WHERE email = 'student@example.com' COLLATE NOCASE`,
  ).run();
  db.prepare(
    `UPDATE students SET gender = 'female', country_code = 'CA', region = 'ON', created_at = COALESCE(created_at, CURRENT_TIMESTAMP),
     subscription_status = 'active', subscription_plan = 'school', billing_provider = 'manual', mrr_cents = 2999, ltv_cents = 8997
     WHERE email = 'teacher@example.com' COLLATE NOCASE`,
  ).run();
  db.prepare(
    `UPDATE students SET country_code = 'US', subscription_status = 'free', subscription_plan = 'free', billing_provider = 'none', mrr_cents = 0
     WHERE email = 'admin@example.com' COLLATE NOCASE`,
  ).run();
} catch {
  /* ignore */
}

async function startServer() {
  const isProduction = process.env.NODE_ENV === "production";
  const ENABLE_TEST_ACCOUNTS =
    String(process.env.ENABLE_TEST_ACCOUNTS || "true").toLowerCase() === "true";
  const ALLOW_LOCAL_AUTH_FALLBACK =
    String(process.env.ALLOW_LOCAL_AUTH_FALLBACK || (isProduction ? "false" : "true")).toLowerCase() === "true";
  const SESSION_SECRET = process.env.SESSION_SECRET || "dev-change-me-please";
  if (isProduction && (!SESSION_SECRET || SESSION_SECRET === "dev-change-me-please")) {
    console.error("FATAL: Set SESSION_SECRET to a long random string in production (e.g. 32+ chars).");
    process.exit(1);
  }

  const app = express();
  const PORT = Number(process.env.PORT) || 3000;
  // Required on platforms like Render/Cloud Run so secure cookies work behind a reverse proxy.
  app.set("trust proxy", 1);

  // Security headers (reduce XSS, clickjacking, MIME sniffing)
  app.use((_req, res, next) => {
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("X-Frame-Options", "DENY");
    res.setHeader("X-XSS-Protection", "1; mode=block");
    if (isProduction) {
      res.setHeader("Strict-Transport-Security", "max-age=31536000; includeSubDomains");
    }
    next();
  });

  app.use(express.json({ limit: "256kb" }));

  app.use(
    cookieSession({
      name: "stemverse_sess",
      keys: [SESSION_SECRET],
      maxAge: 1000 * 60 * 60 * 24 * 7, // 7 days
      httpOnly: true,
      secure: isProduction,
      sameSite: "lax",
    }),
  );

  type SessionUser = { id: number; name: string; role: string };

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
    // Plain URL (http/https)
    if (/^https?:\/\/[^\s<>"']+$/i.test(s)) {
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

  const getAiUsageCountToday = (endpoint?: string, userId?: number) => {
    if (endpoint && userId != null) {
      const row = db
        .prepare(
          `SELECT COUNT(*) as count
           FROM ai_usage_logs
           WHERE date(created_at) = date('now')
             AND endpoint = ?
             AND user_id = ?`,
        )
        .get(endpoint, userId) as { count: number };
      return Number(row?.count || 0);
    }
    if (endpoint) {
      const row = db
        .prepare(
          `SELECT COUNT(*) as count
           FROM ai_usage_logs
           WHERE date(created_at) = date('now')
             AND endpoint = ?`,
        )
        .get(endpoint) as { count: number };
      return Number(row?.count || 0);
    }
    const row = db
      .prepare(`SELECT COUNT(*) as count FROM ai_usage_logs WHERE date(created_at) = date('now')`)
      .get() as { count: number };
    return Number(row?.count || 0);
  };

  const logAiUsage = (endpoint: "generate_quiz" | "recommendations", userId: number, success: 0 | 1, reason?: string) => {
    db.prepare("INSERT INTO ai_usage_logs (endpoint, user_id, success, reason) VALUES (?, ?, ?, ?)")
      .run(endpoint, userId, success, reason || null);
  };

  const checkAndLogAiQuota = (endpoint: "generate_quiz" | "recommendations", userId: number) => {
    const globalCount = getAiUsageCountToday();
    if (globalCount >= AI_DAILY_GLOBAL_LIMIT) {
      logAiUsage(endpoint, userId, 0, "global_limit");
      return {
        ok: false,
        message: "AI daily platform limit reached. Please try again tomorrow.",
      } as const;
    }
    const perUserLimit = endpoint === "generate_quiz" ? AI_DAILY_QUIZ_LIMIT_PER_USER : AI_DAILY_RECOMMEND_LIMIT_PER_USER;
    const userCount = getAiUsageCountToday(endpoint, userId);
    if (userCount >= perUserLimit) {
      logAiUsage(endpoint, userId, 0, "user_limit");
      return {
        ok: false,
        message: `Daily AI limit reached for this feature (${perUserLimit}/day). Please try again tomorrow.`,
      } as const;
    }
    logAiUsage(endpoint, userId, 1, "accepted");
    return { ok: true, message: "" } as const;
  };

  /** Map Supabase user + metadata to a local SQLite students row (numeric id) for existing app APIs. */
  const linkSupabaseUserToLocalStudent = (
    sbUser: { id: string; email?: string | null },
    metadata: Record<string, any>,
  ): SessionUser | undefined => {
    const email = sbUser.email || null;
    const rawRole = String(metadata.role || "student").toLowerCase();
    const desiredRole =
      rawRole === "teacher" || rawRole === "educator" ? "teacher" : rawRole === "admin" ? "admin" : "student";
    const displayName = String(
      metadata.display_name || metadata.full_name || metadata.name || (email ? email.split("@")[0] : "Student"),
    ).trim();
    const preferredUsername = ensureUniqueUsername(displayName);
    const avatarSeed = encodeURIComponent(displayName.toLowerCase().replace(/\s+/g, "-"));

    let localUser = db
      .prepare(
        "SELECT id, name, role, username FROM students WHERE supabase_user_id = ? OR (email IS NOT NULL AND email = ?) LIMIT 1",
      )
      .get(sbUser.id, email) as (SessionUser & { username?: string | null }) | undefined;

    if (!localUser) {
      const inserted = db
        .prepare(
          `INSERT INTO students
           (name, username, password, level, xp, avatar_url, role, email, supabase_user_id, created_at, subscription_status, subscription_plan, billing_provider, mrr_cents, ltv_cents)
           VALUES (?, ?, ?, 1, 0, ?, ?, ?, ?, CURRENT_TIMESTAMP, 'free', 'free', 'none', 0, 0)`,
        )
        .run(
          displayName,
          preferredUsername,
          hashPassword(String(Math.random())),
          `https://picsum.photos/seed/${avatarSeed}/200`,
          desiredRole,
          email,
          sbUser.id,
        );
      localUser = db.prepare("SELECT id, name, role, username FROM students WHERE id = ?").get(inserted.lastInsertRowid) as (SessionUser & { username?: string | null }) | undefined;
    } else {
      db.prepare("UPDATE students SET supabase_user_id = ?, email = COALESCE(email, ?) WHERE id = ?").run(sbUser.id, email, localUser.id);
      if (!localUser.username) {
        const generated = ensureUniqueUsername(displayName);
        db.prepare("UPDATE students SET username = ? WHERE id = ?").run(generated, localUser.id);
      }
    }
    return localUser ? { id: localUser.id, name: localUser.name, role: localUser.role } : undefined;
  };

  const ensureBuiltinTestAccounts = async () => {
    if (!hasSupabaseAdmin || !supabaseAdmin) return;
    if (String(process.env.ENABLE_TEST_ACCOUNTS || "true").toLowerCase() === "false") return;

    const accounts = [
      { email: "student@example.com", password: "student123", role: "student", name: "Alex Rivera" },
      { email: "teacher@example.com", password: "teacher123", role: "teacher", name: "Professor Nova" },
      { email: "admin@example.com", password: "admin123", role: "admin", name: "Admin Core" },
    ] as const;

    const asSupabaseRole = (role: string) => (role === "teacher" ? "educator" : role);

    const listed = await supabaseAdmin.auth.admin.listUsers({ page: 1, perPage: 1000 });
    const byEmail = new Map<string, string>();
    for (const u of listed.data?.users || []) {
      if (u.email) byEmail.set(u.email.toLowerCase(), u.id);
    }

    for (const account of accounts) {
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
        if (!updated.error && updated.data?.user) finalId = updated.data.user.id;
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
        if (!created.error && created.data?.user) finalId = created.data.user.id;
      }

      if (!finalId) continue;

      const linked = linkSupabaseUserToLocalStudent(
        { id: finalId, email },
        { role: asSupabaseRole(account.role), display_name: account.name, name: account.name },
      );
      if (linked) {
        const username = ensureUniqueUsername(account.name);
        db.prepare(
          `UPDATE students
           SET name = ?, role = ?, email = COALESCE(email, ?), username = COALESCE(username, ?), password = ?, supabase_user_id = ?
           WHERE id = ?`,
        ).run(account.name, account.role, email, username, hashPassword(account.password), finalId, linked.id);
      }
    }
  };

  await ensureBuiltinTestAccounts();

  app.get("/api/auth/health", (_req, res) => {
    const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || "";
    const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY || "";
    const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
    const hasSessionSecret = Boolean(process.env.SESSION_SECRET && String(process.env.SESSION_SECRET).trim().length > 0);
    res.json({
      success: true,
      auth: {
        mode: hasSupabaseAdmin ? "supabase" : "local",
        has_supabase_admin: hasSupabaseAdmin,
        has_supabase_url: Boolean(supabaseUrl),
        has_supabase_anon_key: Boolean(supabaseAnonKey),
        has_supabase_service_role_key: Boolean(supabaseServiceRoleKey),
        has_session_secret: hasSessionSecret,
        allow_local_auth_fallback: ALLOW_LOCAL_AUTH_FALLBACK,
        enable_test_accounts: String(process.env.ENABLE_TEST_ACCOUNTS || "true").toLowerCase() === "true",
      },
    });
  });

  const requireAuth: express.RequestHandler = async (req, res, next) => {
    const sessionUser = (req.session as any)?.user as SessionUser | undefined;
    if (sessionUser) return next();

    // Supabase bearer auth fallback for API routes (production-safe, key stays server-side).
    const authHeader = req.headers.authorization || "";
    const tokenMatch = authHeader.match(/^Bearer\s+(.+)$/i);
    const token = tokenMatch?.[1];
    if (!token || !hasSupabaseAdmin || !supabaseAdmin) {
      return res.status(401).json({ success: false, message: "Unauthorized" });
    }

    const { data, error } = await supabaseAdmin.auth.getUser(token);
    if (error || !data?.user) {
      return res.status(401).json({ success: false, message: "Unauthorized" });
    }
    const sbUser = data.user;
    const metadata = (sbUser.user_metadata || {}) as Record<string, any>;
    const localUser = linkSupabaseUserToLocalStudent(sbUser, metadata);

    if (!localUser) return res.status(401).json({ success: false, message: "Unauthorized" });
    (req.session as any).user = { id: localUser.id, name: localUser.name, role: localUser.role };
    next();
  };

  const requireRole = (roles: Array<SessionUser["role"]>): express.RequestHandler => {
    return (req, res, next) => {
      const user = (req.session as any)?.user as SessionUser | undefined;
      if (!user || !roles.includes(user.role)) {
        return res.status(403).json({ success: false, message: "Forbidden" });
      }
      next();
    };
  };

  /** Students can only access their own id; teachers/admins can access any student. */
  const requireStudentAccess: express.RequestHandler = (req, res, next) => {
    const user = (req.session as any)?.user as SessionUser | undefined;
    if (!user) return res.status(401).json({ success: false, message: "Unauthorized" });
    const studentId = Number(req.params.id);
    if (Number.isNaN(studentId)) return res.status(400).json({ success: false, message: "Invalid id" });
    if (user.role === "student" && user.id !== studentId) {
      return res.status(403).json({ success: false, message: "Forbidden" });
    }
    next();
  };

  const ensureClassAccess = (req: express.Request, res: express.Response, classId: number): { ok: boolean } => {
    const user = (req.session as any)?.user as SessionUser | undefined;
    if (!user) {
      res.status(401).json({ success: false, message: "Unauthorized" });
      return { ok: false };
    }
    const cls = db.prepare("SELECT id, teacher_id FROM classes WHERE id = ?").get(classId) as { id: number; teacher_id: number } | undefined;
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

  // API Routes
  app.get("/api/sectors", (req, res) => {
    const sectors = db.prepare("SELECT * FROM sectors").all();
    res.json(sectors);
  });

  app.get("/api/sectors/:id", (req, res) => {
    const sector = db.prepare("SELECT * FROM sectors WHERE id = ?").get(req.params.id);
    if (!sector) return res.status(404).json({ error: "Sector not found" });
    res.json(sector);
  });

  app.post("/api/sectors", requireAuth, requireRole(["admin"]), (req, res) => {
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

    const insert = db.prepare(
      "INSERT INTO sectors (name, description, xp_reward, required_level, mastery_percent, status, image_url) VALUES (?, ?, ?, ?, ?, ?, ?)"
    );
    const result = insert.run(
      trimmedName,
      safeDescription,
      safeXp,
      safeRequiredLevel,
      safeMastery,
      safeStatus,
      safeImageUrl
    );
    const created = db.prepare("SELECT * FROM sectors WHERE id = ?").get(result.lastInsertRowid);
    return res.json({ success: true, sector: created });
  });

  /** Missions in this sector. Students see only missions assigned to their class(es); teachers/admins see all. */
  app.get("/api/sectors/:id/missions", requireAuth, (req, res) => {
    const sectorId = req.params.id;
    const sector = db.prepare("SELECT * FROM sectors WHERE id = ?").get(sectorId);
    if (!sector) return res.status(404).json({ error: "Sector not found" });

    const sessionUser = (req.session as any)?.user as SessionUser;
    let missions: unknown[];

    let completedMissionIds: number[] = [];
    if (sessionUser.role === "student") {
      const rows = db
        .prepare(
          `SELECT DISTINCT
             m.*,
             CASE
               WHEN m.prerequisite_mission_id IS NOT NULL
                    AND m.prerequisite_mission_id NOT IN (
                      SELECT smc.mission_id FROM student_mission_completions smc WHERE smc.student_id = ?
                    )
               THEN 'locked'
               ELSE COALESCE(m.status, 'available')
             END AS status
           FROM missions m
           JOIN class_missions cm ON cm.mission_id = m.id
           JOIN class_students cs ON cs.class_id = cm.class_id
           WHERE cs.student_id = ? AND m.sector_id = ?
           ORDER BY m.id`
        )
        .all(sessionUser.id, sessionUser.id, sectorId);
      missions = rows;
      const completed = db
        .prepare(
          `SELECT mission_id FROM student_mission_completions WHERE student_id = ? AND mission_id IN (SELECT id FROM missions WHERE sector_id = ?)`
        )
        .all(sessionUser.id, sectorId) as { mission_id: number }[];
      completedMissionIds = completed.map((c) => c.mission_id);
    } else {
      missions = db.prepare("SELECT * FROM missions WHERE sector_id = ? ORDER BY id").all(sectorId);
    }

    res.json({ missions, completedMissionIds });
  });

  app.get("/api/students", requireAuth, (req, res) => {
    const sessionUser = (req.session as any)?.user as SessionUser;
    if (sessionUser.role === "admin") {
      const students = db.prepare("SELECT " + STUDENT_SELECT_PUBLIC + " FROM students ORDER BY id").all();
      return res.json(students);
    }
    const students = db.prepare("SELECT id, name, level, xp, avatar_url, role FROM students").all();
    res.json(students);
  });

  app.post("/api/students", (req, res) => {
    const { name, level, xp, avatar_url, role, password } = req.body;
    const insert = db.prepare("INSERT INTO students (name, level, xp, avatar_url, role, password) VALUES (?, ?, ?, ?, ?, ?)");
    const result = insert.run(
      name,
      level || 1,
      xp || 0,
      avatar_url || "https://picsum.photos/seed/user/200",
      role || "student",
      hashPassword(password || "password123"),
    );
    res.json({ success: true, id: result.lastInsertRowid });
  });

  app.get("/api/schools", (_req, res) => {
    const rows = db
      .prepare(
        `SELECT DISTINCT TRIM(school) AS school
         FROM students
         WHERE school IS NOT NULL AND TRIM(school) <> ''
         ORDER BY school COLLATE NOCASE`,
      )
      .all() as Array<{ school: string }>;
    res.json(rows.map((r) => r.school));
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

    const avatarSeed = encodeURIComponent(name.trim().toLowerCase().replace(/\s+/g, "-"));
    const avatar_url = `https://picsum.photos/seed/${avatarSeed}/200`;
    const username = ensureUniqueUsername(name);

    // Supabase-first signup path
    if (hasSupabaseAdmin && supabaseAdmin) {
      const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || "";
      const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY || "";
      if (!supabaseUrl || !supabaseAnonKey) {
        return res.status(500).json({ success: false, message: "Supabase environment is not configured." });
      }
      const supabasePublic = createClient(supabaseUrl, supabaseAnonKey, {
        auth: { autoRefreshToken: false, persistSession: false },
      });
      const mappedRole = role === "teacher" ? "educator" : role;
      const signUp = await supabasePublic.auth.signUp({
        email,
        password,
        options: {
          data: {
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
        },
      });
      if (signUp.error || !signUp.data.user) {
        const msg = String(signUp.error?.message || "Signup failed");
        if (/already|exists|registered/i.test(msg)) {
          // If account exists, allow immediate sign-in with provided password to avoid signup/login loops.
          const existingSignIn = await supabasePublic.auth.signInWithPassword({ email, password });
          if (!existingSignIn.error && existingSignIn.data.user) {
            const existingMeta = (existingSignIn.data.user.user_metadata || {}) as Record<string, any>;
            const linked = linkSupabaseUserToLocalStudent(existingSignIn.data.user, existingMeta);
            const fullUser = linked
              ? db
                  .prepare(
                    "SELECT " + STUDENT_SELECT_PUBLIC + " FROM students WHERE id = ?",
                  )
                  .get(linked.id)
              : null;
            if (linked && fullUser) {
              (req.session as any).user = { id: (fullUser as any).id, name: (fullUser as any).name, role: (fullUser as any).role };
              bumpLastActive((fullUser as any).id);
              return res.json({
                success: true,
                already_exists: true,
                message: "Account already existed. You are now signed in.",
                access_token: existingSignIn.data.session?.access_token || null,
                user: sanitizeUser(fullUser, (fullUser as any).role),
              });
            }
          }
          return res.status(409).json({ success: false, message: "User already exists. Please sign in instead." });
        }
        return res.status(400).json({ success: false, message: msg });
      }
      const sbNew = signUp.data.user;
      await supabaseAdmin.from("profiles").upsert({
        id: sbNew.id,
        role: mappedRole,
        display_name: name,
        school: normalizedSchool || null,
        grade_level: grade || null,
        avatar_url,
        gender: gender || null,
        country_code: country_code || null,
        region,
        timezone,
        subscription_status: "free",
        subscription_plan: "free",
        billing_provider: "none",
        mrr_cents: 0,
        ltv_cents: 0,
      });
      if (!signUp.data.session?.access_token) {
        return res.json({
          success: true,
          needs_email_confirmation: true,
          access_token: null,
          message: "Check your email to verify your account, then sign in.",
        });
      }
      let localUser = db
        .prepare("SELECT " + STUDENT_SELECT_PUBLIC + " FROM students WHERE supabase_user_id = ? OR (email IS NOT NULL AND email = ?) LIMIT 1")
        .get(sbNew.id, email) as Record<string, unknown> | undefined;
      if (!localUser) {
        const inserted = db
          .prepare(
            `INSERT INTO students
             (name, username, password, level, xp, avatar_url, role, age, grade, school, city, email, parent_email, contact_number, supabase_user_id, created_at, gender, country_code, region, timezone)
             VALUES (?, ?, ?, 1, 0, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, ?, ?, ?, ?)`,
          )
          .run(
            name,
            username,
            hashPassword(String(Math.random())),
            avatar_url,
            role,
            age || null,
            grade || null,
            normalizedSchool || null,
            city || null,
            email || null,
            parent_email || null,
            contact_number || null,
            sbNew.id,
            gender,
            country_code,
            region,
            timezone,
          );
        localUser = db
          .prepare(
            "SELECT " + STUDENT_SELECT_PUBLIC + " FROM students WHERE id = ?",
          )
          .get(inserted.lastInsertRowid) as Record<string, unknown>;
      } else {
        db.prepare(
          "UPDATE students SET name = ?, username = COALESCE(username, ?), role = ?, avatar_url = ?, age = ?, grade = ?, school = ?, city = ?, email = ?, parent_email = ?, contact_number = ?, supabase_user_id = ?, gender = COALESCE(?, gender), country_code = COALESCE(?, country_code), region = COALESCE(?, region), timezone = COALESCE(?, timezone), created_at = COALESCE(created_at, CURRENT_TIMESTAMP) WHERE id = ?",
        ).run(
          name,
          username,
          role,
          avatar_url,
          age || null,
          grade || null,
          normalizedSchool || null,
          city || null,
          email || null,
          parent_email || null,
          contact_number || null,
          sbNew.id,
          gender,
          country_code,
          region,
          timezone,
          localUser.id,
        );
        localUser = db
          .prepare(
            "SELECT " + STUDENT_SELECT_PUBLIC + " FROM students WHERE id = ?",
          )
          .get(localUser.id) as Record<string, unknown>;
      }
      (req.session as any).user = { id: (localUser as any).id, name: (localUser as any).name, role: (localUser as any).role };
      bumpLastActive((localUser as any).id);
      return res.json({ success: true, access_token: signUp.data.session.access_token, username: (localUser as any).username, user: sanitizeUser(localUser) });
    }

    const insert = db.prepare(
      `INSERT INTO students
        (name, username, password, level, xp, avatar_url, role, age, grade, school, city, email, parent_email, contact_number, created_at, gender, country_code, region, timezone)
       VALUES (?, ?, ?, 1, 0, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, ?, ?, ?, ?)`,
    );

    const result = insert.run(
      name,
      username,
      hashPassword(password),
      avatar_url,
      role,
      age || null,
      grade || null,
      normalizedSchool || null,
      city || null,
      email || null,
      parent_email || null,
      contact_number || null,
      gender,
      country_code,
      region,
      timezone,
    );

    const user = db
      .prepare(
        "SELECT " + STUDENT_SELECT_PUBLIC + " FROM students WHERE id = ?",
      )
      .get(result.lastInsertRowid);

    (req.session as any).user = { id: (user as any).id, name: (user as any).name, role: (user as any).role };

    bumpLastActive((user as any).id);
    res.json({ success: true, username: (user as any).username, user });
  });

  app.post("/api/login", rateLimitAuth, async (req, res) => {
    const { name, username, email, password } = req.body;
    const identifier = String(email || username || name || "").trim();
    console.log(`Login attempt for: ${identifier}`);

    if (hasSupabaseAdmin && supabaseAdmin) {
      const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || "";
      const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY || "";
      if (!supabaseUrl || !supabaseAnonKey) {
        return res.status(500).json({ success: false, message: "Supabase environment is not configured." });
      }
      if (!identifier || !password) {
        return res.status(400).json({ success: false, message: "Username/email and password are required." });
      }
      let emailForAuth = identifier.includes("@") ? identifier : "";
      if (!emailForAuth) {
        const row = db
          .prepare("SELECT email FROM students WHERE username = ? COLLATE NOCASE OR name = ? COLLATE NOCASE LIMIT 1")
          .get(identifier, identifier) as { email?: string | null } | undefined;
        emailForAuth = String(row?.email || "").trim();
      }
      if (!emailForAuth) {
        return res.status(401).json({ success: false, message: "No account found for this username. Try email login once." });
      }
      const supabasePublic = createClient(supabaseUrl, supabaseAnonKey, {
        auth: { autoRefreshToken: false, persistSession: false },
      });
      const signIn = await supabasePublic.auth.signInWithPassword({ email: emailForAuth, password });
      if (signIn.error || !signIn.data.user) {
        if (!ALLOW_LOCAL_AUTH_FALLBACK) {
          return res.status(401).json({
            success: false,
            message: signIn.error?.message || "Invalid credentials",
          });
        }
        // Local fallback for testing and resilience when Supabase user store is out of sync.
        const localUser = db
          .prepare(
            "SELECT " + STUDENT_SELECT_LOGIN + " FROM students WHERE username = ? COLLATE NOCASE OR name = ? COLLATE NOCASE OR email = ? COLLATE NOCASE LIMIT 1",
          )
          .get(identifier, identifier, identifier) as any;
        if (!localUser || !bcrypt.compareSync(password, localUser.password)) {
          return res.status(401).json({ success: false, message: signIn.error?.message || "Invalid credentials" });
        }
        (req.session as any).user = { id: localUser.id, name: localUser.name, role: localUser.role };
        bumpLastActive(localUser.id);
        return res.json({ success: true, access_token: null, user: sanitizeUser(localUser) });
      }
      const sbUser = signIn.data.user;
      const meta = (sbUser.user_metadata || {}) as Record<string, any>;
      const metaRole = String(meta.role || "student").toLowerCase();
      let roleFromMeta =
        metaRole === "educator" || metaRole === "teacher" ? "teacher" : metaRole === "admin" ? "admin" : "student";
      let prof: { role?: string; display_name?: string } | null = null;
      const { data: profRow } = await supabaseAdmin
        .from("profiles")
        .select("role, display_name")
        .eq("id", sbUser.id)
        .maybeSingle();
      prof = profRow;
      if (prof?.role) {
        const pr = String(prof.role).toLowerCase();
        roleFromMeta = pr === "educator" || pr === "teacher" ? "teacher" : pr === "admin" ? "admin" : "student";
      }
      const metaForLink: Record<string, any> = { ...meta, role: roleFromMeta };
      if (prof?.display_name) metaForLink.display_name = prof.display_name;

      const linked = linkSupabaseUserToLocalStudent(sbUser, metaForLink);
      if (!linked) {
        return res.status(500).json({ success: false, message: "Could not link account to local profile." });
      }

      const displayName = String(
        metaForLink.display_name || metaForLink.full_name || metaForLink.name || (sbUser.email ? sbUser.email.split("@")[0] : "User"),
      );
      const avatar = `https://picsum.photos/seed/${encodeURIComponent(displayName.toLowerCase().replace(/\s+/g, "-"))}/200`;

      db.prepare("UPDATE students SET name = ?, role = ?, avatar_url = ?, email = COALESCE(email, ?), supabase_user_id = ? WHERE id = ?").run(
        displayName,
        roleFromMeta,
        avatar,
        sbUser.email || null,
        sbUser.id,
        linked.id,
      );

      const fullUser = db
        .prepare(
          "SELECT " + STUDENT_SELECT_PUBLIC + " FROM students WHERE id = ?",
        )
        .get(linked.id);
      if (!fullUser) {
        return res.status(500).json({ success: false, message: "Could not load user profile." });
      }

      (req.session as any).user = { id: (fullUser as any).id, name: (fullUser as any).name, role: (fullUser as any).role };
      bumpLastActive((fullUser as any).id);
      return res.json({
        success: true,
        access_token: signIn.data.session?.access_token || null,
        user: sanitizeUser(fullUser),
      });
    }

    const user = db
      .prepare(
        "SELECT " + STUDENT_SELECT_LOGIN + " FROM students WHERE username = ? COLLATE NOCASE OR name = ? COLLATE NOCASE OR email = ? COLLATE NOCASE",
      )
      .get(identifier, identifier, identifier);

    if (!user) {
      console.log(`Login failed: ${identifier} (no such user)`);
      return res.status(401).json({ success: false, message: "Invalid credentials" });
    }

    const matches = bcrypt.compareSync(password, (user as any).password);

    if (!matches) {
      console.log(`Login failed: ${identifier} (bad password)`);
      return res.status(401).json({ success: false, message: "Invalid credentials" });
    }

    console.log(`Login success: ${identifier} (${(user as any).role})`);

    (req.session as any).user = { id: (user as any).id, name: (user as any).name, role: (user as any).role };

    res.json({ success: true, user: sanitizeUser(user) });
  });

  app.get("/api/quizzes", requireAuth, (req, res) => {
    const quizzes = db.prepare("SELECT * FROM quizzes ORDER BY created_at DESC").all();
    res.json(quizzes);
  });

  app.get("/api/quizzes/:id", requireAuth, (req, res) => {
    const row = db.prepare("SELECT * FROM quizzes WHERE id = ?").get(req.params.id);
    if (!row) return res.status(404).json({ error: "Quiz not found" });
    res.json(row);
  });

  app.patch("/api/quizzes/:id", requireAuth, requireRole(["teacher", "admin"]), (req, res) => {
    const id = req.params.id;
    const existing = db.prepare("SELECT id FROM quizzes WHERE id = ?").get(id);
    if (!existing) return res.status(404).json({ error: "Quiz not found" });
    const { title, questions, grade_level } = req.body;
    if (title !== undefined) db.prepare("UPDATE quizzes SET title = ? WHERE id = ?").run(title, id);
    if (questions !== undefined) db.prepare("UPDATE quizzes SET questions = ? WHERE id = ?").run(typeof questions === "string" ? questions : JSON.stringify(questions), id);
    if (grade_level !== undefined) db.prepare("UPDATE quizzes SET grade_level = ? WHERE id = ?").run(String(grade_level || "").trim() || null, id);
    res.json({ success: true });
  });

  app.delete("/api/quizzes/:id", requireAuth, requireRole(["teacher", "admin"]), (req, res) => {
    const id = req.params.id;
    db.prepare("DELETE FROM class_quizzes WHERE quiz_id = ?").run(id);
    db.prepare("DELETE FROM student_quizzes WHERE quiz_id = ?").run(id);
    db.prepare("DELETE FROM quizzes WHERE id = ?").run(id);
    res.json({ success: true });
  });

  app.get("/api/missions", (req, res) => {
    const missions = db.prepare("SELECT * FROM missions").all();
    res.json(missions);
  });

  // AI-style quiz generation for a completed mission (unique per student/request)
  app.post("/api/missions/:id/generate-quiz", requireAuth, requireRole(["student"]), (req, res) => {
    const sessionUser = (req.session as any)?.user as SessionUser;
    const quota = checkAndLogAiQuota("generate_quiz", sessionUser.id);
    if (!quota.ok) {
      return res.status(429).json({ success: false, message: quota.message });
    }
    const missionId = Number(req.params.id);
    if (!Number.isInteger(missionId) || missionId < 1) {
      return res.status(400).json({ success: false, message: "Invalid mission id" });
    }
    const mission = db.prepare("SELECT id, sector_id, title, description FROM missions WHERE id = ?").get(missionId) as
      | { id: number; sector_id: number; title: string; description: string | null }
      | undefined;
    if (!mission) return res.status(404).json({ success: false, message: "Mission not found" });

    const sector = db.prepare("SELECT name, description FROM sectors WHERE id = ?").get(mission.sector_id) as
      | { name: string; description: string | null }
      | undefined;
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
    const seedBase = Date.now() + sessionUser.id * 997 + missionId * 151;
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

    const finalizeAndSave = (questions: any[]) => {
      const normalized = (Array.isArray(questions) ? questions : [])
        .filter((q) => q && q.type === "multiple_choice" && q.content?.question && Array.isArray(q.content?.options))
        .slice(0, 5);
      const useQuestions = normalized.length === 5 ? normalized : fallbackQuestions;
      const title = `${mission.title} · Auto Quiz`;
      const result = db
        .prepare("INSERT INTO quizzes (title, questions) VALUES (?, ?)")
        .run(title, JSON.stringify(useQuestions));
      res.json({ success: true, id: Number(result.lastInsertRowid), title, question_count: useQuestions.length });
    };

    const studentStats = db.prepare(
      `SELECT
         COALESCE(AVG(CAST(score AS FLOAT) / NULLIF(total_questions,0)) * 100, 0) as avg_score,
         COUNT(*) as quizzes_completed
       FROM student_quizzes WHERE student_id = ?`
    ).get(sessionUser.id) as { avg_score: number; quizzes_completed: number };

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

    callAiJson<{ questions?: any[] }>(aiSystem, aiUser)
      .then((ai) => {
        if (ai?.questions && Array.isArray(ai.questions)) return finalizeAndSave(ai.questions);
        return finalizeAndSave(fallbackQuestions);
      })
      .catch(() => finalizeAndSave(fallbackQuestions));
  });

  // AI mission recommendations (adaptive next-skill path)
  app.get("/api/students/:id/recommendations", requireAuth, requireStudentAccess, async (req, res) => {
    const sessionUser = (req.session as any)?.user as SessionUser;
    const quota = checkAndLogAiQuota("recommendations", sessionUser.id);
    if (!quota.ok) {
      return res.status(429).json({ success: false, message: quota.message, recommendations: [] });
    }
    const studentId = Number(req.params.id);
    if (!Number.isInteger(studentId) || studentId < 1) return res.status(400).json({ success: false, message: "Invalid student id" });

    const studentRow = db
      .prepare("SELECT grade FROM students WHERE id = ?")
      .get(studentId) as { grade?: string | null } | undefined;
    const normalizedGrade = String(studentRow?.grade || "")
      .trim()
      .toLowerCase();

    let assigned = db.prepare(`
      SELECT m.*, s.name as sector_name
      FROM missions m
      JOIN class_missions cm ON cm.mission_id = m.id
      JOIN class_students cs ON cs.class_id = cm.class_id
      JOIN sectors s ON s.id = m.sector_id
      WHERE cs.student_id = ?
      ORDER BY m.id ASC
    `).all(studentId) as Array<any>;
    if (assigned.length === 0) {
      assigned = db
        .prepare(
          `
          SELECT m.*, s.name as sector_name
          FROM missions m
          JOIN sectors s ON s.id = m.sector_id
          WHERE m.status = 'available'
            AND (
              ? = ''
              OR
              m.grade_level IS NULL
              OR TRIM(m.grade_level) = ''
              OR LOWER(TRIM(m.grade_level)) = ?
            )
          ORDER BY m.id ASC
          LIMIT 30
        `,
        )
        .all(normalizedGrade, normalizedGrade) as Array<any>;
    }
    const completedSet = new Set<number>(
      (db.prepare(`SELECT mission_id FROM student_mission_completions WHERE student_id = ?`).all(studentId) as Array<{ mission_id: number }>).map(r => r.mission_id)
    );
    const pending = assigned.filter((m) => !completedSet.has(m.id));
    const interestKeys = (
      db
        .prepare("SELECT interest_key FROM student_interest_votes WHERE student_id = ? ORDER BY weight DESC, created_at DESC")
        .all(studentId) as Array<{ interest_key: string }>
    ).map((r) => String(r.interest_key || "").toLowerCase());
    const scoreByInterest = (mission: any) => {
      const hay = `${mission?.title || ""} ${mission?.description || ""} ${mission?.sector_name || ""}`.toLowerCase();
      return interestKeys.reduce((acc, key) => (hay.includes(key.replace(/_/g, " ")) ? acc + 1 : acc), 0);
    };
    const stats = db.prepare(`
      SELECT
        COALESCE(AVG(CAST(score AS FLOAT) / NULLIF(total_questions,0)) * 100, 0) as avg_score,
        COUNT(*) as quizzes_completed
      FROM student_quizzes
      WHERE student_id = ?
    `).get(studentId) as { avg_score: number; quizzes_completed: number };

    const bySector = new Map<number, { sector_name: string; total: number; completed: number }>();
    for (const m of assigned) {
      const cur = bySector.get(m.sector_id) || { sector_name: m.sector_name, total: 0, completed: 0 };
      cur.total += 1;
      if (completedSet.has(m.id)) cur.completed += 1;
      bySector.set(m.sector_id, cur);
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
      .sort((a, b) => scoreByInterest(b) - scoreByInterest(a) || (a.difficulty || "").localeCompare(b.difficulty || "") || a.id - b.id)
      .slice(0, 2)
      .map((m) => ({ mission_id: m.id, title: m.title, difficulty: m.difficulty, sector: m.sector_name, reason: `Build fundamentals in ${m.sector_name} progressively.` }));
    const strongerStretch = pending
      .filter((m) => strongest ? m.sector_id === strongest.sector_id : true)
      .sort((a, b) => scoreByInterest(b) - scoreByInterest(a) || (b.difficulty || "").localeCompare(a.difficulty || "") || a.id - b.id)
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
      const byId = new Map<number, any>(pending.map((m) => [m.id, m]));
      const merged = ai.recommendations
        .map((r) => {
          const m = byId.get(Number(r.mission_id));
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
  });

  app.post("/api/quizzes", requireAuth, requireRole(["teacher", "admin"]), (req, res) => {
    const { title, questions, grade_level } = req.body;
    const insert = db.prepare("INSERT INTO quizzes (title, grade_level, questions) VALUES (?, ?, ?)");
    const result = insert.run(title, String(grade_level || "").trim() || null, JSON.stringify(questions));
    res.json({ success: true, id: result.lastInsertRowid });
  });

  // --- Notifications ---
  app.get("/api/notifications", requireAuth, (req, res) => {
    const sessionUser = (req.session as any)?.user as SessionUser;
    const rows = db
      .prepare(
        `SELECT id, user_id, type, title, message, link, is_read, created_at
         FROM notifications
         WHERE user_id = ?
         ORDER BY created_at DESC
         LIMIT 100`,
      )
      .all(sessionUser.id);
    res.json(rows);
  });

  app.patch("/api/notifications/:id/read", requireAuth, (req, res) => {
    const sessionUser = (req.session as any)?.user as SessionUser;
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id < 1) return res.status(400).json({ error: "Invalid id" });
    const row = db.prepare("SELECT id FROM notifications WHERE id = ? AND user_id = ?").get(id, sessionUser.id);
    if (!row) return res.status(404).json({ error: "Notification not found" });
    db.prepare("UPDATE notifications SET is_read = 1 WHERE id = ? AND user_id = ?").run(id, sessionUser.id);
    res.json({ success: true });
  });

  app.patch("/api/notifications/read-all", requireAuth, (req, res) => {
    const sessionUser = (req.session as any)?.user as SessionUser;
    db.prepare("UPDATE notifications SET is_read = 1 WHERE user_id = ?").run(sessionUser.id);
    res.json({ success: true });
  });

  // --- Challenge Engine API (H5P-style interactive challenges) ---
  app.get("/api/challenges", requireAuth, (req, res) => {
    const sessionUser = (req.session as any)?.user as SessionUser;
    if (sessionUser.role === "student") {
      const challenges = db.prepare(`
        SELECT DISTINCT c.* FROM challenges c
        JOIN class_challenges cc ON cc.challenge_id = c.id
        JOIN class_students cs ON cs.class_id = cc.class_id
        WHERE cs.student_id = ?
        ORDER BY c.created_at DESC
      `).all(sessionUser.id);
      return res.json(challenges);
    }
    const challenges = db.prepare("SELECT * FROM challenges ORDER BY created_at DESC").all();
    res.json(challenges);
  });

  app.get("/api/challenges/:id", requireAuth, (req, res) => {
    const row = db.prepare("SELECT * FROM challenges WHERE id = ?").get(req.params.id);
    if (!row) return res.status(404).json({ error: "Challenge not found" });
    res.json(row);
  });

  app.post("/api/challenges", requireAuth, requireRole(["teacher", "admin"]), (req, res) => {
    const { title, type, world, zone, grade_level, xp_reward, xp_bonus_first_try, xp_retry_penalty, content_json } = req.body;
    if (!title || !type || content_json === undefined) {
      return res.status(400).json({ error: "title, type, and content_json required" });
    }
    const insert = db.prepare(
      "INSERT INTO challenges (title, type, world, zone, grade_level, xp_reward, xp_bonus_first_try, xp_retry_penalty, content_json) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)"
    );
    const result = insert.run(
      title,
      type,
      world || null,
      zone || null,
      String(grade_level || "").trim() || null,
      Number(xp_reward) || 100,
      Number(xp_bonus_first_try) || 0,
      Number(xp_retry_penalty) || 0,
      typeof content_json === "string" ? content_json : JSON.stringify(content_json)
    );
    res.json({ success: true, id: result.lastInsertRowid });
  });

  app.patch("/api/challenges/:id", requireAuth, requireRole(["teacher", "admin"]), (req, res) => {
    const id = req.params.id;
    const existing = db.prepare("SELECT id FROM challenges WHERE id = ?").get(id);
    if (!existing) return res.status(404).json({ error: "Challenge not found" });
    const { title, type, world, zone, grade_level, xp_reward, xp_bonus_first_try, xp_retry_penalty, content_json } = req.body;
    const updates: string[] = [];
    const values: unknown[] = [];
    if (title !== undefined) { updates.push("title = ?"); values.push(title); }
    if (type !== undefined) { updates.push("type = ?"); values.push(type); }
    if (world !== undefined) { updates.push("world = ?"); values.push(world); }
    if (zone !== undefined) { updates.push("zone = ?"); values.push(zone); }
    if (grade_level !== undefined) { updates.push("grade_level = ?"); values.push(String(grade_level || "").trim() || null); }
    if (xp_reward !== undefined) { updates.push("xp_reward = ?"); values.push(Number(xp_reward)); }
    if (xp_bonus_first_try !== undefined) { updates.push("xp_bonus_first_try = ?"); values.push(Number(xp_bonus_first_try)); }
    if (xp_retry_penalty !== undefined) { updates.push("xp_retry_penalty = ?"); values.push(Number(xp_retry_penalty)); }
    if (content_json !== undefined) { updates.push("content_json = ?"); values.push(typeof content_json === "string" ? content_json : JSON.stringify(content_json)); }
    if (updates.length === 0) return res.json({ success: true });
    values.push(id);
    db.prepare(`UPDATE challenges SET ${updates.join(", ")} WHERE id = ?`).run(...values);
    res.json({ success: true });
  });

  app.delete("/api/challenges/:id", requireAuth, requireRole(["teacher", "admin"]), (req, res) => {
    const id = req.params.id;
    db.prepare("DELETE FROM class_challenges WHERE challenge_id = ?").run(id);
    db.prepare("DELETE FROM challenge_attempts WHERE challenge_id = ?").run(id);
    db.prepare("DELETE FROM challenges WHERE id = ?").run(id);
    res.json({ success: true });
  });

  app.post("/api/challenges/:id/attempt", requireAuth, requireRole(["student"]), (req, res) => {
    const challengeId = Number(req.params.id);
    const sessionUser = (req.session as any)?.user as SessionUser;
    const challenge = db.prepare("SELECT * FROM challenges WHERE id = ?").get(challengeId) as { id: number; xp_reward: number; xp_bonus_first_try: number; xp_retry_penalty: number } | undefined;
    if (!challenge) return res.status(404).json({ error: "Challenge not found" });
    const { score, correct, response, time_ms } = req.body;
    const scoreNum = typeof score === "number" ? score : (correct ? 1 : 0);
    const correctNum = correct === true || scoreNum >= 1 ? 1 : 0;
    const prevAttempts = db.prepare("SELECT COUNT(*) as c FROM challenge_attempts WHERE student_id = ? AND challenge_id = ?").get(sessionUser.id, challengeId) as { c: number };
    const attemptNumber = (prevAttempts?.c ?? 0) + 1;
    db.prepare(
      "INSERT INTO challenge_attempts (student_id, challenge_id, attempt_number, score, correct, response_json, time_ms) VALUES (?, ?, ?, ?, ?, ?, ?)"
    ).run(sessionUser.id, challengeId, attemptNumber, scoreNum, correctNum, typeof response === "string" ? response : JSON.stringify(response ?? {}), time_ms ?? null);
    bumpLastActive(sessionUser.id);
    let xpEarned = 0;
    if (correctNum) {
      xpEarned = challenge.xp_reward + (attemptNumber === 1 ? (challenge.xp_bonus_first_try || 0) : 0) - (attemptNumber > 1 ? (challenge.xp_retry_penalty || 0) * (attemptNumber - 1) : 0);
      if (xpEarned < 0) xpEarned = 0;
      db.prepare("UPDATE students SET xp = xp + ? WHERE id = ?").run(xpEarned, sessionUser.id);
    }
    const student = db.prepare("SELECT xp FROM students WHERE id = ?").get(sessionUser.id) as { xp: number };
    res.json({ success: true, correct: !!correctNum, xp_earned: xpEarned, total_xp: student?.xp ?? 0, attempt_number: attemptNumber });
  });

  app.get("/api/challenges/:id/analytics", requireAuth, requireRole(["teacher", "admin"]), (req, res) => {
    const challengeId = req.params.id;
    const attempts = db.prepare(`
      SELECT ca.*, s.name as student_name FROM challenge_attempts ca
      JOIN students s ON s.id = ca.student_id
      WHERE ca.challenge_id = ?
      ORDER BY ca.created_at DESC
    `).all(challengeId) as any[];
    const total = attempts.length;
    const correctCount = attempts.filter((a: any) => a.correct).length;
    const byAttempt = attempts.reduce((acc: Record<number, number>, a: any) => {
      acc[a.attempt_number] = (acc[a.attempt_number] || 0) + 1;
      return acc;
    }, {});
    res.json({ attempts, total, correct_count: correctCount, success_rate: total ? correctCount / total : 0, by_attempt_number: byAttempt });
  });

  app.get("/api/challenges/:id/assigned-classes", requireAuth, requireRole(["teacher", "admin"]), (req, res) => {
    const sessionUser = (req.session as any)?.user as SessionUser;
    const challengeId = Number(req.params.id);
    if (!Number.isInteger(challengeId) || challengeId < 1) return res.status(400).json({ error: "Invalid challenge id" });
    const sql = sessionUser.role === "teacher"
      ? `
        SELECT c.id, c.name, cc.assigned_at
        FROM class_challenges cc
        JOIN classes c ON c.id = cc.class_id
        WHERE cc.challenge_id = ? AND c.teacher_id = ?
        ORDER BY cc.assigned_at DESC
      `
      : `
        SELECT c.id, c.name, cc.assigned_at
        FROM class_challenges cc
        JOIN classes c ON c.id = cc.class_id
        WHERE cc.challenge_id = ?
        ORDER BY cc.assigned_at DESC
      `;
    const rows = sessionUser.role === "teacher"
      ? db.prepare(sql).all(challengeId, sessionUser.id)
      : db.prepare(sql).all(challengeId);
    res.json(rows);
  });

  app.post("/api/classes/:id/challenges", requireAuth, requireRole(["teacher", "admin"]), (req, res) => {
    const classId = Number(req.params.id);
    if (!Number.isInteger(classId) || classId < 1) return res.status(400).json({ success: false, error: "Invalid class id" });
    if (!ensureClassAccess(req, res, classId).ok) return;
    const clsTrack = db.prepare("SELECT curriculum_track FROM classes WHERE id = ?").get(req.params.id) as { curriculum_track?: string | null } | undefined;
    if (!clsTrack) return res.status(404).json({ success: false, error: "Class not found" });
    if (!clsTrack.curriculum_track || !String(clsTrack.curriculum_track).trim()) {
      return res.status(400).json({ success: false, error: "Set curriculum track first before deploying challenges." });
    }
    const { challenge_id } = req.body;
    if (!challenge_id) return res.status(400).json({ error: "challenge_id required" });
    const challengeId = Number(challenge_id);
    const r = db
      .prepare("INSERT OR IGNORE INTO class_challenges (class_id, challenge_id) VALUES (?, ?)")
      .run(classId, challengeId);

    // Notify students only when it's a new assignment
    if (r.changes > 0) {
      const cls = db.prepare("SELECT id, name FROM classes WHERE id = ?").get(classId) as { id: number; name: string } | undefined;
      const ch = db.prepare("SELECT id, title, type FROM challenges WHERE id = ?").get(challengeId) as { id: number; title: string; type: string } | undefined;
      const students = db.prepare("SELECT student_id FROM class_students WHERE class_id = ?").all(classId) as { student_id: number }[];

      const insertNotif = db.prepare(
        "INSERT INTO notifications (user_id, type, title, message, link, is_read) VALUES (?, ?, ?, ?, ?, 0)",
      );
      const title = "New assignment posted";
      const message = `${ch?.title || "A new challenge"} was assigned in ${cls?.name || "your class"}.`;
      const link = `challenge:${challengeId}`;

      const tx = db.transaction(() => {
        for (const s of students) {
          insertNotif.run(s.student_id, "challenge_assigned", title, message, link);
        }
      });
      tx();
    }
    res.json({ success: true });
  });

  app.delete("/api/classes/:id/challenges/:challengeId", requireAuth, requireRole(["teacher", "admin"]), (req, res) => {
    const classId = Number(req.params.id);
    if (!Number.isInteger(classId) || classId < 1) return res.status(400).json({ success: false, error: "Invalid class id" });
    if (!ensureClassAccess(req, res, classId).ok) return;
    db.prepare("DELETE FROM class_challenges WHERE class_id = ? AND challenge_id = ?").run(req.params.id, req.params.challengeId);
    res.json({ success: true });
  });

  app.get("/api/students/:id/assigned-challenges", requireAuth, requireStudentAccess, (req, res) => {
    const studentId = req.params.id;
    const challenges = db.prepare(`
      SELECT DISTINCT
        c.*,
        (
          SELECT ca.score
          FROM challenge_attempts ca
          WHERE ca.student_id = ? AND ca.challenge_id = c.id
          ORDER BY ca.created_at DESC, ca.id DESC
          LIMIT 1
        ) as latest_score,
        (
          SELECT ca.correct
          FROM challenge_attempts ca
          WHERE ca.student_id = ? AND ca.challenge_id = c.id
          ORDER BY ca.created_at DESC, ca.id DESC
          LIMIT 1
        ) as latest_correct,
        (
          SELECT ca.created_at
          FROM challenge_attempts ca
          WHERE ca.student_id = ? AND ca.challenge_id = c.id
          ORDER BY ca.created_at DESC, ca.id DESC
          LIMIT 1
        ) as latest_attempted_at
      FROM challenges c
      JOIN class_challenges cc ON cc.challenge_id = c.id
      JOIN class_students cs ON cs.class_id = cc.class_id
      WHERE cs.student_id = ?
      ORDER BY c.created_at DESC
    `).all(studentId, studentId, studentId, studentId);
    res.json(challenges);
  });

  app.get("/api/logs", requireAuth, requireRole(["admin"]), (req, res) => {
    const logs = db.prepare("SELECT * FROM logs ORDER BY timestamp DESC LIMIT 20").all();
    res.json(logs);
  });

  app.get("/api/admin/metrics", requireAuth, requireRole(["admin"]), (_req, res) => {
    const byRole = db.prepare("SELECT role, COUNT(*) as n FROM students GROUP BY role").all() as { role: string; n: number }[];
    const bySubscriptionStatus = db
      .prepare(
        "SELECT COALESCE(NULLIF(TRIM(subscription_status), ''), 'free') as subscription_status, COUNT(*) as n FROM students GROUP BY 1",
      )
      .all() as { subscription_status: string; n: number }[];
    const byPlan = db
      .prepare(
        "SELECT COALESCE(NULLIF(TRIM(subscription_plan), ''), 'free') as subscription_plan, COUNT(*) as n FROM students GROUP BY 1",
      )
      .all() as { subscription_plan: string; n: number }[];
    const byGender = db
      .prepare(
        `SELECT CASE WHEN gender IS NULL OR TRIM(gender) = '' THEN 'unspecified' ELSE gender END as gender, COUNT(*) as n
         FROM students GROUP BY 1`,
      )
      .all() as { gender: string; n: number }[];
    const byCountry = db
      .prepare(
        `SELECT CASE WHEN country_code IS NULL OR TRIM(country_code) = '' THEN 'unspecified' ELSE country_code END as country_code, COUNT(*) as n
         FROM students GROUP BY 1 ORDER BY n DESC LIMIT 20`,
      )
      .all() as { country_code: string; n: number }[];
    const byCity = db
      .prepare(
        `SELECT CASE WHEN city IS NULL OR TRIM(city) = '' THEN 'unspecified' ELSE city END as city, COUNT(*) as n
         FROM students GROUP BY 1 ORDER BY n DESC LIMIT 15`,
      )
      .all() as { city: string; n: number }[];
    const ageBuckets = db
      .prepare(
        `SELECT bucket, COUNT(*) as n FROM (
           SELECT CASE
             WHEN age IS NULL THEN 'unspecified'
             WHEN age < 13 THEN 'under_13'
             WHEN age <= 17 THEN '13_17'
             ELSE '18_plus'
           END as bucket
           FROM students
         ) GROUP BY bucket`,
      )
      .all() as { bucket: string; n: number }[];
    const gradeDist = db
      .prepare(
        "SELECT CASE WHEN grade IS NULL OR TRIM(grade) = '' THEN 'unspecified' ELSE grade END as grade, COUNT(*) as n FROM students GROUP BY 1 ORDER BY n DESC LIMIT 12",
      )
      .all() as { grade: string; n: number }[];
    const interestTrends = db
      .prepare(
        `SELECT interest_key, COUNT(*) as n
         FROM student_interest_votes
         GROUP BY interest_key
         ORDER BY n DESC, interest_key ASC
         LIMIT 20`,
      )
      .all() as { interest_key: string; n: number }[];

    const signups30 = db
      .prepare(
        `SELECT date(created_at) as day, COUNT(*) as n FROM students
         WHERE created_at IS NOT NULL AND date(created_at) >= date('now', '-30 days')
         GROUP BY date(created_at) ORDER BY day`,
      )
      .all() as { day: string; n: number }[];

    const studentRoleCount = (byRole.find((r) => r.role === "student")?.n ?? 0) as number;
    const activatedRow = db
      .prepare(
        `SELECT COUNT(DISTINCT s.id) as n FROM students s
         WHERE s.role = 'student' AND EXISTS (
           SELECT 1 FROM student_mission_completions smc WHERE smc.student_id = s.id
         )`,
      )
      .get() as { n: number };
    const activationRatePct =
      studentRoleCount > 0 ? Math.round((Number(activatedRow.n) / studentRoleCount) * 1000) / 10 : 0;

    const dau = db.prepare(`SELECT COUNT(*) as n FROM students WHERE last_active_at >= datetime('now', '-1 day')`).get() as { n: number };
    const wau = db.prepare(`SELECT COUNT(*) as n FROM students WHERE last_active_at >= datetime('now', '-7 day')`).get() as { n: number };
    const mau = db.prepare(`SELECT COUNT(*) as n FROM students WHERE last_active_at >= datetime('now', '-30 day')`).get() as { n: number };

    const activeLast7 = Number((db.prepare(`SELECT COUNT(*) as n FROM students WHERE last_active_at >= datetime('now', '-7 day')`).get() as { n: number }).n);
    const returningWeekly = Number(
      (
        db
          .prepare(
            `SELECT COUNT(*) as n FROM students WHERE last_active_at >= datetime('now', '-7 day')
             AND created_at IS NOT NULL AND datetime(created_at) <= datetime('now', '-7 day')`,
          )
          .get() as { n: number }
      ).n,
    );
    const weeklyReturningSharePct = activeLast7 > 0 ? Math.round((returningWeekly / activeLast7) * 1000) / 10 : 0;

    const classCount = Number((db.prepare("SELECT COUNT(*) as n FROM classes").get() as { n: number }).n);
    const avgMissionsPerClass =
      classCount > 0
        ? Math.round(
            (Number((db.prepare("SELECT COUNT(*) as n FROM class_missions").get() as { n: number }).n) / classCount) * 100,
          ) / 100
        : 0;
    const avgQuizzesPerClass =
      classCount > 0
        ? Math.round(
            (Number((db.prepare("SELECT COUNT(*) as n FROM class_quizzes").get() as { n: number }).n) / classCount) * 100,
          ) / 100
        : 0;
    const avgChallengesPerClass =
      classCount > 0
        ? Math.round(
            (Number((db.prepare("SELECT COUNT(*) as n FROM class_challenges").get() as { n: number }).n) / classCount) * 100,
          ) / 100
        : 0;

    const aiByDay = db
      .prepare(
        `SELECT date(created_at) as day, endpoint, SUM(CASE WHEN success = 1 THEN 1 ELSE 0 END) as ok, COUNT(*) as total
         FROM ai_usage_logs WHERE date(created_at) >= date('now', '-14 days')
         GROUP BY date(created_at), endpoint ORDER BY day, endpoint`,
      )
      .all() as { day: string; endpoint: string; ok: number; total: number }[];

    const mrrRow = db
      .prepare(`SELECT COALESCE(SUM(mrr_cents), 0) as mrr FROM students WHERE subscription_status = 'active'`)
      .get() as { mrr: number };
    const mrrCents = Number(mrrRow.mrr || 0);
    const payingUsers = Number(
      (db.prepare(`SELECT COUNT(*) as n FROM students WHERE subscription_status = 'active' AND mrr_cents > 0`).get() as { n: number }).n,
    );
    const trialUsers = Number(
      (db.prepare(`SELECT COUNT(*) as n FROM students WHERE subscription_status = 'trial'`).get() as { n: number }).n,
    );
    const pastDueUsers = Number(
      (db.prepare(`SELECT COUNT(*) as n FROM students WHERE subscription_status = 'past_due'`).get() as { n: number }).n,
    );
    const freeOrNone = Number(
      (db.prepare(`SELECT COUNT(*) as n FROM students WHERE subscription_status IS NULL OR subscription_status IN ('free','none')`).get() as { n: number }).n,
    );
    const arpuCents = payingUsers > 0 ? Math.round(mrrCents / payingUsers) : 0;
    const ltvSumCents = Number((db.prepare(`SELECT COALESCE(SUM(ltv_cents), 0) as s FROM students`).get() as { s: number }).s);

    res.json({
      byRole,
      bySubscriptionStatus,
      byPlan,
      byGender,
      byCountry,
      byCity,
      ageBuckets,
      gradeDistribution: gradeDist,
      interestTrends,
      signupsLast30Days: signups30,
      monetization: {
        mrrCents,
        arpuCents,
        payingUsers,
        trialUsers,
        pastDueUsers,
        freeOrUnpaidUsers: freeOrNone,
        ltvSumCents,
      },
      product: {
        studentCount: studentRoleCount,
        activatedStudents: Number(activatedRow.n),
        activationRatePct,
        dau: Number(dau.n),
        wau: Number(wau.n),
        mau: Number(mau.n),
        weeklyReturningSharePct,
        classCount,
        avgMissionsPerClass,
        avgQuizzesPerClass,
        avgChallengesPerClass,
      },
      aiUsageByDay: aiByDay,
    });
  });

  app.patch("/api/admin/students/:id", requireAuth, requireRole(["admin"]), (req, res) => {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id < 1) return res.status(400).json({ success: false, message: "Invalid id" });
    const row = db.prepare("SELECT id FROM students WHERE id = ?").get(id);
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
    const setClause = Object.keys(updates).map((k) => `${k} = ?`).join(", ");
    db.prepare(`UPDATE students SET ${setClause} WHERE id = ?`).run(...Object.values(updates), id);
    const user = db.prepare("SELECT " + STUDENT_SELECT_PUBLIC + " FROM students WHERE id = ?").get(id);
    res.json({ success: true, user: sanitizeUser(user) });
  });

  app.post("/api/missions", requireAuth, requireRole(["teacher", "admin"]), (req, res) => {
    const { sector_id, title, description, difficulty, grade_level, xp_reward, image_url, embed_code, prerequisite_mission_id, learning_outcomes, domains } = req.body;
    const sessionUser = (req.session as any)?.user as SessionUser | undefined;
    // Allow both teachers and admins to save embed/game URL (normalized on client or as raw string; sanitized below)
    const rawEmbed = typeof embed_code === "string" && embed_code.trim() ? embed_code.trim() : null;
    const safeEmbed = rawEmbed ? sanitizeEmbedCode(rawEmbed) : null;

    const insert = db.prepare(
      "INSERT INTO missions (sector_id, title, description, difficulty, grade_level, xp_reward, status, image_url, embed_code, prerequisite_mission_id, learning_outcomes_json, domains_json) VALUES (?, ?, ?, ?, ?, ?, 'available', ?, ?, ?, ?, ?)",
    );
    const safeOutcomes = Array.isArray(learning_outcomes) ? JSON.stringify(learning_outcomes.map((x) => String(x).trim()).filter(Boolean)) : null;
    const safeDomains = Array.isArray(domains) ? JSON.stringify(domains.map((x) => String(x).trim()).filter(Boolean)) : null;
    const safePrereq = Number.isInteger(Number(prerequisite_mission_id)) && Number(prerequisite_mission_id) > 0 ? Number(prerequisite_mission_id) : null;
    const result = insert.run(
      sector_id,
      title,
      description,
      difficulty,
      String(grade_level || "").trim() || null,
      xp_reward,
      image_url || "https://picsum.photos/seed/mission/400/300",
      safeEmbed,
      safePrereq,
      safeOutcomes,
      safeDomains,
    );
    
    // Log the action
    const logInsert = db.prepare("INSERT INTO logs (message, type, xp_change) VALUES (?, ?, ?)");
    logInsert.run(`New mission deployed: ${title}`, "system", 0);
    
    res.json({ success: true, id: result.lastInsertRowid });
  });

  // Classroom Management
  app.get("/api/classes", requireAuth, requireRole(["teacher", "admin"]), (req, res) => {
    const sessionUser = (req.session as any)?.user as SessionUser;
    let classes;
    if (sessionUser.role === "teacher") {
      classes = db
        .prepare(
          `
        SELECT c.*, s.name as teacher_name,
        (SELECT COUNT(*) FROM class_students WHERE class_id = c.id) as student_count
        FROM classes c
        JOIN students s ON c.teacher_id = s.id
        WHERE c.teacher_id = ?
      `,
        )
        .all(sessionUser.id);
    } else {
      classes = db
        .prepare(
          `
        SELECT c.*, s.name as teacher_name,
        (SELECT COUNT(*) FROM class_students WHERE class_id = c.id) as student_count
        FROM classes c
        JOIN students s ON c.teacher_id = s.id
      `,
        )
        .all();
    }
    res.json(classes);
  });

  app.get("/api/classes/:id", requireAuth, requireRole(["teacher", "admin"]), (req, res) => {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id < 1) return res.status(400).json({ error: "Invalid class id" });
    if (!ensureClassAccess(req, res, id).ok) return;
    const cls = db.prepare("SELECT * FROM classes WHERE id = ?").get(id);
    if (!cls) return res.status(404).json({ error: "Class not found" });
    res.json(cls);
  });

  /** Ensure class has a join_code; generate and save if missing. Returns { join_code }. */
  const handleEnsureJoinCode = (req: express.Request, res: express.Response) => {
    const id = req.params.id ?? req.body?.class_id;
    const classId = id != null ? Number(id) : NaN;
    if (!Number.isInteger(classId) || classId < 1) {
      return res.status(400).json({ error: "Class id required" });
    }
    if (!ensureClassAccess(req, res, classId).ok) return;
    const row = db.prepare("SELECT id, join_code FROM classes WHERE id = ?").get(classId) as { id: number; join_code: string | null } | undefined;
    if (!row) return res.status(404).json({ error: "Class not found" });
    let code = row.join_code != null && String(row.join_code).trim() !== "" ? String(row.join_code).trim() : null;
    if (!code) {
      code = ensureUniqueJoinCode();
      db.prepare("UPDATE classes SET join_code = ? WHERE id = ?").run(code, row.id);
    }
    res.json({ join_code: code });
  };
  app.post("/api/classes/ensure-join-code", requireAuth, requireRole(["teacher", "admin"]), (req, res) => handleEnsureJoinCode(req, res));
  app.patch("/api/classes/ensure-join-code", requireAuth, requireRole(["teacher", "admin"]), (req, res) => handleEnsureJoinCode(req, res));
  app.patch("/api/classes/:id/ensureJoinCode", requireAuth, requireRole(["teacher", "admin"]), handleEnsureJoinCode);
  app.patch("/api/classes/:id/ensure-join-code", requireAuth, requireRole(["teacher", "admin"]), handleEnsureJoinCode);

  app.post("/api/classes", requireAuth, requireRole(["teacher", "admin"]), (req, res) => {
    const { name, teacher_id, description, curriculum_track } = req.body;
    const sessionUser = (req.session as any)?.user as SessionUser;
    const effectiveTeacherId = sessionUser.role === "teacher" ? sessionUser.id : teacher_id;

    const trimmedName = typeof name === "string" ? name.trim() : "";
    if (!trimmedName) {
      return res.status(400).json({ success: false, error: "Class name is required" });
    }
    const tid = Number(effectiveTeacherId);
    if (!Number.isInteger(tid) || tid < 1) {
      return res.status(400).json({ success: false, error: "Invalid teacher" });
    }

    const join_code = ensureUniqueJoinCode();
    const insert = db.prepare("INSERT INTO classes (name, teacher_id, description, join_code, curriculum_track) VALUES (?, ?, ?, ?, ?)");
    const result = insert.run(trimmedName, tid, description || "", join_code, String(curriculum_track || "").trim() || null);
    res.json({ success: true, id: result.lastInsertRowid, join_code });
  });

  app.patch("/api/classes/:id/curriculum", requireAuth, requireRole(["teacher", "admin"]), (req, res) => {
    const classId = Number(req.params.id);
    if (!Number.isInteger(classId) || classId < 1) return res.status(400).json({ success: false, error: "Invalid class id" });
    if (!ensureClassAccess(req, res, classId).ok) return;
    const cls = db.prepare("SELECT id FROM classes WHERE id = ?").get(classId);
    if (!cls) return res.status(404).json({ success: false, error: "Class not found" });
    const curriculumTrack = String(req.body?.curriculum_track || "").trim();
    if (!curriculumTrack) return res.status(400).json({ success: false, error: "curriculum_track is required" });
    db.prepare("UPDATE classes SET curriculum_track = ? WHERE id = ?").run(curriculumTrack, classId);
    res.json({ success: true, curriculum_track: curriculumTrack });
  });

  app.post("/api/classes/join", requireAuth, requireRole(["student"]), (req, res) => {
    const { join_code } = req.body;
    const sessionUser = (req.session as any)?.user as SessionUser;
    if (!join_code || typeof join_code !== "string") {
      return res.status(400).json({ error: "join_code required" });
    }
    const code = String(join_code).trim().toUpperCase();
    const cls = db.prepare("SELECT id, name FROM classes WHERE join_code = ?").get(code) as { id: number; name: string } | undefined;
    if (!cls) {
      return res.status(404).json({ error: "Invalid or expired class code" });
    }
    const existing = db.prepare("SELECT 1 FROM class_students WHERE class_id = ? AND student_id = ?").get(cls.id, sessionUser.id);
    if (existing) {
      return res.status(400).json({ error: "Already in this class" });
    }
    db.prepare("INSERT INTO class_students (class_id, student_id) VALUES (?, ?)").run(cls.id, sessionUser.id);
    bumpLastActive(sessionUser.id);
    res.json({ success: true, class_id: cls.id, class_name: cls.name });
  });

  /** Add students to class by name list; create new accounts for names that don't exist. */
  const handleAddStudentsByNames = (req: express.Request, res: express.Response) => {
    try {
      const id = req.params.id ?? req.body?.class_id;
      const classId = id != null ? Number(id) : NaN;
      if (!Number.isInteger(classId) || classId < 1) {
        return res.status(400).json({ success: false, error: "Invalid class id" });
      }
      if (!ensureClassAccess(req, res, classId).ok) return;
      const { names } = req.body;
      const rawNames = Array.isArray(names) ? names.map((n: unknown) => String(n).trim()).filter(Boolean) : [];
      const seen = new Set<string>();
      const uniqueNames = rawNames.filter((n) => {
        const key = n.toLowerCase();
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      });

      const getStudentByName = db.prepare("SELECT id FROM students WHERE LOWER(TRIM(name)) = LOWER(?) LIMIT 1");
      const insertStudent = db.prepare(
        "INSERT INTO students (name, password, level, xp, avatar_url, role) VALUES (?, ?, 1, 0, ?, 'student')"
      );
      const addToClass = db.prepare("INSERT OR IGNORE INTO class_students (class_id, student_id) VALUES (?, ?)");

      const defaultPassword = hashPassword("password123");
      const created: string[] = [];
      let added = 0;

      for (const name of uniqueNames) {
        let row = getStudentByName.get(name) as { id: number } | undefined;
        if (!row) {
          const avatarSeed = encodeURIComponent(name.toLowerCase().replace(/\s+/g, "-"));
          const avatar_url = `https://picsum.photos/seed/${avatarSeed}/200`;
          const result = insertStudent.run(name, defaultPassword, avatar_url);
          row = { id: Number(result.lastInsertRowid) };
          created.push(name);
        }
        const r = addToClass.run(classId, row.id);
        if (r.changes > 0) added += 1;
      }

      res.json({ success: true, created, added });
    } catch (e: unknown) {
      const err = e as Error;
      console.error("by-names error:", e);
      res.status(500).json({ success: false, error: err?.message || "Failed to add students" });
    }
  };
  app.post("/api/classes/add-students-by-names", requireAuth, requireRole(["teacher", "admin"]), handleAddStudentsByNames);
  app.post("/api/classes/:id/addStudentsByNames", requireAuth, requireRole(["teacher", "admin"]), handleAddStudentsByNames);
  app.post("/api/classes/:id/add-students-by-names", requireAuth, requireRole(["teacher", "admin"]), handleAddStudentsByNames);

  app.post("/api/classes/:id/students/bulk", requireAuth, requireRole(["teacher", "admin"]), (req, res) => {
    const classId = req.params.id;
    const classIdNum = Number(classId);
    if (!Number.isInteger(classIdNum) || classIdNum < 1) return res.status(400).json({ success: false, error: "Invalid class id" });
    if (!ensureClassAccess(req, res, classIdNum).ok) return;
    const { student_ids } = req.body;
    const ids = Array.isArray(student_ids) ? student_ids.map((x: unknown) => Number(x)).filter((n: number) => Number.isInteger(n) && n > 0) : [];
    const insert = db.prepare("INSERT OR IGNORE INTO class_students (class_id, student_id) VALUES (?, ?)");
    let added = 0;
    for (const sid of ids) {
      const r = insert.run(classId, sid);
      if (r.changes > 0) added += 1;
    }
    res.json({ success: true, added, total: ids.length });
  });

  app.post("/api/classes/:id/students", requireAuth, requireRole(["teacher", "admin"]), (req, res) => {
    const classId = Number(req.params.id);
    if (!Number.isInteger(classId) || classId < 1) return res.status(400).json({ success: false, error: "Invalid class id" });
    if (!ensureClassAccess(req, res, classId).ok) return;
    const { student_id } = req.body;
    const insert = db.prepare("INSERT OR IGNORE INTO class_students (class_id, student_id) VALUES (?, ?)");
    insert.run(req.params.id, student_id);
    res.json({ success: true });
  });

  app.post("/api/classes/:id/missions", requireAuth, requireRole(["teacher", "admin"]), (req, res) => {
    const classId = Number(req.params.id);
    if (!Number.isInteger(classId) || classId < 1) return res.status(400).json({ success: false, error: "Invalid class id" });
    if (!ensureClassAccess(req, res, classId).ok) return;
    const cls = db.prepare("SELECT curriculum_track FROM classes WHERE id = ?").get(req.params.id) as { curriculum_track?: string | null } | undefined;
    if (!cls) return res.status(404).json({ success: false, error: "Class not found" });
    if (!cls.curriculum_track || !String(cls.curriculum_track).trim()) {
      return res.status(400).json({ success: false, error: "Set curriculum track first before deploying missions." });
    }
    const { mission_id } = req.body;
    const insert = db.prepare("INSERT OR IGNORE INTO class_missions (class_id, mission_id) VALUES (?, ?)");
    insert.run(req.params.id, mission_id);
    res.json({ success: true });
  });

  app.post("/api/classes/:id/quizzes", requireAuth, requireRole(["teacher", "admin"]), (req, res) => {
    const classId = Number(req.params.id);
    if (!Number.isInteger(classId) || classId < 1) return res.status(400).json({ success: false, error: "Invalid class id" });
    if (!ensureClassAccess(req, res, classId).ok) return;
    const cls = db.prepare("SELECT curriculum_track FROM classes WHERE id = ?").get(req.params.id) as { curriculum_track?: string | null } | undefined;
    if (!cls) return res.status(404).json({ success: false, error: "Class not found" });
    if (!cls.curriculum_track || !String(cls.curriculum_track).trim()) {
      return res.status(400).json({ success: false, error: "Set curriculum track first before deploying quizzes." });
    }
    const { quiz_id } = req.body;
    const insert = db.prepare("INSERT OR IGNORE INTO class_quizzes (class_id, quiz_id) VALUES (?, ?)");
    insert.run(req.params.id, quiz_id);
    res.json({ success: true });
  });

  app.get("/api/classes/:id/content", requireAuth, requireRole(["teacher", "admin"]), (req, res) => {
    const classId = req.params.id;
    const classIdNum = Number(classId);
    if (!Number.isInteger(classIdNum) || classIdNum < 1) return res.status(400).json({ success: false, error: "Invalid class id" });
    if (!ensureClassAccess(req, res, classIdNum).ok) return;
    const missions = db
      .prepare(
        `
      SELECT m.*
      FROM missions m
      JOIN class_missions cm ON cm.mission_id = m.id
      WHERE cm.class_id = ?
    `,
      )
      .all(classId);
    const quizzes = db
      .prepare(
        `
      SELECT q.*
      FROM quizzes q
      JOIN class_quizzes cq ON cq.quiz_id = q.id
      WHERE cq.class_id = ?
    `,
      )
      .all(classId);
    const challenges = db
      .prepare(
        `
      SELECT c.* FROM challenges c
      JOIN class_challenges cc ON cc.challenge_id = c.id
      WHERE cc.class_id = ?
    `,
      )
      .all(classId);
    res.json({ missions, quizzes, challenges });
  });

  app.delete("/api/classes/:id/missions/:missionId", requireAuth, requireRole(["teacher", "admin"]), (req, res) => {
    const classId = Number(req.params.id);
    if (!Number.isInteger(classId) || classId < 1) return res.status(400).json({ success: false, error: "Invalid class id" });
    if (!ensureClassAccess(req, res, classId).ok) return;
    const { id, missionId } = req.params;
    const del = db.prepare("DELETE FROM class_missions WHERE class_id = ? AND mission_id = ?");
    del.run(id, missionId);
    res.json({ success: true });
  });

  app.delete("/api/classes/:id/quizzes/:quizId", requireAuth, requireRole(["teacher", "admin"]), (req, res) => {
    const classId = Number(req.params.id);
    if (!Number.isInteger(classId) || classId < 1) return res.status(400).json({ success: false, error: "Invalid class id" });
    if (!ensureClassAccess(req, res, classId).ok) return;
    const { id, quizId } = req.params;
    const del = db.prepare("DELETE FROM class_quizzes WHERE class_id = ? AND quiz_id = ?");
    del.run(id, quizId);
    res.json({ success: true });
  });

  // Student Progress (students can only read own data)
  app.get("/api/students/:id/progress", requireAuth, requireStudentAccess, (req, res) => {
    const studentId = req.params.id;
    const badges = db.prepare("SELECT * FROM student_badges WHERE student_id = ?").all(studentId);
    const quizzes = db.prepare(`
      SELECT sq.*, q.title 
      FROM student_quizzes sq 
      JOIN quizzes q ON sq.quiz_id = q.id 
      WHERE sq.student_id = ?
    `).all(studentId);
    const missionRow = db
      .prepare("SELECT COUNT(*) as n FROM student_mission_completions WHERE student_id = ?")
      .get(studentId) as { n: number };

    res.json({ badges, quizzes, missions_completed: Number(missionRow?.n ?? 0) });
  });

  app.get("/api/students/:id/interests", requireAuth, requireStudentAccess, (req, res) => {
    const studentId = Number(req.params.id);
    if (!Number.isInteger(studentId) || studentId < 1) return res.status(400).json({ success: false, message: "Invalid student id" });
    const selected = db
      .prepare("SELECT interest_key FROM student_interest_votes WHERE student_id = ? ORDER BY weight DESC, created_at DESC")
      .all(studentId) as Array<{ interest_key: string }>;
    res.json({ success: true, selected: selected.map((r) => r.interest_key) });
  });

  app.post("/api/students/:id/interests", requireAuth, requireStudentAccess, (req, res) => {
    const studentId = Number(req.params.id);
    if (!Number.isInteger(studentId) || studentId < 1) return res.status(400).json({ success: false, message: "Invalid student id" });
    const incoming = Array.isArray(req.body?.selected) ? req.body.selected : [];
    const selected = [...new Set(incoming.map((x: unknown) => String(x || "").trim().toLowerCase()).filter(Boolean))].slice(0, 6);
    if (selected.length < 2) {
      return res.status(400).json({ success: false, message: "Select at least 2 interests." });
    }
    const del = db.prepare("DELETE FROM student_interest_votes WHERE student_id = ?");
    const ins = db.prepare("INSERT INTO student_interest_votes (student_id, interest_key, weight) VALUES (?, ?, ?)");
    const tx = db.transaction(() => {
      del.run(studentId);
      selected.forEach((key: string, idx: number) => ins.run(studentId, key, Math.max(1, selected.length - idx)));
    });
    tx();
    res.json({ success: true, selected });
  });

  app.get("/api/students/:id/assigned-quizzes", requireAuth, requireStudentAccess, (req, res) => {
    const studentId = req.params.id;
    const quizzes = db.prepare(`
      SELECT DISTINCT
        q.*,
        (
          SELECT sq.score
          FROM student_quizzes sq
          WHERE sq.student_id = ? AND sq.quiz_id = q.id
          ORDER BY sq.completed_at DESC, sq.id DESC
          LIMIT 1
        ) as latest_score,
        (
          SELECT sq.total_questions
          FROM student_quizzes sq
          WHERE sq.student_id = ? AND sq.quiz_id = q.id
          ORDER BY sq.completed_at DESC, sq.id DESC
          LIMIT 1
        ) as latest_total_questions,
        (
          SELECT sq.completed_at
          FROM student_quizzes sq
          WHERE sq.student_id = ? AND sq.quiz_id = q.id
          ORDER BY sq.completed_at DESC, sq.id DESC
          LIMIT 1
        ) as latest_completed_at,
        (
          SELECT sq.pending_reviews
          FROM student_quizzes sq
          WHERE sq.student_id = ? AND sq.quiz_id = q.id
          ORDER BY sq.completed_at DESC, sq.id DESC
          LIMIT 1
        ) as latest_pending_reviews
      FROM quizzes q
      JOIN class_quizzes cq ON cq.quiz_id = q.id
      JOIN class_students cs ON cs.class_id = cq.class_id
      WHERE cs.student_id = ?
      ORDER BY q.created_at DESC
    `).all(studentId, studentId, studentId, studentId, studentId);
    res.json(quizzes);
  });

  app.get("/api/students/:id/assigned-missions", requireAuth, requireStudentAccess, (req, res) => {
    const studentId = req.params.id;
    let missions = db.prepare(`
      SELECT DISTINCT
        m.*,
        (
          SELECT smc.completed_at
          FROM student_mission_completions smc
          WHERE smc.student_id = ? AND smc.mission_id = m.id
          ORDER BY smc.completed_at DESC
          LIMIT 1
        ) AS latest_completed_at
      FROM missions m
      JOIN class_missions cm ON cm.mission_id = m.id
      JOIN class_students cs ON cs.class_id = cm.class_id
      WHERE cs.student_id = ?
        AND (
          m.prerequisite_mission_id IS NULL
          OR EXISTS (
            SELECT 1
            FROM student_mission_completions smc2
            WHERE smc2.student_id = ?
              AND smc2.mission_id = m.prerequisite_mission_id
          )
          OR EXISTS (
            SELECT 1
            FROM student_mission_completions smc3
            WHERE smc3.student_id = ?
              AND smc3.mission_id = m.id
          )
        )
      ORDER BY m.id DESC
    `).all(studentId, studentId, studentId, studentId);
    if (!Array.isArray(missions) || missions.length === 0) {
      const studentRow = db.prepare("SELECT grade FROM students WHERE id = ?").get(studentId) as { grade?: string | null } | undefined;
      const normalizedGrade = String(studentRow?.grade || "").trim().toLowerCase();
      missions = db.prepare(`
        SELECT
          m.*,
          (
            SELECT smc.completed_at
            FROM student_mission_completions smc
            WHERE smc.student_id = ? AND smc.mission_id = m.id
            ORDER BY smc.completed_at DESC
            LIMIT 1
          ) AS latest_completed_at
        FROM missions m
        WHERE m.status = 'available'
          AND (
            ? = ''
            OR m.grade_level IS NULL
            OR TRIM(m.grade_level) = ''
            OR LOWER(TRIM(m.grade_level)) = ?
          )
          AND (
            m.prerequisite_mission_id IS NULL
            OR EXISTS (
              SELECT 1
              FROM student_mission_completions smc2
              WHERE smc2.student_id = ?
                AND smc2.mission_id = m.prerequisite_mission_id
            )
          )
        ORDER BY m.id DESC
        LIMIT 24
      `).all(studentId, normalizedGrade, normalizedGrade, studentId);
    }
    res.json(missions);
  });

  app.post("/api/students/:id/missions/:missionId/complete", requireAuth, requireStudentAccess, (req, res) => {
    const studentId = Number(req.params.id);
    const missionId = Number(req.params.missionId);
    const sessionUser = (req.session as any)?.user as SessionUser;
    if (sessionUser.id !== studentId) return res.status(403).json({ error: "Forbidden" });
    db.prepare(
      "INSERT OR IGNORE INTO student_mission_completions (student_id, mission_id) VALUES (?, ?)"
    ).run(studentId, missionId);
    bumpLastActive(studentId);
    res.json({ success: true });
  });

  app.get("/api/students/:id/classes", requireAuth, requireStudentAccess, (req, res) => {
    const studentId = req.params.id;
    const classes = db
      .prepare(
        `
      SELECT c.*, t.name as teacher_name,
        (SELECT COUNT(*) FROM class_students WHERE class_id = c.id) as student_count
      FROM classes c
      JOIN class_students cs ON cs.class_id = c.id
      JOIN students t ON t.id = c.teacher_id
      WHERE cs.student_id = ?
    `,
      )
      .all(studentId);
    res.json(classes);
  });

  app.get("/api/students/:id/classmates", requireAuth, requireStudentAccess, (req, res) => {
    const studentId = req.params.id;
    const classmates = db
      .prepare(
        `
      SELECT DISTINCT s.id, s.name, s.level, s.xp, s.avatar_url, s.role
      FROM students s
      JOIN class_students cs ON cs.student_id = s.id
      WHERE cs.class_id IN (
        SELECT class_id FROM class_students WHERE student_id = ?
      )
      AND s.id != ?
      AND s.role = 'student'
      ORDER BY s.xp DESC
    `,
      )
      .all(studentId, studentId);
    res.json(classmates);
  });

  app.post("/api/student-quizzes", requireAuth, (req, res) => {
    const sessionUser = (req.session as any)?.user as SessionUser;
    const { student_id, quiz_id, score, total_questions, auto_score, review_items } = req.body;
    if (sessionUser.role === "student" && Number(student_id) !== sessionUser.id) {
      return res.status(403).json({ success: false, message: "Forbidden" });
    }
    const normalizedAutoScore = Number.isFinite(Number(auto_score)) ? Number(auto_score) : Number(score) || 0;
    const normalizedTotal = Number.isFinite(Number(total_questions)) ? Number(total_questions) : 0;
    const pendingItems = Array.isArray(review_items) ? review_items : [];
    const pendingCount = pendingItems.length;
    const insert = db.prepare(
      "INSERT INTO student_quizzes (student_id, quiz_id, score, auto_score, reviewed_score, pending_reviews, total_questions) VALUES (?, ?, ?, ?, 0, ?, ?)"
    );
    const insertResult = insert.run(student_id, quiz_id, normalizedAutoScore, normalizedAutoScore, pendingCount, normalizedTotal);
    const studentQuizId = Number(insertResult.lastInsertRowid);

    if (pendingItems.length > 0) {
      const insertReview = db.prepare(
        `INSERT INTO quiz_review_items
         (student_quiz_id, student_id, quiz_id, question_index, question_type, prompt, response_text, max_score, awarded_score, review_status)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0, 'pending')`
      );
      const tx = db.transaction((items: any[]) => {
        items.forEach((item) => {
          insertReview.run(
            studentQuizId,
            Number(student_id),
            Number(quiz_id),
            Number(item?.question_index || 0),
            String(item?.question_type || "short_answer"),
            String(item?.prompt || ""),
            String(item?.response_text || ""),
            Math.max(1, Number(item?.max_score || 1))
          );
        });
      });
      tx(pendingItems);
    }
    bumpLastActive(Number(student_id));
    res.json({ success: true, pending_reviews: pendingCount });
  });

  app.get("/api/teacher/quiz-reviews/pending", requireAuth, requireRole(["teacher", "admin"]), (req, res) => {
    const sessionUser = (req.session as any)?.user as SessionUser;
    const classIdRaw = req.query.class_id;
    const classId = classIdRaw != null ? Number(classIdRaw) : null;

    let query = `
      SELECT
        qri.id,
        qri.student_quiz_id,
        qri.student_id,
        s.name as student_name,
        qri.quiz_id,
        q.title as quiz_title,
        qri.question_index,
        qri.prompt,
        qri.response_text,
        qri.max_score,
        qri.created_at
      FROM quiz_review_items qri
      JOIN students s ON s.id = qri.student_id
      JOIN quizzes q ON q.id = qri.quiz_id
      WHERE qri.review_status = 'pending'
        AND EXISTS (
          SELECT 1
          FROM class_students cs
          JOIN class_quizzes cq ON cq.class_id = cs.class_id AND cq.quiz_id = qri.quiz_id
          JOIN classes c ON c.id = cs.class_id
          WHERE cs.student_id = qri.student_id
            AND ${sessionUser.role === "admin" ? "1=1" : "c.teacher_id = ?"}
            ${classId ? "AND c.id = ?" : ""}
        )
      ORDER BY qri.created_at ASC
    `;

    const params: Array<number> = [];
    if (sessionUser.role !== "admin") params.push(sessionUser.id);
    if (classId) params.push(classId);
    const rows = db.prepare(query).all(...params);
    res.json(rows);
  });

  app.post("/api/teacher/quiz-reviews/:id/grade", requireAuth, requireRole(["teacher", "admin"]), (req, res) => {
    const sessionUser = (req.session as any)?.user as SessionUser;
    const reviewId = Number(req.params.id);
    const awardedRaw = Number(req.body?.awarded_score);
    if (!Number.isInteger(reviewId) || reviewId < 1) {
      return res.status(400).json({ success: false, message: "Invalid review id" });
    }

    const review = db
      .prepare(
        `SELECT qri.*, c.teacher_id
         FROM quiz_review_items qri
         JOIN class_students cs ON cs.student_id = qri.student_id
         JOIN class_quizzes cq ON cq.class_id = cs.class_id AND cq.quiz_id = qri.quiz_id
         JOIN classes c ON c.id = cs.class_id
         WHERE qri.id = ?
         LIMIT 1`
      )
      .get(reviewId) as
      | {
          id: number;
          student_quiz_id: number;
          max_score: number;
          review_status: string;
          teacher_id: number;
        }
      | undefined;

    if (!review) return res.status(404).json({ success: false, message: "Review item not found" });
    if (sessionUser.role !== "admin" && review.teacher_id !== sessionUser.id) {
      return res.status(403).json({ success: false, message: "Forbidden" });
    }
    if (review.review_status !== "pending") {
      return res.status(400).json({ success: false, message: "This item is already reviewed" });
    }

    const awarded = Math.max(0, Math.min(Number(review.max_score || 1), Number.isFinite(awardedRaw) ? awardedRaw : 0));
    db.prepare(
      `UPDATE quiz_review_items
       SET awarded_score = ?, review_status = 'reviewed', reviewed_by = ?, reviewed_at = CURRENT_TIMESTAMP
       WHERE id = ?`
    ).run(awarded, sessionUser.id, reviewId);

    const sums = db
      .prepare(
        `SELECT
           COALESCE(SUM(awarded_score), 0) as reviewed_sum,
           SUM(CASE WHEN review_status = 'pending' THEN 1 ELSE 0 END) as pending_count
         FROM quiz_review_items
         WHERE student_quiz_id = ?`
      )
      .get(review.student_quiz_id) as { reviewed_sum: number; pending_count: number };

    const base = db
      .prepare("SELECT auto_score, total_questions FROM student_quizzes WHERE id = ?")
      .get(review.student_quiz_id) as { auto_score: number; total_questions: number } | undefined;
    if (base) {
      const reviewedScore = Number(sums?.reviewed_sum || 0);
      const total = Number(base.total_questions || 0);
      const combined = Math.max(0, Math.min(total, Number(base.auto_score || 0) + reviewedScore));
      db.prepare(
        `UPDATE student_quizzes
         SET reviewed_score = ?, pending_reviews = ?, score = ?
         WHERE id = ?`
      ).run(reviewedScore, Number(sums?.pending_count || 0), combined, review.student_quiz_id);
    }

    res.json({ success: true });
  });

  app.get("/api/report-card/:classId", requireAuth, requireRole(["teacher", "admin"]), (req, res) => {
    const classId = req.params.classId;
    const base = db.prepare(`
      SELECT s.id, s.name, s.level, s.xp,
      (SELECT COUNT(*) FROM student_quizzes WHERE student_id = s.id) as quizzes_completed,
      (SELECT AVG(CAST(score AS FLOAT)/total_questions) * 100 FROM student_quizzes WHERE student_id = s.id) as avg_quiz_score
      FROM students s
      JOIN class_students cs ON s.id = cs.student_id
      WHERE cs.class_id = ?
    `).all(classId) as any[];

    const mkRow = (row: any) => {
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

  app.post("/api/logs", requireAuth, requireRole(["teacher", "admin"]), (req, res) => {
    const { message, type, xp_change } = req.body;
    const insert = db.prepare("INSERT INTO logs (message, type, xp_change) VALUES (?, ?, ?)");
    insert.run(message, type, xp_change);
    res.json({ success: true });
  });

  app.post("/api/student-badges", requireAuth, requireRole(["teacher", "admin"]), (req, res) => {
    const { student_id, badge_name, badge_icon } = req.body;
    const insert = db.prepare("INSERT INTO student_badges (student_id, badge_name, badge_icon) VALUES (?, ?, ?)");
    const result = insert.run(student_id, badge_name, badge_icon || '🏅');
    res.json({ success: true, id: result.lastInsertRowid });
  });

  app.get("/api/me", requireAuth, (req, res) => {
    const sessionUser = (req.session as any)?.user as { id: number } | undefined;
    const user = db
      .prepare(
        "SELECT " + STUDENT_SELECT_PUBLIC + " FROM students WHERE id = ?",
      )
      .get(sessionUser.id);
    if (!user) {
      return res.status(401).json({ authenticated: false });
    }
    bumpLastActive(sessionUser.id);
    res.json({ authenticated: true, user });
  });

  app.patch("/api/me", requireAuth, (req, res) => {
    const sessionUser = (req.session as any)?.user as SessionUser;
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
    const setClause = Object.keys(updates).map((k) => `${k} = ?`).join(", ");
    const values = Object.values(updates);
    db.prepare(`UPDATE students SET ${setClause} WHERE id = ?`).run(...values, sessionUser.id);
    const user = db
      .prepare(
        "SELECT " + STUDENT_SELECT_PUBLIC + " FROM students WHERE id = ?",
      )
      .get(sessionUser.id);
    res.json({ success: true, user: sanitizeUser(user) });
  });

  app.post("/api/me/change-password", requireAuth, (req, res) => {
    const sessionUser = (req.session as any)?.user as SessionUser;
    const { current_password, new_password } = req.body;
    if (!current_password || !new_password) {
      return res.status(400).json({ success: false, message: "Current password and new password required" });
    }
    if (new_password.length < 6) {
      return res.status(400).json({ success: false, message: "New password must be at least 6 characters" });
    }
    const row = db.prepare("SELECT password FROM students WHERE id = ?").get(sessionUser.id) as { password: string } | undefined;
    if (!row || !bcrypt.compareSync(current_password, row.password)) {
      return res.status(401).json({ success: false, message: "Current password is incorrect" });
    }
    const hashed = hashPassword(new_password);
    db.prepare("UPDATE students SET password = ? WHERE id = ?").run(hashed, sessionUser.id);
    res.json({ success: true });
  });

  app.post("/api/logout", (req, res) => {
    req.session = null as any;
    res.json({ success: true });
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.join(__dirname, "dist")));
    app.get("*", (req, res) => {
      res.sendFile(path.join(__dirname, "dist", "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on port ${PORT}`);
  }).on('error', (err) => {
    console.error('Server failed to start:', err);
  });
}

startServer().catch(err => {
  console.error('Failed to start server:', err);
});

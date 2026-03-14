import express from "express";
import { createServer as createViteServer } from "vite";
import Database from "better-sqlite3";
import path from "path";
import { fileURLToPath } from "url";
import bcrypt from "bcryptjs";
import cookieSession from "cookie-session";
import dotenv from "dotenv";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const db = new Database("stemverse.db");

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
    FOREIGN KEY(sector_id) REFERENCES sectors(id)
  );

  CREATE TABLE IF NOT EXISTS classes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    teacher_id INTEGER,
    description TEXT,
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
    total_questions INTEGER,
    completed_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(student_id) REFERENCES students(id),
    FOREIGN KEY(quiz_id) REFERENCES quizzes(id)
  );

  CREATE TABLE IF NOT EXISTS students (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
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
    questions TEXT, -- JSON string
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS challenges (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    type TEXT NOT NULL,
    world TEXT,
    zone TEXT,
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
`);

// Migration: add join_code to classes if missing
try {
  db.exec(`ALTER TABLE classes ADD COLUMN join_code TEXT;`);
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
  { name: "Alex Rivera", password: "student123" },
  { name: "Professor Nova", password: "teacher123" },
  { name: "Admin Core", password: "admin123" },
] as const;
const isBcryptHash = (s: string | null) => typeof s === "string" && /^\$2[aby]\$\d+\$/.test(s);
const updatePasswordById = db.prepare("UPDATE students SET password = ? WHERE id = ?");
for (const { name, password } of DEMO_ACCOUNTS) {
  const row = db.prepare("SELECT id, password FROM students WHERE name = ? COLLATE NOCASE").get(name) as { id: number; password: string } | undefined;
  if (row && !isBcryptHash(row.password)) {
    updatePasswordById.run(hashPassword(password), row.id);
  }
}

async function startServer() {
  const isProduction = process.env.NODE_ENV === "production";
  const SESSION_SECRET = process.env.SESSION_SECRET || "dev-change-me-please";
  if (isProduction && (!SESSION_SECRET || SESSION_SECRET === "dev-change-me-please")) {
    console.error("FATAL: Set SESSION_SECRET to a long random string in production (e.g. 32+ chars).");
    process.exit(1);
  }

  const app = express();
  const PORT = Number(process.env.PORT) || 3000;

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

  const sanitizeUser = (user: any) => {
    if (!user) return null;
    const { password: _pw, ...rest } = user;
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
    if (/<iframe\s[^>]*src\s*=\s*["']https?:\/\/[^"']+["'][^>]*>/i.test(s) && !/</(script|object|embed)/i.test(s)) {
      const srcMatch = s.match(/src\s*=\s*["'](https?:\/\/[^"']+)["']/i);
      if (srcMatch) {
        const url = toEmbeddableUrl(srcMatch[1]).replace(/["'<>]/g, "");
        return `<iframe src="${url}" class="w-full h-full min-h-[400px]" allowfullscreen></iframe>`;
      }
    }
    return null;
  };

  const requireAuth: express.RequestHandler = (req, res, next) => {
    if (!req.session || !(req.session as any).user) {
      return res.status(401).json({ success: false, message: "Unauthorized" });
    }
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
          `SELECT DISTINCT m.*
           FROM missions m
           JOIN class_missions cm ON cm.mission_id = m.id
           JOIN class_students cs ON cs.class_id = cm.class_id
           WHERE cs.student_id = ? AND m.sector_id = ?
           ORDER BY m.id`
        )
        .all(sessionUser.id, sectorId);
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

  app.post("/api/signup", rateLimitAuth, (req, res) => {
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
    } = req.body;

    if (!name || !password || !email || !role) {
      return res.status(400).json({ success: false, message: "Missing required fields" });
    }

    if (role !== "student" && role !== "teacher") {
      return res.status(400).json({ success: false, message: "Invalid role" });
    }

    const avatarSeed = encodeURIComponent(name.trim().toLowerCase().replace(/\s+/g, "-"));
    const avatar_url = `https://picsum.photos/seed/${avatarSeed}/200`;

    const insert = db.prepare(
      `INSERT INTO students
        (name, password, level, xp, avatar_url, role, age, grade, school, city, email, parent_email, contact_number)
       VALUES (?, ?, 1, 0, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    );

    const result = insert.run(
      name,
      hashPassword(password),
      avatar_url,
      role,
      age || null,
      grade || null,
      school || null,
      city || null,
      email || null,
      parent_email || null,
      contact_number || null,
    );

    const user = db
      .prepare(
        "SELECT id, name, level, xp, avatar_url, role, age, grade, school, city, email, parent_email, contact_number FROM students WHERE id = ?",
      )
      .get(result.lastInsertRowid);

    (req.session as any).user = { id: (user as any).id, name: (user as any).name, role: (user as any).role };

    res.json({ success: true, user });
  });

  app.post("/api/login", rateLimitAuth, (req, res) => {
    const { name, password } = req.body;
    console.log(`Login attempt for: ${name}`);

    const user = db
      .prepare(
        "SELECT id, name, level, xp, avatar_url, role, password, age, grade, school, city, email, parent_email, contact_number FROM students WHERE name = ? COLLATE NOCASE",
      )
      .get(name);

    if (!user) {
      console.log(`Login failed: ${name} (no such user)`);
      return res.status(401).json({ success: false, message: "Invalid credentials" });
    }

    const matches = bcrypt.compareSync(password, (user as any).password);

    if (!matches) {
      console.log(`Login failed: ${name} (bad password)`);
      return res.status(401).json({ success: false, message: "Invalid credentials" });
    }

    console.log(`Login success: ${name} (${(user as any).role})`);

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
    const { title, questions } = req.body;
    if (title !== undefined) db.prepare("UPDATE quizzes SET title = ? WHERE id = ?").run(title, id);
    if (questions !== undefined) db.prepare("UPDATE quizzes SET questions = ? WHERE id = ?").run(typeof questions === "string" ? questions : JSON.stringify(questions), id);
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

  app.post("/api/quizzes", requireAuth, requireRole(["teacher", "admin"]), (req, res) => {
    const { title, questions } = req.body;
    const insert = db.prepare("INSERT INTO quizzes (title, questions) VALUES (?, ?)");
    const result = insert.run(title, JSON.stringify(questions));
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
    const { title, type, world, zone, xp_reward, xp_bonus_first_try, xp_retry_penalty, content_json } = req.body;
    if (!title || !type || content_json === undefined) {
      return res.status(400).json({ error: "title, type, and content_json required" });
    }
    const insert = db.prepare(
      "INSERT INTO challenges (title, type, world, zone, xp_reward, xp_bonus_first_try, xp_retry_penalty, content_json) VALUES (?, ?, ?, ?, ?, ?, ?, ?)"
    );
    const result = insert.run(
      title,
      type,
      world || null,
      zone || null,
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
    const { title, type, world, zone, xp_reward, xp_bonus_first_try, xp_retry_penalty, content_json } = req.body;
    const updates: string[] = [];
    const values: unknown[] = [];
    if (title !== undefined) { updates.push("title = ?"); values.push(title); }
    if (type !== undefined) { updates.push("type = ?"); values.push(type); }
    if (world !== undefined) { updates.push("world = ?"); values.push(world); }
    if (zone !== undefined) { updates.push("zone = ?"); values.push(zone); }
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
    const { challenge_id } = req.body;
    if (!challenge_id) return res.status(400).json({ error: "challenge_id required" });
    const classId = Number(req.params.id);
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
    db.prepare("DELETE FROM class_challenges WHERE class_id = ? AND challenge_id = ?").run(req.params.id, req.params.challengeId);
    res.json({ success: true });
  });

  app.get("/api/students/:id/assigned-challenges", requireAuth, requireStudentAccess, (req, res) => {
    const studentId = req.params.id;
    const challenges = db.prepare(`
      SELECT DISTINCT c.* FROM challenges c
      JOIN class_challenges cc ON cc.challenge_id = c.id
      JOIN class_students cs ON cs.class_id = cc.class_id
      WHERE cs.student_id = ?
      ORDER BY c.created_at DESC
    `).all(studentId);
    res.json(challenges);
  });

  app.get("/api/logs", requireAuth, requireRole(["admin"]), (req, res) => {
    const logs = db.prepare("SELECT * FROM logs ORDER BY timestamp DESC LIMIT 20").all();
    res.json(logs);
  });

  app.post("/api/missions", requireAuth, requireRole(["teacher", "admin"]), (req, res) => {
    const { sector_id, title, description, difficulty, xp_reward, image_url, embed_code } = req.body;
    const sessionUser = (req.session as any)?.user as SessionUser | undefined;
    // Allow both teachers and admins to save embed/game URL (normalized on client or as raw string; sanitized below)
    const rawEmbed = typeof embed_code === "string" && embed_code.trim() ? embed_code.trim() : null;
    const safeEmbed = rawEmbed ? sanitizeEmbedCode(rawEmbed) : null;

    const insert = db.prepare(
      "INSERT INTO missions (sector_id, title, description, difficulty, xp_reward, status, image_url, embed_code) VALUES (?, ?, ?, ?, ?, 'available', ?, ?)",
    );
    const result = insert.run(
      sector_id,
      title,
      description,
      difficulty,
      xp_reward,
      image_url || "https://picsum.photos/seed/mission/400/300",
      safeEmbed,
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
    const cls = db.prepare("SELECT * FROM classes WHERE id = ?").get(req.params.id);
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
    const { name, teacher_id, description } = req.body;
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
    const insert = db.prepare("INSERT INTO classes (name, teacher_id, description, join_code) VALUES (?, ?, ?, ?)");
    const result = insert.run(trimmedName, tid, description || "", join_code);
    res.json({ success: true, id: result.lastInsertRowid, join_code });
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
    const { student_id } = req.body;
    const insert = db.prepare("INSERT OR IGNORE INTO class_students (class_id, student_id) VALUES (?, ?)");
    insert.run(req.params.id, student_id);
    res.json({ success: true });
  });

  app.post("/api/classes/:id/missions", requireAuth, requireRole(["teacher", "admin"]), (req, res) => {
    const { mission_id } = req.body;
    const insert = db.prepare("INSERT OR IGNORE INTO class_missions (class_id, mission_id) VALUES (?, ?)");
    insert.run(req.params.id, mission_id);
    res.json({ success: true });
  });

  app.post("/api/classes/:id/quizzes", requireAuth, requireRole(["teacher", "admin"]), (req, res) => {
    const { quiz_id } = req.body;
    const insert = db.prepare("INSERT OR IGNORE INTO class_quizzes (class_id, quiz_id) VALUES (?, ?)");
    insert.run(req.params.id, quiz_id);
    res.json({ success: true });
  });

  app.get("/api/classes/:id/content", requireAuth, requireRole(["teacher", "admin"]), (req, res) => {
    const classId = req.params.id;
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
    const { id, missionId } = req.params;
    const del = db.prepare("DELETE FROM class_missions WHERE class_id = ? AND mission_id = ?");
    del.run(id, missionId);
    res.json({ success: true });
  });

  app.delete("/api/classes/:id/quizzes/:quizId", requireAuth, requireRole(["teacher", "admin"]), (req, res) => {
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
    
    res.json({ badges, quizzes });
  });

  app.get("/api/students/:id/assigned-quizzes", requireAuth, requireStudentAccess, (req, res) => {
    const studentId = req.params.id;
    const quizzes = db.prepare(`
      SELECT DISTINCT q.*
      FROM quizzes q
      JOIN class_quizzes cq ON cq.quiz_id = q.id
      JOIN class_students cs ON cs.class_id = cq.class_id
      WHERE cs.student_id = ?
      ORDER BY q.created_at DESC
    `).all(studentId);
    res.json(quizzes);
  });

  app.post("/api/students/:id/missions/:missionId/complete", requireAuth, requireStudentAccess, (req, res) => {
    const studentId = Number(req.params.id);
    const missionId = Number(req.params.missionId);
    const sessionUser = (req.session as any)?.user as SessionUser;
    if (sessionUser.id !== studentId) return res.status(403).json({ error: "Forbidden" });
    db.prepare(
      "INSERT OR IGNORE INTO student_mission_completions (student_id, mission_id) VALUES (?, ?)"
    ).run(studentId, missionId);
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
    const { student_id, quiz_id, score, total_questions } = req.body;
    if (sessionUser.role === "student" && Number(student_id) !== sessionUser.id) {
      return res.status(403).json({ success: false, message: "Forbidden" });
    }
    const insert = db.prepare("INSERT INTO student_quizzes (student_id, quiz_id, score, total_questions) VALUES (?, ?, ?, ?)");
    insert.run(student_id, quiz_id, score, total_questions);
    res.json({ success: true });
  });

  app.get("/api/report-card/:classId", requireAuth, requireRole(["teacher", "admin"]), (req, res) => {
    const classId = req.params.classId;
    const report = db.prepare(`
      SELECT s.id, s.name, s.level, s.xp,
      (SELECT COUNT(*) FROM student_quizzes WHERE student_id = s.id) as quizzes_completed,
      (SELECT AVG(CAST(score AS FLOAT)/total_questions) * 100 FROM student_quizzes WHERE student_id = s.id) as avg_quiz_score
      FROM students s
      JOIN class_students cs ON s.id = cs.student_id
      WHERE cs.class_id = ?
    `).all(classId);
    res.json(report);
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

  app.get("/api/me", (req, res) => {
    const sessionUser = (req.session as any)?.user as { id: number } | undefined;
    if (!sessionUser) {
      return res.status(401).json({ authenticated: false });
    }
    const user = db
      .prepare(
        "SELECT id, name, level, xp, avatar_url, role, age, grade, school, city, email, parent_email, contact_number FROM students WHERE id = ?",
      )
      .get(sessionUser.id);
    if (!user) {
      return res.status(401).json({ authenticated: false });
    }
    res.json({ authenticated: true, user });
  });

  app.patch("/api/me", requireAuth, (req, res) => {
    const sessionUser = (req.session as any)?.user as SessionUser;
    const allowed = ["name", "avatar_url", "age", "grade", "school", "city", "email", "parent_email", "contact_number"];
    const updates: Record<string, unknown> = {};
    for (const key of allowed) {
      if (req.body[key] !== undefined) updates[key] = req.body[key];
    }
    if (Object.keys(updates).length === 0) {
      return res.status(400).json({ success: false, message: "No valid fields to update" });
    }
    const setClause = Object.keys(updates).map((k) => `${k} = ?`).join(", ");
    const values = Object.values(updates);
    db.prepare(`UPDATE students SET ${setClause} WHERE id = ?`).run(...values, sessionUser.id);
    const user = db
      .prepare(
        "SELECT id, name, level, xp, avatar_url, role, age, grade, school, city, email, parent_email, contact_number FROM students WHERE id = ?",
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

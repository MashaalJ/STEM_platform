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

  CREATE TABLE IF NOT EXISTS logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
    message TEXT NOT NULL,
    type TEXT,
    xp_change INTEGER
  );
`);

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

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  app.use(
    cookieSession({
      name: "stemverse_sess",
      keys: [process.env.SESSION_SECRET || "dev-change-me-please"],
      maxAge: 1000 * 60 * 60 * 24 * 7, // 7 days
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
    }),
  );

  type SessionUser = { id: number; name: string; role: string };

  const sanitizeUser = (user: any) => {
    if (!user) return null;
    const { password: _pw, ...rest } = user;
    return rest;
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
    const missions = db.prepare("SELECT * FROM missions WHERE sector_id = ?").all(req.params.id);
    res.json({ ...sector, missions });
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

  app.get("/api/quizzes", (req, res) => {
    const quizzes = db.prepare("SELECT * FROM quizzes ORDER BY created_at DESC").all();
    res.json(quizzes);
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

  app.get("/api/logs", requireAuth, requireRole(["admin"]), (req, res) => {
    const logs = db.prepare("SELECT * FROM logs ORDER BY timestamp DESC LIMIT 20").all();
    res.json(logs);
  });

  app.post("/api/missions", requireAuth, requireRole(["teacher", "admin"]), (req, res) => {
    const { sector_id, title, description, difficulty, xp_reward, image_url, embed_code } = req.body;
    const sessionUser = (req.session as any)?.user as SessionUser | undefined;
    const safeEmbed =
      sessionUser && sessionUser.role === "admin"
        ? embed_code || null
        : null;

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

  app.post("/api/classes", requireAuth, requireRole(["teacher", "admin"]), (req, res) => {
    const { name, teacher_id, description } = req.body;
    const sessionUser = (req.session as any)?.user as SessionUser;
    const effectiveTeacherId = sessionUser.role === "teacher" ? sessionUser.id : teacher_id;

    const insert = db.prepare("INSERT INTO classes (name, teacher_id, description) VALUES (?, ?, ?)");
    const result = insert.run(name, effectiveTeacherId, description);
    res.json({ success: true, id: result.lastInsertRowid });
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
    res.json({ missions, quizzes });
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

  // Student Progress
  app.get("/api/students/:id/progress", requireAuth, (req, res) => {
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

  app.get("/api/students/:id/assigned-quizzes", requireAuth, (req, res) => {
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

  app.get("/api/students/:id/classes", requireAuth, (req, res) => {
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

  app.get("/api/students/:id/classmates", requireAuth, (req, res) => {
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
    const { student_id, quiz_id, score, total_questions } = req.body;
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
    console.log(`Server running on http://localhost:${PORT}`);
  }).on('error', (err) => {
    console.error('Server failed to start:', err);
  });
}

startServer().catch(err => {
  console.error('Failed to start server:', err);
});

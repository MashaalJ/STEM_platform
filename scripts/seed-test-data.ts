/**
 * Seed staging Supabase with realistic STEMverse test accounts.
 *
 * Run: npx tsx scripts/seed-test-data.ts
 * Clean first: npx tsx scripts/seed-test-data.ts --clean
 */
import "dotenv/config";
import {
  db,
  selectOne,
  selectMany,
  insertOne,
  updateRow,
  deleteRows,
  insertIgnore,
  findSectorByName,
  usernameExists,
  joinCodeExists,
  type DbRow,
} from "../lib/db.ts";
import { supabaseAdmin, hasSupabaseAdmin } from "../lib/supabaseAdmin.ts";
import { generateUniqueStudentUsername } from "../src/lib/usernameGen.ts";

const TEST_DOMAIN = "@stemverse-test.com";
const TEACHER_PASSWORD = "Test1234!";
const STUDENT_PASSWORD = "Student1234!";
const DARK_CITY_SECTOR_NAME = "Dark City";
const ELECTRICITY_PRE_FLOW_EMBED = "stemverse://electricity-pre-flow";
const OHMS_LAW_EMBED = "stemverse://ohms-law-explorer";

/** Known production Supabase project URLs — seeding is blocked against these. */
const BLOCKED_SUPABASE_URLS = new Set<string>([
  // Update with your production project URL if it does not contain "prod":
  // "https://your-production-ref.supabase.co",
]);

const TEACHERS = [
  { email: "sarah.teacher@stemverse-test.com", name: "Ms. Sarah Ahmed", className: "Grade 5 Builders" },
  { email: "ali.teacher@stemverse-test.com", name: "Mr. Ali Hassan", className: "Grade 7 Makers" },
  { email: "demo.teacher@stemverse-test.com", name: "Demo Teacher", className: "Demo Class" },
] as const;

const TEST_CLASS_NAMES = TEACHERS.map((t) => t.className);

type AuthRole = "student" | "teacher" | "parent";

function normalizeSupabaseUrl(raw: string): string {
  return raw.trim().replace(/\/+$/, "").toLowerCase();
}

function assertSafeTargetDatabase(): void {
  const raw = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || "";
  if (!raw.trim()) {
    console.error("SUPABASE_URL is not set. Refusing to seed.");
    process.exit(1);
  }
  const normalized = normalizeSupabaseUrl(raw);
  if (normalized.includes("prod")) {
    console.error(`Refusing to seed: SUPABASE_URL appears to be production (${raw})`);
    process.exit(1);
  }
  for (const blocked of BLOCKED_SUPABASE_URLS) {
    if (normalizeSupabaseUrl(blocked) === normalized) {
      console.error(`Refusing to seed: SUPABASE_URL matches blocked production URL (${raw})`);
      process.exit(1);
    }
  }
}

function studentEmail(index: number): string {
  return `student${String(index).padStart(2, "0")}${TEST_DOMAIN}`;
}

function studentDisplayName(index: number): string {
  return `Test Student ${String(index).padStart(2, "0")}`;
}

function randomTimestampWithinDays(days: number): string {
  const now = Date.now();
  const spanMs = days * 24 * 60 * 60 * 1000;
  return new Date(now - Math.floor(Math.random() * spanMs)).toISOString();
}

function generateJoinCode(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "";
  for (let i = 0; i < 6; i += 1) code += chars[Math.floor(Math.random() * chars.length)];
  return code;
}

async function ensureUniqueJoinCode(): Promise<string> {
  let code = generateJoinCode();
  while (await joinCodeExists(code)) code = generateJoinCode();
  return code;
}

async function findUserByEmail(email: string): Promise<{ id: string } | null> {
  return selectOne<{ id: string }>("students", "id", { email });
}

async function createAuthUser(
  email: string,
  password: string,
  name: string,
  role: AuthRole,
  username?: string,
): Promise<string> {
  if (!supabaseAdmin) throw new Error("Supabase admin client is not configured");

  const existing = await findUserByEmail(email);
  if (existing) return existing.id;

  const mappedRole = role === "teacher" ? "educator" : role;
  const created = await supabaseAdmin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: {
      role: mappedRole,
      display_name: name,
      ...(username ? { username } : {}),
    },
  });

  if (created.error || !created.data.user?.id) {
    throw new Error(`Failed to create ${email}: ${created.error?.message || "unknown error"}`);
  }

  const userId = created.data.user.id;

  await updateRow("students", { id: userId }, {
    name,
    email,
    role,
    ...(username ? { username } : {}),
    password,
  });

  if (role === "parent") {
    const parentRow = await selectOne("parents", "id", { auth_id: userId });
    if (!parentRow) {
      await insertOne("parents", { auth_id: userId, name, email, student_id: null });
    }
  }

  return userId;
}

async function cleanTestAccounts(): Promise<void> {
  console.log("Cleaning existing test accounts…");

  for (const className of TEST_CLASS_NAMES) {
    const cls = await selectOne<{ id: string }>("classes", "id", { name: className });
    if (cls) await deleteRows("classes", { id: cls.id });
  }

  const { data: testStudents, error: listErr } = await db()
    .from("students")
    .select("id, email")
    .ilike("email", `%${TEST_DOMAIN}`);

  if (listErr) throw new Error(`clean list students: ${listErr.message}`);

  const ids = (testStudents || []).map((r) => String((r as { id: string }).id));
  for (const id of ids) {
    if (!supabaseAdmin) continue;
    const { error } = await supabaseAdmin.auth.admin.deleteUser(id);
    if (error) {
      console.warn(`  Could not delete auth user ${id}: ${error.message}`);
      await deleteRows("students", { id });
    }
  }

  console.log(`  Removed ${ids.length} test account(s).`);
}

async function resolveDarkCityMissions(): Promise<{
  sectorId: string;
  circuitRescue: DbRow;
  ohmsLaw: DbRow;
}> {
  const sector = await findSectorByName(DARK_CITY_SECTOR_NAME);
  if (!sector?.id) {
    throw new Error(
      `Sector "${DARK_CITY_SECTOR_NAME}" not found. Start the dev server once to bootstrap content, then re-run.`,
    );
  }

  const sectorId = String(sector.id);
  const missions = await selectMany<DbRow>("missions", "*", { sector_id: sectorId });

  let circuitRescue = missions.find(
    (m) =>
      String(m.embed_code || "").toLowerCase() === ELECTRICITY_PRE_FLOW_EMBED.toLowerCase() ||
      String(m.title || "").includes("Circuit Rescue"),
  );
  let ohmsLaw = missions.find(
    (m) =>
      String(m.embed_code || "").toLowerCase().includes("ohms-law") ||
      String(m.title || "").toLowerCase().includes("ohm"),
  );

  if (!circuitRescue) {
    circuitRescue = await insertOne("missions", {
      sector_id: sectorId,
      title: "Circuit Rescue: Power the Grid",
      description: "NOVA's electricity pre-flow — build circuits, then launch into Dark City.",
      difficulty: "Easy",
      xp_reward: 200,
      status: "available",
      embed_code: ELECTRICITY_PRE_FLOW_EMBED,
    });
  }

  if (!ohmsLaw) {
    ohmsLaw = await insertOne("missions", {
      sector_id: sectorId,
      title: "Ohm's Law Explorer",
      description: "Explore voltage, current, and resistance with interactive circuits.",
      difficulty: "Medium",
      xp_reward: 150,
      status: "available",
      embed_code: OHMS_LAW_EMBED,
    });
  }

  return { sectorId, circuitRescue, ohmsLaw };
}

function assignMissionCounts(totalStudents: number): number[] {
  const counts = Array.from({ length: totalStudents }, () => Math.floor(Math.random() * 3));
  let bothComplete = counts.filter((c) => c === 2).length;
  if (bothComplete >= 5) return counts;

  const candidates = counts
    .map((c, i) => ({ c, i }))
    .filter(({ c }) => c < 2)
    .map(({ i }) => i);
  for (let i = candidates.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [candidates[i], candidates[j]] = [candidates[j]!, candidates[i]!];
  }

  let need = 5 - bothComplete;
  for (const idx of candidates) {
    if (need <= 0) break;
    counts[idx] = 2;
    bothComplete += 1;
    need -= 1;
  }

  return counts;
}

async function seedMissionProgress(
  studentIds: string[],
  sectorId: string,
  circuitRescue: DbRow,
  ohmsLaw: DbRow,
): Promise<number> {
  const missionCounts = assignMissionCounts(studentIds.length);
  let completionsCreated = 0;

  for (let i = 0; i < studentIds.length; i += 1) {
    const studentId = studentIds[i]!;
    const count = missionCounts[i] ?? 0;
    const pickCircuitFirst = Math.random() < 0.5;
    const missionsToComplete: DbRow[] =
      count === 0
        ? []
        : count === 1
          ? [pickCircuitFirst ? circuitRescue : ohmsLaw]
          : pickCircuitFirst
            ? [circuitRescue, ohmsLaw]
            : [ohmsLaw, circuitRescue];

    let xpEarned = 0;
    for (const mission of missionsToComplete) {
      const completedAt = randomTimestampWithinDays(30);
      const { error } = await db()
        .from("student_mission_completions")
        .upsert(
          { student_id: studentId, mission_id: String(mission.id), completed_at: completedAt },
          { onConflict: "student_id,mission_id" },
        );
      if (error) throw new Error(`completion upsert: ${error.message}`);
      completionsCreated += 1;
      xpEarned += Number(mission.xp_reward) || 0;
    }

    const masteryPercent = count === 2 ? 100 : count === 1 ? 50 : 0;
    const { error: masteryErr } = await db()
      .from("student_sector_mastery")
      .upsert(
        {
          student_id: studentId,
          sector_id: sectorId,
          mastery_percent: masteryPercent,
          updated_at: randomTimestampWithinDays(30),
        },
        { onConflict: "student_id,sector_id" },
      );
    if (masteryErr) throw new Error(`mastery upsert: ${masteryErr.message}`);

    await updateRow("students", { id: studentId }, { xp: xpEarned });
  }

  return completionsCreated;
}

async function countRoboticsUnlocked(darkCitySectorId: string, studentIds: string[]): Promise<number> {
  const robotics =
    (await findSectorByName("Robotics City")) ?? (await findSectorByName("Robotics Lab"));
  const threshold = Number(robotics?.unlock_mastery_percent) || 80;
  const prereqSectorId = String(robotics?.unlock_sector_id || darkCitySectorId);
  const seeded = new Set(studentIds);

  const rows = await selectMany<{ student_id: string; mastery_percent: number }>(
    "student_sector_mastery",
    "student_id, mastery_percent",
    { sector_id: prereqSectorId },
  );

  return rows.filter(
    (r) => seeded.has(String(r.student_id)) && Number(r.mastery_percent) >= threshold,
  ).length;
}

async function main(): Promise<void> {
  assertSafeTargetDatabase();

  if (!hasSupabaseAdmin || !supabaseAdmin) {
    console.error("Supabase admin is not configured (SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY).");
    process.exit(1);
  }

  const shouldClean = process.argv.includes("--clean");
  if (shouldClean) await cleanTestAccounts();

  const { sectorId, circuitRescue, ohmsLaw } = await resolveDarkCityMissions();

  const teacherIds: string[] = [];
  const classIds: string[] = [];

  for (const teacher of TEACHERS) {
    const teacherId = await createAuthUser(teacher.email, TEACHER_PASSWORD, teacher.name, "teacher");
    teacherIds.push(teacherId);

    const existingClass = await selectOne<{ id: string; teacher_id?: string | null }>(
      "classes",
      "id, teacher_id",
      { name: teacher.className },
    );

    let classId: string;
    if (existingClass) {
      classId = existingClass.id;
      if (String(existingClass.teacher_id || "") !== teacherId) {
        await updateRow("classes", { id: classId }, { teacher_id: teacherId });
      }
    } else {
      const created = await insertOne<{ id: string }>("classes", {
        name: teacher.className,
        teacher_id: teacherId,
        description: `Test class for ${teacher.name}`,
        join_code: await ensureUniqueJoinCode(),
      });
      classId = created.id;
    }
    classIds.push(classId);

    for (const mission of [circuitRescue, ohmsLaw]) {
      await insertIgnore(
        "class_missions",
        {
          class_id: classId,
          mission_id: String(mission.id),
          assigned_by: teacherId,
        },
        "class_id,mission_id",
      );
    }
  }

  const studentIds: string[] = [];
  for (let n = 1; n <= 35; n += 1) {
    const email = studentEmail(n);
    const name = studentDisplayName(n);
    let studentId = (await findUserByEmail(email))?.id;

    if (!studentId) {
      const username = await generateUniqueStudentUsername(usernameExists);
      studentId = await createAuthUser(email, STUDENT_PASSWORD, name, "student", username);
    } else {
      const username = await generateUniqueStudentUsername(usernameExists);
      await updateRow("students", { id: studentId }, { name, username, password: STUDENT_PASSWORD });
    }

    studentIds.push(studentId);

    let classId: string | null = null;
    if (n <= 10) classId = classIds[0]!;
    else if (n <= 20) classId = classIds[1]!;
    else if (n <= 30) classId = classIds[2]!;

    if (n > 30) {
      await deleteRows("class_students", { student_id: studentId });
    } else if (classId) {
      await insertIgnore("class_students", { class_id: classId, student_id: studentId }, "class_id,student_id");
    }
  }

  const parent01Id = await createAuthUser(
    "parent01@stemverse-test.com",
    TEACHER_PASSWORD,
    "Test Parent One",
    "parent",
  );
  await updateRow("parents", { auth_id: parent01Id }, { student_id: studentIds[0] });

  const parent02Id = await createAuthUser(
    "parent02@stemverse-test.com",
    TEACHER_PASSWORD,
    "Test Parent Two",
    "parent",
  );
  await updateRow("parents", { auth_id: parent02Id }, { student_id: studentIds[5] });

  const completionsCreated = await seedMissionProgress(studentIds, sectorId, circuitRescue, ohmsLaw);
  const roboticsUnlocked = await countRoboticsUnlocked(sectorId, studentIds);

  console.log("");
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log("STEMverse Test Data Seeding Complete");
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log(`Teachers created:    ${TEACHERS.length}`);
  console.log(`Classes created:     ${TEST_CLASS_NAMES.length}`);
  console.log(`Students created:    ${studentIds.length}`);
  console.log(`Parents created:     2`);
  console.log(`Completions created: ${completionsCreated}`);
  console.log(`Students with Robotics City unlocked: ${roboticsUnlocked}`);
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log(`Login credentials: ${TEACHER_PASSWORD} / ${STUDENT_PASSWORD}`);
  console.log(`Teacher: ${TEACHERS[0]!.email}`);
  console.log(`Student: ${studentEmail(1)}`);
  console.log(`Parent:  parent01@stemverse-test.com`);
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log("");
  console.log("Run with: npx tsx scripts/seed-test-data.ts");
}

main().catch((err) => {
  console.error("Seed failed:", err instanceof Error ? err.message : err);
  process.exit(1);
});

/**
 * Duolingo-style hub: individual learners belong to the default STEMverse school.
 */
import { db, selectOne, updateRow, insertOne, countRows } from "./db.ts";
import * as Curriculum from "./curriculum.ts";
import { assertSchoolStudentCapacity } from "./schoolLimits.ts";

const DEFAULT_NAME = () =>
  String(process.env.DEFAULT_INDIVIDUAL_SCHOOL_NAME || "STEMverse").trim() || "STEMverse";

let cachedSchoolId: { id: string; at: number } | null = null;
const CACHE_MS = 60_000;

export function getDefaultIndividualSchoolName(): string {
  return DEFAULT_NAME();
}

/** Resolve the school row used for self-serve / individual signups. */
export async function resolveDefaultIndividualSchoolId(): Promise<string | null> {
  if (cachedSchoolId && Date.now() - cachedSchoolId.at < CACHE_MS) {
    return cachedSchoolId.id;
  }
  const name = DEFAULT_NAME();
  const { data, error } = await db()
    .from("schools")
    .select("id, name, subscription_status")
    .ilike("name", name)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data?.id) return null;
  if (String(data.subscription_status || "").toLowerCase() === "suspended") return null;
  const id = String(data.id);
  cachedSchoolId = { id, at: Date.now() };
  return id;
}

/** Link a student to the STEMverse hub if they are not already in a school. */
export async function attachStudentToDefaultIndividualSchool(
  studentId: string,
): Promise<{ attached: boolean; schoolId?: string; reason?: string }> {
  if (!studentId) return { attached: false, reason: "missing_id" };
  const row = await selectOne<{ role: string; school_id: string | null }>("students", "role, school_id", {
    id: studentId,
  });
  if (!row || row.role !== "student") return { attached: false, reason: "not_student" };
  if (row.school_id) return { attached: false, reason: "already_linked", schoolId: String(row.school_id) };

  const schoolId = await resolveDefaultIndividualSchoolId();
  if (!schoolId) return { attached: false, reason: "no_default_school" };

  const school = await selectOne<{ name: string; max_students: number }>("schools", "name, max_students", {
    id: schoolId,
  });
  if (!school) return { attached: false, reason: "school_missing" };

  const cap = await assertSchoolStudentCapacity(schoolId, Number(school.max_students ?? 300), 1);
  if (!cap.ok) return { attached: false, reason: "capacity", schoolId };

  await updateRow(
    "students",
    { id: studentId },
    {
      school_id: schoolId,
      school: String(school.name || DEFAULT_NAME()),
    },
  );
  return { attached: true, schoolId };
}

/** Ensure STEMverse Default class exists under the hub school (for self-paced learners). */
export async function ensureStemverseIndividualHubClass(
  ensureJoinCode: () => Promise<string>,
): Promise<void> {
  const schoolId = await resolveDefaultIndividualSchoolId();
  if (!schoolId) return;

  let cls = await Curriculum.findClassByName(Curriculum.STEMVERSE_DEFAULT_CLASS_NAME);
  if (!cls) {
    const admin = await selectOne<{ id: string }>("students", "id", { role: "admin" });
    const teacher =
      admin ||
      (await selectOne<{ id: string }>("students", "id", { role: "teacher", school_id: schoolId }));
    cls = await insertOne("classes", {
      name: Curriculum.STEMVERSE_DEFAULT_CLASS_NAME,
      school_id: schoolId,
      teacher_id: teacher?.id ?? null,
      description: "Self-paced STEMverse learners (individual signups)",
      curriculum_track: "default",
      join_code: await ensureJoinCode(),
    });
  } else {
    const patch: Record<string, unknown> = {};
    if (!cls.school_id) patch.school_id = schoolId;
    if (Object.keys(patch).length) await updateRow("classes", { id: String(cls.id) }, patch);
  }
}

export async function countDefaultHubStudents(): Promise<number> {
  const schoolId = await resolveDefaultIndividualSchoolId();
  if (!schoolId) return 0;
  return countRows("students", { school_id: schoolId, role: "student" });
}

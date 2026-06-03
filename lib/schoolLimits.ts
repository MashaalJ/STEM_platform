import { db, selectMany, countRows } from "./db";

/** Distinct students enrolled in any class belonging to the school. */
export async function countSchoolStudents(schoolId: string): Promise<number> {
  const classes = await selectMany<{ id: string }>("classes", "id", { school_id: schoolId });
  const classIds = classes.map((c) => String(c.id));
  if (!classIds.length) {
    return countRows("students", { school_id: schoolId, role: "student" });
  }
  const { data, error } = await db().from("class_students").select("student_id").in("class_id", classIds);
  if (error) throw new Error(error.message);
  return new Set((data || []).map((r) => String((r as { student_id: string }).student_id))).size;
}

export async function assertSchoolStudentCapacity(
  schoolId: string,
  maxStudents: number,
  extraEnrollments = 1,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const current = await countSchoolStudents(schoolId);
  if (current + extraEnrollments > Number(maxStudents || 50)) {
    return {
      ok: false,
      error:
        "Student limit reached for this school. Contact your school administrator.",
    };
  }
  return { ok: true };
}

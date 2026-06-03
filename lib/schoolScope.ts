import { selectOne, type DbRow } from "./db";

export async function getUserSchoolId(userId: string): Promise<string | null> {
  const row = await selectOne<{ school_id: string | null }>("students", "school_id", { id: userId });
  return row?.school_id ? String(row.school_id) : null;
}

export async function enrichUserWithSchool(user: DbRow): Promise<DbRow> {
  const schoolId = user.school_id ? String(user.school_id) : null;
  const role = String(user.role || "");
  let school_record: DbRow | null = null;
  if (schoolId) {
    school_record = await selectOne(
      "schools",
      "id, name, city, country, tier, subscription_status, subscription_expires_at, max_teachers, max_students",
      { id: schoolId },
    );
  }
  const needs_school_activation = role === "school_admin" && !schoolId;
  const needs_teacher_invite = role === "teacher" && !schoolId;
  return {
    ...user,
    school_record_name: school_record?.name ? String(school_record.name) : null,
    school_record: school_record || undefined,
    needs_school_activation,
    needs_teacher_invite,
  };
}

import { db, selectOne, updateRow, type DbRow } from "./db";

const CODE_CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

/** Normalize codes entered by humans (spaces, dashes, mixed case). */
export function normalizeActivationCode(raw: string): string {
  return String(raw || "")
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "");
}

export function generateSchoolCode(length = 8): string {
  let out = "";
  for (let i = 0; i < length; i += 1) {
    out += CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)];
  }
  return out;
}

export async function generateUniqueActivationCode(): Promise<string> {
  for (let i = 0; i < 20; i += 1) {
    const code = generateSchoolCode(8);
    const existing = await selectOne("schools", "id", { activation_code: code });
    if (!existing) return code;
  }
  throw new Error("Could not generate unique activation code");
}

/** Find school waiting for principal activation (exact match after normalize). */
export async function findSchoolByActivationCode(rawCode: string): Promise<DbRow | null> {
  const code = normalizeActivationCode(rawCode);
  if (!code || code.length < 6) return null;

  let school = await selectOne<DbRow>("schools", "*", { activation_code: code });
  if (school) return school;

  const { data, error } = await db()
    .from("schools")
    .select("*")
    .eq("activation_code", code)
    .limit(1)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (data) return data as DbRow;

  const { data: rows, error: listErr } = await db()
    .from("schools")
    .select("*")
    .not("activation_code", "is", null);
  if (listErr) throw new Error(listErr.message);
  for (const row of rows || []) {
    const stored = normalizeActivationCode(String((row as DbRow).activation_code || ""));
    if (stored === code) return row as DbRow;
  }
  return null;
}

async function isCodeTaken(code: string): Promise<boolean> {
  if (await selectOne("schools", "id", { activation_code: code })) return true;
  if (await selectOne("schools", "id", { teacher_join_code: code })) return true;
  if (await selectOne("teacher_invites", "id", { code })) return true;
  return false;
}

export async function generateUniqueTeacherInviteCode(): Promise<string> {
  for (let i = 0; i < 20; i += 1) {
    const code = generateSchoolCode(8);
    if (!(await isCodeTaken(code))) return code;
  }
  throw new Error("Could not generate unique invite code");
}

/** Reusable code on the school — many teachers can use the same one (until max_teachers). */
export async function generateUniqueTeacherJoinCode(): Promise<string> {
  for (let i = 0; i < 20; i += 1) {
    const code = generateSchoolCode(8);
    if (!(await isCodeTaken(code))) return code;
  }
  throw new Error("Could not generate unique teacher join code");
}

export async function ensureSchoolTeacherJoinCode(schoolId: string): Promise<string> {
  const school = await selectOne<DbRow>("schools", "teacher_join_code", { id: schoolId });
  const existing = school?.teacher_join_code
    ? normalizeActivationCode(String(school.teacher_join_code))
    : "";
  if (existing.length >= 8) return existing;

  const code = await generateUniqueTeacherJoinCode();
  await updateRow("schools", { id: schoolId }, { teacher_join_code: code });
  return code;
}

/** Find school by reusable teacher join code. */
export async function findSchoolByTeacherJoinCode(rawCode: string): Promise<DbRow | null> {
  const code = normalizeActivationCode(rawCode);
  if (!code || code.length < 6) return null;

  let school = await selectOne<DbRow>("schools", "*", { teacher_join_code: code });
  if (school) return school;

  const { data, error } = await db().from("schools").select("*").eq("teacher_join_code", code).limit(1).maybeSingle();
  if (error) throw new Error(error.message);
  if (data) return data as DbRow;

  const { data: rows, error: listErr } = await db()
    .from("schools")
    .select("*")
    .not("teacher_join_code", "is", null);
  if (listErr) throw new Error(listErr.message);
  for (const row of rows || []) {
    const stored = normalizeActivationCode(String((row as DbRow).teacher_join_code || ""));
    if (stored === code) return row as DbRow;
  }
  return null;
}

/** Used one-time invite — for clearer errors when teachers reuse an old invite. */
export async function findUsedTeacherInviteByCode(rawCode: string): Promise<DbRow | null> {
  const code = normalizeActivationCode(rawCode);
  if (!code) return null;
  const invite = await selectOne<DbRow>("teacher_invites", "*", { code });
  if (invite?.used) return invite;
  const { data } = await db().from("teacher_invites").select("*").eq("code", code).eq("used", true).limit(1).maybeSingle();
  return (data as DbRow) || null;
}

/** Find unused teacher invite (exact match after normalize). */
export async function findTeacherInviteByCode(rawCode: string): Promise<DbRow | null> {
  const code = normalizeActivationCode(rawCode);
  if (!code || code.length < 6) return null;

  let invite = await selectOne<DbRow>("teacher_invites", "*", { code });
  if (invite && !invite.used) return invite;

  const { data, error } = await db()
    .from("teacher_invites")
    .select("*")
    .eq("code", code)
    .eq("used", false)
    .limit(1)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (data) return data as DbRow;

  const { data: rows, error: listErr } = await db().from("teacher_invites").select("*").eq("used", false);
  if (listErr) throw new Error(listErr.message);
  for (const row of rows || []) {
    const stored = normalizeActivationCode(String((row as DbRow).code || ""));
    if (stored === code) return row as DbRow;
  }
  return null;
}

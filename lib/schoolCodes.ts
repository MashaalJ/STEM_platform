import { db, selectOne, type DbRow } from "./db";

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

export async function generateUniqueTeacherInviteCode(): Promise<string> {
  for (let i = 0; i < 20; i += 1) {
    const code = generateSchoolCode(8);
    const existing = await selectOne("teacher_invites", "id", { code });
    if (!existing) return code;
  }
  throw new Error("Could not generate unique invite code");
}

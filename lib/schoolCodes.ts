import { selectOne } from "./db";

const CODE_CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

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

export async function generateUniqueTeacherInviteCode(): Promise<string> {
  for (let i = 0; i < 20; i += 1) {
    const code = generateSchoolCode(8);
    const existing = await selectOne("teacher_invites", "id", { code });
    if (!existing) return code;
  }
  throw new Error("Could not generate unique invite code");
}

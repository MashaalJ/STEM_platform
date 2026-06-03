const PW_CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789abcdefghjkmnpqrstuvwxyz";

export function generateRosterPassword(length = 10): string {
  let out = "";
  for (let i = 0; i < length; i += 1) {
    out += PW_CHARS[Math.floor(Math.random() * PW_CHARS.length)];
  }
  return out;
}

export type RosterCredentialRow = {
  name: string;
  username: string;
  password: string;
  is_new: boolean;
  student_id: string;
};

export function normalizeCurriculumTrack(raw: string | null | undefined): "core_stem" | "advanced" | "custom" {
  const t = String(raw || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "_");
  if (t === "core_stem" || t === "core") return "core_stem";
  if (t === "advanced") return "advanced";
  if (t === "custom") return "custom";
  return "custom";
}

export const CURRICULUM_TRACK_LABELS: Record<"core_stem" | "advanced" | "custom", string> = {
  core_stem: "Core STEM",
  advanced: "Advanced",
  custom: "Custom",
};

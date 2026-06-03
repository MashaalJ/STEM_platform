/**
 * Curriculum resolution — class overrides, default curriculum, global fallbacks.
 */
import {
  db,
  selectOne,
  selectMany,
  selectAllMissions,
  upsertRow,
  type DbRow,
} from "./db";
import { normalizeCurriculumTrack } from "./rosterCredentials.ts";

export const STEMVERSE_DEFAULT_CLASS_NAME = "STEMverse Default";
export const STEMVERSE_ADVANCED_CLASS_NAME = "STEMverse Advanced";

export type CurriculumOverrideRow = {
  mission_id: string;
  sector_id?: string | null;
  is_enabled?: boolean;
  custom_order?: number | null;
  custom_title?: string | null;
  custom_description?: string | null;
  unlock_after_mission_id?: string | null;
};

export type CurriculumMissionView = DbRow & {
  is_enabled: boolean;
  custom_order: number | null;
  custom_title: string | null;
  custom_description: string | null;
  unlock_after_mission_id: string | null;
  effective_title: string;
  effective_description: string;
  has_override: boolean;
};

async function loadSectorsForCurriculum(): Promise<DbRow[]> {
  try {
    return await selectMany<DbRow>("sectors", "*", undefined, { column: "sort_order", ascending: true });
  } catch {
    // Backward-compat for DBs that don't have sort_order yet.
    return await selectMany<DbRow>("sectors", "*");
  }
}

async function loadMissionsForCurriculum(): Promise<DbRow[]> {
  try {
    return await selectMany<DbRow>("missions", "*", undefined, { column: "created_at", ascending: true });
  } catch {
    return await selectMany<DbRow>("missions", "*");
  }
}

export async function findClassByName(name: string): Promise<DbRow | null> {
  const { data, error } = await db().from("classes").select("*").ilike("name", name).limit(1).maybeSingle();
  if (error) throw new Error(`findClassByName: ${error.message}`);
  return data;
}

export async function isDefaultClass(classId: string): Promise<boolean> {
  const cls = await selectOne<{ name: string }>("classes", "name", { id: classId });
  return String(cls?.name || "").toLowerCase() === STEMVERSE_DEFAULT_CLASS_NAME.toLowerCase();
}

export async function getPrimaryClassIdForStudent(studentId: string): Promise<string | null> {
  const rows = await selectMany<{ class_id: string }>("class_students", "class_id", { student_id: studentId });
  if (!rows.length) return null;
  for (const row of rows) {
    const cls = await selectOne<{ id: string; name: string }>("classes", "id, name", { id: row.class_id });
    if (cls && String(cls.name).toLowerCase() !== STEMVERSE_DEFAULT_CLASS_NAME.toLowerCase()) {
      return String(cls.id);
    }
  }
  return String(rows[0].class_id);
}

export async function getClassCurriculumOverrides(classId: string): Promise<Map<string, CurriculumOverrideRow>> {
  const map = new Map<string, CurriculumOverrideRow>();
  try {
    const useDefault = await isDefaultClass(classId);
    const table = useDefault ? "default_curriculum" : "class_curriculum";
    const match = useDefault ? {} : { class_id: classId };
    const rows = await selectMany<DbRow>(table, "*", match);
    for (const row of rows) {
      map.set(String(row.mission_id), {
        mission_id: String(row.mission_id),
        sector_id: row.sector_id as string | null,
        is_enabled: row.is_enabled as boolean | undefined,
        custom_order: row.custom_order as number | null,
        custom_title: row.custom_title as string | null,
        custom_description: row.custom_description as string | null,
        unlock_after_mission_id: row.unlock_after_mission_id as string | null,
      });
    }
  } catch {
    /* table may not exist yet */
  }
  return map;
}

async function getOverridesFromClassId(classId: string): Promise<Map<string, CurriculumOverrideRow>> {
  const map = new Map<string, CurriculumOverrideRow>();
  try {
    const rows = await selectMany<DbRow>("class_curriculum", "*", { class_id: classId });
    for (const row of rows) {
      map.set(String(row.mission_id), {
        mission_id: String(row.mission_id),
        sector_id: row.sector_id as string | null,
        is_enabled: row.is_enabled as boolean | undefined,
        custom_order: row.custom_order as number | null,
        custom_title: row.custom_title as string | null,
        custom_description: row.custom_description as string | null,
        unlock_after_mission_id: row.unlock_after_mission_id as string | null,
      });
    }
  } catch {
    /* ignore */
  }
  return map;
}

export async function getDefaultCurriculumOverrides(): Promise<Map<string, CurriculumOverrideRow>> {
  const map = new Map<string, CurriculumOverrideRow>();
  try {
    const rows = await selectMany<DbRow>("default_curriculum", "*");
    for (const row of rows) {
      map.set(String(row.mission_id), {
        mission_id: String(row.mission_id),
        sector_id: row.sector_id as string | null,
        is_enabled: row.is_enabled as boolean | undefined,
        custom_order: row.custom_order as number | null,
        custom_title: row.custom_title as string | null,
        custom_description: row.custom_description as string | null,
        unlock_after_mission_id: row.unlock_after_mission_id as string | null,
      });
    }
  } catch {
    /* ignore */
  }
  return map;
}

function applyOverride(mission: DbRow, override: CurriculumOverrideRow | undefined, index: number): CurriculumMissionView {
  const enabled = override?.is_enabled ?? true;
  const title = String(override?.custom_title || mission.title || "");
  const description = String(override?.custom_description ?? mission.description ?? "");
  return {
    ...mission,
    is_enabled: enabled,
    custom_order: override?.custom_order ?? null,
    custom_title: override?.custom_title ?? null,
    custom_description: override?.custom_description ?? null,
    unlock_after_mission_id: override?.unlock_after_mission_id ?? null,
    effective_title: title,
    effective_description: description,
    has_override: Boolean(override),
    title,
    description,
    prerequisite_mission_id: override?.unlock_after_mission_id ?? mission.prerequisite_mission_id,
  };
}

export async function buildCurriculumForClass(classId: string) {
  const sectors = await loadSectorsForCurriculum();
  const allMissions = await loadMissionsForCurriculum();
  const cls = await selectOne<{ curriculum_track?: string | null }>("classes", "curriculum_track", { id: classId });
  const track = normalizeCurriculumTrack(cls?.curriculum_track);

  let overrides = new Map<string, CurriculumOverrideRow>();
  if (track === "core_stem") {
    overrides = await getDefaultCurriculumOverrides();
  } else if (track === "advanced") {
    const adv = await findClassByName(STEMVERSE_ADVANCED_CLASS_NAME);
    if (adv?.id) {
      overrides = await getOverridesFromClassId(String(adv.id));
    }
    if (!overrides.size) {
      // Fallback so advanced track never hard-fails to an empty curriculum.
      overrides = await getDefaultCurriculumOverrides();
    }
  } else {
    // "custom" and unknown values map to class-specific overrides.
    overrides = await getClassCurriculumOverrides(classId);
  }

  const bySector = sectors.map((sector) => {
    const sectorId = String(sector.id);
    const sectorMissions = allMissions
      .filter((m) => String(m.sector_id) === sectorId)
      .map((m, i) => applyOverride(m, overrides.get(String(m.id)), i));

    sectorMissions.sort((a, b) => {
      const ao = a.custom_order ?? 9999;
      const bo = b.custom_order ?? 9999;
      if (ao !== bo) return ao - bo;
      return String(a.created_at || "").localeCompare(String(b.created_at || ""));
    });

    return {
      sector,
      missions: sectorMissions,
    };
  });

  return { sectors: bySector };
}

export async function buildDefaultCurriculumView() {
  const sectors = await loadSectorsForCurriculum();
  let allMissions: DbRow[] = [];
  try {
    allMissions = await selectAllMissions("*");
  } catch {
    allMissions = await loadMissionsForCurriculum();
  }
  const overrides = await getDefaultCurriculumOverrides();

  const bySector = sectors.map((sector) => {
    const sectorId = String(sector.id);
    const sectorMissions = allMissions
      .filter((m) => String(m.sector_id) === sectorId)
      .map((m, i) => applyOverride(m, overrides.get(String(m.id)), i));

    sectorMissions.sort((a, b) => {
      const ao = a.custom_order ?? 9999;
      const bo = b.custom_order ?? 9999;
      if (ao !== bo) return ao - bo;
      return String(a.created_at || "").localeCompare(String(b.created_at || ""));
    });

    return { sector, missions: sectorMissions };
  });

  return { sectors: bySector };
}

export async function upsertClassCurriculumRow(
  classId: string,
  body: {
    mission_id: string;
    is_enabled?: boolean;
    custom_order?: number | null;
    custom_title?: string | null;
    custom_description?: string | null;
    unlock_after_mission_id?: string | null;
  },
  managedBy?: string | null,
) {
  const mission = await selectOne<{ sector_id: string | null }>("missions", "sector_id", { id: body.mission_id });
  if (!mission) throw new Error("Mission not found");

  const payload: DbRow = {
    sector_id: mission.sector_id,
    mission_id: body.mission_id,
    is_enabled: body.is_enabled ?? true,
    custom_order: body.custom_order ?? null,
    custom_title: body.custom_title?.trim() || null,
    custom_description: body.custom_description?.trim() || null,
    unlock_after_mission_id: body.unlock_after_mission_id || null,
  };

  const useDefault = await isDefaultClass(classId);
  if (useDefault) {
    if (managedBy) payload.managed_by = managedBy;
    return upsertRow("default_curriculum", payload, "mission_id");
  }

  return upsertRow("class_curriculum", { ...payload, class_id: classId }, "class_id,mission_id");
}

export async function resolveMissionsWithCurriculum(
  sectorId: string,
  studentId: string,
  baseMissions: DbRow[],
): Promise<CurriculumMissionView[]> {
  const classId = await getPrimaryClassIdForStudent(studentId);
  let overrides = new Map<string, CurriculumOverrideRow>();

  if (classId) {
    overrides = await getClassCurriculumOverrides(classId);
  } else {
    overrides = await getDefaultCurriculumOverrides();
  }

  const merged = baseMissions
    .map((m, i) => applyOverride(m, overrides.get(String(m.id)), i))
    .filter((m) => m.is_enabled);

  merged.sort((a, b) => {
    const ao = a.custom_order ?? 9999;
    const bo = b.custom_order ?? 9999;
    if (ao !== bo) return ao - bo;
    return String(a.created_at || "").localeCompare(String(b.created_at || ""));
  });

  return merged;
}

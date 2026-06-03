/**
 * Server-side Supabase query helpers (used by server.ts route handlers).
 */
import {
  db,
  selectOne,
  selectMany,
  insertOne,
  insertMany,
  updateRow,
  deleteRows,
  countRows,
  countRowsGte,
  upsertRow,
  insertIgnore,
  startOfTodayIso,
  STUDENT_SELECT_PUBLIC,
  getStudentPublic,
  findStudentByEmailOrUsername,
  selectDistinctSchools,
  type DbRow,
} from "./db";

export { STUDENT_SELECT_PUBLIC, getStudentPublic, selectDistinctSchools, findStudentByEmailOrUsername };

export async function getStudentRoleById(id: string): Promise<string | null> {
  const row = await selectOne<{ role: string }>("students", "role", { id });
  return row?.role ?? null;
}

export async function listSectorsOrdered(): Promise<DbRow[]> {
  const { selectAllSectors } = await import("./db");
  return selectAllSectors("*");
}

async function getStudentClassIds(studentId: string): Promise<string[]> {
  const rows = await selectMany<{ class_id: string }>("class_students", "class_id", { student_id: studentId });
  return rows.map((r) => String(r.class_id));
}

export async function getStudentSectorMasteryMap(studentId: string): Promise<Map<string, number>> {
  try {
    const rows = await selectMany<{ sector_id: string; mastery_percent: number }>(
      "student_sector_mastery",
      "sector_id, mastery_percent",
      { student_id: studentId },
    );
    return new Map(rows.map((r) => [String(r.sector_id), Number(r.mastery_percent) || 0]));
  } catch {
    return new Map();
  }
}

export async function studentCompletedStarterMission(studentId: string): Promise<boolean> {
  const { data, error } = await db()
    .from("student_mission_completions")
    .select("mission_id, missions!inner(sector_id, sectors!inner(is_starter))")
    .eq("student_id", studentId)
    .eq("missions.sectors.is_starter", true)
    .limit(1);
  if (error) {
    const completions = await selectMany<{ mission_id: string }>("student_mission_completions", "mission_id", {
      student_id: studentId,
    });
    if (!completions.length) return false;
    const missionIds = completions.map((c) => c.mission_id);
    const starterMissions = await db()
      .from("missions")
      .select("id, sectors!inner(is_starter)")
      .in("id", missionIds)
      .eq("sectors.is_starter", true)
      .limit(1);
    return (starterMissions.data?.length ?? 0) > 0;
  }
  return (data?.length ?? 0) > 0;
}

export async function getMissionsForSectorStudent(sectorId: string, studentId: string) {
  const { selectAllMissions } = await import("./db");
  const missions = (await selectAllMissions("*")).filter(
    (m) => String(m.sector_id) === String(sectorId) && isMissionVisibleInCorridor(m.status),
  );
  missions.sort((a, b) => String(a.created_at || "").localeCompare(String(b.created_at || "")));
  const activeMissions = missions;

  let filtered: DbRow[];
  try {
    const { resolveMissionsWithCurriculum } = await import("./curriculum");
    filtered = await resolveMissionsWithCurriculum(sectorId, studentId, activeMissions);
  } catch {
    const sector = await selectOne<{ is_starter?: boolean }>("sectors", "is_starter", { id: sectorId });
    const isStarterSector = Boolean(sector?.is_starter);
    const classMissionIds = new Set<string>();
    if (!isStarterSector) {
      const classIds = await getStudentClassIds(studentId);
      if (classIds.length) {
        const { data: cm, error: cmErr } = await db()
          .from("class_missions")
          .select("mission_id")
          .in("class_id", classIds);
        if (cmErr) throw new Error(cmErr.message);
        for (const row of cm || []) classMissionIds.add(String((row as { mission_id: string }).mission_id));
      }
    }
    filtered = activeMissions.filter((m) => isStarterSector || classMissionIds.has(String(m.id)));
  }

  const completions = await selectMany<{ mission_id: string }>("student_mission_completions", "mission_id", {
    student_id: studentId,
  });
  const completedSet = new Set(completions.map((c) => c.mission_id));

  const withStatus = filtered.map((m) => {
    const prereq = (m.prerequisite_mission_id ?? m.unlock_after_mission_id) as string | null;
    let status = String(m.status || "available");
    if (prereq && !completedSet.has(prereq)) status = "locked";
    return { ...m, status };
  });

  const completedMissionIds = filtered.filter((m) => completedSet.has(String(m.id))).map((m) => m.id);
  return { missions: withStatus, completedMissionIds };
}

export async function listStudentsPublic(scope: "admin" | "school" | "teacher", schoolId?: string | null) {
  if (scope === "admin") {
    return selectMany("students", STUDENT_SELECT_PUBLIC, undefined, { column: "created_at", ascending: true });
  }
  if (scope === "school" && schoolId) {
    return selectMany("students", STUDENT_SELECT_PUBLIC, { school_id: schoolId }, { column: "created_at", ascending: true });
  }
  if (scope === "teacher" && schoolId) {
    return selectMany("students", STUDENT_SELECT_PUBLIC, { school_id: schoolId, role: "student" }, { column: "created_at", ascending: true });
  }
  return selectMany("students", "id, name, level, xp, avatar_url, role");
}

export async function listQuizzes() {
  return selectMany("quizzes", "*", undefined, { column: "created_at", ascending: false });
}

function isPublishedMissionStatus(status: unknown): boolean {
  const s = String(status || "available").toLowerCase();
  return s === "available" || s === "active" || s === "locked";
}

export function isMissionVisibleInCorridor(status: unknown): boolean {
  const s = String(status || "available").toLowerCase();
  if (s === "archived" || s === "draft") return false;
  return isPublishedMissionStatus(s);
}

export async function listMissions(options?: {
  includeDraft?: boolean;
  viewerId?: string;
  viewerRole?: string;
}) {
  const { selectAllMissions } = await import("./db");
  const rows = await selectAllMissions("*");
  const viewerId = options?.viewerId ? String(options.viewerId) : "";
  const isStaff = options?.viewerRole === "teacher" || options?.viewerRole === "admin";

  return rows
    .filter((m) => {
      const s = String(m.status || "available").toLowerCase();
      if (s === "archived") return false;
      const creator = m.created_by != null ? String(m.created_by) : "";
      const isOwner = Boolean(viewerId && creator && creator === viewerId);

      if (s === "draft") {
        return isStaff && options?.includeDraft && isOwner;
      }

      if (isPublishedMissionStatus(s)) {
        return true;
      }

      return isMissionVisibleInCorridor(m.status);
    })
    .sort((a, b) => String(b.created_at || "").localeCompare(String(a.created_at || "")));
}

export async function listMissionsForSector(sectorId: string) {
  const { selectAllMissions } = await import("./db");
  const rows = await selectAllMissions("*");
  return rows
    .filter((m) => String(m.sector_id) === String(sectorId) && isMissionVisibleInCorridor(m.status))
    .sort((a, b) => String(a.created_at || "").localeCompare(String(b.created_at || "")));
}

export async function getMissionBrief(id: string) {
  return selectOne<{ id: string; sector_id: string; title: string; description: string | null }>(
    "missions",
    "id, sector_id, title, description",
    { id },
  );
}

export async function getSectorBrief(id: string) {
  return selectOne<{ name: string; description: string | null }>("sectors", "name, description", { id });
}

export async function insertQuiz(title: string, questionsJson: string) {
  const row = await insertOne<{ id: string }>("quizzes", { title, questions: questionsJson });
  return row.id;
}

export async function getStudentQuizStats(studentId: string) {
  const rows = await selectMany<{ score: number; total_questions: number }>(
    "student_quizzes",
    "score, total_questions",
    { student_id: studentId },
  );
  if (!rows.length) return { avg_score: 0, quizzes_completed: 0 };
  let sum = 0;
  let n = 0;
  for (const r of rows) {
    const tq = Number(r.total_questions) || 0;
    if (tq > 0) {
      sum += (Number(r.score) / tq) * 100;
      n += 1;
    }
  }
  return { avg_score: n ? sum / n : 0, quizzes_completed: rows.length };
}

export async function listNotifications(userId: string) {
  return selectMany("notifications", "id, user_id, type, title, message, link, is_read, created_at", { user_id: userId }, {
    column: "created_at",
    ascending: false,
  });
}

export async function markNotificationRead(id: string, userId: string): Promise<boolean> {
  const row = await selectOne("notifications", "id", { id, user_id: userId });
  if (!row) return false;
  await updateRow("notifications", { id, user_id: userId }, { is_read: true });
  return true;
}

export async function markAllNotificationsRead(userId: string) {
  await updateRow("notifications", { user_id: userId }, { is_read: true });
}

export async function listChallengesForStudent(studentId: string) {
  const classIds = await getStudentClassIds(studentId);
  if (!classIds.length) return [];

  const { data: links, error: linkErr } = await db()
    .from("class_challenges")
    .select("challenge_id")
    .in("class_id", classIds);
  if (linkErr) throw new Error(linkErr.message);

  const challengeIds = [
    ...new Set((links || []).map((r) => String((r as { challenge_id: string }).challenge_id))),
  ];
  if (!challengeIds.length) return [];

  const { data: challenges, error: chErr } = await db().from("challenges").select("*").in("id", challengeIds);
  if (chErr) throw new Error(chErr.message);

  return (challenges as DbRow[]).sort((a, b) =>
    String(b.created_at || "").localeCompare(String(a.created_at || "")),
  );
}

export async function listAllChallenges() {
  return selectMany("challenges", "*", undefined, { column: "created_at", ascending: false });
}

export async function insertLog(message: string, type: string, xp_change: number) {
  try {
    await insertOne("logs", { message, type, xp_change });
  } catch (err) {
    console.warn(
      "[stemverse] insertLog skipped:",
      err instanceof Error ? err.message : String(err),
    );
  }
}

export async function listLogs(limit = 20) {
  const { data, error } = await db().from("logs").select("*").order("timestamp", { ascending: false }).limit(limit);
  if (error) throw new Error(error.message);
  return data || [];
}

export async function countAiUsageToday(endpoint?: string, userId?: string) {
  const since = startOfTodayIso();
  if (endpoint && userId) return countRowsGte("ai_usage_logs", "created_at", since, { endpoint, user_id: userId });
  if (endpoint) return countRowsGte("ai_usage_logs", "created_at", since, { endpoint });
  return countRowsGte("ai_usage_logs", "created_at", since);
}

export async function insertAiUsage(
  endpoint: string,
  userId: string,
  success: 0 | 1,
  reason?: string | null,
) {
  await insertOne("ai_usage_logs", { endpoint, user_id: userId, success, reason: reason || null });
}

/** Admin metrics assembled from multiple queries (no raw SQL). */
export async function getAdminMetrics() {
  const students = await selectMany<DbRow>("students", "*");
  const byRoleMap = new Map<string, number>();
  const bySubscriptionStatus = new Map<string, number>();
  const byPlan = new Map<string, number>();
  const byGender = new Map<string, number>();
  const byCountry = new Map<string, number>();
  const byCity = new Map<string, number>();
  const ageBuckets = new Map<string, number>();
  const gradeDist = new Map<string, number>();
  const signups30Map = new Map<string, number>();

  const now = Date.now();
  const dayMs = 86400000;
  const cutoff30 = new Date(now - 30 * dayMs).toISOString().slice(0, 10);

  let mrrCents = 0;
  let payingUsers = 0;
  let trialUsers = 0;
  let pastDueUsers = 0;
  let freeOrNone = 0;
  let ltvSumCents = 0;
  let dau = 0;
  let wau = 0;
  let mau = 0;
  let returningWeekly = 0;
  let activeLast7 = 0;

  const studentIds = new Set<string>();
  const activatedStudents = new Set<string>();

  const completions = await selectMany<{ student_id: string }>("student_mission_completions", "student_id");
  for (const c of completions) activatedStudents.add(c.student_id);

  for (const s of students) {
    const role = String(s.role || "student");
    byRoleMap.set(role, (byRoleMap.get(role) || 0) + 1);
    if (role === "student") studentIds.add(String(s.id));

    const sub = String(s.subscription_status || "free").trim() || "free";
    bySubscriptionStatus.set(sub, (bySubscriptionStatus.get(sub) || 0) + 1);
    const plan = String(s.subscription_plan || "free").trim() || "free";
    byPlan.set(plan, (byPlan.get(plan) || 0) + 1);

    const gender = s.gender ? String(s.gender) : "unspecified";
    byGender.set(gender, (byGender.get(gender) || 0) + 1);
    const cc = s.country_code ? String(s.country_code) : "unspecified";
    byCountry.set(cc, (byCountry.get(cc) || 0) + 1);
    const city = s.city ? String(s.city).trim() : "unspecified";
    byCity.set(city, (byCity.get(city) || 0) + 1);

    const age = s.age != null ? Number(s.age) : null;
    const bucket = age == null ? "unspecified" : age < 13 ? "under_13" : age <= 17 ? "13_17" : "18_plus";
    ageBuckets.set(bucket, (ageBuckets.get(bucket) || 0) + 1);

    const grade = s.grade ? String(s.grade).trim() : "unspecified";
    gradeDist.set(grade, (gradeDist.get(grade) || 0) + 1);

    if (s.created_at) {
      const day = String(s.created_at).slice(0, 10);
      if (day >= cutoff30) signups30Map.set(day, (signups30Map.get(day) || 0) + 1);
    }

    if (sub === "active") {
      mrrCents += Number(s.mrr_cents) || 0;
      if (Number(s.mrr_cents) > 0) payingUsers += 1;
    }
    if (sub === "trial") trialUsers += 1;
    if (sub === "past_due") pastDueUsers += 1;
    if (!sub || sub === "free" || sub === "none") freeOrNone += 1;
    ltvSumCents += Number(s.ltv_cents) || 0;

    const last = s.last_active_at ? new Date(String(s.last_active_at)).getTime() : 0;
    const created = s.created_at ? new Date(String(s.created_at)).getTime() : 0;
    if (last >= now - dayMs) dau += 1;
    if (last >= now - 7 * dayMs) {
      wau += 1;
      activeLast7 += 1;
      if (created && created <= now - 7 * dayMs) returningWeekly += 1;
    }
    if (last >= now - 30 * dayMs) mau += 1;
  }

  const studentRoleCount = byRoleMap.get("student") || 0;
  const activatedCount = [...activatedStudents].filter((id) => studentIds.has(id)).length;
  const activationRatePct = studentRoleCount > 0 ? Math.round((activatedCount / studentRoleCount) * 1000) / 10 : 0;

  const classCount = await countRows("classes");
  const missionAssignCount = await countRows("class_missions");
  const quizAssignCount = await countRows("class_quizzes");
  const challengeAssignCount = await countRows("class_challenges");

  const since14 = new Date(now - 14 * dayMs).toISOString();
  const aiLogs = await selectMany<{ created_at: string; endpoint: string; success: number }>(
    "ai_usage_logs",
    "created_at, endpoint, success",
  );
  const aiByDayMap = new Map<string, { day: string; endpoint: string; ok: number; total: number }>();
  for (const log of aiLogs) {
    if (String(log.created_at) < since14) continue;
    const day = String(log.created_at).slice(0, 10);
    const key = `${day}|${log.endpoint}`;
    const cur = aiByDayMap.get(key) || { day, endpoint: log.endpoint, ok: 0, total: 0 };
    cur.total += 1;
    if (Number(log.success) === 1) cur.ok += 1;
    aiByDayMap.set(key, cur);
  }
  const aiByDay = [...aiByDayMap.values()].map((v) => ({
    day: v.day,
    endpoint: v.endpoint,
    ok: v.ok,
    total: v.total,
  }));

  const interestVotes = await selectMany<{ interest_key: string }>("student_interest_votes", "interest_key");
  const interestMap = new Map<string, number>();
  for (const v of interestVotes) {
    const k = v.interest_key;
    interestMap.set(k, (interestMap.get(k) || 0) + 1);
  }
  const interestTrends = [...interestMap.entries()]
    .map(([interest_key, n]) => ({ interest_key, n }))
    .sort((a, b) => b.n - a.n || a.interest_key.localeCompare(b.interest_key))
    .slice(0, 20);

  const mapToArr = (m: Map<string, number>, keyName: string) =>
    [...m.entries()].map(([k, n]) => ({ [keyName]: k, n }));

  return {
    byRole: mapToArr(byRoleMap, "role"),
    bySubscriptionStatus: mapToArr(bySubscriptionStatus, "subscription_status"),
    byPlan: mapToArr(byPlan, "subscription_plan"),
    byGender: mapToArr(byGender, "gender"),
    byCountry: [...byCountry.entries()]
      .map(([country_code, n]) => ({ country_code, n }))
      .sort((a, b) => b.n - a.n)
      .slice(0, 20),
    byCity: [...byCity.entries()]
      .map(([city, n]) => ({ city, n }))
      .sort((a, b) => b.n - a.n)
      .slice(0, 15),
    ageBuckets: mapToArr(ageBuckets, "bucket"),
    gradeDistribution: [...gradeDist.entries()]
      .map(([grade, n]) => ({ grade, n }))
      .sort((a, b) => b.n - a.n)
      .slice(0, 12),
    interestTrends,
    signupsLast30Days: [...signups30Map.entries()].map(([day, n]) => ({ day, n })).sort((a, b) => a.day.localeCompare(b.day)),
    monetization: {
      mrrCents,
      arpuCents: payingUsers > 0 ? Math.round(mrrCents / payingUsers) : 0,
      payingUsers,
      trialUsers,
      pastDueUsers,
      freeOrUnpaidUsers: freeOrNone,
      ltvSumCents,
    },
    product: {
      studentCount: studentRoleCount,
      activatedStudents: activatedCount,
      activationRatePct,
      dau,
      wau,
      mau,
      weeklyReturningSharePct: activeLast7 > 0 ? Math.round((returningWeekly / activeLast7) * 1000) / 10 : 0,
      classCount,
      avgMissionsPerClass: classCount > 0 ? Math.round((missionAssignCount / classCount) * 100) / 100 : 0,
      avgQuizzesPerClass: classCount > 0 ? Math.round((quizAssignCount / classCount) * 100) / 100 : 0,
      avgChallengesPerClass: classCount > 0 ? Math.round((challengeAssignCount / classCount) * 100) / 100 : 0,
    },
    aiUsageByDay: aiByDay,
  };
}

export async function listClassesWithMeta(teacherId?: string, schoolId?: string | null) {
  let q = db()
    .from("classes")
    .select("*, teacher:students!classes_teacher_id_fkey(name), class_students(count)");
  if (teacherId) q = q.eq("teacher_id", teacherId);
  if (schoolId) q = q.eq("school_id", schoolId);
  const { data, error } = await q;
  if (error) {
    const classMatch: Record<string, unknown> = {};
    if (teacherId) classMatch.teacher_id = teacherId;
    if (schoolId) classMatch.school_id = schoolId;
    const classes = await selectMany<DbRow>("classes", "*", Object.keys(classMatch).length ? classMatch : undefined);
    const out = [];
    for (const c of classes) {
      const teacher = c.teacher_id
        ? await selectOne<{ name: string }>("students", "name", { id: String(c.teacher_id) })
        : null;
      const student_count = await countRows("class_students", { class_id: String(c.id) });
      out.push({ ...c, teacher_name: teacher?.name, student_count });
    }
    return out;
  }
  return (data || []).map((c: DbRow) => ({
    ...c,
    teacher_name: (c.teacher as { name?: string } | null)?.name,
    student_count: Array.isArray(c.class_students) ? (c.class_students[0] as { count?: number })?.count : 0,
  }));
}

export async function getStarterMissionId(): Promise<string | null> {
  const { data } = await db()
    .from("missions")
    .select("id, sectors!inner(is_starter)")
    .eq("sectors.is_starter", true)
    .order("created_at", { ascending: true })
    .limit(1);
  return data?.[0] ? String((data[0] as { id: string }).id) : null;
}

export async function upsertStudentProfile(
  userId: string,
  profile: {
    name: string;
    role: string;
    username: string;
    avatar_url: string;
    age?: number | null;
    grade?: string | null;
    school?: string | null;
    school_id?: string | null;
    city?: string | null;
    email?: string | null;
    parent_email?: string | null;
    contact_number?: string | null;
    gender?: string | null;
    country_code?: string | null;
    region?: string | null;
    timezone?: string | null;
  },
  passwordHash?: string,
) {
  const existing = await selectOne("students", "id, username", { id: userId });
  const row: DbRow = {
    id: userId,
    name: profile.name,
    role: profile.role,
    username: (existing as { username?: string } | null)?.username || profile.username,
    avatar_url: profile.avatar_url,
    age: profile.age ?? null,
    grade: profile.grade ?? null,
    school: profile.school ?? null,
    city: profile.city ?? null,
    email: profile.email ?? null,
    parent_email: profile.parent_email ?? null,
    contact_number: profile.contact_number ?? null,
    gender: profile.gender ?? null,
    country_code: profile.country_code ?? null,
    region: profile.region ?? null,
    timezone: profile.timezone ?? null,
  };
  const { provisionRosterStudent } = await import("./db");
  if (!existing) {
    await provisionRosterStudent({
      id: userId,
      name: profile.name,
      username: profile.username,
      email: profile.email,
      avatar_url: profile.avatar_url,
      password: passwordHash || "password123",
      role: profile.role,
    });
    await updateRow("students", { id: userId }, {
      age: row.age,
      grade: row.grade,
      school: row.school,
      city: row.city,
      parent_email: row.parent_email,
      contact_number: row.contact_number,
      gender: row.gender,
      country_code: row.country_code,
      region: row.region,
      timezone: row.timezone,
      subscription_status: "free",
      subscription_plan: "free",
      billing_provider: "none",
      mrr_cents: 0,
      ltv_cents: 0,
    });
  } else {
    await updateRow("students", { id: userId }, row);
  }
  return getStudentPublic(userId);
}

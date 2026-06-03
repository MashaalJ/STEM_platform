/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import express from "express";
import {
  db,
  selectOne,
  selectMany,
  insertOne,
  updateRow,
  deleteRows,
  countRows,
  insertIgnore,
  insertMany,
  upsertRow,
  isUuid,
  getStudentPublic,
  findSectorByName,
  type DbRow,
} from "../../lib/db";

import { xpToLevel } from "../../lib/xp.ts";
import * as SQ from "../../lib/serverQueries";
import { asyncRoute, getReqUser } from "./_middleware.ts";

export type StudentsRouterDeps = {
  requireAuth: express.RequestHandler;
  requireRole: (roles: string[]) => express.RequestHandler;
  requireStudentAccess: express.RequestHandler;
  rateLimitAi: express.RequestHandler;
  checkAndLogAiQuota: (
    endpoint: "generate_quiz" | "recommendations",
    userId: string,
  ) => Promise<{ ok: boolean; message?: string }>;
  callAiJson: <T = unknown>(system: string, user: string) => Promise<T | null>;
  bumpLastActive: (userId: string) => Promise<void>;
};

export default function createStudentsRouter(deps: StudentsRouterDeps): express.Router {
  const {
    requireAuth,
    requireRole,
    requireStudentAccess,
    rateLimitAi,
    checkAndLogAiQuota,
    callAiJson,
    bumpLastActive,
  } = deps;
  const router = express.Router();

  const parseOnboardingAge = (body: Record<string, unknown>): number | null => {
    if (Number.isFinite(Number(body.age))) return Math.max(1, Math.min(99, Number(body.age)));
    const g = String(body.age_grade || "").trim().toLowerCase();
    if (g === "grade_3_5") return 9;
    if (g === "grade_6_8") return 12;
    if (g === "grade_9_12") return 15;
    return null;
  };

  const assignedLevelFromAge = (age: number): string => {
    if (age <= 10) return "explorer";
    if (age <= 13) return "builder";
    if (age <= 16) return "maker";
    return "innovator";
  };

  const assignDefaultCurriculum = async (input: {
    ageGrade: string;
    interests: string[];
    experience: string;
    goal: string;
    assignedLevel?: string | null;
  }) => {
    const defaults = await selectMany<{
      sector_id: string | null;
      is_enabled?: boolean | null;
      custom_order?: number | null;
    }>("default_curriculum", "sector_id, is_enabled, custom_order");
    const orderedDefaultSectorIds = [...new Set(
      defaults
        .filter((d) => d.sector_id && (d.is_enabled ?? true))
        .sort((a, b) => (Number(a.custom_order ?? 9999) - Number(b.custom_order ?? 9999)))
        .map((d) => String(d.sector_id)),
    )];
    if (!orderedDefaultSectorIds.length) return { sectors: [] as string[], startSector: null as string | null };

    const sectorRows = await selectMany<{ id: string; name: string }>("sectors", "id, name");
    const sectorById = new Map(sectorRows.map((s) => [String(s.id), String(s.name || "").toLowerCase()]));
    const preferredTerms = [
      ...input.interests.map((x) => String(x || "").toLowerCase()),
      String(input.goal || "").toLowerCase(),
      String(input.experience || "").toLowerCase(),
      String(input.ageGrade || "").toLowerCase(),
    ];
    const keywordMap: Array<{ keys: string[]; terms: string[] }> = [
      { keys: ["robotics"], terms: ["robot", "arduino", "circuit"] },
      { keys: ["ai_ml"], terms: ["ai", "ml", "machine learning"] },
      { keys: ["electronics"], terms: ["electric", "circuit", "hardware"] },
      { keys: ["space_tech"], terms: ["space", "astro", "galaxy"] },
      { keys: ["game_dev"], terms: ["game", "design"] },
      { keys: ["web_dev", "app_dev"], terms: ["web", "app", "frontend"] },
    ];
    const desiredTerms = new Set<string>();
    for (const entry of keywordMap) {
      if (entry.keys.some((k) => preferredTerms.some((t) => t.includes(k)))) {
        entry.terms.forEach((t) => desiredTerms.add(t));
      }
    }
    const selected = orderedDefaultSectorIds.filter((sid) => {
      if (!desiredTerms.size) return false;
      const name = sectorById.get(sid) || "";
      return [...desiredTerms].some((term) => name.includes(term));
    });
    const sectors = [...new Set([...selected, ...orderedDefaultSectorIds])].slice(0, 4);
    const startSector = sectors[0] || orderedDefaultSectorIds[0] || null;
    return { sectors, startSector };
  };

  router.get("/students", requireAuth, requireRole(["teacher", "admin", "school_admin"]), asyncRoute(async (req, res) => {
    const sessionUser = getReqUser(req)!;
    const { getUserSchoolId } = await import("../../lib/schoolScope.ts");
    if (sessionUser.role === "admin") {
      res.json(await SQ.listStudentsPublic("admin"));
      return;
    }
    const schoolId = await getUserSchoolId(sessionUser.id);
    if (!schoolId) {
      res.json([]);
      return;
    }
    const scope = sessionUser.role === "school_admin" ? "school" : "teacher";
    res.json(await SQ.listStudentsPublic(scope, schoolId));
  }));

  // AI mission recommendations (adaptive next-skill path)
  router.get(
    "/students/:id/recommendations",
    requireAuth,
    requireStudentAccess,
    rateLimitAi,
    asyncRoute(async (req, res) => {
    const sessionUser = getReqUser(req)!;
    const quota = await checkAndLogAiQuota("recommendations", sessionUser.id);
    if (!quota.ok) {
      return res.status(429).json({ success: false, message: quota.message, recommendations: [] });
    }
    const studentId = req.params.id;

    const studentRow = await selectOne<{ grade?: string | null }>("students", "grade", { id: studentId });
    const normalizedGrade = String(studentRow?.grade || "")
      .trim()
      .toLowerCase();

    let assigned: Array<DbRow & { sector_name?: string }> = [];
    const { data: classRows } = await db().from("class_students").select("class_id").eq("student_id", studentId);
    const classIds = (classRows || []).map((r) => (r as { class_id: string }).class_id);
    if (classIds.length) {
      const { data: cmRows } = await db().from("class_missions").select("mission_id").in("class_id", classIds);
      const missionIds = [...new Set((cmRows || []).map((r) => (r as { mission_id: string }).mission_id))];
      if (missionIds.length) {
        const missions = await selectMany<DbRow>("missions", "*");
        const sectors = await selectMany<{ id: string; name: string }>("sectors", "id, name");
        const sectorMap = new Map(sectors.map((s) => [s.id, s.name]));
        assigned = missions
          .filter((m) => missionIds.includes(String(m.id)))
          .map((m) => ({ ...m, sector_name: sectorMap.get(String(m.sector_id)) }));
      }
    }
    if (assigned.length === 0) {
      const allMissions = await selectMany<DbRow>("missions", "*", { status: "available" });
      const sectors = await selectMany<{ id: string; name: string }>("sectors", "id, name");
      const sectorMap = new Map(sectors.map((s) => [s.id, s.name]));
      assigned = allMissions
        .filter((m) => {
          if (!normalizedGrade) return true;
          const gl = String(m.grade_level || "").trim().toLowerCase();
          return !gl || gl === normalizedGrade;
        })
        .slice(0, 30)
        .map((m) => ({ ...m, sector_name: sectorMap.get(String(m.sector_id)) }));
    }
    const completions = await selectMany<{ mission_id: string }>("student_mission_completions", "mission_id", {
      student_id: studentId,
    });
    const completedSet = new Set(completions.map((r) => r.mission_id));
    const pending = assigned.filter((m) => !completedSet.has(String(m.id)));
    const interestRows = await selectMany<{ interest_key: string }>(
      "student_interest_votes",
      "interest_key",
      { student_id: studentId },
      { column: "weight", ascending: false },
    );
    const interestKeys = interestRows.map((r) => String(r.interest_key || "").toLowerCase());
    const scoreByInterest = (mission: any) => {
      const hay = `${mission?.title || ""} ${mission?.description || ""} ${mission?.sector_name || ""}`.toLowerCase();
      return interestKeys.reduce((acc, key) => (hay.includes(key.replace(/_/g, " ")) ? acc + 1 : acc), 0);
    };
    const stats = await SQ.getStudentQuizStats(studentId);

    const bySector = new Map<string, { sector_name: string; total: number; completed: number }>();
    for (const m of assigned) {
      const sid = String(m.sector_id);
      const cur = bySector.get(sid) || { sector_name: String(m.sector_name || ""), total: 0, completed: 0 };
      cur.total += 1;
      if (completedSet.has(String(m.id))) cur.completed += 1;
      bySector.set(sid, cur);
    }
    const sectorProgress = [...bySector.entries()].map(([sector_id, p]) => ({
      sector_id,
      sector_name: p.sector_name,
      completion_rate: p.total ? p.completed / p.total : 0,
      total: p.total,
      completed: p.completed,
    }));
    const weakest = [...sectorProgress].sort((a, b) => a.completion_rate - b.completion_rate)[0];
    const strongest = [...sectorProgress].sort((a, b) => b.completion_rate - a.completion_rate)[0];

    // Heuristic baseline recommendations from pending missions
    const easierFirst = pending
      .filter((m) => weakest ? m.sector_id === weakest.sector_id : true)
      .sort(
        (a, b) =>
          scoreByInterest(b) - scoreByInterest(a) ||
          String(a.difficulty || "").localeCompare(String(b.difficulty || "")) ||
          String(a.id).localeCompare(String(b.id)),
      )
      .slice(0, 2)
      .map((m) => ({ mission_id: m.id, title: m.title, difficulty: m.difficulty, sector: m.sector_name, reason: `Build fundamentals in ${m.sector_name} progressively.` }));
    const strongerStretch = pending
      .filter((m) => strongest ? m.sector_id === strongest.sector_id : true)
      .sort(
        (a, b) =>
          scoreByInterest(b) - scoreByInterest(a) ||
          String(b.difficulty || "").localeCompare(String(a.difficulty || "")) ||
          String(a.id).localeCompare(String(b.id)),
      )
      .slice(0, 2)
      .map((m) => ({ mission_id: m.id, title: m.title, difficulty: m.difficulty, sector: m.sector_name, reason: `Stretch in your stronger area: ${m.sector_name}.` }));
    let recommendations = [...easierFirst, ...strongerStretch].slice(0, 4);

    // AI refinement if key exists
    const aiSystem = `You are a learning-path recommender for STEM games.
Return ONLY valid JSON: {"recommendations":[{"mission_id":number,"reason":"string","difficulty_target":"easy|medium|hard"}]}
Prefer adaptive progression: easier for weaker domains, harder for stronger domains.`;
    const aiUser = JSON.stringify({
      student_id: studentId,
      avg_score_percent: Math.round(Number(stats?.avg_score || 0)),
      quizzes_completed: Number(stats?.quizzes_completed || 0),
      sector_progress: sectorProgress,
      pending_missions: pending.map((m) => ({ mission_id: m.id, title: m.title, sector: m.sector_name, difficulty: m.difficulty })),
      student_interests: interestKeys,
    });
    const ai = await callAiJson<{ recommendations?: Array<{ mission_id: number; reason?: string; difficulty_target?: string }> }>(aiSystem, aiUser);
    if (ai?.recommendations?.length) {
      const byId = new Map<string, DbRow>(pending.map((m) => [String(m.id), m]));
      const merged = ai.recommendations
        .map((r) => {
          const m = byId.get(String(r.mission_id));
          if (!m) return null;
          return {
            mission_id: m.id,
            title: m.title,
            difficulty: m.difficulty,
            sector: m.sector_name,
            reason: r.reason || `Recommended next step for ${m.sector_name}.`,
          };
        })
        .filter(Boolean) as any[];
      if (merged.length) recommendations = merged.slice(0, 4);
    }

    res.json({
      success: true,
      profile: {
        avg_score_percent: Math.round(Number(stats?.avg_score || 0)),
        quizzes_completed: Number(stats?.quizzes_completed || 0),
        weakest_sector: weakest?.sector_name || null,
        strongest_sector: strongest?.sector_name || null,
      },
      recommendations,
    });
  }));

  router.get("/students/:id/assigned-challenges", requireAuth, requireStudentAccess, asyncRoute(async (req, res) => {
    const studentId = req.params.id;
    const baseChallenges = await SQ.listChallengesForStudent(studentId);
    const out = [];
    for (const c of baseChallenges) {
      const { data: attempts } = await db()
        .from("challenge_attempts")
        .select("score, correct, created_at")
        .eq("student_id", studentId)
        .eq("challenge_id", c.id)
        .order("created_at", { ascending: false })
        .limit(1);
      const latest = attempts?.[0] as DbRow | undefined;
      out.push({
        ...c,
        latest_score: latest?.score ?? null,
        latest_correct: latest?.correct ?? null,
        latest_attempted_at: latest?.created_at ?? null,
      });
    }
    res.json(out);
  }));

  // Student Progress (students can only read own data)
  router.get("/students/:id/progress", requireAuth, requireStudentAccess, asyncRoute(async (req, res) => {
    const studentId = req.params.id;
    const badges = await selectMany("student_badges", "*", { student_id: studentId });
    const sqRows = await selectMany<DbRow>("student_quizzes", "*", { student_id: studentId });
    const quizzes = [];
    for (const sq of sqRows) {
      const q = await selectOne<{ title: string }>("quizzes", "title", { id: String(sq.quiz_id) });
      quizzes.push({ ...sq, title: q?.title });
    }
    const missions_completed = await countRows("student_mission_completions", { student_id: studentId });
    res.json({ badges, quizzes, missions_completed });
  }));

  router.get("/students/:id/interests", requireAuth, requireStudentAccess, asyncRoute(async (req, res) => {
    const selected = await selectMany<{ interest_key: string }>(
      "student_interest_votes",
      "interest_key",
      { student_id: req.params.id },
      { column: "weight", ascending: false },
    );
    res.json({ success: true, selected: selected.map((r) => r.interest_key) });
  }));

  router.get("/students/:id/onboarding", requireAuth, requireStudentAccess, asyncRoute(async (req, res) => {
    const studentId = req.params.id;
    const { data: classes } = await db().from("class_students").select("class_id").eq("student_id", studentId).limit(1);
    const hasClass = Boolean(classes && classes.length);
    const profile = await selectOne<DbRow>("student_onboarding_profiles", "*", { student_id: studentId });
    res.json({
      success: true,
      has_class: hasClass,
      completed: Boolean(profile),
      should_show: !hasClass && !profile,
      profile,
    });
  }));

  router.post("/students/:id/onboarding", requireAuth, requireStudentAccess, asyncRoute(async (req, res) => {
    const studentId = req.params.id;
    const body = (req.body && typeof req.body === "object" ? req.body : {}) as Record<string, unknown>;
    const ageGrade = String(body.age_grade || "").trim();
    const experience = String(body.experience || "").trim();
    const goal = String(body.goal || "").trim();
    const interests: string[] = Array.isArray(body.interests)
      ? [...new Set(body.interests.map((x: unknown) => String(x || "").trim().toLowerCase()).filter(Boolean))].slice(0, 6) as string[]
      : [];

    const parsedAge = parseOnboardingAge(body);
    const assignedLevel = parsedAge != null ? assignedLevelFromAge(parsedAge) : null;

    const { data: classes } = await db().from("class_students").select("class_id").eq("student_id", studentId).limit(1);
    const hasClass = Boolean(classes && classes.length);
    let assignment = { sectors: [] as string[], startSector: null as string | null };
    if (!hasClass) {
      assignment = await assignDefaultCurriculum({
        ageGrade,
        interests,
        experience,
        goal,
        assignedLevel,
      });
      if (!assignment.sectors.length) {
        const dark = await findSectorByName("Dark City");
        if (dark?.id) {
          assignment = { sectors: [String(dark.id)], startSector: String(dark.id) };
        }
      }
    }

    if (!hasClass && assignment.sectors.length) {
      for (const sid of assignment.sectors) {
        await upsertRow(
          "student_sector_mastery",
          {
            student_id: studentId,
            sector_id: sid,
            mastery_percent: sid === assignment.startSector ? 1 : 0,
            updated_at: new Date().toISOString(),
          },
          "student_id,sector_id",
        );
      }
    }

    const profile = await upsertRow<DbRow>(
      "student_onboarding_profiles",
      {
        student_id: studentId,
        age: parsedAge,
        age_grade: ageGrade || null,
        interests,
        experience_level: experience || null,
        learning_goal: goal || null,
        assigned_level: assignedLevel,
        recommended_sector_ids: assignment.sectors,
        start_sector_id: assignment.startSector,
        completed_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
      "student_id",
    );

    await updateRow(
      "students",
      { id: studentId },
      {
        onboarding_completed: true,
        assigned_level: assignedLevel,
      },
    );

    let firstJourneyId: string | null = null;
    if (!hasClass && assignment.startSector) {
      let jq = db()
        .from("journeys")
        .select("id, order_index, assigned_level")
        .eq("is_default", true)
        .eq("is_deployed", true)
        .is("class_id", null)
        .eq("sector_id", assignment.startSector)
        .order("order_index", { ascending: true });
      const { data: journeyRows } = await jq;
      const rows = ((journeyRows || []) as Array<{ id: string; assigned_level?: string | null }>).filter(
        (j) => !j.assigned_level || !assignedLevel || String(j.assigned_level) === assignedLevel,
      );
      if (rows[0]?.id) firstJourneyId = String(rows[0].id);
    }

    const startSectorRow = assignment.startSector
      ? await selectOne<{ id: string; name: string }>("sectors", "id, name", { id: assignment.startSector })
      : null;

    res.json({
      success: true,
      has_class: hasClass,
      assigned: !hasClass,
      assigned_level: assignedLevel,
      onboarding_completed: true,
      sectors: assignment.sectors,
      start_sector: assignment.startSector,
      start_sector_name: startSectorRow?.name ?? null,
      first_journey_id: firstJourneyId,
      highlight_sector_id: assignment.startSector,
      profile,
    });
  }));

  router.post("/students/:id/tutorial-complete", requireAuth, requireStudentAccess, asyncRoute(async (req, res) => {
    const studentId = req.params.id;
    await updateRow("students", { id: studentId }, { tutorial_completed: true });
    res.json({ success: true, tutorial_completed: true });
  }));

  router.post("/students/:id/interests", requireAuth, requireStudentAccess, asyncRoute(async (req, res) => {
    const studentId = req.params.id;
    const incoming = Array.isArray(req.body?.selected) ? req.body.selected : [];
    const selected = [...new Set(incoming.map((x: unknown) => String(x || "").trim().toLowerCase()).filter(Boolean))].slice(0, 6);
    if (selected.length < 2) {
      return res.status(400).json({ success: false, message: "Select at least 2 interests." });
    }
    await deleteRows("student_interest_votes", { student_id: studentId });
    await insertMany(
      "student_interest_votes",
      selected.map((key: string, idx: number) => ({
        student_id: studentId,
        interest_key: key,
        weight: Math.max(1, selected.length - idx),
      })),
    );
    res.json({ success: true, selected });
  }));

  router.get("/students/:id/assigned-quizzes", requireAuth, requireStudentAccess, asyncRoute(async (req, res) => {
    const studentId = req.params.id;
    const { data: classRows } = await db().from("class_students").select("class_id").eq("student_id", studentId);
    const classIds = (classRows || []).map((r) => (r as { class_id: string }).class_id);
    const quizIdSet = new Set<string>();
    if (classIds.length) {
      const { data: cq } = await db().from("class_quizzes").select("quiz_id").in("class_id", classIds);
      for (const row of cq || []) quizIdSet.add((row as { quiz_id: string }).quiz_id);
    }
    const out: DbRow[] = [];
    for (const qid of quizIdSet) {
      const q = await selectOne<DbRow>("quizzes", "*", { id: qid });
      if (!q) continue;
      const { data: sqRows } = await db()
        .from("student_quizzes")
        .select("*")
        .eq("student_id", studentId)
        .eq("quiz_id", qid)
        .order("completed_at", { ascending: false })
        .limit(1);
      const latest = sqRows?.[0] as DbRow | undefined;
      out.push({
        ...q,
        latest_score: latest?.score ?? null,
        latest_total_questions: latest?.total_questions ?? null,
        latest_completed_at: latest?.completed_at ?? null,
        latest_pending_reviews: latest?.pending_reviews ?? null,
      });
    }
    out.sort((a, b) => String(b.created_at).localeCompare(String(a.created_at)));
    return res.json(out);
  }));

  router.get("/students/:id/assigned-missions", requireAuth, requireStudentAccess, asyncRoute(async (req, res) => {
    const studentId = req.params.id;
    const completions = await selectMany<{ mission_id: string; completed_at: string }>(
      "student_mission_completions",
      "mission_id, completed_at",
      { student_id: studentId },
    );
    const completedMap = new Map(completions.map((c) => [c.mission_id, c.completed_at]));
    const { data: classRows } = await db().from("class_students").select("class_id").eq("student_id", studentId);
    const classIds = (classRows || []).map((r) => (r as { class_id: string }).class_id);
    let missionIds: string[] = [];
    if (classIds.length) {
      const { data: cm } = await db().from("class_missions").select("mission_id").in("class_id", classIds);
      missionIds = [...new Set((cm || []).map((r) => (r as { mission_id: string }).mission_id))];
    }
    let missions: DbRow[] = [];
    if (missionIds.length) {
      const all = await selectMany<DbRow>("missions", "*");
      missions = all.filter((m) => missionIds.includes(String(m.id)));
    }
    if (!missions.length) {
      const studentRow = await selectOne<{ grade?: string | null }>("students", "grade", { id: studentId });
      const normalizedGrade = String(studentRow?.grade || "").trim().toLowerCase();
      const all = await selectMany<DbRow>("missions", "*", { status: "available" });
      missions = all
        .filter((m) => {
          if (!normalizedGrade) return true;
          const gl = String(m.grade_level || "").trim().toLowerCase();
          return !gl || gl === normalizedGrade;
        })
        .slice(0, 24);
    }
    const filtered = missions.filter((m) => {
      const prereq = m.prerequisite_mission_id as string | null;
      if (!prereq) return true;
      if (completedMap.has(prereq)) return true;
      if (completedMap.has(String(m.id))) return true;
      return false;
    });
    const withCompleted = filtered.map((m) => ({
      ...m,
      latest_completed_at: completedMap.get(String(m.id)) ?? null,
    }));
    return res.json(withCompleted);
  }));

  router.post("/students/:id/missions/:missionId/complete", requireAuth, requireStudentAccess, async (req, res) => {
    const studentId = req.params.id;
    const missionId = req.params.missionId;
    const sessionUser = getReqUser(req)!;
    if (sessionUser.id !== studentId) return res.status(403).json({ error: "Forbidden" });

    const prior = await selectOne("student_mission_completions", "student_id", {
      student_id: studentId,
      mission_id: missionId,
    });
    let xpEarned = 0;
    if (!prior) {
      const mission = await selectOne<{ xp_reward?: number }>("missions", "xp_reward", { id: missionId });
      xpEarned = Math.max(0, Number(mission?.xp_reward) || 0);
      const studentRow = await selectOne<{ xp?: number }>("students", "xp", { id: studentId });
      const newXp = (Number(studentRow?.xp) || 0) + xpEarned;
      const newLevel = xpToLevel(newXp);
      await updateRow("students", { id: studentId }, { xp: newXp, level: newLevel });
    }

    await insertIgnore(
      "student_mission_completions",
      { student_id: studentId, mission_id: missionId },
      "student_id,mission_id",
    );
    await bumpLastActive(studentId);
    const student = await getStudentPublic(studentId);
    res.json({ success: true, student, xp_earned: xpEarned });
  });

  router.get("/students/:id/classes", requireAuth, requireStudentAccess, async (req, res) => {
    const studentId = req.params.id;
    const { data: memberships } = await db().from("class_students").select("class_id").eq("student_id", studentId);
    const classIds = (memberships || []).map((m) => (m as { class_id: string }).class_id);
    const out = [];
    for (const cid of classIds) {
      const c = await selectOne<DbRow>("classes", "*", { id: cid });
      if (!c) continue;
      const teacher = c.teacher_id
        ? await selectOne<{ name: string }>("students", "name", { id: String(c.teacher_id) })
        : null;
      const student_count = await countRows("class_students", { class_id: cid });
      out.push({ ...c, teacher_name: teacher?.name, student_count });
    }
    res.json(out);
  });

  router.get("/students/:id/classmates", requireAuth, requireStudentAccess, async (req, res) => {
    const studentId = req.params.id;
    const { data: myClasses } = await db().from("class_students").select("class_id").eq("student_id", studentId);
    const classIds = (myClasses || []).map((r) => (r as { class_id: string }).class_id);
    if (!classIds.length) return res.json([]);
    const { data: peers } = await db().from("class_students").select("student_id").in("class_id", classIds);
    const peerIds = [...new Set((peers || []).map((p) => (p as { student_id: string }).student_id))].filter(
      (id) => id !== studentId,
    );
    const classmates = [];
    for (const pid of peerIds) {
      const s = await selectOne<DbRow>("students", "id, name, username, level, xp, avatar_url, role", { id: pid });
      if (s && s.role === "student") classmates.push(s);
    }
    classmates.sort((a, b) => Number(b.xp) - Number(a.xp));
    res.json(classmates);
  });

  return router;
}

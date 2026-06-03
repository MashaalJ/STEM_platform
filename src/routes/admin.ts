/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import express from "express";
import { db, selectOne, selectMany, updateRow, countRows, isUuid, getStudentPublic, type DbRow } from "../../lib/db";
import * as SQ from "../../lib/serverQueries";
import { asyncRoute, getReqUser } from "./_middleware.ts";

export type AdminRouterDeps = {
  requireAuth: express.RequestHandler;
  requireRole: (roles: string[]) => express.RequestHandler;
  sanitizeUser: (user: Record<string, unknown> | null, viewerRole?: string) => Record<string, unknown> | null;
  normalizeGender: (raw: unknown) => string | null;
  normalizeCountryCode: (raw: unknown) => string | null;
  ensureClassAccess: (
    req: express.Request,
    res: express.Response,
    classId: string,
  ) => Promise<{ ok: boolean }>;
};

export default function createAdminRouter(deps: AdminRouterDeps): express.Router {
  const {
    requireAuth,
    requireRole,
    sanitizeUser,
    normalizeGender,
    normalizeCountryCode,
    ensureClassAccess,
  } = deps;
  const router = express.Router();

  router.get("/schools", requireAuth, asyncRoute(async (_req, res) => {
    try {
      res.json(await SQ.selectDistinctSchools());
    } catch (err) {
      console.warn("[stemverse] /api/schools:", err instanceof Error ? err.message : err);
      res.json([]);
    }
  }));

  router.get("/logs", requireAuth, requireRole(["admin"]), async (_req, res) => {
    res.json(await SQ.listLogs());
  });

  router.get("/admin/metrics", requireAuth, requireRole(["admin"]), async (_req, res) => {
    res.json(await SQ.getAdminMetrics());
  });

  router.patch("/admin/students/:id", requireAuth, requireRole(["admin"]), async (req, res) => {
    const id = req.params.id;
    if (!isUuid(id)) return res.status(400).json({ success: false, message: "Invalid id" });
    const row = await selectOne("students", "id", { id });
    if (!row) return res.status(404).json({ success: false, message: "User not found" });

    const allowed = [
      "subscription_status",
      "subscription_plan",
      "billing_provider",
      "mrr_cents",
      "ltv_cents",
      "gender",
      "country_code",
      "region",
      "timezone",
    ] as const;
    const updates: Record<string, unknown> = {};
    for (const key of allowed) {
      if (req.body[key] !== undefined) updates[key] = req.body[key];
    }
    if (updates.subscription_status !== undefined) {
      const s = String(updates.subscription_status || "").trim().toLowerCase();
      const ok = ["none", "free", "trial", "active", "past_due", "canceled"].includes(s);
      if (!ok) return res.status(400).json({ success: false, message: "Invalid subscription_status" });
      updates.subscription_status = s;
    }
    if (updates.subscription_plan !== undefined) {
      updates.subscription_plan = String(updates.subscription_plan || "free").trim() || "free";
    }
    if (updates.billing_provider !== undefined) {
      const b = String(updates.billing_provider || "none").trim().toLowerCase();
      if (!["none", "manual", "stripe"].includes(b)) {
        return res.status(400).json({ success: false, message: "Invalid billing_provider" });
      }
      updates.billing_provider = b;
    }
    if (updates.mrr_cents !== undefined) {
      const n = Number(updates.mrr_cents);
      if (!Number.isFinite(n) || n < 0) return res.status(400).json({ success: false, message: "Invalid mrr_cents" });
      updates.mrr_cents = Math.round(n);
    }
    if (updates.ltv_cents !== undefined) {
      const n = Number(updates.ltv_cents);
      if (!Number.isFinite(n) || n < 0) return res.status(400).json({ success: false, message: "Invalid ltv_cents" });
      updates.ltv_cents = Math.round(n);
    }
    if (updates.gender !== undefined) {
      const g = normalizeGender(updates.gender);
      if (req.body.gender != null && String(req.body.gender).trim() !== "" && g === null) {
        return res.status(400).json({ success: false, message: "Invalid gender" });
      }
      updates.gender = g;
    }
    if (updates.country_code !== undefined) {
      const cc = normalizeCountryCode(updates.country_code);
      if (req.body.country_code != null && String(req.body.country_code).trim() !== "" && cc === null) {
        return res.status(400).json({ success: false, message: "Invalid country_code" });
      }
      updates.country_code = cc;
    }
    if (updates.region !== undefined) updates.region = String(updates.region || "").trim() || null;
    if (updates.timezone !== undefined) updates.timezone = String(updates.timezone || "").trim() || null;

    if (Object.keys(updates).length === 0) {
      return res.status(400).json({ success: false, message: "No valid fields" });
    }
    await updateRow("students", { id }, updates);
    const user = await getStudentPublic(id);
    res.json({ success: true, user: sanitizeUser(user) });
  });

  router.get("/teacher/quiz-reviews/pending", requireAuth, requireRole(["teacher", "admin"]), async (req, res) => {
    const sessionUser = getReqUser(req)!;
    const classIdRaw = req.query.class_id;
    const classId = classIdRaw != null && String(classIdRaw).trim() ? String(classIdRaw) : null;
    if (classId && !isUuid(classId)) return res.status(400).json({ error: "Invalid class_id" });

    const pending = await selectMany<DbRow>("quiz_review_items", "*", { review_status: "pending" }, {
      column: "created_at",
      ascending: true,
    });
    const rows: DbRow[] = [];
    for (const qri of pending) {
      const csRows = await selectMany<{ class_id: string }>("class_students", "class_id", { student_id: qri.student_id });
      let allowed = false;
      for (const cs of csRows) {
        const cq = await selectOne("class_quizzes", "class_id", { class_id: cs.class_id, quiz_id: qri.quiz_id });
        if (!cq) continue;
        const cls = await selectOne<{ teacher_id: string }>("classes", "teacher_id", { id: cs.class_id });
        if (!cls) continue;
        if (classId && cs.class_id !== classId) continue;
        if (sessionUser.role === "admin" || cls.teacher_id === sessionUser.id) {
          allowed = true;
          break;
        }
      }
      if (!allowed) continue;
      const student = await selectOne<{ name: string }>("students", "name", { id: qri.student_id });
      const quiz = await selectOne<{ title: string }>("quizzes", "title", { id: qri.quiz_id });
      rows.push({
        id: qri.id,
        student_quiz_id: qri.student_quiz_id,
        student_id: qri.student_id,
        student_name: student?.name ?? "",
        quiz_id: qri.quiz_id,
        quiz_title: quiz?.title ?? "",
        question_index: qri.question_index,
        prompt: qri.prompt,
        response_text: qri.response_text,
        max_score: qri.max_score,
        created_at: qri.created_at,
      });
    }
    res.json(rows);
  });

  router.post("/teacher/quiz-reviews/:id/grade", requireAuth, requireRole(["teacher", "admin"]), async (req, res) => {
    const sessionUser = getReqUser(req)!;
    const reviewId = req.params.id;
    const awardedRaw = Number(req.body?.awarded_score);
    if (!isUuid(reviewId)) {
      return res.status(400).json({ success: false, message: "Invalid review id" });
    }

    const qri = await selectOne<DbRow>("quiz_review_items", "*", { id: reviewId });
    if (!qri) return res.status(404).json({ success: false, message: "Review item not found" });

    const csRows = await selectMany<{ class_id: string }>("class_students", "class_id", { student_id: qri.student_id });
    let teacherId: string | null = null;
    let hasAccess = false;
    for (const cs of csRows) {
      const cq = await selectOne("class_quizzes", "class_id", { class_id: cs.class_id, quiz_id: qri.quiz_id });
      if (!cq) continue;
      const cls = await selectOne<{ teacher_id: string }>("classes", "teacher_id", { id: cs.class_id });
      if (!cls) continue;
      teacherId = cls.teacher_id;
      hasAccess = true;
      break;
    }
    if (!hasAccess) return res.status(404).json({ success: false, message: "Review item not found" });
    if (sessionUser.role !== "admin" && teacherId !== sessionUser.id) {
      return res.status(403).json({ success: false, message: "Forbidden" });
    }
    if (qri.review_status !== "pending") {
      return res.status(400).json({ success: false, message: "This item is already reviewed" });
    }

    const awarded = Math.max(0, Math.min(Number(qri.max_score || 1), Number.isFinite(awardedRaw) ? awardedRaw : 0));
    await updateRow("quiz_review_items", { id: reviewId }, {
      awarded_score: awarded,
      review_status: "reviewed",
      reviewed_by: sessionUser.id,
      reviewed_at: new Date().toISOString(),
    });

    const allReviews = await selectMany<DbRow>("quiz_review_items", "awarded_score, review_status", {
      student_quiz_id: qri.student_quiz_id,
    });
    const reviewedSum = allReviews.reduce((sum, r) => sum + Number(r.awarded_score || 0), 0);
    const pendingCount = allReviews.filter((r) => r.review_status === "pending").length;

    const base = await selectOne<{ auto_score: number; total_questions: number }>("student_quizzes", "auto_score, total_questions", {
      id: qri.student_quiz_id,
    });
    if (base) {
      const total = Number(base.total_questions || 0);
      const combined = Math.max(0, Math.min(total, Number(base.auto_score || 0) + reviewedSum));
      await updateRow("student_quizzes", { id: qri.student_quiz_id }, {
        reviewed_score: reviewedSum,
        pending_reviews: pendingCount,
        score: combined,
      });
    }

    res.json({ success: true });
  });

  router.get("/report-card/:classId", requireAuth, requireRole(["teacher", "admin"]), async (req, res) => {
    const classId = req.params.classId;
    if (!isUuid(classId)) return res.status(400).json({ error: "Invalid class id" });
    if (!(await ensureClassAccess(req, res, classId)).ok) return;

    const roster = await selectMany<{ student_id: string }>("class_students", "student_id", { class_id: classId });
    const base: DbRow[] = [];
    for (const { student_id } of roster) {
      const s = await getStudentPublic(student_id);
      if (!s) continue;
      const quizzes = await selectMany<{ score: number; total_questions: number }>("student_quizzes", "score, total_questions", {
        student_id,
      });
      const quizzes_completed = quizzes.length;
      const scored = quizzes.filter((q) => Number(q.total_questions) > 0);
      const avg_quiz_score =
        scored.length > 0
          ? (scored.reduce((sum, q) => sum + Number(q.score) / Number(q.total_questions), 0) / scored.length) * 100
          : 0;
      let nodes_completed = 0;
      try {
        nodes_completed = await countRows("student_journey_progress", { student_id });
      } catch {
        nodes_completed = 0;
      }
      const last_active_at = s.last_active_at ? String(s.last_active_at) : null;
      const daysInactive = last_active_at
        ? (Date.now() - new Date(last_active_at).getTime()) / 86_400_000
        : 999;
      let status = "On Track";
      if (avg_quiz_score < 50 || (quizzes_completed === 0 && nodes_completed === 0)) status = "Behind";
      else if (daysInactive >= 3 || avg_quiz_score < 70) status = "Needs Attention";

      const journey_progress: Array<{
        sector_id: string;
        sector_name: string;
        completed: number;
        total: number;
        percent: number;
      }> = [];
      if (classId) {
        let journeyQuery = db()
          .from("journeys")
          .select("id, sector_id, is_deployed")
          .eq("class_id", classId)
          .eq("is_deployed", true);
        let { data: journeyRows, error: journeyErr } = await journeyQuery;
        if (journeyErr && /is_deployed/i.test(journeyErr.message || "")) {
          const fallback = await db().from("journeys").select("id, sector_id").eq("class_id", classId);
          journeyRows = fallback.data as typeof journeyRows;
          journeyErr = fallback.error;
        }
        const bySector = new Map<string, { completed: number; total: number }>();
        for (const j of (journeyRows || []) as Array<{ id: string; sector_id: string | null }>) {
          const sid = String(j.sector_id || "");
          if (!sid) continue;
          const total = await countRows("journey_nodes", { journey_id: String(j.id) });
          const done = await countRows("student_journey_progress", { student_id, journey_id: String(j.id) });
          const cur = bySector.get(sid) || { completed: 0, total: 0 };
          cur.total += total;
          cur.completed += done;
          bySector.set(sid, cur);
        }
        for (const [sectorId, agg] of bySector) {
          const sector = await selectOne<{ name: string }>("sectors", "name", { id: sectorId });
          const percent = agg.total > 0 ? Math.round((agg.completed / agg.total) * 100) : 0;
          journey_progress.push({
            sector_id: sectorId,
            sector_name: sector?.name || "Sector",
            completed: agg.completed,
            total: agg.total,
            percent,
          });
        }
        journey_progress.sort((a, b) => a.sector_name.localeCompare(b.sector_name));
      }

      const challenge_performance: { title: string; score: number; attempted_at: string }[] = [];
      const { data: attemptRows } = await db()
        .from("challenge_attempts")
        .select("score, created_at, challenge_id")
        .eq("student_id", student_id)
        .order("created_at", { ascending: false })
        .limit(12);
      const seenChallenges = new Set<string>();
      for (const row of attemptRows || []) {
        const challengeId = String((row as { challenge_id: string }).challenge_id);
        if (seenChallenges.has(challengeId)) continue;
        seenChallenges.add(challengeId);
        const ch = await selectOne<{ title: string }>("challenges", "title", { id: challengeId });
        challenge_performance.push({
          title: ch?.title || "Challenge",
          score: Math.round(Number((row as { score: number }).score || 0)),
          attempted_at: String((row as { created_at: string }).created_at),
        });
        if (challenge_performance.length >= 6) break;
      }

      const recent_activity: { title: string; kind: string; at: string; xp?: number }[] = [];
      const { data: completionRows } = await db()
        .from("student_mission_completions")
        .select("completed_at, mission_id")
        .eq("student_id", student_id)
        .order("completed_at", { ascending: false })
        .limit(6);
      for (const row of completionRows || []) {
        const missionId = String((row as { mission_id: string }).mission_id);
        const mission = await selectOne<{ title: string; xp_reward?: number }>("missions", "title, xp_reward", {
          id: missionId,
        });
        recent_activity.push({
          title: mission?.title || "Mission",
          kind: "mission",
          at: String((row as { completed_at: string }).completed_at),
          xp: Number(mission?.xp_reward || 0),
        });
      }

      const challengeAvg =
        challenge_performance.length > 0
          ? challenge_performance.reduce((sum, c) => sum + c.score, 0) / challenge_performance.length
          : null;

      base.push({
        id: s.id,
        name: s.name,
        level: s.level,
        xp: s.xp,
        quizzes_completed,
        avg_quiz_score,
        nodes_completed,
        last_active_at,
        status,
        challenge_performance,
        recent_activity,
        challenge_avg_score: challengeAvg,
        journey_progress,
      });
    }

    const mkRow = (row: DbRow) => {
      const avg = Number(row.avg_quiz_score || 0);
      const quizzes = Number(row.quizzes_completed || 0);
      const level = Number(row.level || 1);
      const xp = Number(row.xp || 0);
      const nodes = Number(row.nodes_completed || 0);
      const challengeAvg = row.challenge_avg_score != null ? Number(row.challenge_avg_score) : null;
      const challenges = Array.isArray(row.challenge_performance) ? row.challenge_performance : [];

      const strengths: string[] = [];
      const gaps: string[] = [];
      if (avg >= 75) strengths.push("Strong quiz performance");
      else if (quizzes > 0) gaps.push("Quiz scores below target — review missed concepts");
      if (nodes >= 5) strengths.push("Steady journey progress");
      else if (nodes === 0) gaps.push("No journey nodes completed yet");
      if (challengeAvg != null && challengeAvg >= 75) strengths.push("Solid challenge scores");
      else if (challengeAvg != null && challengeAvg < 60) gaps.push("Challenge practice needs reinforcement");
      if (strengths.length === 0) strengths.push("Building foundational skills");
      if (gaps.length === 0) gaps.push("Keep momentum with varied mission types");

      const masteryDomains = avg >= 80 ? ["Core problem solving", "Scientific reasoning"] : ["Core problem solving"];
      const skillsLearned = [
        "Perseverance on multi-step problems",
        avg >= 70 ? "Conceptual understanding" : "Foundational recall",
        quizzes >= 5 ? "Assessment stamina" : "Early assessment practice",
      ];
      const topicsCovered = [
        "STEMverse missions and quizzes completed in this class",
        challenges.length ? "Teacher-assigned challenges with recorded attempts" : "Challenges ready when assigned",
      ];
      let band = "Developing";
      if (avg >= 85 && level >= 20) band = "Exceeds expectations";
      else if (avg >= 70) band = "On track";
      const aiAssessment = [
        `${row.name} is level ${level} with ${xp} XP and ${nodes} journey node${nodes === 1 ? "" : "s"} completed.`,
        quizzes > 0
          ? `Quiz average: ${Math.round(avg)}% across ${quizzes} attempt${quizzes === 1 ? "" : "s"}.`
          : "No quizzes recorded yet for this class.",
        challengeAvg != null
          ? `Latest challenge average: ${Math.round(challengeAvg)}%.`
          : challenges.length === 0
            ? "No challenge attempts yet."
            : "",
        `Strengths: ${strengths.join("; ")}.`,
        `Focus areas: ${gaps.join("; ")}.`,
        `Overall band: ${band}.`,
      ]
        .filter(Boolean)
        .join(" ");
      return {
        ...row,
        strengths,
        gaps,
        mastery_domains: masteryDomains,
        skills_learned: skillsLearned,
        topics_covered: topicsCovered,
        ai_assessment: aiAssessment,
      };
    };

    res.json(base.map(mkRow));
  });

  router.post("/logs", requireAuth, requireRole(["teacher", "admin"]), async (req, res) => {
    const { message, type, xp_change } = req.body;
    await SQ.insertLog(message, type, xp_change);
    res.json({ success: true });
  });

  return router;
}

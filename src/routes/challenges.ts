/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import express from "express";
import {
  db,
  selectOne,
  insertOne,
  updateRow,
  deleteRows,
  countRows,
  isUuid,
  type DbRow,
} from "../../lib/db";
import * as SQ from "../../lib/serverQueries";
import { asyncRoute, getReqUser } from "./_middleware.ts";

export type ChallengesRouterDeps = {
  requireAuth: express.RequestHandler;
  requireRole: (roles: string[]) => express.RequestHandler;
  bumpLastActive: (userId: string) => Promise<void>;
  insertRowWithColumnFallback: (table: string, row: DbRow) => Promise<DbRow>;
  updateRowWithColumnFallback: (
    table: string,
    match: Record<string, unknown>,
    patch: DbRow,
  ) => Promise<void>;
};

export default function createChallengesRouter(deps: ChallengesRouterDeps): express.Router {
  const { requireAuth, requireRole, bumpLastActive, insertRowWithColumnFallback, updateRowWithColumnFallback } =
    deps;
  const router = express.Router();

  // --- Challenge Engine API (H5P-style interactive challenges) ---
  router.get("/challenges", requireAuth, async (req, res) => {
    const sessionUser = getReqUser(req)!;
    if (sessionUser.role === "student") {
      return res.json(await SQ.listChallengesForStudent(sessionUser.id));
    }
    res.json(await SQ.listAllChallenges());
  });

  router.get("/challenges/:id", requireAuth, async (req, res) => {
    if (!isUuid(req.params.id)) return res.status(400).json({ error: "Invalid challenge id" });
    const row = await selectOne("challenges", "*", { id: req.params.id });
    if (!row) return res.status(404).json({ error: "Challenge not found" });
    res.json(row);
  });

  router.post(
    "/challenges",
    requireAuth,
    requireRole(["teacher", "admin"]),
    asyncRoute(async (req, res) => {
      const sessionUser = getReqUser(req)!;
      const { title, type, world, zone, grade_level, xp_reward, xp_bonus_first_try, xp_retry_penalty, content_json } =
        req.body;
      if (!title || !type || content_json === undefined) {
        return res.status(400).json({ error: "title, type, and content_json required" });
      }
      const created = await insertRowWithColumnFallback("challenges", {
        title,
        type,
        world: world || null,
        zone: zone || null,
        grade_level: String(grade_level || "").trim() || null,
        xp_reward: Number(xp_reward) || 100,
        xp_bonus_first_try: Number(xp_bonus_first_try) || 0,
        xp_retry_penalty: Number(xp_retry_penalty) || 0,
        content_json: typeof content_json === "string" ? content_json : JSON.stringify(content_json),
        created_by: sessionUser.id,
      });
      res.json({ success: true, id: created.id });
    }),
  );

  router.patch("/challenges/:id", requireAuth, requireRole(["teacher", "admin"]), async (req, res) => {
    const id = req.params.id;
    if (!isUuid(id)) return res.status(400).json({ error: "Invalid challenge id" });
    const existing = await selectOne("challenges", "id", { id });
    if (!existing) return res.status(404).json({ error: "Challenge not found" });
    const { title, type, world, zone, grade_level, xp_reward, xp_bonus_first_try, xp_retry_penalty, content_json } = req.body;
    const patch: DbRow = {};
    if (title !== undefined) patch.title = title;
    if (type !== undefined) patch.type = type;
    if (world !== undefined) patch.world = world;
    if (zone !== undefined) patch.zone = zone;
    if (grade_level !== undefined) patch.grade_level = String(grade_level || "").trim() || null;
    if (xp_reward !== undefined) patch.xp_reward = Number(xp_reward);
    if (xp_bonus_first_try !== undefined) patch.xp_bonus_first_try = Number(xp_bonus_first_try);
    if (xp_retry_penalty !== undefined) patch.xp_retry_penalty = Number(xp_retry_penalty);
    if (content_json !== undefined) {
      patch.content_json = typeof content_json === "string" ? content_json : JSON.stringify(content_json);
    }
    if (Object.keys(patch).length === 0) return res.json({ success: true });
    await updateRowWithColumnFallback("challenges", { id }, patch);
    res.json({ success: true });
  });

  router.delete("/challenges/:id", requireAuth, requireRole(["teacher", "admin"]), async (req, res) => {
    const id = req.params.id;
    if (!isUuid(id)) return res.status(400).json({ error: "Invalid challenge id" });
    await deleteRows("class_challenges", { challenge_id: id });
    await deleteRows("challenge_attempts", { challenge_id: id });
    await deleteRows("challenges", { id });
    res.json({ success: true });
  });

  router.post("/challenges/:id/attempt", requireAuth, requireRole(["student"]), async (req, res) => {
    const challengeId = req.params.id;
    if (!isUuid(challengeId)) return res.status(400).json({ error: "Invalid challenge id" });
    const sessionUser = getReqUser(req)!;
    const challenge = await selectOne<{
      id: string;
      xp_reward: number;
      xp_bonus_first_try: number;
      xp_retry_penalty: number;
    }>("challenges", "id, xp_reward, xp_bonus_first_try, xp_retry_penalty", { id: challengeId });
    if (!challenge) return res.status(404).json({ error: "Challenge not found" });
    const { score, correct, response, time_ms } = req.body;
    const scoreNum = typeof score === "number" ? score : correct ? 1 : 0;
    const correctNum = correct === true || scoreNum >= 1 ? 1 : 0;
    const prevAttempts = await countRows("challenge_attempts", { student_id: sessionUser.id, challenge_id: challengeId });
    const attemptNumber = prevAttempts + 1;
    await insertOne("challenge_attempts", {
      student_id: sessionUser.id,
      challenge_id: challengeId,
      attempt_number: attemptNumber,
      score: scoreNum,
      correct: correctNum,
      response_json: typeof response === "string" ? response : JSON.stringify(response ?? {}),
      time_ms: time_ms ?? null,
    });
    await bumpLastActive(sessionUser.id);
    let xpEarned = 0;
    if (correctNum) {
      xpEarned =
        Number(challenge.xp_reward) +
        (attemptNumber === 1 ? Number(challenge.xp_bonus_first_try) || 0 : 0) -
        (attemptNumber > 1 ? (Number(challenge.xp_retry_penalty) || 0) * (attemptNumber - 1) : 0);
      if (xpEarned < 0) xpEarned = 0;
      const studentRow = await selectOne<{ xp: number }>("students", "xp", { id: sessionUser.id });
      await updateRow("students", { id: sessionUser.id }, { xp: (Number(studentRow?.xp) || 0) + xpEarned });
    }
    const student = await selectOne<{ xp: number }>("students", "xp", { id: sessionUser.id });
    res.json({
      success: true,
      correct: !!correctNum,
      xp_earned: xpEarned,
      total_xp: student?.xp ?? 0,
      attempt_number: attemptNumber,
    });
  });

  router.get("/challenges/:id/assigned-classes", requireAuth, requireRole(["teacher", "admin"]), async (req, res) => {
    const sessionUser = getReqUser(req)!;
    const challengeId = req.params.id;
    if (!isUuid(challengeId)) return res.status(400).json({ error: "Invalid challenge id" });
    let q = db().from("class_challenges").select("assigned_at, classes(id, name, teacher_id)").eq("challenge_id", challengeId);
    if (sessionUser.role === "teacher") {
      q = q.eq("classes.teacher_id", sessionUser.id);
    }
    const { data } = await q;
    const rows = (data || []).map((row: DbRow) => ({
      id: (row.classes as { id: string }).id,
      name: (row.classes as { name: string }).name,
      assigned_at: row.assigned_at,
    }));
    res.json(rows);
  });

  return router;
}

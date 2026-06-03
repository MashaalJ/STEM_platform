/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import express from "express";
import { db, selectOne, selectMany, updateRow, countRows, isUuid } from "../../lib/db";
import { asyncRoute, V, getReqUser } from "./_middleware.ts";

export type ParentRouterDeps = {
  requireAuth: express.RequestHandler;
  requireRole: (roles: string[]) => express.RequestHandler;
  rateLimitLinkChild: express.RequestHandler;
};

export default function createParentRouter(deps: ParentRouterDeps): express.Router {
  const { requireAuth, requireRole, rateLimitLinkChild } = deps;
  const router = express.Router();

  type ParentRow = {
    id: string;
    auth_id: string;
    name: string;
    email: string;
    student_id: string | null;
  };

  const getParentProfileByAuthId = async (authId: string) =>
    selectOne<ParentRow>("parents", "*", { auth_id: authId });

  const requireLinkedChildId = async (
    authId: string,
  ): Promise<{ childId: string; parent: ParentRow } | null> => {
    const parent = await getParentProfileByAuthId(authId);
    if (!parent?.student_id) return null;
    return { childId: parent.student_id, parent };
  };

  const computeStreakFromDates = (isoDates: string[]): number => {
    if (!isoDates.length) return 0;
    const days = new Set(isoDates.map((d) => String(d).slice(0, 10)));
    let streak = 0;
    const cursor = new Date();
    cursor.setHours(0, 0, 0, 0);
    const todayKey = cursor.toISOString().slice(0, 10);
    if (!days.has(todayKey)) {
      cursor.setDate(cursor.getDate() - 1);
    }
    while (true) {
      const key = cursor.toISOString().slice(0, 10);
      if (days.has(key)) {
        streak += 1;
        cursor.setDate(cursor.getDate() - 1);
      } else {
        break;
      }
    }
    return streak;
  };

  const resolveChildSectorContext = async (childId: string) => {
    const { data: latestRows } = await db()
      .from("student_mission_completions")
      .select("mission_id, completed_at")
      .eq("student_id", childId)
      .order("completed_at", { ascending: false })
      .limit(1);
    const latest = latestRows?.[0] as { mission_id: string; completed_at: string } | undefined;

    let sectorId: string | null = null;
    let sectorName: string | null = null;
    let currentMissionName: string | null = null;
    let nextMissionName: string | null = null;

    if (latest?.mission_id) {
      const mission = await selectOne<{ sector_id?: string; title?: string }>("missions", "sector_id, title", {
        id: latest.mission_id,
      });
      sectorId = mission?.sector_id ? String(mission.sector_id) : null;
      currentMissionName = mission?.title ?? null;
    }

    if (!sectorId) {
      const starter =
        (await selectOne<{ id: string; name: string }>("sectors", "id, name", { is_starter: true })) ||
        (await selectMany<{ id: string; name: string }>(
          "sectors",
          "id, name",
          { status: "active" },
          { column: "sort_order", ascending: true },
        ))[0];
      if (starter) {
        sectorId = String(starter.id);
        sectorName = starter.name;
      }
    } else {
      const sector = await selectOne<{ name: string }>("sectors", "name", { id: sectorId });
      sectorName = sector?.name ?? null;
    }

    const missionsInSector = sectorId
      ? await selectMany<{ id: string; title: string; prerequisite_mission_id?: string | null }>(
          "missions",
          "id, title, prerequisite_mission_id",
          { sector_id: sectorId },
          { column: "created_at", ascending: true },
        )
      : [];

    const { data: doneRows } = await db()
      .from("student_mission_completions")
      .select("mission_id")
      .eq("student_id", childId);
    const doneSet = new Set((doneRows || []).map((r) => String((r as { mission_id: string }).mission_id)));

    const missions_completed_in_sector = missionsInSector.filter((m) => doneSet.has(String(m.id))).length;
    const total_missions_in_sector = missionsInSector.length;

    for (const m of missionsInSector) {
      if (doneSet.has(String(m.id))) continue;
      const prereq = m.prerequisite_mission_id;
      if (!prereq || doneSet.has(String(prereq))) {
        nextMissionName = m.title;
        break;
      }
    }

    return {
      sectorName,
      currentMissionName,
      nextMissionName,
      missions_completed_in_sector,
      total_missions_in_sector,
    };
  };

  router.get("/parent/child", requireAuth, requireRole(["parent"]), asyncRoute(async (req, res) => {
    const sessionUser = getReqUser(req)!;
    const link = await requireLinkedChildId(sessionUser.id);
    if (!link) {
      return res.json({ linked: false });
    }
    const child = await selectOne<{
      name: string;
      level: number;
      xp: number;
      avatar_url: string | null;
      last_active_at: string | null;
    }>("students", "name, level, xp, avatar_url, last_active_at", { id: link.childId, role: "student" });
    if (!child) {
      return res.status(404).json({ linked: false, message: "Child account not found" });
    }
    const sectorCtx = await resolveChildSectorContext(link.childId);
    res.json({
      linked: true,
      name: child.name,
      level: child.level,
      xp: child.xp,
      current_sector: sectorCtx.sectorName,
      avatar: child.avatar_url,
      last_active: child.last_active_at,
    });
  }));

  router.get("/parent/child/activity", requireAuth, requireRole(["parent"]), asyncRoute(async (req, res) => {
    const sessionUser = getReqUser(req)!;
    const link = await requireLinkedChildId(sessionUser.id);
    if (!link) {
      return res.status(404).json({ success: false, message: "No linked child" });
    }
    const childId = link.childId;

    const { data: journeyRows } = await db()
      .from("student_journey_progress")
      .select("node_id, completed_at")
      .eq("student_id", childId)
      .order("completed_at", { ascending: false })
      .limit(40);

    const journeyActivity: Array<{
      activity_title: string;
      sector_name: string | null;
      source: "journey_node";
      completed_at: string;
      xp_earned: number;
    }> = [];

    for (const row of journeyRows || []) {
      const r = row as { node_id: string; completed_at: string };
      const node = await selectOne<{ title?: string; xp_reward?: number; journey_id?: string }>(
        "journey_nodes",
        "title, xp_reward, journey_id",
        { id: r.node_id },
      );
      if (!node?.journey_id) continue;
      const journey = await selectOne<{ sector_id?: string }>("journeys", "sector_id", {
        id: node.journey_id,
      });
      let sector_name: string | null = null;
      if (journey?.sector_id) {
        const sector = await selectOne<{ name: string }>("sectors", "name", { id: journey.sector_id });
        sector_name = sector?.name ?? null;
      }
      journeyActivity.push({
        activity_title: node.title ?? "Journey activity",
        sector_name,
        source: "journey_node",
        completed_at: r.completed_at,
        xp_earned: node.xp_reward ?? 0,
      });
    }

    const { data: missionRows } = await db()
      .from("student_mission_completions")
      .select("mission_id, completed_at")
      .eq("student_id", childId)
      .order("completed_at", { ascending: false })
      .limit(40);

    const missionActivity: Array<{
      activity_title: string;
      sector_name: string | null;
      source: "mission";
      completed_at: string;
      xp_earned: number;
    }> = [];

    for (const row of missionRows || []) {
      const r = row as { mission_id: string; completed_at: string };
      const mission = await selectOne<{ title?: string; xp_reward?: number; sector_id?: string }>(
        "missions",
        "title, xp_reward, sector_id",
        { id: r.mission_id },
      );
      let sector_name: string | null = null;
      if (mission?.sector_id) {
        const sector = await selectOne<{ name: string }>("sectors", "name", { id: mission.sector_id });
        sector_name = sector?.name ?? null;
      }
      missionActivity.push({
        activity_title: mission?.title ?? "Mission",
        sector_name,
        source: "mission",
        completed_at: r.completed_at,
        xp_earned: mission?.xp_reward ?? 0,
      });
    }

    const merged = [...journeyActivity, ...missionActivity]
      .sort((a, b) => new Date(b.completed_at).getTime() - new Date(a.completed_at).getTime())
      .slice(0, 20);

    res.json(merged);
  }));

  router.get("/parent/child/progress", requireAuth, requireRole(["parent"]), asyncRoute(async (req, res) => {
    const sessionUser = getReqUser(req)!;
    const link = await requireLinkedChildId(sessionUser.id);
    if (!link) {
      return res.status(404).json({ success: false, message: "No linked child" });
    }
    const child = await selectOne<{ level: number; xp: number }>("students", "level, xp", {
      id: link.childId,
      role: "student",
    });
    if (!child) {
      return res.status(404).json({ success: false, message: "Child account not found" });
    }
    const sectorCtx = await resolveChildSectorContext(link.childId);
    const badges_earned_count = await countRows("student_badges", { student_id: link.childId });
    res.json({
      current_sector_name: sectorCtx.sectorName,
      missions_completed_in_sector: sectorCtx.missions_completed_in_sector,
      total_missions_in_sector: sectorCtx.total_missions_in_sector,
      overall_level: child.level,
      total_xp: child.xp,
      badges_earned_count,
      current_mission_name: sectorCtx.currentMissionName,
      next_mission_name: sectorCtx.nextMissionName,
    });
  }));

  router.get("/parent/child/attendance", requireAuth, requireRole(["parent"]), asyncRoute(async (req, res) => {
    const sessionUser = getReqUser(req)!;
    const link = await requireLinkedChildId(sessionUser.id);
    if (!link) {
      return res.status(404).json({ success: false, message: "No linked child" });
    }
    const now = Date.now();
    const weekAgo = new Date(now - 7 * 24 * 60 * 60 * 1000).toISOString();
    const monthAgo = new Date(now - 30 * 24 * 60 * 60 * 1000).toISOString();

    const { data: weekRows } = await db()
      .from("student_mission_completions")
      .select("completed_at, mission_id")
      .eq("student_id", link.childId)
      .gte("completed_at", weekAgo);
    const { data: monthRows } = await db()
      .from("student_mission_completions")
      .select("completed_at")
      .eq("student_id", link.childId)
      .gte("completed_at", monthAgo);
    const { data: allDates } = await db()
      .from("student_mission_completions")
      .select("completed_at")
      .eq("student_id", link.childId)
      .order("completed_at", { ascending: false });

    let xp_earned_this_week = 0;
    for (const row of weekRows || []) {
      const r = row as { mission_id: string };
      const mission = await selectOne<{ xp_reward?: number }>("missions", "xp_reward", { id: r.mission_id });
      xp_earned_this_week += Number(mission?.xp_reward ?? 0);
    }

    const completionDates = (allDates || []).map((r) => String((r as { completed_at: string }).completed_at));
    const last_active = completionDates[0] ?? null;

    res.json({
      sessions_this_week: (weekRows || []).length,
      sessions_this_month: (monthRows || []).length,
      last_active,
      xp_earned_this_week,
      current_streak: computeStreakFromDates(completionDates),
    });
  }));

  router.post("/parent/link-child", requireAuth, requireRole(["parent"]), rateLimitLinkChild, V.validateBody(V.linkChildSchema), asyncRoute(async (req, res) => {
    const sessionUser = getReqUser(req)!;
    const { student_email } = req.body;
    const normalizedEmail = student_email.trim().toLowerCase();
    const parent = await getParentProfileByAuthId(sessionUser.id);
    if (!parent) {
      return res.status(400).json({ success: false, message: "Parent profile not found" });
    }
    if (parent.student_id) {
      return res.status(400).json({ success: false, message: "You already have a linked child account" });
    }
    const { data: childRows } = await db()
      .from("students")
      .select("id, role, email")
      .ilike("email", normalizedEmail)
      .limit(1);
    const child = childRows?.[0] as { id: string; role: string; email?: string } | undefined;
    if (!child || child.role !== "student") {
      return res.status(404).json({ success: false, message: "No student account found with that email" });
    }
    const { data: existingLinks } = await db()
      .from("parents")
      .select("id")
      .eq("student_id", child.id)
      .limit(1);
    if (existingLinks?.length) {
      return res.status(409).json({ success: false, message: "This student already has a parent linked" });
    }
    await updateRow("parents", { id: parent.id }, { student_id: child.id });
    res.json({ success: true, student_id: child.id });
  }));

  return router;
}

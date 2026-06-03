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
  isUuid,
  optionalUuid,
  type DbRow,
} from "../../lib/db";
import * as SQ from "../../lib/serverQueries";
import { asyncRoute, V, getReqUser } from "./_middleware.ts";

const SECTOR_STATUSES = new Set(["active", "locked", "maintenance", "archived", "coming_soon"]);
const MISSION_STATUSES = new Set(["available", "locked", "archived"]);

/** Sectors with a deployed journey that has at least one node (class journeys). */
async function deployedJourneySectorIdsForClasses(classIds: string[]): Promise<{
  sectorIds: Set<string>;
  journeyRows: Array<{ id: string; sector_id: string | null; order_index: number | null }>;
  nodeByJourney: Map<string, string[]>;
}> {
  const empty = { sectorIds: new Set<string>(), journeyRows: [], nodeByJourney: new Map<string, string[]>() };
  if (!classIds.length) return empty;

  const { data: publishedCurriculums } = await db()
    .from("curriculums")
    .select("id, class_id")
    .in("class_id", classIds)
    .eq("is_published", true);
  const publishedByClass = new Set(((publishedCurriculums || []) as Array<{ class_id: string }>).map((r) => String(r.class_id)));
  const publishedIds = ((publishedCurriculums || []) as Array<{ id: string }>).map((r) => String(r.id));

  let journeysQ = db()
    .from("journeys")
    .select("id, sector_id, order_index, class_id, curriculum_id")
    .eq("is_deployed", true)
    .in("class_id", classIds);
  if (publishedIds.length) {
    journeysQ = journeysQ.in("curriculum_id", publishedIds);
  } else if (publishedByClass.size) {
    journeysQ = journeysQ.in("class_id", Array.from(publishedByClass));
  }
  const { data: journeyData } = await journeysQ;
  const journeyRows = (journeyData || []) as Array<{
    id: string;
    sector_id: string | null;
    order_index: number | null;
  }>;

  const journeyIds = journeyRows.map((j) => String(j.id));
  const { data: nodeData } = journeyIds.length
    ? await db().from("journey_nodes").select("id, journey_id").in("journey_id", journeyIds)
    : { data: [] as Array<{ id: string; journey_id: string }> };

  const nodeByJourney = new Map<string, string[]>();
  for (const n of (nodeData || []) as Array<{ id: string; journey_id: string }>) {
    const jid = String(n.journey_id);
    const cur = nodeByJourney.get(jid) || [];
    cur.push(String(n.id));
    nodeByJourney.set(jid, cur);
  }

  const sectorIds = new Set<string>();
  for (const j of journeyRows) {
    const sid = String(j.sector_id || "");
    if (!sid) continue;
    if ((nodeByJourney.get(String(j.id)) || []).length > 0) sectorIds.add(sid);
  }

  return { sectorIds, journeyRows, nodeByJourney };
}

/** Sectors with class_missions assigned to the student's classes. */
async function legacyMissionSectorIdsForClasses(classIds: string[]): Promise<Set<string>> {
  const out = new Set<string>();
  if (!classIds.length) return out;
  const { data: cm } = await db().from("class_missions").select("mission_id").in("class_id", classIds);
  const missionIds = [...new Set((cm || []).map((r) => String((r as { mission_id: string }).mission_id)))];
  if (!missionIds.length) return out;
  const { data: missions } = await db().from("missions").select("sector_id").in("id", missionIds);
  for (const m of (missions || []) as Array<{ sector_id: string | null }>) {
    const sid = String(m.sector_id || "");
    if (sid) out.add(sid);
  }
  return out;
}

/** Default / platform journeys (no class) deployed with nodes in a sector. */
async function deployedDefaultJourneySectorIds(sectorFilter?: Set<string>): Promise<Set<string>> {
  let q = db()
    .from("journeys")
    .select("id, sector_id")
    .eq("is_deployed", true)
    .eq("is_default", true)
    .is("class_id", null);
  const { data: journeys, error } = await q;
  if (error && /is_deployed|is_default|class_id/i.test(error.message || "")) {
    return new Set();
  }
  const rows = (journeys || []) as Array<{ id: string; sector_id: string | null }>;
  if (!rows.length) return new Set();

  const journeyIds = rows.map((j) => String(j.id));
  const { data: nodes } = await db().from("journey_nodes").select("journey_id").in("journey_id", journeyIds);
  const journeysWithNodes = new Set((nodes || []).map((n) => String((n as { journey_id: string }).journey_id)));

  const out = new Set<string>();
  for (const j of rows) {
    if (!journeysWithNodes.has(String(j.id))) continue;
    const sid = String(j.sector_id || "");
    if (!sid) continue;
    if (sectorFilter && !sectorFilter.has(sid)) continue;
    out.add(sid);
  }
  return out;
}

export type SectorsRouterDeps = {
  requireAuth: express.RequestHandler;
  requireRole: (roles: string[]) => express.RequestHandler;
  isProduction: boolean;
  enrichSectorRow: (sector: DbRow, allSectors: DbRow[]) => DbRow;
  sectorStudentCountMap: () => Promise<Map<string, number>>;
  parseDomainIds: (raw: unknown) => string[] | null;
  parseLearningOutcomes: (raw: unknown) => string | null;
  parsePrerequisiteIds: (raw: unknown) => string | null;
  insertRowWithColumnFallback: (table: string, row: DbRow) => Promise<DbRow>;
  updateRowWithColumnFallback: (
    table: string,
    match: Record<string, unknown>,
    patch: DbRow,
  ) => Promise<void>;
  buildEmbedFromAdminInput: (body: Record<string, unknown>) => string | null;
  sanitizeEmbedCode: (input: string) => string | null;
};

export default function createSectorsRouter(deps: SectorsRouterDeps): express.Router {
  const {
    requireAuth,
    requireRole,
    isProduction,
    enrichSectorRow,
    sectorStudentCountMap,
    parseDomainIds,
    parseLearningOutcomes,
    parsePrerequisiteIds,
    insertRowWithColumnFallback,
    updateRowWithColumnFallback,
    buildEmbedFromAdminInput,
    sanitizeEmbedCode,
  } = deps;

  const router = express.Router();

  router.get("/sectors", requireAuth, asyncRoute(async (req, res) => {
    const rows = await SQ.listSectorsOrdered();
    let sectors = rows.map((s) => enrichSectorRow(s, rows));
    const sessionUser = getReqUser(req);
    const isAdmin = sessionUser?.role === "admin";
    let studentMastery = new Map<string, number>();

    if (!isAdmin) {
      sectors = sectors.filter((s) => String(s.status || "").toLowerCase() !== "archived");
    }

    if (sessionUser?.role === "student") {
      studentMastery = await SQ.getStudentSectorMasteryMap(sessionUser.id);
      sectors = sectors.map((s) => ({
        ...s,
        mastery_percent: studentMastery.get(String(s.id)) ?? Number(s.mastery_percent) ?? 0,
      }));
      const memberships = await selectMany<{ class_id: string }>("class_students", "class_id", { student_id: sessionUser.id });
      const classIds = [...new Set(memberships.map((m) => String(m.class_id)))];

      // Class students: journey-deployed sectors + legacy corridor sectors (tapered dual path).
      if (classIds.length) {
        const { sectorIds: journeySectorIds, journeyRows, nodeByJourney } =
          await deployedJourneySectorIdsForClasses(classIds);
        const legacySectorIds = await legacyMissionSectorIdsForClasses(classIds);
        const visibleSectorIds = new Set([...journeySectorIds, ...legacySectorIds]);
        sectors = sectors.filter((s) => visibleSectorIds.has(String(s.id)));

        const journeyIds = journeyRows.map((j) => String(j.id));
        const { data: progressData } = journeyIds.length
          ? await db()
              .from("student_journey_progress")
              .select("node_id, journey_id")
              .eq("student_id", sessionUser.id)
              .in("journey_id", journeyIds)
          : { data: [] as Array<{ node_id: string; journey_id: string }> };

        const completedByJourney = new Map<string, number>();
        for (const p of (progressData || []) as Array<{ journey_id: string }>) {
          const jid = String(p.journey_id);
          completedByJourney.set(jid, (completedByJourney.get(jid) || 0) + 1);
        }

        const statusBySector = new Map<string, string>();
        if (journeySectorIds.size) {
          const sectorOrder = new Map<string, number>();
          const sectorDone = new Map<string, boolean>();
          for (const j of journeyRows) {
            const sid = String(j.sector_id || "");
            if (!sid || !journeySectorIds.has(sid)) continue;
            const order = Number.isFinite(Number(j.order_index)) ? Number(j.order_index) : 0;
            if (!sectorOrder.has(sid) || order < Number(sectorOrder.get(sid))) sectorOrder.set(sid, order);
            const total = (nodeByJourney.get(String(j.id)) || []).length;
            const done = total > 0 && (completedByJourney.get(String(j.id)) || 0) >= total;
            sectorDone.set(sid, (sectorDone.get(sid) ?? true) && done);
          }
          const orderedSectorIds = [...journeySectorIds].sort(
            (a, b) => (sectorOrder.get(a) ?? 9999) - (sectorOrder.get(b) ?? 9999),
          );
          let unlocked = true;
          for (const sid of orderedSectorIds) {
            statusBySector.set(sid, unlocked ? "active" : "locked");
            if (!(sectorDone.get(sid) ?? false)) unlocked = false;
          }
        }

        sectors = sectors.map((s) => {
          const sid = String(s.id);
          const hasJourney = journeySectorIds.has(sid);
          return {
            ...s,
            has_deployed_journey: hasJourney,
            status: hasJourney
              ? statusBySector.get(sid) || "locked"
              : legacySectorIds.has(sid)
                ? "active"
                : String(s.status || "locked"),
          };
        });
      } else {
        // Individual subscriber: show sectors from onboarding assignment, fallback to default curriculum.
        let assignedIds: string[] = [];
        const onboarding = await selectOne<{ recommended_sector_ids?: unknown }>(
          "student_onboarding_profiles",
          "recommended_sector_ids",
          { student_id: sessionUser.id },
        );
        if (Array.isArray(onboarding?.recommended_sector_ids)) {
          assignedIds = onboarding.recommended_sector_ids.map((x) => String(x)).filter(Boolean);
        }
        if (!assignedIds.length) {
          const masteryRows = await selectMany<{ sector_id: string }>(
            "student_sector_mastery",
            "sector_id",
            { student_id: sessionUser.id },
          );
          assignedIds = masteryRows.map((r) => String(r.sector_id)).filter(Boolean);
        }
        if (!assignedIds.length) {
          const defaults = await selectMany<{
            sector_id: string | null;
            is_enabled?: boolean | null;
            custom_order?: number | null;
          }>("default_curriculum", "sector_id, is_enabled, custom_order");
          assignedIds = defaults
            .filter((d) => d.sector_id && (d.is_enabled ?? true))
            .map((d) => String(d.sector_id));
        }
        const defaultSectorIds = new Set(assignedIds);
        const defaultJourneySectorIds = await deployedDefaultJourneySectorIds(defaultSectorIds);
        sectors = sectors
          .filter((s) => defaultSectorIds.has(String(s.id)))
          .map((s) => ({
            ...s,
            status: "active",
            has_deployed_journey: defaultJourneySectorIds.has(String(s.id)),
          }));
      }
    }

    if (sessionUser?.role === "student") {
      sectors = sectors.map((s) => ({
        ...s,
        has_deployed_journey: Boolean((s as DbRow).has_deployed_journey),
      }));
    } else {
      sectors = sectors.map((s) => ({ ...s, has_deployed_journey: false }));
    }

    const byId = new Map(sectors.map((s) => [String(s.id), s]));
    sectors = sectors.map((s) => {
      if (sessionUser?.role === "student") return s;
      if (String(s.status || "").toLowerCase() !== "locked") return s;
      const unlockId = s.unlock_sector_id as string | null | undefined;
      if (!unlockId) return s;
      const prereq = byId.get(String(unlockId));
      if (!prereq) return s;
      const need = Number(s.unlock_mastery_percent) || 80;
      const have =
        studentMastery.get(String(unlockId)) ??
        Number(prereq.mastery_percent) ??
        0;
      if (have >= need) return { ...s, status: "active" };
      return s;
    });

    if (isAdmin) {
      const counts = await sectorStudentCountMap();
      sectors = sectors.map((s) => ({
        ...s,
        student_count: counts.get(String(s.id)) ?? 0,
      }));
    }

    res.json(sectors);
  }));

  router.get("/sectors/:id", requireAuth, asyncRoute(async (req, res) => {
    if (!isUuid(req.params.id)) return res.status(400).json({ error: "Invalid sector id" });
    const sector = await selectOne("sectors", "*", { id: req.params.id });
    if (!sector) return res.status(404).json({ error: "Sector not found" });
    const sessionUser = getReqUser(req);
    const sectorId = String(sector.id);
    let has_deployed_journey = false;
    if (sessionUser?.role === "student") {
      const memberships = await selectMany<{ class_id: string }>("class_students", "class_id", {
        student_id: sessionUser.id,
      });
      const classIds = [...new Set(memberships.map((m) => String(m.class_id)))];
      if (classIds.length) {
        const { sectorIds } = await deployedJourneySectorIdsForClasses(classIds);
        has_deployed_journey = sectorIds.has(sectorId);
      } else {
        const defaultJourneySectorIds = await deployedDefaultJourneySectorIds(new Set([sectorId]));
        has_deployed_journey = defaultJourneySectorIds.has(sectorId);
      }
    }
    res.json({ ...sector, has_deployed_journey });
  }));

  router.post(
    "/sectors",
    requireAuth,
    requireRole(["admin"]),
    V.validateBody(V.createSectorSchema),
    asyncRoute(async (req, res) => {
      const body = req.body || {};
      const {
        name,
        description,
        theme_color,
        icon,
        level_lock,
        unlock_sector_id,
        unlock_mastery_percent,
        domain_ids,
        xp_reward,
        required_level,
        mastery_percent,
        status,
        image_url,
      } = body;

      const trimmedName = String(name || "").trim();
      if (!trimmedName) {
        return res.status(400).json({ success: false, message: "Sector name is required" });
      }

      const safeDescription = String(description || "").trim();
      const safeXp = Math.max(0, Number.isFinite(Number(xp_reward)) ? Number(xp_reward) : 0);
      const safeRequiredLevel = Math.max(
        1,
        Number.isFinite(Number(level_lock ?? required_level)) ? Number(level_lock ?? required_level) : 1,
      );
      const safeMastery = Math.min(
        100,
        Math.max(0, Number.isFinite(Number(mastery_percent)) ? Number(mastery_percent) : 0),
      );
      const safeStatusRaw = String(status || "locked").toLowerCase();
      const safeStatus = SECTOR_STATUSES.has(safeStatusRaw) && safeStatusRaw !== "archived" ? safeStatusRaw : "locked";
      const safeImageUrl = String(image_url || "").trim() || "https://picsum.photos/seed/sector/400/300";
      const safeThemeColor = String(theme_color || "").trim() || null;
      const safeIcon = String(icon || "").trim() || null;
      const safeUnlockId = optionalUuid(unlock_sector_id);
      const safeUnlockMastery = Math.min(
        100,
        Math.max(50, Number.isFinite(Number(unlock_mastery_percent)) ? Number(unlock_mastery_percent) : 80),
      );
      const safeDomainIds = parseDomainIds(domain_ids);

      const created = await insertRowWithColumnFallback("sectors", {
        name: trimmedName,
        description: safeDescription,
        xp_reward: safeXp,
        required_level: safeRequiredLevel,
        mastery_percent: safeMastery,
        status: safeStatus,
        image_url: safeImageUrl,
        theme_color: safeThemeColor,
        icon: safeIcon,
        unlock_sector_id: safeUnlockId,
        unlock_mastery_percent: safeUnlockMastery,
        domain_ids: safeDomainIds?.length ? safeDomainIds : null,
      });
      return res.json({ success: true, sector: created });
    }),
  );

  router.patch(
    "/sectors/:id",
    requireAuth,
    requireRole(["admin"]),
    V.validateBody(V.patchSectorSchema),
    asyncRoute(async (req, res) => {
      const sectorId = req.params.id;
      if (!isUuid(sectorId)) return res.status(400).json({ success: false, message: "Invalid sector id" });
      const existing = await selectOne("sectors", "*", { id: sectorId });
      if (!existing) return res.status(404).json({ success: false, message: "Sector not found" });

      const body = req.body || {};
      const updates: DbRow = {};
      if (body.name != null) {
        const n = String(body.name).trim();
        if (!n) return res.status(400).json({ success: false, message: "Sector name cannot be empty" });
        updates.name = n;
      }
      if (body.description != null) updates.description = String(body.description).trim();
      if (body.theme_color != null) updates.theme_color = String(body.theme_color).trim() || null;
      if (body.icon != null) updates.icon = String(body.icon).trim() || null;
      if (body.image_url != null) updates.image_url = String(body.image_url).trim() || null;
      if (body.xp_reward != null) updates.xp_reward = Math.max(0, Number(body.xp_reward) || 0);
      if (body.level_lock != null || body.required_level != null) {
        updates.required_level = Math.max(1, Number(body.level_lock ?? body.required_level) || 1);
      }
      if (body.mastery_percent != null) {
        updates.mastery_percent = Math.min(100, Math.max(0, Number(body.mastery_percent) || 0));
      }
      if (body.unlock_sector_id !== undefined) {
        updates.unlock_sector_id = body.unlock_sector_id ? optionalUuid(body.unlock_sector_id) : null;
      }
      if (body.unlock_mastery_percent != null) {
        updates.unlock_mastery_percent = Math.min(100, Math.max(50, Number(body.unlock_mastery_percent) || 80));
      }
      if (body.domain_ids !== undefined) {
        const ids = parseDomainIds(body.domain_ids);
        updates.domain_ids = ids?.length ? ids : null;
      }
      if (body.status != null) {
        const st = String(body.status).toLowerCase();
        if (SECTOR_STATUSES.has(st) && st !== "archived") updates.status = st;
      }

      if (!Object.keys(updates).length) {
        return res.status(400).json({ success: false, message: "No valid fields" });
      }
      await updateRowWithColumnFallback("sectors", { id: sectorId }, updates);
      const sector = await selectOne("sectors", "*", { id: sectorId });
      res.json({ success: true, sector });
    }),
  );

  router.delete("/sectors/:id", requireAuth, requireRole(["admin"]), asyncRoute(async (req, res) => {
    const sectorId = req.params.id;
    if (!isUuid(sectorId)) return res.status(400).json({ success: false, message: "Invalid sector id" });
    const existing = await selectOne("sectors", "id", { id: sectorId });
    if (!existing) return res.status(404).json({ success: false, message: "Sector not found" });
    await updateRow("sectors", { id: sectorId }, { status: "archived" });
    res.json({ success: true });
  }));

  router.get("/domains", requireAuth, requireRole(["teacher", "admin"]), asyncRoute(async (_req, res) => {
    try {
      const rows = await selectMany("domains", "*", undefined, { column: "name", ascending: true });
      res.json(rows);
    } catch (err) {
      console.warn("[stemverse] /api/domains:", err instanceof Error ? err.message : err);
      res.json([]);
    }
  }));

  router.post(
    "/domains",
    requireAuth,
    requireRole(["admin"]),
    V.validateBody(V.createDomainSchema),
    asyncRoute(async (req, res) => {
      const { name, description, color, icon } = req.body || {};
      const trimmedName = String(name || "").trim();
      if (!trimmedName) return res.status(400).json({ success: false, message: "Domain name is required" });
      const created = await insertOne("domains", {
        name: trimmedName,
        description: String(description || "").trim() || null,
        color: String(color || "").trim() || null,
        icon: String(icon || "").trim() || null,
      });
      res.json({ success: true, domain: created });
    }),
  );

  router.patch(
    "/domains/:id",
    requireAuth,
    requireRole(["admin"]),
    V.validateBody(V.patchDomainSchema),
    asyncRoute(async (req, res) => {
      const domainId = req.params.id;
      if (!isUuid(domainId)) return res.status(400).json({ success: false, message: "Invalid domain id" });
      const existing = await selectOne("domains", "id", { id: domainId });
      if (!existing) return res.status(404).json({ success: false, message: "Domain not found" });
      const { name, description, color, icon } = req.body || {};
      const updates: DbRow = {};
      if (name != null) {
        const n = String(name).trim();
        if (!n) return res.status(400).json({ success: false, message: "Domain name cannot be empty" });
        updates.name = n;
      }
      if (description != null) updates.description = String(description).trim() || null;
      if (color != null) updates.color = String(color).trim() || null;
      if (icon != null) updates.icon = String(icon).trim() || null;
      if (!Object.keys(updates).length) {
        return res.status(400).json({ success: false, message: "No valid fields" });
      }
      await updateRow("domains", { id: domainId }, updates);
      const domain = await selectOne("domains", "*", { id: domainId });
      res.json({ success: true, domain });
    }),
  );

  router.delete("/domains/:id", requireAuth, requireRole(["admin"]), asyncRoute(async (req, res) => {
    const domainId = req.params.id;
    if (!isUuid(domainId)) return res.status(400).json({ success: false, message: "Invalid domain id" });
    const existing = await selectOne("domains", "id", { id: domainId });
    if (!existing) return res.status(404).json({ success: false, message: "Domain not found" });
    await deleteRows("domains", { id: domainId });
    res.json({ success: true });
  }));

  router.get(
    "/sectors/:id/first-journey-node",
    requireAuth,
    asyncRoute(async (req, res) => {
      const sectorId = req.params.id;
      if (!isUuid(sectorId)) return res.status(400).json({ error: "Invalid sector id" });
      const sector = await selectOne("sectors", "id", { id: sectorId });
      if (!sector) return res.status(404).json({ error: "Sector not found" });

      let journeyId: string | null = null;
      const { data: defaultJourneys } = await db()
        .from("journeys")
        .select("id")
        .eq("sector_id", sectorId)
        .eq("is_deployed", true)
        .eq("is_default", true)
        .is("class_id", null)
        .order("order_index", { ascending: true })
        .limit(1);
      const dj = (defaultJourneys || [])[0] as { id?: string } | undefined;
      if (dj?.id) journeyId = String(dj.id);

      if (!journeyId) {
        return res.json({ title: "Circuit Rescue" });
      }

      const { data: nodes } = await db()
        .from("journey_nodes")
        .select("title")
        .eq("journey_id", journeyId)
        .order("order_index", { ascending: true })
        .limit(1);
      const first = (nodes || [])[0] as { title?: string } | undefined;
      res.json({ title: String(first?.title || "").trim() || "Circuit Rescue" });
    }),
  );

  router.get("/sectors/:id/missions", requireAuth, asyncRoute(async (req, res) => {
    const sectorId = req.params.id;
    if (!isUuid(sectorId)) return res.status(400).json({ error: "Invalid sector id" });
    const sector = await selectOne("sectors", "*", { id: sectorId });
    if (!sector) return res.status(404).json({ error: "Sector not found" });

    const sessionUser = getReqUser(req)!;
    if (sessionUser.role === "student") {
      const result = await SQ.getMissionsForSectorStudent(sectorId, sessionUser.id);
      return res.json(result);
    }
    const visible = await SQ.listMissionsForSector(sectorId);
    res.json({ missions: visible, completedMissionIds: [] });
  }));

  router.post(
    "/sectors/:id/missions",
    requireAuth,
    requireRole(["teacher", "admin"]),
    V.validateBody(V.createSectorMissionSchema),
    asyncRoute(async (req, res) => {
      const sectorId = req.params.id;
      if (!isUuid(sectorId)) return res.status(400).json({ success: false, message: "Invalid sector id" });
      const sector = await selectOne("sectors", "id", { id: sectorId });
      if (!sector) return res.status(404).json({ success: false, message: "Sector not found" });

      const body = req.body || {};
      const title = String(body.title || "").trim();
      if (!title) return res.status(400).json({ success: false, message: "Mission title is required" });

      const safeEmbed = buildEmbedFromAdminInput(body);
      const rawEmbed = String(body.embed_code || "").trim();
      const embedCode = safeEmbed ?? (rawEmbed ? sanitizeEmbedCode(rawEmbed) : null);
      const safeOutcomes = parseLearningOutcomes(body.learning_outcomes);
      const safePrereq = parsePrerequisiteIds(body.prerequisites ?? body.prerequisite_mission_id);
      const safeDomainId = optionalUuid(body.domain_id);
      const safeDifficulty = String(body.difficulty || "beginner").trim() || "beginner";
      const safeXp = Math.max(0, Number.isFinite(Number(body.xp_reward)) ? Number(body.xp_reward) : 100);

      const sessionUser = getReqUser(req)!;
      const bodyStatus = String(body.status || "available").toLowerCase();
      const missionStatus =
        bodyStatus === "locked" ? "locked" : bodyStatus === "draft" ? "draft" : "available";

      const created = await insertRowWithColumnFallback("missions", {
        sector_id: sectorId,
        title,
        description: String(body.description || "").trim(),
        difficulty: safeDifficulty,
        xp_reward: safeXp,
        status: missionStatus,
        image_url: String(body.image_url || "").trim() || "https://picsum.photos/seed/mission/400/300",
        embed_code: embedCode,
        prerequisite_mission_id: safePrereq,
        learning_outcomes_json: safeOutcomes,
        domain_id: safeDomainId,
        created_by: sessionUser.id,
      });
      await SQ.insertLog(`New mission deployed: ${title}`, "system", 0);
      res.json({ success: true, mission: created, id: created.id });
    }),
  );

  router.get("/missions", requireAuth, asyncRoute(async (req, res) => {
    const sessionUser = getReqUser(req)!;
    const isStaff = sessionUser.role === "teacher" || sessionUser.role === "admin";
    res.json(
      await SQ.listMissions({
        includeDraft: isStaff,
        viewerId: sessionUser.id,
        viewerRole: sessionUser.role,
      }),
    );
  }));

  router.get("/activities", requireAuth, asyncRoute(async (req, res) => {
    const q = req.query || {};
    const type = String(q.type || "").trim().toLowerCase();
    const sectorId = optionalUuid(q.sector_id);
    const difficulty = String(q.difficulty || "").trim().toLowerCase();
    const search = String(q.search || "").trim().toLowerCase();
    const defaultOnly = String(q.default_only || "").toLowerCase() === "true";

    const sessionUser = getReqUser(req)!;
    const { data, error } = await db()
      .from("activities")
      .select("*")
      .order("created_at", { ascending: false });
    if (error) return res.status(500).json({ error: error.message });

    let rows = ((data || []) as DbRow[]).filter((r) => {
      const status = String(r.status || "active").toLowerCase();
      const isOwner = String(r.created_by || "") === sessionUser.id;
      if (status === "active") return true;
      return isOwner || sessionUser.role === "admin";
    });
    if (type) rows = rows.filter((r) => String(r.activity_type || "").toLowerCase() === type);
    if (sectorId) rows = rows.filter((r) => String(r.sector_id || "") === sectorId);
    if (difficulty) rows = rows.filter((r) => String(r.difficulty || "").toLowerCase() === difficulty);
    if (defaultOnly) rows = rows.filter((r) => Boolean(r.is_default));
    if (search) rows = rows.filter((r) => `${String(r.title || "")} ${String(r.description || "")}`.toLowerCase().includes(search));

    res.json(rows);
  }));

  router.post(
    "/activities",
    requireAuth,
    requireRole(["teacher", "admin"]),
    asyncRoute(async (req, res) => {
      const sessionUser = getReqUser(req)!;
      const title = String(req.body?.title || "").trim();
      const activityType = String(req.body?.activity_type || "").trim().toLowerCase();
      if (!title) return res.status(400).json({ success: false, error: "title is required" });
      if (!["video", "reading", "tool", "challenge", "quiz", "interactive"].includes(activityType)) {
        return res.status(400).json({ success: false, error: "Invalid activity_type" });
      }
      const row = await insertOne("activities", {
        title,
        description: String(req.body?.description || "").trim() || null,
        activity_type: activityType,
        content: req.body?.content && typeof req.body.content === "object" ? req.body.content : {},
        sector_id: optionalUuid(req.body?.sector_id),
        domain_id: optionalUuid(req.body?.domain_id),
        difficulty: String(req.body?.difficulty || "beginner").trim() || "beginner",
        age_min: Number.isFinite(Number(req.body?.age_min)) ? Number(req.body?.age_min) : 6,
        age_max: Number.isFinite(Number(req.body?.age_max)) ? Number(req.body?.age_max) : 18,
        xp_reward: Number.isFinite(Number(req.body?.xp_reward)) ? Number(req.body?.xp_reward) : 50,
        estimated_minutes: Number.isFinite(Number(req.body?.estimated_minutes)) ? Number(req.body?.estimated_minutes) : 10,
        thumbnail_url: String(req.body?.thumbnail_url || "").trim() || null,
        tags: Array.isArray(req.body?.tags) ? req.body.tags.map((t: unknown) => String(t)).filter(Boolean) : [],
        created_by: sessionUser.id,
        is_default: sessionUser.role === "admin" ? Boolean(req.body?.is_default) : false,
        status: String(req.body?.status || "active").trim() || "active",
      });
      res.json({ success: true, activity: row });
    }),
  );

  router.patch(
    "/activities/:id",
    requireAuth,
    requireRole(["teacher", "admin"]),
    asyncRoute(async (req, res) => {
      const activityId = req.params.id;
      if (!isUuid(activityId)) return res.status(400).json({ success: false, error: "Invalid activity id" });
      const sessionUser = getReqUser(req)!;
      const existing = await selectOne<DbRow>("activities", "*", { id: activityId });
      if (!existing) return res.status(404).json({ success: false, error: "Activity not found" });
      if (sessionUser.role !== "admin" && String(existing.created_by || "") !== sessionUser.id) {
        return res.status(403).json({ success: false, error: "Forbidden" });
      }
      const patch: DbRow = {};
      if (req.body?.title !== undefined) patch.title = String(req.body.title || "").trim();
      if (req.body?.description !== undefined) patch.description = String(req.body.description || "").trim() || null;
      if (req.body?.content !== undefined) patch.content = req.body.content && typeof req.body.content === "object" ? req.body.content : {};
      if (req.body?.sector_id !== undefined) patch.sector_id = optionalUuid(req.body.sector_id);
      if (req.body?.domain_id !== undefined) patch.domain_id = optionalUuid(req.body.domain_id);
      if (req.body?.difficulty !== undefined) patch.difficulty = String(req.body.difficulty || "").trim() || "beginner";
      if (req.body?.age_min !== undefined) patch.age_min = Number.isFinite(Number(req.body.age_min)) ? Number(req.body.age_min) : 6;
      if (req.body?.age_max !== undefined) patch.age_max = Number.isFinite(Number(req.body.age_max)) ? Number(req.body.age_max) : 18;
      if (req.body?.xp_reward !== undefined) patch.xp_reward = Number.isFinite(Number(req.body.xp_reward)) ? Number(req.body.xp_reward) : 50;
      if (req.body?.estimated_minutes !== undefined) patch.estimated_minutes = Number.isFinite(Number(req.body.estimated_minutes)) ? Number(req.body.estimated_minutes) : 10;
      if (req.body?.thumbnail_url !== undefined) patch.thumbnail_url = String(req.body.thumbnail_url || "").trim() || null;
      if (req.body?.tags !== undefined) patch.tags = Array.isArray(req.body.tags) ? req.body.tags.map((t: unknown) => String(t)).filter(Boolean) : [];
      if (req.body?.status !== undefined) patch.status = String(req.body.status || "active").trim() || "active";
      if (sessionUser.role === "admin" && req.body?.is_default !== undefined) patch.is_default = Boolean(req.body.is_default);
      await updateRow("activities", { id: activityId }, patch);
      const updated = await selectOne("activities", "*", { id: activityId });
      res.json({ success: true, activity: updated });
    }),
  );

  router.post(
    "/missions",
    requireAuth,
    requireRole(["teacher", "admin"]),
    V.validateBody(V.createMissionSchema),
    asyncRoute(async (req, res) => {
      try {
        const sessionUser = getReqUser(req)!;
        const {
          sector_id,
          title,
          description,
          difficulty,
          grade_level,
          xp_reward,
          image_url,
          embed_code,
          prerequisite_mission_id,
          learning_outcomes,
          domains,
          domain_id,
        } = req.body;
        const rawEmbed = typeof embed_code === "string" && embed_code.trim() ? embed_code.trim() : null;
        const safeEmbed = rawEmbed ? sanitizeEmbedCode(rawEmbed) : buildEmbedFromAdminInput(req.body || {});

        const safeOutcomes = parseLearningOutcomes(learning_outcomes);
        const safeDomains = Array.isArray(domains)
          ? JSON.stringify(domains.map((x) => String(x).trim()).filter(Boolean))
          : null;
        const safePrereq = parsePrerequisiteIds(prerequisite_mission_id) ?? optionalUuid(prerequisite_mission_id);
        const safeDomainId = optionalUuid(domain_id);
        const safeSectorId = optionalUuid(sector_id);
        if (!safeSectorId) {
          return res.status(400).json({ success: false, message: "sector_id is required — pick a sector for this mission." });
        }
        const sectorRow = await selectOne("sectors", "id", { id: safeSectorId });
        if (!sectorRow) {
          return res.status(400).json({ success: false, message: "Invalid sector_id" });
        }
        const bodyStatus = String(req.body?.status || "available").toLowerCase();
        const missionStatus =
          bodyStatus === "locked" ? "locked" : bodyStatus === "draft" ? "draft" : "available";
        const created = await insertRowWithColumnFallback("missions", {
          sector_id: safeSectorId,
          title,
          description,
          difficulty,
          grade_level: String(grade_level || "").trim() || null,
          xp_reward: xp_reward ?? 500,
          status: missionStatus,
          image_url: image_url || "https://picsum.photos/seed/mission/400/300",
          embed_code: safeEmbed,
          prerequisite_mission_id: safePrereq,
          learning_outcomes_json: safeOutcomes,
          domains_json: safeDomains,
          domain_id: safeDomainId,
          created_by: sessionUser.id,
        });
        await SQ.insertLog(`New mission deployed: ${title}`, "system", 0);
        res.json({ success: true, id: created.id, mission: created });
      } catch (err) {
        console.error("[stemverse] POST /api/missions:", err);
        res.status(500).json({
          success: false,
          message: isProduction
            ? "Could not create mission."
            : err instanceof Error
              ? err.message
              : "Could not create mission.",
        });
      }
    }),
  );

  router.patch(
    "/missions/:id",
    requireAuth,
    requireRole(["teacher", "admin"]),
    V.validateBody(V.patchMissionSchema),
    asyncRoute(async (req, res) => {
      const missionId = req.params.id;
      if (!isUuid(missionId)) return res.status(400).json({ success: false, message: "Invalid mission id" });
      const existing = await selectOne("missions", "*", { id: missionId });
      if (!existing) return res.status(404).json({ success: false, message: "Mission not found" });

      const body = req.body || {};
      const updates: DbRow = {};
      if (body.title != null) {
        const t = String(body.title).trim();
        if (!t) return res.status(400).json({ success: false, message: "Mission title cannot be empty" });
        updates.title = t;
      }
      if (body.description != null) updates.description = String(body.description).trim();
      if (body.difficulty != null) updates.difficulty = String(body.difficulty).trim() || "beginner";
      if (body.xp_reward != null) updates.xp_reward = Math.max(0, Number(body.xp_reward) || 0);
      if (body.image_url != null) updates.image_url = String(body.image_url).trim() || null;
      if (body.domain_id !== undefined) updates.domain_id = body.domain_id ? optionalUuid(body.domain_id) : null;
      if (body.learning_outcomes != null) updates.learning_outcomes_json = parseLearningOutcomes(body.learning_outcomes);
      if (body.prerequisites !== undefined || body.prerequisite_mission_id !== undefined) {
        updates.prerequisite_mission_id = parsePrerequisiteIds(body.prerequisites ?? body.prerequisite_mission_id);
      }
      if (
        body.embed_code != null ||
        body.embed_type != null ||
        body.embed_config != null ||
        body.custom_embed_url != null
      ) {
        const built = buildEmbedFromAdminInput(body);
        const raw = String(body.embed_code || "").trim();
        updates.embed_code = built ?? (raw ? sanitizeEmbedCode(raw) : null);
      }
      if (body.status != null) {
        const st = String(body.status).toLowerCase();
        if (MISSION_STATUSES.has(st) && st !== "archived") updates.status = st;
      }

      if (!Object.keys(updates).length) {
        return res.status(400).json({ success: false, message: "No valid fields" });
      }
      await updateRowWithColumnFallback("missions", { id: missionId }, updates);
      const mission = await selectOne("missions", "*", { id: missionId });
      res.json({ success: true, mission });
    }),
  );

  router.delete("/missions/:id", requireAuth, requireRole(["teacher", "admin"]), asyncRoute(async (req, res) => {
    const missionId = req.params.id;
    if (!isUuid(missionId)) return res.status(400).json({ success: false, message: "Invalid mission id" });
    const existing = await selectOne("missions", "id", { id: missionId });
    if (!existing) return res.status(404).json({ success: false, message: "Mission not found" });
    await updateRow("missions", { id: missionId }, { status: "archived" });
    res.json({ success: true });
  }));

  return router;
}

/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import express from "express";
import { db, selectOne, insertOne, updateRow, isUuid, optionalUuid, type DbRow } from "../../lib/db";
import { asyncRoute, getReqUser } from "./_middleware.ts";

export type ToolActivityRouterDeps = {
    requireAuth: express.RequestHandler;
};

export type ToolActivityRouters = {
  apiRouter: express.Router;
  projectsRouter: express.Router;
};

export default function createToolActivityRouter(deps: ToolActivityRouterDeps): ToolActivityRouters {
  const { requireAuth } = deps;
  const apiRouter = express.Router();
  const projectsRouter = express.Router();

  projectsRouter.post("/projects/save", requireAuth, async (req, res) => {
    const sessionUser = getReqUser(req);
    if (!sessionUser) return res.status(401).json({ success: false, message: "Unauthorized" });
    const projectId = optionalUuid(req.body?.id);
    const missionId = optionalUuid(req.body?.mission_id);
    const title = String(req.body?.title || "Arduino Project").trim();
    const workspaceJson = String(req.body?.workspace_json || "").trim();
    const generatedCode = String(req.body?.generated_code || "");
    if (!workspaceJson) {
      return res.status(400).json({ success: false, message: "workspace_json is required" });
    }

    if (projectId) {
      const existing = await selectOne<{ id: string; student_id: string }>("coding_projects", "id, student_id", {
        id: projectId,
      });
      if (!existing) return res.status(404).json({ success: false, message: "Project not found" });
      if (existing.student_id !== sessionUser.id && sessionUser.role !== "teacher" && sessionUser.role !== "admin") {
        return res.status(403).json({ success: false, message: "Forbidden" });
      }
      await updateRow("coding_projects", { id: projectId }, {
        mission_id: missionId,
        title: title || null,
        workspace_json: workspaceJson,
        generated_code: generatedCode,
      });
      return res.json({ success: true, id: projectId });
    }

    const inserted = await insertOne<{ id: string }>("coding_projects", {
      student_id: sessionUser.id,
      mission_id: missionId,
      title: title || null,
      workspace_json: workspaceJson,
      generated_code: generatedCode,
    });
    return res.json({ success: true, id: inserted.id });
  });

  apiRouter.get("/tool-activity/progress", requireAuth, async (req, res) => {
    const sessionUser = getReqUser(req);
    if (!sessionUser) return res.status(401).json({ success: false, message: "Unauthorized" });
    const missionId = req.query.mission_id;
    if (!isUuid(missionId)) {
      return res.status(400).json({ success: false, message: "mission_id is required" });
    }
    const { data: rows } = await db()
      .from("coding_projects")
      .select("id, workspace_json, updated_at")
      .eq("student_id", sessionUser.id)
      .eq("mission_id", missionId)
      .order("updated_at", { ascending: false })
      .limit(1);
    const row = rows?.[0] as { id: string; workspace_json: string; updated_at: string } | undefined;
    if (!row) return res.json({ success: true, save: null });
    return res.json({
      success: true,
      save: { id: row.id, workspace_json: row.workspace_json, updated_at: row.updated_at },
    });
  });

  apiRouter.post("/tool-activity/save", requireAuth, async (req, res) => {
    const sessionUser = getReqUser(req);
    if (!sessionUser) return res.status(401).json({ success: false, message: "Unauthorized" });
    const missionId = optionalUuid(req.body?.mission_id);
    const title = String(req.body?.title || "Tool activity").trim();
    const workspaceJson = String(req.body?.workspace_json || "").trim();
    const projectId = optionalUuid(req.body?.id);
    if (!workspaceJson) {
      return res.status(400).json({ success: false, message: "workspace_json is required" });
    }

    if (projectId) {
      const existing = await selectOne<{ id: string; student_id: string }>("coding_projects", "id, student_id", {
        id: projectId,
      });
      if (!existing) return res.status(404).json({ success: false, message: "Save not found" });
      if (existing.student_id !== sessionUser.id && sessionUser.role !== "teacher" && sessionUser.role !== "admin") {
        return res.status(403).json({ success: false, message: "Forbidden" });
      }
      await updateRow("coding_projects", { id: projectId }, {
        mission_id: missionId,
        title,
        workspace_json: workspaceJson,
      });
      return res.json({ success: true, id: projectId });
    }

    const inserted = await insertOne<{ id: string }>("coding_projects", {
      student_id: sessionUser.id,
      mission_id: missionId,
      title,
      workspace_json: workspaceJson,
      generated_code: "tool_activity",
    });
    return res.json({ success: true, id: inserted.id });
  });

  projectsRouter.get("/projects/:id", requireAuth, async (req, res) => {
    const sessionUser = getReqUser(req);
    if (!sessionUser) return res.status(401).json({ success: false, message: "Unauthorized" });
    const id = req.params.id;
    if (!isUuid(id)) return res.status(400).json({ success: false, message: "Invalid project id" });
    const project = await selectOne<DbRow>(
      "coding_projects",
      "id, student_id, mission_id, title, workspace_json, generated_code, created_at, updated_at",
      { id },
    );
    if (!project) return res.status(404).json({ success: false, message: "Project not found" });
    if (project.student_id !== sessionUser.id && sessionUser.role !== "teacher" && sessionUser.role !== "admin") {
      return res.status(403).json({ success: false, message: "Forbidden" });
    }
    return res.json({ success: true, project });
  });

  return { apiRouter, projectsRouter };
}

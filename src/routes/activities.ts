/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import express from "express";
import { selectOne, isUuid, type DbRow } from "../../lib/db";
import {
  defaultBuilderState,
  emptyStep,
  encodeToolActivityEmbed,
  type ToolType,
} from "../../src/lib/toolActivity.ts";
import { asyncRoute } from "./_middleware.ts";

function defaultEmbedForToolType(toolType: string): string {
  const t = String(toolType || "").toLowerCase();
  if (t === "circuit_builder") {
    return encodeToolActivityEmbed({ ...defaultBuilderState(), tool: "circuit_builder" });
  }
  if (t === "block_coding" || t === "arduino_ide" || t === "arduino") {
    return "stemverse://arduino-uno-blockly";
  }
  if (t === "3d_viewer") {
    const cfg = defaultBuilderState();
    cfg.tool = "3d_viewer";
    cfg.steps = [{ ...emptyStep(2, "3d_viewer" as ToolType), id: 2 }];
    return encodeToolActivityEmbed(cfg);
  }
  return "";
}

export type ActivitiesRouterDeps = {
  requireAuth: express.RequestHandler;
};

function asContent(raw: unknown): Record<string, unknown> {
  if (raw && typeof raw === "object" && !Array.isArray(raw)) return raw as Record<string, unknown>;
  return {};
}

const UNAVAILABLE_MSG =
  "This activity needs additional setup. Contact your teacher.";

async function resolveMissionIdByEmbed(embedCode: string): Promise<string | undefined> {
  const embed = embedCode.trim();
  if (!embed) return undefined;
  const mission = await selectOne<DbRow>("missions", "id", { embed_code: embed });
  const id = mission?.id != null ? String(mission.id) : "";
  return isUuid(id) ? id : undefined;
}

async function buildToolOrInteractivePlay(activity: DbRow): Promise<Record<string, unknown>> {
  const content = asContent(activity.content);
  const title = String(activity.title || "Activity");
  const tool_type = content.tool_type != null ? String(content.tool_type) : "";
  const missionIdRaw = content.mission_id != null ? String(content.mission_id) : "";
  const mission_id = isUuid(missionIdRaw) ? missionIdRaw : undefined;

  let embed_code = String(content.embed_code || "").trim();

  if (embed_code) {
    // use content embed
  } else if (mission_id) {
    const mission = await selectOne<DbRow>("missions", "embed_code", { id: mission_id });
    embed_code = String(mission?.embed_code || "").trim();
    if (!embed_code) {
      return { kind: "unavailable", message: UNAVAILABLE_MSG, title };
    }
  } else if (tool_type) {
    embed_code = defaultEmbedForToolType(tool_type);
    if (!embed_code) {
      return { kind: "unavailable", message: UNAVAILABLE_MSG, title };
    }
  } else {
    return { kind: "unavailable", message: UNAVAILABLE_MSG, title };
  }

  let resolvedMissionId = mission_id;
  if (!resolvedMissionId) {
    resolvedMissionId = await resolveMissionIdByEmbed(embed_code);
  }

  return {
    kind: "embed",
    embed_code,
    tool_type,
    title,
    ...(resolvedMissionId ? { mission_id: resolvedMissionId } : {}),
  };
}

function buildPlayDescriptor(activity: DbRow): Record<string, unknown> {
  const activityType = String(activity.activity_type || "").toLowerCase();
  const content = asContent(activity.content);
  const title = String(activity.title || "Activity");

  switch (activityType) {
    case "video":
      return {
        kind: "video",
        url: String(content.url || ""),
        title,
        duration: content.duration ?? null,
        transcript: content.transcript != null ? String(content.transcript) : "",
      };
    case "reading":
      return {
        kind: "reading",
        body: String(content.body || ""),
        estimated_minutes: Number.isFinite(Number(content.estimated_minutes))
          ? Number(content.estimated_minutes)
          : Number.isFinite(Number(activity.estimated_minutes))
            ? Number(activity.estimated_minutes)
            : undefined,
        title,
      };
    case "challenge":
      return {
        kind: "challenge",
        challenge_id: content.challenge_id != null ? String(content.challenge_id) : "",
        title,
      };
    case "quiz":
      return {
        kind: "quiz",
        quiz_id: content.quiz_id != null ? String(content.quiz_id) : "",
        title,
      };
    case "game": {
      const embedUrl = String(content.embed_url || "");
      const config = content.config != null ? JSON.stringify(content.config) : "";
      const embed_code = embedUrl
        ? `${embedUrl}${embedUrl.includes("?") ? "&" : "?"}config=${encodeURIComponent(config)}`
        : "";
      return { kind: "embed", embed_code, tool_type: "", title };
    }
    case "hardware":
      return {
        kind: "hardware",
        hardware_config: content,
        title,
      };
    default:
      return { kind: "unknown", title };
  }
}

export default function createActivitiesRouter(deps: ActivitiesRouterDeps): express.Router {
  const { requireAuth } = deps;
  const router = express.Router();

  router.get(
    "/activities/:id/play",
    requireAuth,
    asyncRoute(async (req, res) => {
      const activityId = req.params.id;
      if (!isUuid(activityId)) return res.status(400).json({ error: "Invalid activity id" });

      const activity = await selectOne<DbRow>("activities", "*", { id: activityId });
      if (!activity) return res.status(404).json({ error: "Activity not found" });

      const status = String(activity.status || "active").toLowerCase();
      if (status !== "active") {
        return res.status(404).json({ error: "Activity not found" });
      }

      const activityType = String(activity.activity_type || "").toLowerCase();
      if (activityType === "interactive" || activityType === "tool") {
        res.json(await buildToolOrInteractivePlay(activity));
        return;
      }

      res.json(buildPlayDescriptor(activity));
    }),
  );

  return router;
}

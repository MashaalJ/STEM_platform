/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import express from "express";
import { asyncRoute, getReqUser, V } from "./_middleware.ts";
import { stembotFallbackReply, STEMBOT_SYSTEM_PROMPT } from "../lib/stembot.ts";

export type AiQuotaEndpoint = "generate_quiz" | "recommendations" | "stembot_chat";

export type ChatRouterDeps = {
  requireAuth: express.RequestHandler;
  rateLimitAi: express.RequestHandler;
  callAiChat: (
    messages: Array<{ role: "system" | "user" | "assistant"; content: string }>,
  ) => Promise<string | null>;
  checkAndLogAiQuota: (
    endpoint: AiQuotaEndpoint,
    userId: string,
  ) => Promise<{ ok: boolean; message: string }>;
  aiConfigured: boolean;
};

export default function createChatRouter(deps: ChatRouterDeps): express.Router {
  const { requireAuth, rateLimitAi, callAiChat, checkAndLogAiQuota, aiConfigured } = deps;
  const router = express.Router();

  router.post(
    "/chat/stembot",
    requireAuth,
    rateLimitAi,
    V.validateBody(V.stembotChatSchema),
    asyncRoute(async (req, res) => {
      const sessionUser = getReqUser(req)!;
      const { message, history = [] } = req.body as {
        message: string;
        history?: Array<{ role: "user" | "assistant"; content: string }>;
      };

      const trimmed = message.trim();
      if (!trimmed) {
        return res.status(400).json({ success: false, error: "message is required" });
      }

      if (!aiConfigured) {
        return res.json({
          success: true,
          reply: stembotFallbackReply(trimmed),
          source: "fallback",
          reason: "ai_not_configured",
        });
      }

      const quota = await checkAndLogAiQuota("stembot_chat", sessionUser.id);
      if (!quota.ok) {
        return res.json({
          success: true,
          reply: stembotFallbackReply(trimmed),
          source: "fallback",
          reason: "quota",
          message: quota.message,
        });
      }

      const recentHistory = history
        .slice(-16)
        .filter((h) => h && (h.role === "user" || h.role === "assistant") && String(h.content || "").trim())
        .map((h) => ({
          role: h.role as "user" | "assistant",
          content: String(h.content).trim().slice(0, 4000),
        }));

      const messages: Array<{ role: "system" | "user" | "assistant"; content: string }> = [
        { role: "system", content: STEMBOT_SYSTEM_PROMPT },
        ...recentHistory,
        { role: "user", content: trimmed.slice(0, 2000) },
      ];

      const aiReply = await callAiChat(messages);
      if (aiReply) {
        return res.json({ success: true, reply: aiReply, source: "ai" });
      }

      res.json({
        success: true,
        reply: stembotFallbackReply(trimmed),
        source: "fallback",
        reason: "ai_error",
      });
    }),
  );

  return router;
}

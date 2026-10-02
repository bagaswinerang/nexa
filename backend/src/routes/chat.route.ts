/**
 * Chat route — Gemini AI with function calling.
 */

import { Hono } from "hono";
import { chat } from "../services/gemini.js";
import { answerTransactionRequest } from "../services/chat-data-fallback.js";
import type { ChatRequest } from "../types/index.js";

const chatRoute = new Hono();

// POST /chat
chatRoute.post("/", async (c) => {
  const requestId = c.req.header("x-request-id") || crypto.randomUUID();
  c.header("x-request-id", requestId);
  try {
    const body = await c.req.json<ChatRequest>();

    if (!body.message || body.message.trim().length === 0) {
      return c.json({ error: "Message is required" }, 400);
    }

    const deterministicAnswer = await answerTransactionRequest(
      body.message,
      body.user_address,
    );
    if (deterministicAnswer) {
      return c.json({
        reply: deterministicAnswer.reply,
        model_used: "nexa-db",
        tool_calls: deterministicAnswer.toolCalls,
      });
    }

    const result = await chat(
      body.message,
      body.history || [],
      body.user_address,
      body.is_thinking,
      body.model
    );

    return c.json({
      reply: result.reply,
      thought: result.thought,
      model_used: result.model_used,
      tool_calls: result.toolCalls,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Chat failed";
    console.error(`[Chat] request=${requestId} error:`, error);
    if (message === "DATABASE_UNAVAILABLE") {
      return c.json(
        {
          error: "Riwayat transaksi sedang tidak tersedia. Silakan coba lagi.",
          code: "DATABASE_UNAVAILABLE",
          request_id: requestId,
        },
        503,
      );
    }
    return c.json(
      {
        error: "Nexa AI sedang tidak tersedia. Silakan coba lagi beberapa saat.",
        code: "AI_UNAVAILABLE",
        request_id: requestId,
      },
      503,
    );
  }
});

export default chatRoute;

/**
 * Chat route — Gemini AI with function calling.
 */

import { Hono } from "hono";
import { chat } from "../services/gemini.js";
import type { ChatRequest } from "../types/index.js";

const chatRoute = new Hono();

// POST /chat
chatRoute.post("/", async (c) => {
  try {
    const body = await c.req.json<ChatRequest>();

    if (!body.message || body.message.trim().length === 0) {
      return c.json({ error: "Message is required" }, 400);
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
    console.error("Chat error:", error);
    const message = error instanceof Error ? error.message : "Chat failed";
    return c.json({ error: message }, 500);
  }
});

export default chatRoute;

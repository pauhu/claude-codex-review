#!/usr/bin/env node
/**
 * Responses API → Chat Completions adapter v4
 *
 * Solves: claude-max-api-proxy ignores OpenAI `tools` param.
 * Fix:    Inject tool schemas into the prompt, parse structured
 *         tool calls from Claude's text, emit as Responses API
 *         function_call events so Codex can execute them in its sandbox.
 *
 * Chain:  Codex ──► :4000 (this) ──► :3456 (claude-max-api-proxy) ──► Claude CLI
 */

const http = require("http");

const UPSTREAM = "http://localhost:3456";
const PORT = 4000;

// ── Tool-call prompt injection ──────────────────────────────────────

function buildToolPrompt(tools) {
  if (!tools || tools.length === 0) return "";
  const schemas = tools
    .filter((t) => t.type === "function")
    .map(
      (t) =>
        `- ${t.name}(${JSON.stringify(t.parameters || {})}): ${t.description || ""}`
    )
    .join("\n");
  return [
    "",
    "You have access to these tools:",
    schemas,
    "",
    "IMPORTANT: To use a tool, you MUST respond with ONLY a JSON object in this exact format, nothing else before or after:",
    '{"tool_calls": [{"name": "TOOL_NAME", "arguments": {...}}]}',
    "",
    "If you need to run a shell command, use exec_shell with a command array.",
    'Example: {"tool_calls": [{"name": "exec_shell", "arguments": {"command": ["npx", "tsc", "--noEmit"]}}]}',
    "",
    "If you do NOT need to call a tool (e.g. you are providing a final answer), respond with plain text.",
    "Only call ONE tool at a time. Wait for its result before calling the next.",
  ].join("\n");
}

// ── Parse tool calls from Claude's text ─────────────────────────────

function parseToolCalls(text) {
  // Try to find JSON with tool_calls
  const trimmed = text.trim();

  // Direct JSON parse
  try {
    const parsed = JSON.parse(trimmed);
    if (parsed.tool_calls && Array.isArray(parsed.tool_calls)) {
      return parsed.tool_calls;
    }
  } catch {}

  // Try to extract JSON from markdown code blocks
  const codeBlock = trimmed.match(/```(?:json)?\s*\n?([\s\S]*?)\n?```/);
  if (codeBlock) {
    try {
      const parsed = JSON.parse(codeBlock[1].trim());
      if (parsed.tool_calls && Array.isArray(parsed.tool_calls)) {
        return parsed.tool_calls;
      }
    } catch {}
  }

  // Try to find any JSON object with tool_calls in the text
  const jsonMatch = trimmed.match(/\{[\s\S]*"tool_calls"[\s\S]*\}/);
  if (jsonMatch) {
    try {
      const parsed = JSON.parse(jsonMatch[0]);
      if (parsed.tool_calls && Array.isArray(parsed.tool_calls)) {
        return parsed.tool_calls;
      }
    } catch {}
  }

  return null; // No tool calls found → plain text response
}

// ── Translate Responses API input → Chat Completions messages ───────

function translateInput(input, instructions, tools) {
  const messages = [];

  // System message with tool injection
  let systemContent = instructions || "";
  const toolPrompt = buildToolPrompt(tools);
  if (toolPrompt) {
    systemContent = systemContent
      ? systemContent + "\n" + toolPrompt
      : toolPrompt;
  }
  if (systemContent) {
    messages.push({ role: "system", content: systemContent });
  }

  if (typeof input === "string") {
    messages.push({ role: "user", content: input });
    return messages;
  }

  if (!Array.isArray(input)) {
    messages.push({ role: "user", content: JSON.stringify(input) });
    return messages;
  }

  for (const item of input) {
    // Regular message
    if (item.type === "message" || (item.role && !item.type)) {
      const role = item.role || "user";
      let content;
      if (typeof item.content === "string") {
        content = item.content;
      } else if (Array.isArray(item.content)) {
        content = item.content
          .filter(
            (c) =>
              c.type === "input_text" ||
              c.type === "text" ||
              c.type === "output_text"
          )
          .map((c) => c.text)
          .join("\n");
      } else {
        content = JSON.stringify(item.content);
      }
      if (content) {
        messages.push({ role, content });
      }
    }

    // Function call (assistant previously called a tool)
    // → translate to assistant message showing what was called
    if (item.type === "function_call") {
      const callDesc = JSON.stringify({
        tool_calls: [{ name: item.name, arguments: safeParseArgs(item.arguments) }],
      });
      messages.push({ role: "assistant", content: callDesc });
    }

    // Function call output (tool result)
    // → translate to user message with the result
    if (item.type === "function_call_output") {
      messages.push({
        role: "user",
        content: `[Tool result for call_id=${item.call_id}]:\n${typeof item.output === "string" ? item.output : JSON.stringify(item.output)}`,
      });
    }
  }

  if (
    messages.length === 0 ||
    (messages.length === 1 && messages[0].role === "system")
  ) {
    messages.push({ role: "user", content: "Hello" });
  }

  return messages;
}

function safeParseArgs(args) {
  if (typeof args === "object") return args;
  try {
    return JSON.parse(args);
  } catch {
    return { raw: args };
  }
}

// ── Build Responses API response ────────────────────────────────────

function buildUsage(chatRes) {
  return {
    input_tokens:
      chatRes.usage?.prompt_tokens || chatRes.usage?.input_tokens || 0,
    output_tokens:
      chatRes.usage?.completion_tokens || chatRes.usage?.output_tokens || 0,
    total_tokens: chatRes.usage?.total_tokens || 0,
  };
}

let callCounter = 0;

function buildResponseWithToolCalls(chatRes, toolCalls, reqModel) {
  const respId = chatRes.id || `resp_${Date.now().toString(36)}`;
  const output = toolCalls.map((tc) => {
    const callId = `call_${(++callCounter).toString(36).padStart(6, "0")}`;
    return {
      type: "function_call",
      id: callId,
      call_id: callId,
      name: tc.name,
      arguments:
        typeof tc.arguments === "string"
          ? tc.arguments
          : JSON.stringify(tc.arguments || {}),
      status: "completed",
    };
  });

  return {
    id: respId,
    object: "response",
    created_at: chatRes.created || Math.floor(Date.now() / 1000),
    status: "completed",
    model: chatRes.model || reqModel,
    output,
    usage: buildUsage(chatRes),
  };
}

function buildResponseWithText(chatRes, text, reqModel) {
  const respId = chatRes.id || `resp_${Date.now().toString(36)}`;
  const msgId = `msg_${Date.now().toString(36)}`;

  return {
    id: respId,
    object: "response",
    created_at: chatRes.created || Math.floor(Date.now() / 1000),
    status: "completed",
    model: chatRes.model || reqModel,
    output: [
      {
        type: "message",
        id: msgId,
        status: "completed",
        role: "assistant",
        content: [{ type: "output_text", text }],
      },
    ],
    usage: buildUsage(chatRes),
  };
}

// ── SSE streaming ───────────────────────────────────────────────────

function streamResponse(res, responsesRes) {
  res.writeHead(200, {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache",
    Connection: "keep-alive",
  });

  const send = (evt) => res.write(`data: ${JSON.stringify(evt)}\n\n`);
  const inProgress = { ...responsesRes, status: "in_progress" };

  send({
    type: "response.created",
    response: { ...inProgress, output: [] },
  });
  send({ type: "response.in_progress", response: inProgress });

  for (let i = 0; i < responsesRes.output.length; i++) {
    const item = responsesRes.output[i];
    send({ type: "response.output_item.added", output_index: i, item });

    if (item.type === "message" && item.content) {
      for (let j = 0; j < item.content.length; j++) {
        const part = item.content[j];
        send({
          type: "response.content_part.added",
          output_index: i,
          content_index: j,
          part: { type: part.type, text: "" },
        });
        send({
          type: "response.output_text.delta",
          output_index: i,
          content_index: j,
          delta: part.text,
        });
        send({
          type: "response.output_text.done",
          output_index: i,
          content_index: j,
          text: part.text,
        });
        send({
          type: "response.content_part.done",
          output_index: i,
          content_index: j,
          part,
        });
      }
    }

    if (item.type === "function_call") {
      send({
        type: "response.function_call_arguments.delta",
        output_index: i,
        call_id: item.call_id,
        delta: item.arguments,
      });
      send({
        type: "response.function_call_arguments.done",
        output_index: i,
        call_id: item.call_id,
        arguments: item.arguments,
      });
    }

    send({ type: "response.output_item.done", output_index: i, item });
  }

  send({ type: "response.completed", response: responsesRes });
  res.end();
}

// ── HTTP Server ─────────────────────────────────────────────────────

const server = http.createServer(async (req, res) => {
  const urlPath = req.url.split("?")[0];
  console.log(`[${new Date().toISOString()}] ${req.method} ${urlPath}`);

  if (req.method === "OPTIONS") {
    res.writeHead(204, {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization",
    });
    return res.end();
  }

  if (urlPath === "/health") {
    res.writeHead(200, { "Content-Type": "application/json" });
    return res.end(
      JSON.stringify({ status: "ok", adapter: "responses-to-chat", version: 4 })
    );
  }

  if (urlPath === "/v1/models") {
    try {
      const upstream = await fetch(`${UPSTREAM}/v1/models`);
      const data = await upstream.text();
      res.writeHead(upstream.status, { "Content-Type": "application/json" });
      return res.end(data);
    } catch (e) {
      res.writeHead(502, { "Content-Type": "application/json" });
      return res.end(JSON.stringify({ error: "upstream unreachable" }));
    }
  }

  if (urlPath === "/v1/responses" && req.method === "POST") {
    let body = "";
    req.on("data", (chunk) => (body += chunk));
    req.on("end", async () => {
      try {
        const rReq = JSON.parse(body);
        const wantsStream = rReq.stream === true;
        const hasTools = rReq.tools && rReq.tools.length > 0;

        console.log(
          "[v4] model:", rReq.model,
          "tools:", (rReq.tools || []).length,
          "input:", Array.isArray(rReq.input) ? rReq.input.length + " items" : "string",
          "stream:", wantsStream
        );

        // Translate input – inject tool schemas into prompt
        const messages = translateInput(
          rReq.input,
          rReq.instructions,
          hasTools ? rReq.tools : null
        );

        // Do NOT pass tools to upstream – they get ignored anyway
        // Instead we injected them into the system prompt
        const chatReq = {
          model: rReq.model || "claude-sonnet-4-5-20250929",
          messages,
          max_tokens: rReq.max_output_tokens || 16384,
          temperature: rReq.temperature ?? 1,
          stream: false,
        };

        console.log("[v4] → upstream:", messages.length, "msgs");

        const upstream = await fetch(`${UPSTREAM}/v1/chat/completions`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: req.headers.authorization || "",
          },
          body: JSON.stringify(chatReq),
        });

        const chatRes = await upstream.json();
        const text = chatRes.choices?.[0]?.message?.content || "";

        console.log("[v4] ← upstream:", upstream.status, "len:", text.length);

        if (chatRes.error) {
          console.error("[v4] upstream error:", JSON.stringify(chatRes.error));
        }

        // Try to parse tool calls from Claude's response
        let responsesRes;
        if (hasTools) {
          const toolCalls = parseToolCalls(text);
          if (toolCalls) {
            console.log("[v4] parsed", toolCalls.length, "tool call(s):", toolCalls.map((t) => t.name).join(", "));
            responsesRes = buildResponseWithToolCalls(
              chatRes,
              toolCalls,
              chatReq.model
            );
          } else {
            console.log("[v4] no tool calls, plain text response");
            responsesRes = buildResponseWithText(chatRes, text, chatReq.model);
          }
        } else {
          responsesRes = buildResponseWithText(chatRes, text, chatReq.model);
        }

        if (wantsStream) {
          streamResponse(res, responsesRes);
          console.log("[v4] streamed OK");
        } else {
          res.writeHead(200, { "Content-Type": "application/json" });
          res.end(JSON.stringify(responsesRes));
          console.log("[v4] JSON OK");
        }
      } catch (e) {
        console.error("[v4] error:", e.message, e.stack?.split("\n")[1]);
        res.writeHead(500, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: e.message }));
      }
    });
    return;
  }

  res.writeHead(404, { "Content-Type": "application/json" });
  res.end(JSON.stringify({ error: "not found", path: req.url }));
});

server.listen(PORT, () => {
  console.log(`Responses adapter v4 listening on http://localhost:${PORT}`);
  console.log(`Upstream: ${UPSTREAM}`);
  console.log(
    "Features: prompt-injected tool schemas, structured tool-call parsing, SSE streaming"
  );
});

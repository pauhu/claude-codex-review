#!/usr/bin/env node
// Responses API → Chat Completions adapter for Codex → Claude Max
// Translates POST /v1/responses into POST /v1/chat/completions
// Upstream: claude-max-api-proxy on port 3456

const http = require("http");

const UPSTREAM = "http://localhost:3456";
const PORT = 4000;

const server = http.createServer(async (req, res) => {
  const urlPath = req.url.split("?")[0]; // strip query params
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);

  // CORS preflight
  if (req.method === "OPTIONS") {
    res.writeHead(204, {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization",
    });
    return res.end();
  }

  // Health check
  if (urlPath === "/health") {
    res.writeHead(200, { "Content-Type": "application/json" });
    return res.end(JSON.stringify({ status: "ok", adapter: "responses-to-chat" }));
  }

  // Models passthrough (match with or without query params)
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

  // Main: translate /v1/responses → /v1/chat/completions
  if (urlPath === "/v1/responses" && req.method === "POST") {
    let body = "";
    req.on("data", (chunk) => (body += chunk));
    req.on("end", async () => {
      try {
        const responsesReq = JSON.parse(body);
        const wantsStream = responsesReq.stream === true;

        console.log("[adapter] model:", responsesReq.model, "stream:", wantsStream);

        // Build chat completions request
        const messages = [];

        // Handle instructions as system message
        if (responsesReq.instructions) {
          messages.push({ role: "system", content: responsesReq.instructions });
        }

        // Handle input – can be string or array of message objects
        const input = responsesReq.input;
        if (typeof input === "string") {
          messages.push({ role: "user", content: input });
        } else if (Array.isArray(input)) {
          for (const msg of input) {
            if (msg.type === "message" || msg.role) {
              const role = msg.role || "user";
              let content;
              if (typeof msg.content === "string") {
                content = msg.content;
              } else if (Array.isArray(msg.content)) {
                content = msg.content
                  .filter((c) => c.type === "input_text" || c.type === "text" || c.type === "output_text")
                  .map((c) => c.text)
                  .join("\n");
              } else {
                content = JSON.stringify(msg.content);
              }
              if (content) {
                messages.push({ role, content });
              }
            }
          }
        }

        if (messages.length === 0) {
          messages.push({ role: "user", content: "Hello" });
        }

        console.log("[adapter] messages:", messages.length);

        const chatReq = {
          model: responsesReq.model || "claude-sonnet-4-5-20250929",
          messages,
          max_tokens: responsesReq.max_output_tokens || 16384,
          temperature: responsesReq.temperature ?? 1,
          stream: false,
        };

        const upstream = await fetch(`${UPSTREAM}/v1/chat/completions`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: req.headers.authorization || "",
          },
          body: JSON.stringify(chatReq),
        });

        const chatRes = await upstream.json();
        console.log("[adapter] upstream:", upstream.status);

        const outputText =
          chatRes.choices?.[0]?.message?.content || "No response";

        // Build usage in Responses API format (input_tokens, output_tokens required)
        const usage = {
          input_tokens: chatRes.usage?.prompt_tokens || chatRes.usage?.input_tokens || 0,
          output_tokens: chatRes.usage?.completion_tokens || chatRes.usage?.output_tokens || 0,
          total_tokens: chatRes.usage?.total_tokens || 0,
        };

        const msgId = `msg_${Date.now().toString(36)}`;
        const respId = chatRes.id || `resp_${Date.now().toString(36)}`;

        const outputItem = {
          type: "message",
          id: msgId,
          status: "completed",
          role: "assistant",
          content: [{ type: "output_text", text: outputText }],
        };

        const responsesRes = {
          id: respId,
          object: "response",
          created_at: chatRes.created || Math.floor(Date.now() / 1000),
          status: "completed",
          model: chatRes.model || chatReq.model,
          output: [outputItem],
          usage,
        };

        if (wantsStream) {
          res.writeHead(200, {
            "Content-Type": "text/event-stream",
            "Cache-Control": "no-cache",
            Connection: "keep-alive",
          });

          const send = (evt) => res.write(`data: ${JSON.stringify(evt)}\n\n`);

          // Sequence of events Codex expects for a complete response
          send({ type: "response.created", response: { ...responsesRes, status: "in_progress", output: [] } });
          send({ type: "response.in_progress", response: { ...responsesRes, status: "in_progress" } });
          send({ type: "response.output_item.added", output_index: 0, item: outputItem });
          send({ type: "response.content_part.added", output_index: 0, content_index: 0, part: { type: "output_text", text: "" } });
          send({ type: "response.output_text.delta", output_index: 0, content_index: 0, delta: outputText });
          send({ type: "response.output_text.done", output_index: 0, content_index: 0, text: outputText });
          send({ type: "response.content_part.done", output_index: 0, content_index: 0, part: { type: "output_text", text: outputText } });
          send({ type: "response.output_item.done", output_index: 0, item: outputItem });
          send({ type: "response.completed", response: responsesRes });

          res.end();
          console.log("[adapter] streamed OK, tokens:", usage.input_tokens, "/", usage.output_tokens);
        } else {
          res.writeHead(200, { "Content-Type": "application/json" });
          res.end(JSON.stringify(responsesRes));
          console.log("[adapter] JSON OK");
        }
      } catch (e) {
        console.error("[adapter] error:", e.message);
        res.writeHead(500, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: e.message }));
      }
    });
    return;
  }

  // Fallback
  console.log("[adapter] 404:", req.url);
  res.writeHead(404, { "Content-Type": "application/json" });
  res.end(JSON.stringify({ error: "not found", path: req.url }));
});

server.listen(PORT, () => {
  console.log(`Responses adapter listening on http://localhost:${PORT}`);
  console.log(`Upstream: ${UPSTREAM}`);
});

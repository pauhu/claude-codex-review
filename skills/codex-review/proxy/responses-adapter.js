#!/usr/bin/env node
// Responses API → Chat Completions adapter for Codex → Claude Max
// Translates POST /v1/responses into POST /v1/chat/completions
// Upstream: claude-max-api-proxy on port 3456

const http = require("http");

const UPSTREAM = "http://localhost:3456";
const PORT = 4000;

const server = http.createServer(async (req, res) => {
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
  if (req.url === "/health") {
    res.writeHead(200, { "Content-Type": "application/json" });
    return res.end(JSON.stringify({ status: "ok", adapter: "responses-to-chat" }));
  }

  // Models passthrough
  if (req.url === "/v1/models") {
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
  if (req.url === "/v1/responses" && req.method === "POST") {
    let body = "";
    req.on("data", (chunk) => (body += chunk));
    req.on("end", async () => {
      try {
        const responsesReq = JSON.parse(body);

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
              messages.push({
                role: msg.role || "user",
                content:
                  typeof msg.content === "string"
                    ? msg.content
                    : Array.isArray(msg.content)
                      ? msg.content
                          .filter((c) => c.type === "input_text" || c.type === "text")
                          .map((c) => c.text)
                          .join("\n")
                      : JSON.stringify(msg.content),
              });
            }
          }
        }

        if (messages.length === 0) {
          messages.push({ role: "user", content: "Hello" });
        }

        const chatReq = {
          model: responsesReq.model || "claude-sonnet-4-5-20250929",
          messages,
          max_tokens: responsesReq.max_output_tokens || 4096,
          temperature: responsesReq.temperature ?? 1,
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

        // Translate chat completion → responses format
        const outputText =
          chatRes.choices?.[0]?.message?.content || "No response";

        const responsesRes = {
          id: chatRes.id || `resp_${Date.now()}`,
          object: "response",
          created_at: chatRes.created || Math.floor(Date.now() / 1000),
          model: chatRes.model || chatReq.model,
          output: [
            {
              type: "message",
              role: "assistant",
              content: [{ type: "output_text", text: outputText }],
            },
          ],
          usage: chatRes.usage || { input_tokens: 0, output_tokens: 0 },
        };

        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify(responsesRes));
      } catch (e) {
        console.error("Adapter error:", e.message);
        res.writeHead(500, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: e.message }));
      }
    });
    return;
  }

  // Fallback: proxy everything else
  res.writeHead(404, { "Content-Type": "application/json" });
  res.end(JSON.stringify({ error: "not found", path: req.url }));
});

server.listen(PORT, () => {
  console.log(`Responses adapter listening on http://localhost:${PORT}`);
  console.log(`Upstream: ${UPSTREAM}`);
});

#!/usr/bin/env node
/**
 * Responses API → Chat Completions adapter
 *
 * Accepts OpenAI Responses API format (POST /v1/responses)
 * Translates to Chat Completions format (POST /v1/chat/completions)
 * Forwards to claude-max-api-proxy at UPSTREAM (default localhost:3456)
 *
 * This lets Codex CLI v0.98+ (which only speaks Responses API)
 * work with claude-max-api-proxy (which only speaks Chat Completions).
 */

const http = require("http");

const PORT = parseInt(process.env.ADAPTER_PORT || "4000", 10);
const UPSTREAM_HOST = process.env.UPSTREAM_HOST || "localhost";
const UPSTREAM_PORT = parseInt(process.env.UPSTREAM_PORT || "3456", 10);

// Convert Responses API request → Chat Completions request
function responsesToChatBody(body) {
  const messages = [];

  // instructions → system message
  if (body.instructions) {
    messages.push({ role: "system", content: body.instructions });
  }

  // input → user messages
  if (typeof body.input === "string") {
    messages.push({ role: "user", content: body.input });
  } else if (Array.isArray(body.input)) {
    for (const item of body.input) {
      if (typeof item === "string") {
        messages.push({ role: "user", content: item });
      } else if (item.role) {
        messages.push({ role: item.role, content: item.content || "" });
      }
    }
  }

  if (messages.length === 0) {
    messages.push({ role: "user", content: "" });
  }

  return {
    model: body.model || "claude-sonnet-4",
    messages,
    stream: true,
  };
}

// Generate a response ID
function respId() {
  return "resp_" + Math.random().toString(36).slice(2, 14);
}

// SSE helper
function sse(res, event, data) {
  res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
}

// Handle POST /v1/responses
function handleResponses(req, res) {
  let rawBody = "";
  req.on("data", (chunk) => (rawBody += chunk));
  req.on("end", () => {
    let body;
    try {
      body = JSON.parse(rawBody);
    } catch {
      res.writeHead(400, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: "Invalid JSON" }));
      return;
    }

    const chatBody = responsesToChatBody(body);
    const chatPayload = JSON.stringify(chatBody);
    const id = respId();

    // Set SSE headers
    res.writeHead(200, {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    });

    // Send response.created
    sse(res, "response.created", {
      type: "response.created",
      response: { id, object: "response", status: "in_progress", output: [] },
    });

    // Send output_item.added
    sse(res, "response.output_item.added", {
      type: "response.output_item.added",
      output_index: 0,
      item: { type: "message", role: "assistant", content: [] },
    });

    // Send content_part.added
    sse(res, "response.content_part.added", {
      type: "response.content_part.added",
      output_index: 0,
      content_index: 0,
      part: { type: "output_text", text: "" },
    });

    // Forward to upstream (chat completions)
    const upstreamReq = http.request(
      {
        hostname: UPSTREAM_HOST,
        port: UPSTREAM_PORT,
        path: "/v1/chat/completions",
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Content-Length": Buffer.byteLength(chatPayload),
        },
      },
      (upstreamRes) => {
        let fullText = "";
        let buffer = "";

        upstreamRes.on("data", (chunk) => {
          buffer += chunk.toString();
          const lines = buffer.split("\n");
          buffer = lines.pop() || "";

          for (const line of lines) {
            if (!line.startsWith("data: ")) continue;
            const data = line.slice(6).trim();
            if (data === "[DONE]") continue;
            if (data === "") continue;

            try {
              const parsed = JSON.parse(data);
              const delta = parsed.choices?.[0]?.delta;
              const text = delta?.content;
              const finish = parsed.choices?.[0]?.finish_reason;

              if (text) {
                fullText += text;
                sse(res, "response.output_text.delta", {
                  type: "response.output_text.delta",
                  output_index: 0,
                  content_index: 0,
                  delta: text,
                });
              }

              if (finish === "stop") {
                // Send completion events
                sse(res, "response.output_text.done", {
                  type: "response.output_text.done",
                  output_index: 0,
                  content_index: 0,
                  text: fullText,
                });

                sse(res, "response.content_part.done", {
                  type: "response.content_part.done",
                  output_index: 0,
                  content_index: 0,
                  part: { type: "output_text", text: fullText },
                });

                sse(res, "response.output_item.done", {
                  type: "response.output_item.done",
                  output_index: 0,
                  item: {
                    type: "message",
                    role: "assistant",
                    content: [{ type: "output_text", text: fullText }],
                  },
                });

                sse(res, "response.completed", {
                  type: "response.completed",
                  response: {
                    id,
                    object: "response",
                    status: "completed",
                    output: [
                      {
                        type: "message",
                        role: "assistant",
                        content: [{ type: "output_text", text: fullText }],
                      },
                    ],
                  },
                });

                res.end();
              }
            } catch {
              // skip unparseable lines
            }
          }
        });

        upstreamRes.on("end", () => {
          if (!res.writableEnded) res.end();
        });

        upstreamRes.on("error", (err) => {
          console.error("Upstream error:", err.message);
          if (!res.writableEnded) res.end();
        });
      }
    );

    upstreamReq.on("error", (err) => {
      console.error("Connection error:", err.message);
      sse(res, "response.failed", {
        type: "response.failed",
        response: { id, object: "response", status: "failed" },
      });
      res.end();
    });

    upstreamReq.end(chatPayload);
  });
}

// Handle GET /v1/models
function handleModels(req, res) {
  // Proxy to upstream
  http
    .get(
      `http://${UPSTREAM_HOST}:${UPSTREAM_PORT}/v1/models`,
      (upstreamRes) => {
        let data = "";
        upstreamRes.on("data", (c) => (data += c));
        upstreamRes.on("end", () => {
          res.writeHead(200, { "Content-Type": "application/json" });
          res.end(data);
        });
      }
    )
    .on("error", () => {
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(
        JSON.stringify({
          object: "list",
          data: [
            { id: "claude-sonnet-4", object: "model", owned_by: "anthropic" },
          ],
        })
      );
    });
}

// Server
const server = http.createServer((req, res) => {
  if (req.method === "POST" && req.url === "/v1/responses") {
    handleResponses(req, res);
  } else if (req.method === "GET" && req.url === "/v1/models") {
    handleModels(req, res);
  } else if (req.method === "GET" && req.url === "/health") {
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ status: "ok", adapter: "responses-to-chat" }));
  } else {
    res.writeHead(404);
    res.end("Not found");
  }
});

server.listen(PORT, () => {
  console.log(`Responses adapter listening on http://localhost:${PORT}`);
  console.log(`Forwarding to http://${UPSTREAM_HOST}:${UPSTREAM_PORT}`);
});

import * as http from "node:http";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { SSEServerTransport } from "@modelcontextprotocol/sdk/server/sse.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { LogLevel, logger, setLogLevel } from "../utils/logger";
import { createMcpServerInstance } from "./mcpServer";
import type { McpServerTools } from "./tools";

/**
 * Starts the MCP server using the Streamable HTTP and SSE transports.
 * @param tools The shared tool instances.
 * @param port The port to listen on.
 * @returns The created McpServer instance.
 */
export async function startHttpServer(
  tools: McpServerTools,
  port: number,
): Promise<McpServer> {
  setLogLevel(LogLevel.INFO);

  const server = createMcpServerInstance(tools);
  const sseTransports: Record<string, SSEServerTransport> = {};

  const httpServer = http.createServer(async (req, res) => {
    try {
      const url = new URL(req.url || "/", `http://${req.headers.host}`);

      if (req.method === "GET" && url.pathname === "/sse") {
        // Handle SSE connection
        const transport = new SSEServerTransport("/messages", res);
        sseTransports[transport.sessionId] = transport;

        // Keep-Alive-Ping alle 15 Sekunden
        const keepAliveInterval = setInterval(() => {
          try {
            res.write(": keep-alive\n\n");
          } catch (e) {
            // Ignoriere Fehler beim Schreiben, z.B. wenn Verbindung schon geschlossen
          }
        }, 15000);

        res.on("close", () => {
          clearInterval(keepAliveInterval);
          delete sseTransports[transport.sessionId];
          transport.close();
        });

        await server.connect(transport);
      } else if (req.method === "POST" && url.pathname === "/messages") {
        // Handle SSE messages
        const sessionId = url.searchParams.get("sessionId");
        const transport = sessionId ? sseTransports[sessionId] : undefined;

        if (transport) {
          let body = "";
          for await (const chunk of req) {
            body += chunk;
          }
          const parsedBody = JSON.parse(body);
          await transport.handlePostMessage(req, res, parsedBody);
        } else {
          res.writeHead(400, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ error: "No transport found for sessionId" }));
        }
      } else if (url.pathname === "/mcp") {
        // Handle Streamable HTTP (stateless)
        let body = "";
        for await (const chunk of req) {
          body += chunk;
        }
        const parsedBody = JSON.parse(body);

        // In stateless mode, create a new instance of server and transport for each request
        const requestServer = createMcpServerInstance(tools);
        const requestTransport = new StreamableHTTPServerTransport({
          sessionIdGenerator: undefined,
        });

        res.on("close", () => {
          logger.debug("Streamable HTTP request closed");
          requestTransport.close();
          requestServer.close(); // Close the per-request server instance
        });

        await requestServer.connect(requestTransport);
        await requestTransport.handleRequest(req, res, parsedBody);
      } else {
        // Handle 404 Not Found
        res.writeHead(404, { "Content-Type": "application/json" });
        res.end(
          JSON.stringify({
            error: `Endpoint ${url.pathname} not found.`,
          }),
        );
      }
    } catch (error) {
      logger.error(`❌ Error handling HTTP request: ${error}`);
      // Send an error response
      res.writeHead(500, { "Content-Type": "application/json" });
      res.end(
        JSON.stringify({
          error: error instanceof Error ? error.message : String(error),
        }),
      );
    }
  });

  httpServer.listen(port, () => {
    logger.info(`🤖 MCP server listening at http://127.0.0.1:${port}`);
  });

  const originalClose = httpServer.close.bind(httpServer);
  server.close = async () => {
    logger.debug("Closing MCP server instance...");
    httpServer.close();
    for (const transport of Object.values(sseTransports)) {
      await transport.close();
    }
    logger.debug("MCP server instance closed.");
    await originalClose();
  };

  // Return the server instance
  return server;
}

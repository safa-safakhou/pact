import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
import { createServer, request } from "node:http";
import { extname, resolve, sep } from "node:path";
import { pathToFileURL } from "node:url";

const types = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".webp": "image/webp",
  ".ico": "image/x-icon",
  ".woff2": "font/woff2",
};

export function createGateway({ webRoot, apiPort }) {
  const root = resolve(webRoot);
  return createServer(async (req, res) => {
    const url = new URL(req.url, "http://localhost");
    if (
      /^\/(?:v1|v2|oauth|mcp|accounts|approvals|health|ready|metrics|a2a)(?:\/|$)/.test(url.pathname) ||
      url.pathname.startsWith("/.well-known/")
    ) {
      const upstream = request(
        { hostname: "127.0.0.1", port: apiPort, path: req.url, method: req.method, headers: req.headers },
        (response) => {
          res.writeHead(response.statusCode, response.headers);
          response.pipe(res);
        },
      );
      upstream.on("error", () => {
        res.writeHead(503);
        res.end("Local API unavailable");
      });
      req.on("aborted", () => upstream.destroy());
      req.pipe(upstream);
      return;
    }
    try {
      const relative = decodeURIComponent(url.pathname).replace(/^\/pact(?=\/|$)/, "");
      if (!["GET", "HEAD"].includes(req.method) || relative.split("/").some((part) => part.startsWith(".")))
        throw Error("not found");
      let file = resolve(root, `.${relative}`);
      if (file !== root && !file.startsWith(root + sep)) throw Error("not found");
      if (!extname(file)) file = resolve(root, "index.html");
      if (!(await stat(file)).isFile()) throw Error("not found");
      res.writeHead(200, {
        "content-type": types[extname(file)] ?? "application/octet-stream",
        "x-content-type-options": "nosniff",
        "cache-control": "no-store",
      });
      if (req.method === "HEAD") res.end();
      else createReadStream(file).pipe(res);
    } catch {
      res.writeHead(404);
      res.end("Not found");
    }
  });
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const port = Number(process.env.LOCAL_WORLD_GATEWAY_PORT ?? 3400);
  const apiPort = Number(process.env.LOCAL_WORLD_API_PORT ?? 3401);
  if (!process.env.LOCAL_WORLD_WEB_ROOT) throw Error("Explicit built web root required");
  createGateway({ webRoot: process.env.LOCAL_WORLD_WEB_ROOT, apiPort }).listen(port, "127.0.0.1", () =>
    console.log(`Local world gateway: http://127.0.0.1:${port}`),
  );
}

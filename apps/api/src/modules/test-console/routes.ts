import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import type { FastifyPluginAsync } from "fastify";

const moduleDir = path.dirname(fileURLToPath(import.meta.url));
const assetsDir = path.join(moduleDir, "ui");

async function loadAsset(fileName: string) {
  return readFile(path.join(assetsDir, fileName), "utf8");
}

export const testConsoleRoutes: FastifyPluginAsync = async (app) => {
  app.get("/ui", async (_request, reply) => {
    const html = await loadAsset("index.html");
    return reply.type("text/html; charset=utf-8").send(html);
  });

  app.get("/ui/styles.css", async (_request, reply) => {
    const css = await loadAsset("styles.css");
    return reply.type("text/css; charset=utf-8").send(css);
  });

  app.get("/ui/app.js", async (_request, reply) => {
    const js = await loadAsset("app.js");
    return reply.type("application/javascript; charset=utf-8").send(js);
  });
};

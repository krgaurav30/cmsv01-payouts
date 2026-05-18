import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import type { FastifyPluginAsync } from "fastify";

const moduleDir = path.dirname(fileURLToPath(import.meta.url));
const assetsDir = path.join(moduleDir, "ui");

async function loadAsset(fileName: string) {
  return readFile(path.join(assetsDir, fileName), "utf8");
}

export const corporateAppRoutes: FastifyPluginAsync = async (app) => {
  app.get("/corporate/login", async (_request, reply) => {
    const html = await loadAsset("login.html");
    return reply.type("text/html; charset=utf-8").send(html);
  });

  app.get("/corporate/login/styles.css", async (_request, reply) => {
    const css = await loadAsset("login.css");
    return reply.type("text/css; charset=utf-8").send(css);
  });

  app.get("/corporate/login/app.js", async (_request, reply) => {
    const js = await loadAsset("login.js");
    return reply.type("application/javascript; charset=utf-8").send(js);
  });

  app.get("/corporate/onboarding", async (_request, reply) => {
    const html = await loadAsset("index.html");
    return reply.type("text/html; charset=utf-8").send(html);
  });

  app.get("/corporate/onboarding/styles.css", async (_request, reply) => {
    const css = await loadAsset("styles.css");
    return reply.type("text/css; charset=utf-8").send(css);
  });

  app.get("/corporate/onboarding/app.js", async (_request, reply) => {
    const js = await loadAsset("app.js");
    return reply.type("application/javascript; charset=utf-8").send(js);
  });

  app.get("/corporate/operations", async (_request, reply) => {
    const html = await loadAsset("operations.html");
    return reply.type("text/html; charset=utf-8").send(html);
  });

  app.get("/corporate/operations/styles.css", async (_request, reply) => {
    const css = await loadAsset("operations.css");
    return reply.type("text/css; charset=utf-8").send(css);
  });

  app.get("/corporate/operations/app.js", async (_request, reply) => {
    const js = await loadAsset("operations.js");
    return reply.type("application/javascript; charset=utf-8").send(js);
  });
};

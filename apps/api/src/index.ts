import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import { loadConfig } from "./config";
import { buildApp } from "./app";
import { prisma } from "./lib/prisma";

function loadEnvFile() {
  const paths = [resolve(process.cwd(), ".env"), resolve(process.cwd(), "../../.env")];
  for (const file of paths) {
    if (!existsSync(file)) continue;
    const text = readFileSync(file, "utf8");
    for (const line of text.split("\n")) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const eq = trimmed.indexOf("=");
      if (eq < 0) continue;
      const key = trimmed.slice(0, eq);
      const value = trimmed.slice(eq + 1);
      if (!process.env[key]) process.env[key] = value;
    }
  }
}

loadEnvFile();

const config = loadConfig();
const app = await buildApp(config);

try {
  await app.listen({ port: config.API_PORT, host: "0.0.0.0" });
} catch (err) {
  app.log.error(err);
  await prisma.$disconnect();
  process.exit(1);
}

async function shutdown() {
  await app.close();
  await prisma.$disconnect();
  process.exit(0);
}

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);

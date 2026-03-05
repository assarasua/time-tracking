import { PrismaClient } from "@prisma/client";
import { copyFileSync, existsSync, mkdirSync } from "node:fs";
import path from "node:path";

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

function ensurePrismaEnginePath() {
  if (process.env.PRISMA_QUERY_ENGINE_LIBRARY) return;
  if (process.platform !== "linux") return;

  const candidateDirs = [
    "/node_modules/.prisma/client",
    "/node_modules/@prisma/engines",
    path.join(process.cwd(), "node_modules/.prisma/client"),
    path.join(process.cwd(), "node_modules/@prisma/engines"),
    "/opt/buildhome/repo/node_modules/.prisma/client",
    "/opt/buildhome/repo/node_modules/@prisma/engines",
    path.join(__dirname, "../../../node_modules/.prisma/client"),
    path.join(__dirname, "../../../node_modules/@prisma/engines"),
    path.join(__dirname, "../../../../node_modules/.prisma/client"),
    path.join(__dirname, "../../../../node_modules/@prisma/engines")
  ];

  const engineNames = [
    "libquery_engine-debian-openssl-1.1.x.so.node",
    "libquery_engine-debian-openssl-3.0.x.so.node",
    "libquery_engine-linux-musl.so.node"
  ];

  for (const dir of candidateDirs) {
    for (const engineName of engineNames) {
      const directPath = path.join(dir, engineName);
      if (existsSync(directPath)) {
        process.env.PRISMA_QUERY_ENGINE_LIBRARY = directPath;
        return;
      }
    }
  }

  // Fallback: copy any available engine into a stable writable location.
  const tmpDir = "/tmp/prisma-engines";
  mkdirSync(tmpDir, { recursive: true });

  for (const dir of candidateDirs) {
    for (const engineName of engineNames) {
      const sourcePath = path.join(dir, engineName);
      if (!existsSync(sourcePath)) continue;
      const targetPath = path.join(tmpDir, engineName);
      try {
        copyFileSync(sourcePath, targetPath);
        process.env.PRISMA_QUERY_ENGINE_LIBRARY = targetPath;
        return;
      } catch {
        // Keep trying other sources.
      }
    }
  }
}

ensurePrismaEnginePath();

export const db =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["query", "warn", "error"] : ["error"]
  });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = db;
}

import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";
import { copyFileSync, existsSync, mkdirSync } from "node:fs";
import path from "node:path";
import { Pool } from "pg";

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };
const connectionString =
  process.env.DATABASE_URL ?? "postgresql://placeholder:placeholder@localhost:5432/placeholder";
const adapter = new PrismaPg(
  new Pool({
    connectionString
  })
);

function ensurePrismaCompilerWasm() {
  const targetDir = path.join(process.cwd(), "node_modules/.prisma/client");
  const targetFile = `${targetDir}/query_compiler_bg.wasm`;
  const targetSchema = `${targetDir}/schema.prisma`;
  if (existsSync(targetFile) && existsSync(targetSchema)) return;

  const candidates = [
    path.join(process.cwd(), "node_modules/.prisma/client/query_compiler_bg.wasm"),
    path.join(process.cwd(), ".prisma/client/query_compiler_bg.wasm"),
    path.join(process.cwd(), "node_modules/prisma/build/query_compiler_bg.postgresql.wasm"),
    path.join(__dirname, "../../../node_modules/.prisma/client/query_compiler_bg.wasm"),
    path.join(__dirname, "../../../../node_modules/.prisma/client/query_compiler_bg.wasm"),
    path.join(__dirname, "../../../../../node_modules/.prisma/client/query_compiler_bg.wasm")
  ];
  const schemaCandidates = [
    path.join(process.cwd(), "node_modules/.prisma/client/schema.prisma"),
    path.join(process.cwd(), ".prisma/client/schema.prisma"),
    path.join(__dirname, "../../../node_modules/.prisma/client/schema.prisma"),
    path.join(__dirname, "../../../../node_modules/.prisma/client/schema.prisma"),
    path.join(__dirname, "../../../../../node_modules/.prisma/client/schema.prisma")
  ];

  const sourceFile = candidates.find((candidate) => existsSync(candidate));
  const sourceSchema = schemaCandidates.find((candidate) => existsSync(candidate));
  if (!sourceFile || !sourceSchema) return;

  try {
    mkdirSync(targetDir, { recursive: true });
    copyFileSync(sourceFile, targetFile);
    copyFileSync(sourceSchema, targetSchema);
  } catch {
    // If runtime path is not writable, diagnostics endpoint will expose the ENOENT root cause.
  }
}

ensurePrismaCompilerWasm();

export const db =
  globalForPrisma.prisma ??
  new PrismaClient({
    adapter,
    log: process.env.NODE_ENV === "development" ? ["query", "warn", "error"] : ["error"]
  } as any);

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = db;
}

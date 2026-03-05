import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  typedRoutes: true,
  serverExternalPackages: ["@prisma/client", "prisma"],
  outputFileTracingRoot: process.cwd(),
  outputFileTracingIncludes: {
    "/*": [
      "node_modules/.prisma/client/**/*",
      "node_modules/@prisma/client/**/*",
      "node_modules/prisma/libquery_engine-*.so.node",
      "node_modules/@prisma/engines/**/*"
    ]
  }
};

export default nextConfig;

import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  typedRoutes: true,
  outputFileTracingRoot: process.cwd(),
  outputFileTracingIncludes: {
    "/*": [
      "./node_modules/.prisma/client/**/*",
      "./node_modules/@prisma/client/**/*",
      "./node_modules/prisma/libquery_engine-*.so.node",
      "./node_modules/@prisma/engines/**/*"
    ]
  }
};

export default nextConfig;

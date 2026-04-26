import { fileURLToPath } from "node:url";
import type { NextConfig } from "next";

const dashboardRoot = fileURLToPath(new URL(".", import.meta.url));

const nextConfig: NextConfig = {
  outputFileTracingRoot: dashboardRoot,
  turbopack: {
    root: dashboardRoot,
  },
};

export default nextConfig;

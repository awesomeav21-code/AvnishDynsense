import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  transpilePackages: ["@dynsense/shared"],
  devIndicators: false,
};

export default nextConfig;

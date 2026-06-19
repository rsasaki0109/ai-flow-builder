import type { NextConfig } from "next";

type WebpackConfigWithResolve = {
  resolve?: {
    extensionAlias?: Record<string, string[]>;
  };
};

const nextConfig: NextConfig = {
  reactStrictMode: true,
  transpilePackages: ["@ai-flow-builder/db", "@ai-flow-builder/flow-core"],
  webpack(config: WebpackConfigWithResolve): WebpackConfigWithResolve {
    config.resolve ??= {};
    config.resolve.extensionAlias = {
      ".cjs": [".cts", ".cjs"],
      ".js": [".ts", ".tsx", ".js"],
      ".mjs": [".mts", ".mjs"],
    };
    return config;
  },
};

export default nextConfig;

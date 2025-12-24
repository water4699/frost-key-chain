import type { NextConfig } from "next";
import path from "path";

const nextConfig: NextConfig = {
  serverExternalPackages: ["@fhevm/solidity"],
  headers() {
    // Required by FHEVM 
    return Promise.resolve([
      {
        source: '/',
        headers: [
          {
            key: 'Cross-Origin-Opener-Policy',
            value: 'same-origin',
          },
          {
            key: 'Cross-Origin-Embedder-Policy',
            value: 'require-corp',
          },
        ],
      },
    ]);
  },
  // Ensure output file tracing root is the frontend app, not workspace root
  outputFileTracingRoot: path.join(__dirname),
  webpack: (config) => {
    config.resolve = config.resolve || {};
    config.resolve.alias = {
      ...(config.resolve.alias || {}),
      "@react-native-async-storage/async-storage": path.resolve(
        __dirname,
        "empty-async-storage.js"
      ),
    };
    return config;
  },
};

export default nextConfig;

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  transpilePackages: [
    "@tourneyforge/types",
    "@tourneyforge/validators",
    "@tourneyforge/scoring",
    "@tourneyforge/themes",
    "@tourneyforge/ui",
    "tamagui",
    "@tamagui/core",
    "@tamagui/config-node",
    "react-native-web",
  ],
  experimental: {
    optimizePackageImports: ["@tourneyforge/ui"],
  },
};

module.exports = nextConfig;

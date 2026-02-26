/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  transpilePackages: [
    "@tourneyforge/types",
    "@tourneyforge/validators",
    "@tourneyforge/scoring",
    "@tourneyforge/themes",
  ],
};

module.exports = nextConfig;

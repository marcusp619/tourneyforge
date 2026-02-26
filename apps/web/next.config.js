/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  transpilePackages: [
    "@tourneyforge/types",
    "@tourneyforge/validators",
    "@tourneyforge/scoring",
    "@tourneyforge/themes",
  ],
  images: {
    // Tenant logos (Cloudflare R2) and sponsor logos can come from any HTTPS host.
    // This is acceptable for a multi-tenant SaaS where directors supply their own URLs.
    remotePatterns: [
      { protocol: "https", hostname: "**" },
    ],
  },
};

module.exports = nextConfig;

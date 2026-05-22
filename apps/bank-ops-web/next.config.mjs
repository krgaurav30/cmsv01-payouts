/** @type {import('next').NextConfig} */
const bffUrl =
  process.env.BFF_URL ||
  process.env.NEXT_PUBLIC_BFF_URL ||
  "http://127.0.0.1:3100";

const nextConfig = {
  allowedDevOrigins: ["127.0.0.1"],
  async rewrites() {
    return [
      {
        source: "/v1/:path*",
        destination: `${bffUrl}/v1/:path*`
      },
      {
        source: "/health",
        destination: `${bffUrl}/health`
      },
      {
        source: "/bank/:path*",
        destination: `${bffUrl}/bank/:path*`
      }
    ];
  }
};

export default nextConfig;

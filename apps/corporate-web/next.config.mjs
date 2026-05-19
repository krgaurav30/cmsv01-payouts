/** @type {import('next').NextConfig} */
const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:3101";

const nextConfig = {
  allowedDevOrigins: ["127.0.0.1"],
  async rewrites() {
    return [
      {
        source: "/v1/:path*",
        destination: `${apiUrl}/v1/:path*`
      },
      {
        source: "/health",
        destination: `${apiUrl}/health`
      },
      {
        source: "/bank/:path*",
        destination: `${apiUrl}/bank/:path*`
      }
    ];
  }
};

export default nextConfig;

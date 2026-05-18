/** @type {import('next').NextConfig} */
const nextConfig = {
  allowedDevOrigins: ["127.0.0.1"],
  async rewrites() {
    return [
      {
        source: "/v1/:path*",
        destination: "http://127.0.0.1:3101/v1/:path*"
      },
      {
        source: "/health",
        destination: "http://127.0.0.1:3101/health"
      }
    ];
  }
};

export default nextConfig;

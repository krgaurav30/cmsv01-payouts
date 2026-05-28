/** @type {import('next').NextConfig} */
const bffUrl =
  process.env.BFF_URL ||
  process.env.NEXT_PUBLIC_BFF_URL ||
  "http://127.0.0.1:3100";

const nextConfig = {
  allowedDevOrigins: ["127.0.0.1"],
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          {
            key: "X-Content-Type-Options",
            value: "nosniff"
          },
          {
            key: "Referrer-Policy",
            value: "strict-origin-when-cross-origin"
          },
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=(), interest-cohort=()"
          },
          {
            key: "X-XSS-Protection",
            value: "1; mode=block"
          },
          {
            key: "Strict-Transport-Security",
            value: "max-age=63072000; includeSubDomains; preload"
          },
          {
            key: "X-DNS-Prefetch-Control",
            value: "on"
          }
        ]
      },
      {
        source: "/((?!developer-portal).*)",
        headers: [
          {
            key: "X-Frame-Options",
            value: "DENY"
          },
          {
            key: "Content-Security-Policy",
            value: "frame-ancestors 'none';"
          }
        ]
      },
      {
        source: "/developer-portal",
        headers: [
          {
            key: "X-Frame-Options",
            value: "SAMEORIGIN"
          },
          {
            key: "Content-Security-Policy",
            value: "frame-ancestors 'self';"
          }
        ]
      }
    ];
  },
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
      },
      {
        source: "/bff/:path*",
        destination: `${bffUrl}/bff/:path*`
      }
    ];
  }
};

export default nextConfig;

export function resolveApiBase(origin?: string | null) {
  const configured =
    process.env.API_URL ||
    process.env.NEXT_PUBLIC_API_URL ||
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : null) ||
    origin ||
    (process.env.NODE_ENV === "development" ? "http://127.0.0.1:3101" : null);

  if (!configured) {
    throw new Error(
      "API base URL is not configured. Set API_URL for server-side requests."
    );
  }

  return configured.replace(/\/+$/, "");
}

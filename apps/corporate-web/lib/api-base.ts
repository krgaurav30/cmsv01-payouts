export function resolveBffBase(origin?: string | null) {
  const configured =
    process.env.BFF_URL ||
    process.env.NEXT_PUBLIC_BFF_URL ||
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : null) ||
    (process.env.NODE_ENV === "development" ? "http://127.0.0.1:3100" : null) ||
    origin;

  if (!configured) {
    throw new Error(
      "BFF base URL is not configured. Set BFF_URL for server-side requests."
    );
  }

  return configured.replace(/\/+$/, "");
}

export function resolveBankOpsPortalBase(origin?: string | null) {
  const configured =
    process.env.BANK_OPS_PORTAL_BASE ||
    process.env.NEXT_PUBLIC_BANK_OPS_PORTAL_BASE ||
    (process.env.NODE_ENV === "development" ? "http://localhost:3002" : null) ||
    origin;

  return configured ? configured.replace(/\/+$/, "") : "http://localhost:3002";
}

import type { CorporateSession } from "./types";

export const SESSION_COOKIE = "cmsCorporateSession";
export const SELECTED_CORPORATE_COOKIE = "cmsSelectedCorporateId";
export const SELECTED_SUBSCRIPTION_COOKIE = "cmsSelectedSubscriptionId";

export function parseSessionCookie(value?: string | null) {
  if (!value) {
    return null;
  }

  let candidate = value;

  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      return JSON.parse(candidate) as CorporateSession;
    } catch {
      try {
        const decoded = decodeURIComponent(candidate);

        if (decoded === candidate) {
          break;
        }

        candidate = decoded;
      } catch {
        break;
      }
    }
  }

  return null;
}

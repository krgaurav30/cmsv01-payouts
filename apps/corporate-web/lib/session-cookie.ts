import type { CorporateSession } from "./types";

export const SESSION_COOKIE = "cmsCorporateSession";
export const SELECTED_CORPORATE_COOKIE = "cmsSelectedCorporateId";

export function parseSessionCookie(value?: string | null) {
  if (!value) {
    return null;
  }

  try {
    return JSON.parse(decodeURIComponent(value)) as CorporateSession;
  } catch {
    return null;
  }
}

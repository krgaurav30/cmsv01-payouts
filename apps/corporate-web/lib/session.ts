"use client";

import type { CorporateSession } from "./types";
import {
  parseSessionCookie,
  SELECTED_CORPORATE_COOKIE,
  SESSION_COOKIE
} from "./session-cookie";

const SESSION_KEY = "cmsCorporateSession";
const SELECTED_CORPORATE_KEY = "cmsSelectedCorporateId";

export function readSession() {
  try {
    const stored = localStorage.getItem(SESSION_KEY);
    if (stored) {
      return JSON.parse(stored) as CorporateSession | null;
    }

    const cookieValue = readCookie(SESSION_COOKIE);
    if (!cookieValue) {
      return null;
    }

    const parsed = parseSessionCookie(cookieValue);
    if (parsed) {
      localStorage.setItem(SESSION_KEY, JSON.stringify(parsed));
    }

    return parsed;
  } catch {
    return null;
  }
}

export function persistSession(session: CorporateSession) {
  localStorage.setItem(SESSION_KEY, JSON.stringify(session));
  document.cookie = `${SESSION_COOKIE}=${encodeURIComponent(JSON.stringify(session))}; Path=/; Max-Age=${60 * 60 * 8}; SameSite=Lax`;
}

export function clearSession() {
  localStorage.removeItem(SESSION_KEY);
  localStorage.removeItem(SELECTED_CORPORATE_KEY);
  document.cookie = `${SESSION_COOKIE}=; Path=/; Max-Age=0; SameSite=Lax`;
  document.cookie = `${SELECTED_CORPORATE_COOKIE}=; Path=/; Max-Age=0; SameSite=Lax`;
}

export function readSelectedCorporateId() {
  return localStorage.getItem(SELECTED_CORPORATE_KEY);
}

export function persistSelectedCorporateId(corporateId: string) {
  localStorage.setItem(SELECTED_CORPORATE_KEY, corporateId);
  document.cookie = `${SELECTED_CORPORATE_COOKIE}=${encodeURIComponent(corporateId)}; Path=/; Max-Age=${60 * 60 * 8}; SameSite=Lax`;
}

function readCookie(name: string) {
  const prefix = `${name}=`;
  const match = document.cookie
    .split(";")
    .map((item) => item.trim())
    .find((item) => item.startsWith(prefix));

  return match ? match.slice(prefix.length) : null;
}

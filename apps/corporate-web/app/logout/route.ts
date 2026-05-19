import { NextRequest, NextResponse } from "next/server";

import {
  SELECTED_CORPORATE_COOKIE,
  SESSION_COOKIE
} from "../../lib/session-cookie";

export async function GET(request: NextRequest) {
  const response = NextResponse.redirect(new URL("/login", request.url));

  response.cookies.set(SESSION_COOKIE, "", {
    httpOnly: false,
    sameSite: "lax",
    path: "/",
    maxAge: 0
  });

  response.cookies.set(SELECTED_CORPORATE_COOKIE, "", {
    httpOnly: false,
    sameSite: "lax",
    path: "/",
    maxAge: 0
  });

  return response;
}

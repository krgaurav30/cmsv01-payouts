import { NextRequest, NextResponse } from "next/server";
import { SESSION_COOKIE } from "../../../lib/session-cookie";

export async function POST(request: NextRequest) {
  const formData = await request.formData();
  const username = String(formData.get("username") ?? "");
  const password = String(formData.get("password") ?? "");

  try {
    const response = await fetch("http://127.0.0.1:3101/v1/auth/login", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        username,
        password
      }),
      cache: "no-store"
    });

    const data = (await response.json().catch(() => ({}))) as {
      session?: unknown;
      message?: string;
    };

    if (!response.ok || !data.session) {
      return NextResponse.redirect(new URL("/login?error=invalid_credentials", request.url));
    }

    const redirectResponse = NextResponse.redirect(new URL("/operations", request.url));
    redirectResponse.cookies.set(SESSION_COOKIE, encodeURIComponent(JSON.stringify(data.session)), {
      httpOnly: false,
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60 * 8
    });

    return redirectResponse;
  } catch {
    return NextResponse.redirect(new URL("/login?error=service_unavailable", request.url));
  }
}

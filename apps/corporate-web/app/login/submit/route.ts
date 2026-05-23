import { NextRequest, NextResponse } from "next/server";
import { resolveBffBase } from "../../../lib/api-base";
import { SESSION_COOKIE } from "../../../lib/session-cookie";

export async function POST(request: NextRequest) {
  const formData = await request.formData();
  const username = String(formData.get("username") ?? "");
  const password = String(formData.get("password") ?? "");

  try {
    const bffUrl = resolveBffBase(request.nextUrl.origin);
    const response = await fetch(`${bffUrl}/bff/auth/login`, {
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

    if (!response.ok) {
      if (response.status === 401 || response.status === 400) {
        return NextResponse.redirect(new URL("/login?error=invalid_credentials", request.url), {
          status: 303
        });
      }
      
      const errMsg = `(Server returned status ${response.status}. The backend services may be sleeping; please wait a few seconds and try again.)`;
      return NextResponse.redirect(
        new URL(`/login?error=service_unavailable&details=${encodeURIComponent(errMsg)}`, request.url),
        { status: 303 }
      );
    }

    if (!data.session) {
      return NextResponse.redirect(new URL("/login?error=invalid_credentials", request.url), {
        status: 303
      });
    }

    const redirectResponse = NextResponse.redirect(new URL("/operations", request.url), {
      status: 303
    });
    redirectResponse.cookies.set(SESSION_COOKIE, JSON.stringify(data.session), {
      httpOnly: false,
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60 * 8
    });

    return redirectResponse;
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    return NextResponse.redirect(
      new URL(`/login?error=service_unavailable&details=${encodeURIComponent(msg)}`, request.url),
      { status: 303 }
    );
  }
}

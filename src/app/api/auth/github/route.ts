import { NextResponse } from "next/server";
import { getAuthorizationUrl } from "@/lib/auth/github-oauth";

export async function GET() {
  try {
    const state = crypto.randomUUID();
    const authUrl = getAuthorizationUrl(state);

    const response = NextResponse.redirect(authUrl);

    response.cookies.set("github-oauth-state", state, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 10, // 10 minutes
    });

    return response;
  } catch (err) {
    const message = err instanceof Error ? err.message : "Auth configuration error";
    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
    return NextResponse.redirect(`${appUrl}/?error=${encodeURIComponent(message)}`);
  }
}

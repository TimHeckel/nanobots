import { NextResponse } from "next/server";

function logoutResponse() {
  const response = NextResponse.redirect(new URL("/", process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000"));

  response.cookies.set("nb-session", "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  });

  return response;
}

export async function GET() {
  return logoutResponse();
}

export async function POST() {
  return logoutResponse();
}

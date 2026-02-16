import { NextRequest, NextResponse } from "next/server";
import { jwtVerify } from "jose";

/**
 * Routes that require authentication.
 */
const PROTECTED_PAGE_ROUTES = ["/chat"];
const PROTECTED_API_ROUTES = ["/api/chat", "/api/org"];

function isProtectedRoute(pathname: string): boolean {
  for (const route of PROTECTED_PAGE_ROUTES) {
    if (pathname === route || pathname.startsWith(`${route}/`)) {
      return true;
    }
  }
  for (const route of PROTECTED_API_ROUTES) {
    if (pathname === route || pathname.startsWith(`${route}/`)) {
      return true;
    }
  }
  return false;
}

function isApiRoute(pathname: string): boolean {
  return pathname.startsWith("/api/");
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (!isProtectedRoute(pathname)) {
    return NextResponse.next();
  }

  const token = request.cookies.get("nb-session")?.value;

  if (!token) {
    return unauthorized(request, pathname);
  }

  try {
    const secret = process.env.JWT_SECRET;
    if (!secret) {
      console.error("JWT_SECRET is not set");
      return unauthorized(request, pathname);
    }

    const key = new TextEncoder().encode(secret);
    await jwtVerify(token, key);

    return NextResponse.next();
  } catch {
    return unauthorized(request, pathname);
  }
}

function unauthorized(request: NextRequest, pathname: string): NextResponse {
  if (isApiRoute(pathname)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Redirect to home page for page routes
  const url = request.nextUrl.clone();
  url.pathname = "/";
  url.search = "";
  return NextResponse.redirect(url);
}

export const config = {
  matcher: [
    "/chat",
    "/chat/:path*",
    "/api/chat",
    "/api/chat/:path*",
    "/api/org",
    "/api/org/:path*",
  ],
};

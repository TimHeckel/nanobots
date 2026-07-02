import { NextRequest, NextResponse } from "next/server";
import { jwtVerify } from "jose";

/**
 * Routes that require authentication.
 */
const PROTECTED_PAGE_ROUTES = ["/chat", "/admin"];
const PROTECTED_API_ROUTES = ["/api/chat", "/api/conversations", "/api/org", "/api/admin"];
const DEV_JWT_SECRET_FALLBACK = "nanobots-e2e-session-secret";
const E2E_AUTH_COOKIE = "nb-e2e-auth";

function getJwtSecret() {
  return process.env.JWT_SECRET ??
    (process.env.NODE_ENV === "production" ? undefined : DEV_JWT_SECRET_FALLBACK);
}

function allowLocalE2EBypass(request: NextRequest) {
  return (
    process.env.NODE_ENV !== "production" &&
    request.nextUrl.hostname === "localhost" &&
    request.cookies.get(E2E_AUTH_COOKIE)?.value === "allow"
  );
}

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

  // Redirect signed-in users from landing page to chat
  if (pathname === "/") {
    const token = request.cookies.get("nb-session")?.value;
    if (token) {
      try {
        const secret = getJwtSecret();
        if (secret) {
          const key = new TextEncoder().encode(secret);
          await jwtVerify(token, key);
          const url = request.nextUrl.clone();
          url.pathname = "/chat";
          return NextResponse.redirect(url);
        }
      } catch {
        // Invalid token — let them see the landing page
      }
    }
    return NextResponse.next();
  }

  if (!isProtectedRoute(pathname)) {
    return NextResponse.next();
  }

  if (allowLocalE2EBypass(request)) {
    return NextResponse.next();
  }

  const token = request.cookies.get("nb-session")?.value;

  if (!token) {
    return unauthorized(request, pathname);
  }

  try {
    const secret = getJwtSecret();
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
    "/",
    "/chat",
    "/chat/:path*",
    "/admin",
    "/admin/:path*",
    "/api/chat",
    "/api/chat/:path*",
    "/api/conversations",
    "/api/conversations/:path*",
    "/api/org",
    "/api/org/:path*",
    "/api/admin",
    "/api/admin/:path*",
  ],
};

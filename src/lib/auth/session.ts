/**
 * JWT session management for nanobots.sh.
 * Uses the `jose` library for signing and verifying tokens.
 */

import { SignJWT, jwtVerify, type JWTPayload } from "jose";
import { NextResponse } from "next/server";

const COOKIE_NAME = "nb-session";
const MAX_AGE_SECONDS = 7 * 24 * 60 * 60; // 7 days

export interface SessionPayload extends JWTPayload {
  userId: string;
  orgId?: string;
  role?: string;
}

function getSecret(): Uint8Array {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    throw new Error("JWT_SECRET is not set");
  }
  return new TextEncoder().encode(secret);
}

/**
 * Sign a JWT with the given payload. Returns the token string.
 */
export async function signJwt(payload: {
  userId: string;
  orgId?: string;
  role?: string;
}): Promise<string> {
  const token = await new SignJWT(payload as unknown as JWTPayload)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("7d")
    .sign(getSecret());

  return token;
}

/**
 * Verify a JWT and return the payload, or null if invalid/expired.
 */
export async function verifyJwt(
  token: string
): Promise<SessionPayload | null> {
  try {
    const { payload } = await jwtVerify(token, getSecret());
    return payload as SessionPayload;
  } catch {
    return null;
  }
}

/**
 * Read and verify the session from the request cookies.
 * Accepts a cookies object with a `get` method (e.g. from `cookies()` or `request.cookies`).
 */
export async function getSession(
  cookies: { get(name: string): { value: string } | undefined }
): Promise<SessionPayload | null> {
  const cookie = cookies.get(COOKIE_NAME);
  if (!cookie) {
    return null;
  }
  return verifyJwt(cookie.value);
}

/**
 * Set the nb-session cookie on a NextResponse.
 */
export function setSessionCookie(response: NextResponse, token: string): void {
  response.cookies.set(COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: MAX_AGE_SECONDS,
  });
}

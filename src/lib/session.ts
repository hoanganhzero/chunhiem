import { SignJWT, jwtVerify } from "jose";

export const SESSION_COOKIE = "session";
const MAX_AGE = 60 * 60 * 24 * 7; // 7 ngày

export type SessionPayload = { userId: string };

function key() {
  const secret = process.env.AUTH_SECRET;
  if (!secret || secret.length < 32) throw new Error("AUTH_SECRET phải có ít nhất 32 ký tự");
  return new TextEncoder().encode(secret);
}

export async function signSession(payload: SessionPayload) {
  return new SignJWT(payload)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${MAX_AGE}s`)
    .sign(key());
}

export async function verifySession(token: string | undefined): Promise<SessionPayload | null> {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, key());
    return typeof payload.userId === "string" ? { userId: payload.userId } : null;
  } catch {
    return null;
  }
}

export const cookieOptions = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax" as const,
  path: "/",
  maxAge: MAX_AGE,
};

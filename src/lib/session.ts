import { SignJWT, jwtVerify } from "jose";

export const SESSION_COOKIE = "session";
const MAX_AGE = 60 * 60 * 24 * 7; // 7 ngày

/** mcp = must change password: buộc đổi mật khẩu trước khi dùng hệ thống */
export type SessionPayload = { userId: string; mcp?: boolean };

export const AUTH_SECRET_ERROR =
  "Máy chủ chưa cấu hình AUTH_SECRET (chuỗi ngẫu nhiên ≥ 32 ký tự). Quản trị: thêm biến này trên Vercel → Settings → Environment Variables rồi Redeploy.";

/** Khoá ký phiên đăng nhập đã cấu hình hợp lệ chưa */
export function authSecretReady() {
  return (process.env.AUTH_SECRET?.trim().length ?? 0) >= 32;
}

function key() {
  if (!authSecretReady()) throw new Error(AUTH_SECRET_ERROR);
  return new TextEncoder().encode(process.env.AUTH_SECRET!.trim());
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
    return typeof payload.userId === "string" ? { userId: payload.userId, mcp: payload.mcp === true } : null;
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

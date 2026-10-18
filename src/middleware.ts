import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE, verifySession } from "@/lib/session";

export async function middleware(req: NextRequest) {
  const session = await verifySession(req.cookies.get(SESSION_COOKIE)?.value);
  const path = req.nextUrl.pathname;
  const isLogin = path.startsWith("/login");
  if (!session && !isLogin) return NextResponse.redirect(new URL("/login", req.url));
  if (session && isLogin) return NextResponse.redirect(new URL("/dashboard", req.url));
  // Tài khoản mới / vừa đặt lại mật khẩu: bắt buộc đổi mật khẩu trước khi dùng hệ thống
  if (session?.mcp && path !== "/account" && req.method === "GET") {
    return NextResponse.redirect(new URL("/account", req.url));
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};

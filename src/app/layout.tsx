import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Quản lý lớp chủ nhiệm",
  description: "Hệ thống quản lý học sinh lớp chủ nhiệm cho nhiều trường",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="vi">
      <body>{children}</body>
    </html>
  );
}

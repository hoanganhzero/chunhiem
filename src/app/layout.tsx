import type { Metadata, Viewport } from "next";
import "@fontsource/be-vietnam-pro/400.css";
import "@fontsource/be-vietnam-pro/500.css";
import "@fontsource/be-vietnam-pro/600.css";
import "@fontsource/be-vietnam-pro/700.css";
import "./globals.css";
import { PwaClient } from "@/components/PwaClient";

export const metadata: Metadata = {
  title: { default: "Sổ Chủ Nhiệm", template: "%s · Sổ Chủ Nhiệm" },
  description: "Quản lý lớp chủ nhiệm: điểm danh, sổ điểm, liên lạc phụ huynh, báo cáo — cho trường THPT và trung tâm GDNN-GDTX",
  applicationName: "Sổ Chủ Nhiệm",
  appleWebApp: { capable: true, title: "Sổ Chủ Nhiệm", statusBarStyle: "black-translucent" },
  formatDetection: { telephone: false },
  icons: {
    icon: [{ url: "/icons/icon-192.png", sizes: "192x192", type: "image/png" }, { url: "/icons/favicon-32.png", sizes: "32x32", type: "image/png" }],
    apple: [{ url: "/icons/apple-touch-icon.png", sizes: "180x180" }],
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#0f1b38",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="vi">
      <body>
        {children}
        <PwaClient />
      </body>
    </html>
  );
}

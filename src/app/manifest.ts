import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/",
    name: "Sổ Chủ Nhiệm — Quản lý lớp chủ nhiệm",
    short_name: "Sổ Chủ Nhiệm",
    description: "Điểm danh, sổ điểm, liên lạc phụ huynh, báo cáo — cho giáo viên, học sinh, phụ huynh và nhà trường",
    lang: "vi",
    start_url: "/dashboard?source=pwa",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#0f1b38",
    theme_color: "#0f1b38",
    categories: ["education", "productivity"],
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
    shortcuts: [
      { name: "Trang chủ", url: "/dashboard?source=shortcut", icons: [{ src: "/icons/icon-192.png", sizes: "192x192" }] },
      { name: "Đổi mật khẩu", url: "/account", icons: [{ src: "/icons/icon-192.png", sizes: "192x192" }] },
    ],
  };
}

"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { BookMarked, Share, X } from "lucide-react";

type BeforeInstallPromptEvent = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: string }> };

const DISMISS_KEY = "install-dismissed-at";

function dismissedRecently() {
  try {
    const at = Number(localStorage.getItem(DISMISS_KEY) ?? 0);
    return Date.now() - at < 14 * 86400000; // ẩn 14 ngày sau khi bấm "Để sau"
  } catch {
    return false;
  }
}

/** Đăng ký service worker, gợi ý cài ứng dụng (Android/máy tính: nút Cài; iPhone: hướng dẫn), báo mất mạng. */
/** Chỉ gợi ý cài ở màn hình chính — không che nút thao tác ở các trang đăng nhập / nhập liệu. */
const isHome = (p: string) => p === "/dashboard" || /^\/portal\/[^/]+$/.test(p);

export function PwaClient() {
  const path = usePathname();
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null);
  const [ios, setIos] = useState(false);
  const [offline, setOffline] = useState(false);

  useEffect(() => {
    if ("serviceWorker" in navigator && process.env.NODE_ENV === "production") {
      navigator.serviceWorker.register("/sw.js").catch(() => {});
    }
    const standalone =
      window.matchMedia("(display-mode: standalone)").matches || (navigator as unknown as { standalone?: boolean }).standalone;
    const onPrompt = (e: Event) => {
      e.preventDefault();
      if (!standalone && !dismissedRecently()) setDeferred(e as BeforeInstallPromptEvent);
    };
    window.addEventListener("beforeinstallprompt", onPrompt);
    const isIos = /iphone|ipad|ipod/i.test(navigator.userAgent) && !/crios|fxios/i.test(navigator.userAgent);
    if (isIos && !standalone && !dismissedRecently()) setIos(true);

    const net = () => setOffline(!navigator.onLine);
    net();
    window.addEventListener("online", net);
    window.addEventListener("offline", net);
    return () => {
      window.removeEventListener("beforeinstallprompt", onPrompt);
      window.removeEventListener("online", net);
      window.removeEventListener("offline", net);
    };
  }, []);

  const dismiss = () => {
    try { localStorage.setItem(DISMISS_KEY, String(Date.now())); } catch {}
    setDeferred(null);
    setIos(false);
  };

  return (
    <>
      {offline && <div className="offline-bar" role="status">Đang ngoại tuyến — kiểm tra kết nối mạng</div>}
      {(deferred || ios) && isHome(path) && (
        <div className="install" role="dialog" aria-label="Cài đặt ứng dụng">
          <div className="brand-logo"><BookMarked size={22} /></div>
          <div className="i-text">
            <strong>Cài ứng dụng lên điện thoại</strong>
            {deferred ? (
              "Mở nhanh từ màn hình chính như app."
            ) : (
              <>Bấm <Share size={14} style={{ verticalAlign: -2 }} /> rồi chọn <b>“Thêm vào MH chính”</b></>
            )}
          </div>
          {deferred && (
            <button
              className="sm"
              onClick={async () => {
                await deferred.prompt();
                await deferred.userChoice;
                setDeferred(null);
              }}
            >
              Cài đặt
            </button>
          )}
          <button className="ghost sm" onClick={dismiss} aria-label="Để sau"><X size={18} /></button>
        </div>
      )}
    </>
  );
}

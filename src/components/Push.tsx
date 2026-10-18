"use client";

import { useEffect, useState } from "react";
import { Bell, BellOff, X } from "lucide-react";
import { removePushSubscription, savePushSubscription, sendTestPush } from "@/actions/notify";

function urlB64ToUint8Array(base64: string) {
  const pad = "=".repeat((4 - (base64.length % 4)) % 4);
  const raw = atob((base64 + pad).replace(/-/g, "+").replace(/_/g, "/"));
  return Uint8Array.from(raw, (c) => c.charCodeAt(0));
}

type State = "loading" | "unsupported" | "ios-install" | "denied" | "off" | "on";

function isIos() {
  return /iphone|ipad|ipod/i.test(navigator.userAgent);
}
function isStandalone() {
  return window.matchMedia("(display-mode: standalone)").matches || (navigator as unknown as { standalone?: boolean }).standalone === true;
}

/** Trạng thái thông báo đẩy trên thiết bị này + bật / tắt. */
function usePush(vapidKey: string) {
  const [state, setState] = useState<State>("loading");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    (async () => {
      if (!("serviceWorker" in navigator) || !("PushManager" in window) || !("Notification" in window)) {
        // iPhone chỉ hỗ trợ thông báo đẩy khi đã "Thêm vào MH chính" (iOS 16.4+)
        setState(isIos() && !isStandalone() ? "ios-install" : "unsupported");
        return;
      }
      if (Notification.permission === "denied") return setState("denied");
      const reg = await navigator.serviceWorker.getRegistration();
      const sub = await reg?.pushManager.getSubscription();
      setState(sub ? "on" : "off");
    })().catch(() => setState("unsupported"));
  }, []);

  const enable = async () => {
    setBusy(true); setError("");
    try {
      const perm = await Notification.requestPermission();
      if (perm !== "granted") { setState(perm === "denied" ? "denied" : "off"); return; }
      const reg = (await navigator.serviceWorker.getRegistration()) ?? (await navigator.serviceWorker.register("/sw.js"));
      await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: urlB64ToUint8Array(vapidKey) });
      const res = await savePushSubscription(sub.toJSON(), navigator.userAgent);
      if ("error" in res) throw new Error(res.error);
      setState("on");
    } catch (e) {
      const m = e instanceof Error ? e.message : "";
      setError(
        /permission/i.test(m)
          ? "Thiết bị chưa cho phép nhận thông báo. Kiểm tra Cài đặt → Thông báo của trình duyệt / điện thoại (chế độ ẩn danh không hỗ trợ)."
          : /push service|network|abort/i.test(m)
            ? "Không kết nối được dịch vụ thông báo của điện thoại. Kiểm tra mạng rồi thử lại."
            : m || "Không bật được thông báo",
      );
    } finally {
      setBusy(false);
    }
  };
  const disable = async () => {
    setBusy(true);
    try {
      const reg = await navigator.serviceWorker.getRegistration();
      const sub = await reg?.pushManager.getSubscription();
      if (sub) { await removePushSubscription(sub.endpoint); await sub.unsubscribe(); }
      setState("off");
    } finally {
      setBusy(false);
    }
  };
  return { state, busy, error, enable, disable };
}

/** Khối cài đặt trong trang Tài khoản. */
export function PushSettings({ vapidKey }: { vapidKey: string }) {
  const { state, busy, error, enable, disable } = usePush(vapidKey);
  const [test, setTest] = useState("");
  if (!vapidKey) return <p className="small muted">Máy chủ chưa cấu hình thông báo đẩy (khoá VAPID).</p>;
  return (
    <div>
      {state === "loading" && <p className="small muted">Đang kiểm tra…</p>}
      {state === "unsupported" && <p className="small muted">Trình duyệt này không hỗ trợ thông báo đẩy. Hãy dùng Chrome / Edge / Safari mới, hoặc cài ứng dụng lên màn hình chính.</p>}
      {state === "ios-install" && <div className="alert info">Trên iPhone / iPad: bấm <b>Chia sẻ</b> → <b>Thêm vào MH chính</b>, mở ứng dụng từ màn hình chính rồi bật thông báo tại đây (cần iOS 16.4 trở lên).</div>}
      {state === "denied" && <div className="alert warn">Bạn đã chặn thông báo. Vào cài đặt trình duyệt / điện thoại → Thông báo → cho phép trang này, rồi tải lại trang.</div>}
      {state === "off" && (
        <button onClick={enable} disabled={busy}><Bell size={18} /> {busy ? "Đang bật…" : "Bật thông báo trên thiết bị này"}</button>
      )}
      {state === "on" && (
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
          <span className="badge ok">Đã bật trên thiết bị này</span>
          <button className="secondary sm" disabled={busy} onClick={async () => { const r = await sendTestPush(); setTest(r.ok ?? r.error ?? ""); }}>Gửi thử</button>
          <button className="ghost sm" disabled={busy} onClick={disable}><BellOff size={16} /> Tắt</button>
          {test && <span className="small muted">{test}</span>}
        </div>
      )}
      {error && <div className="alert error" style={{ marginTop: 8 }}>{error}</div>}
    </div>
  );
}

const DISMISS = "push-banner-dismissed-at";

/** Lời mời bật thông báo ở trang chủ (ẩn khi đã bật / không hỗ trợ / bấm "Để sau"). */
export function PushBanner({ vapidKey, text }: { vapidKey: string; text: string }) {
  const { state, busy, error, enable } = usePush(vapidKey);
  const [hidden, setHidden] = useState(true);
  useEffect(() => {
    try { setHidden(Date.now() - Number(localStorage.getItem(DISMISS) ?? 0) < 7 * 86400000); } catch { setHidden(false); }
  }, []);
  if (!vapidKey || hidden || !["off", "ios-install"].includes(state)) return null;
  return (
    <div className="card push-banner">
      <div className="stat-icon"><Bell size={22} /></div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <strong>Nhận thông báo trên điện thoại</strong>
        <div className="small muted">{state === "ios-install" ? "Trên iPhone: Chia sẻ → Thêm vào MH chính, mở ứng dụng rồi bật thông báo." : text}</div>
        {error && <div className="small" style={{ color: "var(--danger)" }}>{error}</div>}
      </div>
      {state === "off" && <button className="sm" onClick={enable} disabled={busy}>{busy ? "Đang bật…" : "Bật"}</button>}
      <button className="ghost sm" aria-label="Để sau" onClick={() => { try { localStorage.setItem(DISMISS, String(Date.now())); } catch {} setHidden(true); }}><X size={18} /></button>
    </div>
  );
}

import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { NOTIFY_KINDS, type NotifyKind } from "@/lib/notify";
import { Empty, PageHeader } from "@/components/ui";
import { MarkRead } from "@/components/MarkRead";

export const metadata = { title: "Thông báo" };

export default async function NotificationsPage() {
  const user = await requireUser();
  const list = await db.notification.findMany({ where: { userId: user.id }, orderBy: { createdAt: "desc" }, take: 100 });
  const unread = list.filter((n) => !n.read).length;

  const day = (d: Date) => d.toLocaleDateString("vi-VN", { timeZone: "Asia/Ho_Chi_Minh", weekday: "long", day: "numeric", month: "numeric" });
  const groups = list.reduce<[string, typeof list][]>((acc, n) => {
    const k = day(n.createdAt);
    const last = acc[acc.length - 1];
    if (last?.[0] === k) last[1].push(n); else acc.push([k, [n]]);
    return acc;
  }, []);
  return (
    <>
      <PageHeader
        title="Thông báo"
        sub={unread ? `${unread} thông báo mới` : "Không có thông báo mới"}
        actions={<Link className="btn secondary" href="/account">Cài đặt thông báo</Link>}
      />
      <MarkRead unread={unread} />
      <div className="card">
        {list.length === 0 ? <Empty>Chưa có thông báo.</Empty> : groups.map(([d, items]) => (
          <div key={d} style={{ marginBottom: 12 }}>
            <div className="small muted" style={{ fontWeight: 600, textTransform: "capitalize", marginBottom: 4 }}>{d}</div>
            {items.map((n) => (
              <Link key={n.id} href={n.url ?? "/dashboard"} className={`noti ${n.read ? "" : "unread"}`}>
                <div className="li-body">
                  <div className="li-title">{n.title}</div>
                  <div className="li-text">{n.body}</div>
                  <div className="li-meta">
                    {n.createdAt.toLocaleTimeString("vi-VN", { timeZone: "Asia/Ho_Chi_Minh", hour: "2-digit", minute: "2-digit" })}
                    {" · "}{NOTIFY_KINDS[n.kind as NotifyKind] ?? ""}
                  </div>
                </div>
              </Link>
            ))}
          </div>
        ))}
      </div>
    </>
  );
}

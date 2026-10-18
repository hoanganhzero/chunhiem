import { requireUser } from "@/lib/auth";
import { roleLabel } from "@/lib/constants";
import { buildNav } from "@/lib/nav";
import { db } from "@/lib/db";
import { logout } from "@/actions/auth";
import { AppShell } from "@/components/AppShell";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();
  const [nav, unread] = await Promise.all([
    buildNav(user),
    db.notification.count({ where: { userId: user.id, read: false } }),
  ]);
  return (
    <AppShell
      nav={nav}
      user={{ name: user.name, role: roleLabel(user.role, user.schoolType) }}
      unitName={user.schoolName ?? "Quản trị hệ thống"}
      unread={unread}
      logout={logout}
    >
      {children}
    </AppShell>
  );
}

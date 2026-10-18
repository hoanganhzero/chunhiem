import { requireUser } from "@/lib/auth";
import { roleLabel } from "@/lib/constants";
import { buildNav } from "@/lib/nav";
import { logout } from "@/actions/auth";
import { AppShell } from "@/components/AppShell";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();
  const nav = await buildNav(user);
  return (
    <AppShell
      nav={nav}
      user={{ name: user.name, role: roleLabel(user.role, user.schoolType) }}
      unitName={user.schoolName ?? "Quản trị hệ thống"}
      logout={logout}
    >
      {children}
    </AppShell>
  );
}

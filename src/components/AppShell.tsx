"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { BookMarked, KeyRound, LogOut } from "lucide-react";
import { Icon } from "./Icon";
import type { Nav, NavItem } from "@/lib/nav";

type Props = {
  nav: Nav;
  user: { name: string; role: string };
  unitName: string;
  logout: () => Promise<void>;
  children: React.ReactNode;
};

export const APP_NAME = "Sổ Chủ Nhiệm";

function initials(name: string) {
  const p = name.trim().split(/\s+/);
  return ((p.length > 1 ? p[p.length - 2][0] : "") + p[p.length - 1][0]).toUpperCase();
}

/** Mục đang mở: khớp đường dẫn dài nhất (để /classes/x không sáng cùng /classes/x/grades). */
function useActive(items: NavItem[]) {
  const path = usePathname();
  const match = items
    .filter((i) => (i.exact ? path === i.href : path === i.href || path.startsWith(i.href + "/")))
    .sort((a, b) => b.href.length - a.href.length)[0];
  return match?.href;
}

export function AppShell({ nav, user, unitName, logout, children }: Props) {
  const [open, setOpen] = useState(false);
  const path = usePathname();
  const all = nav.groups.flatMap((g) => g.items);
  const active = useActive([...all, ...nav.bottom]);
  useEffect(() => {
    setOpen(false);
    // Đưa tab đang mở (thanh tab cuộn ngang của lớp) vào giữa màn hình
    document.querySelector(".tabs a.active")?.scrollIntoView({ inline: "center", block: "nearest" });
  }, [path]);

  return (
    <div className="shell">
      <header className="topbar">
        <div className="brand-logo"><BookMarked size={18} /></div>
        <div className="t-main">
          <div className="t-title">{APP_NAME}</div>
          <div className="t-sub">{unitName}</div>
        </div>
        <Link href="/account" className="avatar" aria-label="Tài khoản">{initials(user.name)}</Link>
      </header>

      <div className={`sheet-backdrop ${open ? "open" : ""}`} onClick={() => setOpen(false)} />
      <nav className={`sidebar ${open ? "open" : ""}`} aria-label="Menu chính">
        <div className="brand">
          <div className="brand-logo"><BookMarked size={20} /></div>
          <div>
            <div className="brand-name">{APP_NAME}</div>
            <div className="brand-sub">{unitName}</div>
          </div>
        </div>
        <div className="nav-scroll">
          {nav.groups.map((g, i) => (
            <div key={i}>
              {g.title && <div className="nav-group-title">{g.title}</div>}
              {g.items.map((it) => (
                <Link key={it.href} href={it.href} className={`nav-link ${active === it.href ? "active" : ""}`}>
                  <Icon name={it.icon} size={19} />
                  <span>{it.label}</span>
                  {it.badge ? <span className="nav-badge">{it.badge}</span> : null}
                </Link>
              ))}
            </div>
          ))}
        </div>
        <div className="nav-user">
          <div className="avatar">{initials(user.name)}</div>
          <div className="who">
            <div className="name">{user.name}</div>
            <div className="role">{user.role}</div>
          </div>
          <Link href="/account" className="icon-btn" title="Đổi mật khẩu" aria-label="Đổi mật khẩu"><KeyRound size={18} /></Link>
          <form action={logout}>
            <button className="icon-btn" title="Đăng xuất" aria-label="Đăng xuất"><LogOut size={18} /></button>
          </form>
        </div>
      </nav>

      <main className="main">{children}</main>

      <nav className="bottom-nav" aria-label="Điều hướng nhanh">
        {nav.bottom.map((it) => (
          <Link key={it.href + it.label} href={it.href} className={active === it.href ? "active" : ""}>
            <span className="bn-icon"><Icon name={it.icon} size={21} /></span>
            {it.label}
            {it.badge ? <span className="bn-badge">{it.badge}</span> : null}
          </Link>
        ))}
        <button type="button" onClick={() => setOpen(true)} className={open ? "active" : ""} aria-label="Mở menu đầy đủ">
          <span className="bn-icon"><Icon name="more" size={21} /></span>
          Thêm
        </button>
      </nav>
    </div>
  );
}

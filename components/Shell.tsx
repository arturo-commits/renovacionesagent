"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, type ReactNode } from "react";
import { Icon } from "./Icon";

type NavItem = { href: string; label: string; icon: string };

export function Shell({
  logo,
  sections,
  topRight,
  children,
}: {
  logo: ReactNode;
  sections: { label?: string; items: NavItem[] }[];
  topRight: ReactNode;
  children: ReactNode;
}) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const isActive = (href: string) => pathname === href || (href !== "/inicio" && pathname.startsWith(href + "/"));

  return (
    <div className={`shell ${open ? "menu-open" : ""}`}>
      <aside className="sidebar" onClick={() => setOpen(false)}>
        {logo}
        {sections.map((s, i) => (
          <nav className="nav" key={i}>
            {s.label && <div className="nav-label">{s.label}</div>}
            {s.items.map((it) => (
              <Link key={it.href} href={it.href} className={isActive(it.href) ? "active" : ""}>
                <Icon name={it.icon} />
                {it.label}
              </Link>
            ))}
          </nav>
        ))}
        <div className="sidebar-foot">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/illustrations/mapachin-birrete.svg" alt="" />
          Formación interna de Tuio
        </div>
      </aside>
      <div className="main">
        <header className="topbar">
          <button className="btn ghost sm menu-toggle" onClick={() => setOpen((o) => !o)} aria-label="Abrir menú">
            <Icon name="menu" />
          </button>
          <div />
          {topRight}
        </header>
        <main className="content">{children}</main>
      </div>
    </div>
  );
}

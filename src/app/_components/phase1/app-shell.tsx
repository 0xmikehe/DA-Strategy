import Link from "next/link";
import React from "react";
import type { ReactNode } from "react";
import { StatusBadge } from "./status-badge";

type ActiveSection = "home" | "market" | "ledger";

type AppShellProps = {
  active: ActiveSection;
  title: string;
  context: string;
  children: ReactNode;
};

const navItems = [
  { href: "/", key: "home", label: "H", title: "首页" },
  { href: "/market", key: "market", label: "M", title: "市场页" },
  { href: "/ledger", key: "ledger", label: "L", title: "账本页" }
] satisfies Array<{ href: string; key: ActiveSection; label: string; title: string }>;

export function AppShell({ active, title, context, children }: AppShellProps) {
  return (
    <div className="workspace-shell">
      <nav className="side-rail" aria-label="主导航">
        <Link className="nav-mark" href="/" aria-label="Digital Asset OS" />
        {navItems.map((item) => (
          <Link
            aria-label={item.title}
            className={item.key === active ? "rail-link is-active" : "rail-link"}
            href={item.href}
            key={item.key}
          >
            {item.label}
          </Link>
        ))}
      </nav>
      <div className="workspace">
        <header className="topbar">
          <div className="topbar-inner">
            <div className="topbar-left">
              <div className="context-title">{title}</div>
              <div className="mini-stat">{context}</div>
            </div>
            <div className="topbar-right">
              <StatusBadge tone="good">fixture_synced</StatusBadge>
              <StatusBadge tone="frozen">snapshot sealed</StatusBadge>
            </div>
          </div>
        </header>
        {children}
      </div>
    </div>
  );
}

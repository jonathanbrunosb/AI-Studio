"use client";

import { useState } from "react";
import { Sidebar } from "./sidebar";
import { Topbar } from "./topbar";
import type { AppRole } from "@/lib/auth/authorization";
import type { NotificationItem } from "./notification-bell";

export function AppShell({ children, user, notifications }: { children: React.ReactNode; user: { fullName: string; email: string; roles: AppRole[] }; notifications: { items: NotificationItem[]; unread: number } }) {
  const [collapsed, setCollapsed] = useState(() =>
    typeof window !== "undefined" && window.localStorage.getItem("ai-studio-sidebar") === "collapsed",
  );
  const [mobileOpen, setMobileOpen] = useState(false);

  function toggleSidebar() {
    setCollapsed((current) => {
      window.localStorage.setItem("ai-studio-sidebar", current ? "expanded" : "collapsed");
      return !current;
    });
  }

  return (
    <div className="min-h-screen bg-[var(--canvas)]">
      <Sidebar collapsed={collapsed} mobileOpen={mobileOpen} onCloseMobile={() => setMobileOpen(false)} onToggle={toggleSidebar} roles={user.roles} />
      <div className={`min-h-screen transition-[padding] duration-300 ${collapsed ? "lg:pl-[84px]" : "lg:pl-[268px]"}`}>
        <Topbar onOpenMobile={() => setMobileOpen(true)} user={user} notifications={notifications} />
        <main className="mx-auto w-full max-w-[1720px] p-4 md:p-6 lg:p-8">{children}</main>
      </div>
    </div>
  );
}

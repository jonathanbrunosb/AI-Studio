"use client";

import { useState } from "react";
import { Sidebar } from "./sidebar";
import { Topbar } from "./topbar";

export function AppShell({ children }: { children: React.ReactNode }) {
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
      <Sidebar collapsed={collapsed} mobileOpen={mobileOpen} onCloseMobile={() => setMobileOpen(false)} onToggle={toggleSidebar} />
      <div className={`min-h-screen transition-[padding] duration-300 ${collapsed ? "lg:pl-[84px]" : "lg:pl-[268px]"}`}>
        <Topbar onOpenMobile={() => setMobileOpen(true)} />
        <main className="mx-auto w-full max-w-[1720px] p-4 md:p-6 lg:p-8">{children}</main>
      </div>
    </div>
  );
}

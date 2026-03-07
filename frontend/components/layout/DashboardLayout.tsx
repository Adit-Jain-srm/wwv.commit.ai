"use client";

import { usePathname } from "next/navigation";
import { TopNavWithData } from "./TopNavWithData";
import { SidebarNav } from "./SidebarNav";

interface DashboardLayoutProps {
  children: React.ReactNode;
}

export function DashboardLayout({ children }: DashboardLayoutProps) {
  const pathname = usePathname();
  const activeNav = pathname === "/" ? "dashboard" : pathname.replace("/", "") || "dashboard";

  return (
    <div className="min-h-screen flex flex-col">
      <TopNavWithData />
      <div className="flex flex-1 overflow-hidden">
        <SidebarNav active={activeNav} />
        <main className="flex-1 overflow-y-auto bg-slate-950">
          {children}
        </main>
      </div>
    </div>
  );
}

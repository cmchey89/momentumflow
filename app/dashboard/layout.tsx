"use client";
import { useEffect, useRef, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import Link from "next/link";
import {
  LayoutDashboard, FolderKanban, CheckSquare,
  MessageSquare, LogOut, Layers, Users, BarChart2, Settings, Receipt,
  PanelLeftClose, PanelLeftOpen,
} from "lucide-react";
import ChangeLogSidePanel from "./ChangeLogSidePanel";

interface Me { id: string; email: string; name: string; role: string; team: string | null; }

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const [me, setMe] = useState<Me | null>(null);
  const router = useRouter();
  const pathname = usePathname();

  const projectDetailMatch = pathname?.match(/^\/dashboard\/projects\/([^/]+)$/);
  const isProjectDetail = !!projectDetailMatch;
  const projectId = projectDetailMatch?.[1];

  const [collapsed, setCollapsed] = useState(false);
  const wasProjectDetail = useRef(false);
  useEffect(() => {
    // Auto-collapse the moment you enter a project (not on every tab click
    // within it) -- once inside, the manual toggle is free to do its thing.
    if (isProjectDetail && !wasProjectDetail.current) setCollapsed(true);
    wasProjectDetail.current = isProjectDetail;
  }, [isProjectDetail]);

  useEffect(() => {
    fetch("/api/auth/me")
      .then(r => r.ok ? r.json() : Promise.reject())
      .then(d => setMe(d.user))
      .catch(() => router.push("/"));
  }, [router]);

  const signOut = async () => {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/");
  };

  if (!me) return null;

  const nav = [
    { href: "/dashboard", label: "Overview", icon: LayoutDashboard },
    { href: "/dashboard/board", label: "Team Board", icon: Layers },
    { href: "/dashboard/projects", label: "Projects", icon: FolderKanban },
    { href: "/dashboard/tasks", label: "My Tasks", icon: CheckSquare },
    { href: "/dashboard/workload", label: "Workload", icon: Users },
    { href: "/dashboard/chat", label: "Chat", icon: MessageSquare },
    { href: "/dashboard/report", label: "Year-End Report", icon: BarChart2 },
    ...(me.role === "superadmin" || me.role === "manager" ? [{ href: "/dashboard/rate-catalog", label: "Rate Catalog", icon: Receipt }] : []),
    ...(me.role === "superadmin" || me.role === "manager" ? [{ href: "/dashboard/admin", label: "Admin", icon: Settings }] : []),
  ];

  return (
    <div className="flex h-screen bg-gray-50">
      <aside className={`bg-white border-r border-gray-200 flex flex-col flex-shrink-0 transition-all duration-150 ${collapsed ? "w-16" : "w-64"}`}>
        <div className={`border-b border-gray-200 flex items-center ${collapsed ? "flex-col gap-2 py-4" : "justify-between p-6"}`}>
          {collapsed ? (
            <h1 className="text-xl font-bold text-blue-600" title="MomentumFlow">M</h1>
          ) : (
            <div className="min-w-0">
              <h1 className="text-xl font-bold text-blue-600">MomentumFlow</h1>
              <p className="text-sm text-gray-500 mt-1 truncate">{me.name || me.email}</p>
              <div className="flex items-center gap-1 mt-1 flex-wrap">
                {me.role === "superadmin" && <span className="text-xs bg-purple-100 text-purple-700 px-2 py-0.5 rounded-full font-medium">Super Admin</span>}
                {me.role === "manager" && <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full font-medium">Manager</span>}
                {me.team && <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full font-medium capitalize">{me.team}</span>}
              </div>
            </div>
          )}
          <button onClick={() => setCollapsed(v => !v)} title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            className="text-gray-400 hover:text-gray-600 flex-shrink-0">
            {collapsed ? <PanelLeftOpen className="w-4 h-4" /> : <PanelLeftClose className="w-4 h-4" />}
          </button>
        </div>
        <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
          {nav.map(({ href, label, icon: Icon }) => (
            <Link key={href} href={href} title={collapsed ? label : undefined}
              className={`flex items-center rounded-lg text-sm font-medium transition-colors ${collapsed ? "justify-center px-2 py-2.5" : "gap-3 px-3 py-2"} ${
                pathname === href ? "bg-blue-50 text-blue-700" : "text-gray-600 hover:bg-gray-100"
              }`}
            >
              <Icon className="w-4 h-4 flex-shrink-0" />
              {!collapsed && label}
            </Link>
          ))}
        </nav>
        <div className="p-4 border-t border-gray-200">
          <button onClick={signOut} title={collapsed ? "Sign Out" : undefined}
            className={`flex items-center w-full rounded-lg text-sm font-medium text-gray-600 hover:bg-gray-100 transition-colors ${collapsed ? "justify-center px-2 py-2.5" : "gap-3 px-3 py-2"}`}
          >
            <LogOut className="w-4 h-4 flex-shrink-0" />
            {!collapsed && "Sign Out"}
          </button>
        </div>
      </aside>
      {isProjectDetail && collapsed && projectId && <ChangeLogSidePanel projectId={projectId} />}
      <main className="flex-1 overflow-auto">{children}</main>
    </div>
  );
}

"use client";
import { useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import Link from "next/link";
import {
  LayoutDashboard, FolderKanban, CheckSquare,
  MessageSquare, LogOut, Layers, Users, BarChart2, Settings,
} from "lucide-react";

interface Me { id: string; email: string; name: string; role: string; team: string | null; }

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const [me, setMe] = useState<Me | null>(null);
  const router = useRouter();
  const pathname = usePathname();

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
    ...(me.role === "superadmin" || me.role === "manager" ? [{ href: "/dashboard/admin", label: "Admin", icon: Settings }] : []),
  ];

  return (
    <div className="flex h-screen bg-gray-50">
      <aside className="w-64 bg-white border-r border-gray-200 flex flex-col">
        <div className="p-6 border-b border-gray-200">
          <h1 className="text-xl font-bold text-blue-600">TeamHub</h1>
          <p className="text-sm text-gray-500 mt-1 truncate">{me.name || me.email}</p>
          <div className="flex items-center gap-1 mt-1 flex-wrap">
            {me.role === "superadmin" && <span className="text-xs bg-purple-100 text-purple-700 px-2 py-0.5 rounded-full font-medium">Super Admin</span>}
            {me.role === "manager" && <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full font-medium">Manager</span>}
            {me.team && <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full font-medium capitalize">{me.team}</span>}
          </div>
        </div>
        <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
          {nav.map(({ href, label, icon: Icon }) => (
            <Link key={href} href={href}
              className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                pathname === href ? "bg-blue-50 text-blue-700" : "text-gray-600 hover:bg-gray-100"
              }`}
            >
              <Icon className="w-4 h-4" />
              {label}
            </Link>
          ))}
        </nav>
        <div className="p-4 border-t border-gray-200">
          <button onClick={signOut}
            className="flex items-center gap-3 px-3 py-2 w-full rounded-lg text-sm font-medium text-gray-600 hover:bg-gray-100 transition-colors"
          >
            <LogOut className="w-4 h-4" />
            Sign Out
          </button>
        </div>
      </aside>
      <main className="flex-1 overflow-auto">{children}</main>
    </div>
  );
}

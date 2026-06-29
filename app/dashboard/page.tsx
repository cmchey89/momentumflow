"use client";
import { useSession } from "next-auth/react";
import { useEffect, useState } from "react";
import { FolderKanban, CheckSquare, TrendingUp, Layers } from "lucide-react";
import Link from "next/link";

interface Stats {
  projects: number;
  tasks: { todo: number; in_progress: number; done: number };
  pending_handoffs: number;
}

export default function DashboardPage() {
  const { data: session } = useSession();
  const [stats, setStats] = useState<Stats | null>(null);

  useEffect(() => {
    fetch("/api/stats").then(r => r.json()).then(setStats);
  }, []);

  const taskTotal = stats ? stats.tasks.todo + stats.tasks.in_progress + stats.tasks.done : 0;
  const donePercent = taskTotal > 0 ? Math.round((stats!.tasks.done / taskTotal) * 100) : 0;

  return (
    <div className="p-8">
      <div className="mb-8">
        <h2 className="text-2xl font-bold text-gray-900">
          Welcome back, {session?.user?.name || "there"}
        </h2>
        <p className="text-gray-500 mt-1">Here&apos;s what&apos;s happening across all teams today.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
        <StatCard icon={<FolderKanban className="w-5 h-5 text-blue-600" />} label="Projects" value={stats?.projects ?? "—"} bg="bg-blue-50" />
        <StatCard icon={<CheckSquare className="w-5 h-5 text-yellow-600" />} label="In Progress" value={stats?.tasks.in_progress ?? "—"} bg="bg-yellow-50" />
        <StatCard icon={<CheckSquare className="w-5 h-5 text-green-600" />} label="Completed" value={stats?.tasks.done ?? "—"} bg="bg-green-50" />
        <StatCard icon={<TrendingUp className="w-5 h-5 text-purple-600" />} label="Done %" value={taskTotal > 0 ? `${donePercent}%` : "—"} bg="bg-purple-50" />
      </div>

      {stats?.pending_handoffs ? (
        <div className="mb-6 bg-amber-50 border border-amber-200 rounded-xl p-4 flex items-center gap-3">
          <Layers className="w-5 h-5 text-amber-600 flex-shrink-0" />
          <p className="text-sm text-amber-800 font-medium">
            {stats.pending_handoffs} task{stats.pending_handoffs > 1 ? "s" : ""} pending handoff — check the Team Board
          </p>
          <Link href="/dashboard/board" className="ml-auto text-xs text-amber-700 underline font-medium">View</Link>
        </div>
      ) : null}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <QuickLink href="/dashboard/board" icon={<Layers className="w-6 h-6 text-blue-600" />} title="Team Board" desc="All tasks across all teams" />
        <QuickLink href="/dashboard/projects" icon={<FolderKanban className="w-6 h-6 text-blue-600" />} title="Projects" desc="View and manage all team projects" />
        <QuickLink href="/dashboard/tasks" icon={<CheckSquare className="w-6 h-6 text-green-600" />} title="My Tasks" desc="See tasks assigned to you" />
      </div>
    </div>
  );
}

function StatCard({ icon, label, value, bg }: { icon: React.ReactNode; label: string; value: string | number; bg: string }) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-6">
      <div className={`w-10 h-10 rounded-lg ${bg} flex items-center justify-center mb-3`}>{icon}</div>
      <p className="text-sm text-gray-500">{label}</p>
      <p className="text-2xl font-bold text-gray-900 mt-1">{value}</p>
    </div>
  );
}

function QuickLink({ href, icon, title, desc }: { href: string; icon: React.ReactNode; title: string; desc: string }) {
  return (
    <Link href={href} className="bg-white rounded-xl border border-gray-200 p-6 hover:border-blue-300 hover:shadow-sm transition-all block">
      <div className="mb-3">{icon}</div>
      <h3 className="font-semibold text-gray-900">{title}</h3>
      <p className="text-sm text-gray-500 mt-1">{desc}</p>
    </Link>
  );
}

"use client";
import { useEffect, useState } from "react";
import { Circle, Clock, CheckSquare, AlertCircle, ArrowRightLeft } from "lucide-react";

type Team = "network" | "osp" | "finance" | "management";
type Status = "todo" | "in_progress" | "done";
type HandoffStatus = "active" | "pending" | "returned";

interface BoardTask {
  id: string;
  title: string;
  description: string | null;
  status: Status;
  priority: "low" | "medium" | "high";
  assignedTo: string | null;
  dueDate: string | null;
  sourceTeam: Team | null;
  currentTeam: Team | null;
  handoffStatus: HandoffStatus;
  projectName: string | null;
  projectId: string;
}

const TEAMS: Team[] = ["network", "osp", "finance", "management"];
const TEAM_COLORS: Record<Team, string> = {
  network: "bg-blue-100 text-blue-700",
  osp: "bg-pink-100 text-pink-700",
  finance: "bg-green-100 text-green-700",
  management: "bg-gray-100 text-gray-700",
};
const PRIORITY_COLORS = { low: "text-gray-400", medium: "text-yellow-500", high: "text-red-500" };
const HANDOFF_BADGE: Record<HandoffStatus, string> = {
  active: "",
  pending: "bg-amber-100 text-amber-700",
  returned: "bg-purple-100 text-purple-700",
};

export default function BoardPage() {
  const [tasks, setTasks] = useState<BoardTask[]>([]);
  const [filterTeam, setFilterTeam] = useState<Team | "all">("all");
  const [filterStatus, setFilterStatus] = useState<Status | "all">("all");
  const [handoffTaskId, setHandoffTaskId] = useState<string | null>(null);
  const [handoffTarget, setHandoffTarget] = useState<Team>("network");
  const [handoffNote, setHandoffNote] = useState("");
  const [sending, setSending] = useState(false);

  const load = () => fetch("/api/board").then(r => r.json()).then(setTasks);
  useEffect(() => { load(); }, []);

  const filtered = tasks.filter(t => {
    if (filterTeam !== "all" && t.currentTeam !== filterTeam && t.sourceTeam !== filterTeam) return false;
    if (filterStatus !== "all" && t.status !== filterStatus) return false;
    return true;
  });

  const sendHandoff = async () => {
    if (!handoffTaskId) return;
    setSending(true);
    await fetch(`/api/tasks/${handoffTaskId}/handoff`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ toTeam: handoffTarget, note: handoffNote }),
    });
    setHandoffTaskId(null);
    setHandoffNote("");
    setSending(false);
    load();
  };

  const pendingCount = tasks.filter(t => t.handoffStatus === "pending").length;

  return (
    <div className="p-8">
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-gray-900">Team Board</h2>
        <p className="text-gray-500 mt-1">All tasks across all teams and projects</p>
      </div>

      {pendingCount > 0 && (
        <div className="mb-4 bg-amber-50 border border-amber-200 rounded-lg px-4 py-3 text-sm text-amber-800 font-medium">
          {pendingCount} task{pendingCount > 1 ? "s" : ""} pending handoff
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-wrap gap-3 mb-6">
        <div className="flex items-center gap-2">
          <span className="text-xs font-medium text-gray-500">Team:</span>
          <button onClick={() => setFilterTeam("all")} className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${filterTeam === "all" ? "bg-gray-900 text-white" : "bg-white border border-gray-200 text-gray-600 hover:bg-gray-50"}`}>All</button>
          {TEAMS.map(t => (
            <button key={t} onClick={() => setFilterTeam(t)} className={`px-3 py-1.5 rounded-lg text-xs font-medium capitalize transition-colors ${filterTeam === t ? "bg-gray-900 text-white" : `${TEAM_COLORS[t]} hover:opacity-80`}`}>{t}</button>
          ))}
        </div>
        <div className="flex items-center gap-2 ml-4">
          <span className="text-xs font-medium text-gray-500">Status:</span>
          {(["all", "todo", "in_progress", "done"] as const).map(s => (
            <button key={s} onClick={() => setFilterStatus(s)} className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${filterStatus === s ? "bg-gray-900 text-white" : "bg-white border border-gray-200 text-gray-600 hover:bg-gray-50"}`}>
              {s === "all" ? "All" : s === "in_progress" ? "In Progress" : s === "todo" ? "To Do" : "Done"}
            </button>
          ))}
        </div>
      </div>

      {/* Task list */}
      <div className="space-y-2">
        {filtered.length === 0 && (
          <div className="text-center py-16 text-gray-400">
            <Layers className="w-12 h-12 mx-auto mb-3 opacity-30" />
            <p>No tasks match your filters.</p>
          </div>
        )}
        {filtered.map(task => (
          <div key={task.id} className={`bg-white border rounded-xl p-4 flex items-center gap-4 ${task.handoffStatus === "pending" ? "border-amber-200" : task.handoffStatus === "returned" ? "border-purple-200" : "border-gray-200"}`}>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <p className={`font-medium text-sm ${task.status === "done" ? "line-through text-gray-400" : "text-gray-900"}`}>{task.title}</p>
                {task.handoffStatus !== "active" && (
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${HANDOFF_BADGE[task.handoffStatus]}`}>
                    {task.handoffStatus === "pending" ? "Pending handoff" : "Returned"}
                  </span>
                )}
              </div>
              {task.description && <p className="text-xs text-gray-500 mt-0.5 truncate">{task.description}</p>}
              <div className="flex items-center gap-2 mt-2 flex-wrap">
                {task.sourceTeam && (
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium capitalize ${TEAM_COLORS[task.sourceTeam]}`}>From: {task.sourceTeam}</span>
                )}
                {task.currentTeam && task.currentTeam !== task.sourceTeam && (
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium capitalize ${TEAM_COLORS[task.currentTeam]}`}>At: {task.currentTeam}</span>
                )}
                <span className={`text-xs flex items-center gap-1 ${PRIORITY_COLORS[task.priority]}`}><AlertCircle className="w-3 h-3" />{task.priority}</span>
                {task.assignedTo && <span className="text-xs bg-blue-50 text-blue-600 px-2 py-0.5 rounded-full">{task.assignedTo}</span>}
                {task.dueDate && <span className={`text-xs ${new Date(task.dueDate) < new Date() && task.status !== "done" ? "text-red-500" : "text-gray-400"}`}>Due {new Date(task.dueDate).toLocaleDateString()}</span>}
                {task.projectName && <span className="text-xs text-gray-400">· {task.projectName}</span>}
              </div>
            </div>
            <div className="flex items-center gap-2 flex-shrink-0">
              <span className={`text-xs px-2 py-1 rounded-md font-medium ${
                task.status === "todo" ? "bg-gray-100 text-gray-600" :
                task.status === "in_progress" ? "bg-yellow-100 text-yellow-700" :
                "bg-green-100 text-green-700"
              }`}>
                {task.status === "todo" ? "To Do" : task.status === "in_progress" ? "In Progress" : "Done"}
              </span>
              {task.handoffStatus === "active" && task.status !== "done" && (
                <button onClick={() => setHandoffTaskId(task.id)} className="flex items-center gap-1 text-xs text-gray-500 hover:text-blue-600 border border-gray-200 hover:border-blue-300 px-2 py-1 rounded-lg transition-colors">
                  <ArrowRightLeft className="w-3 h-3" /> Hand off
                </button>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Handoff modal */}
      {handoffTaskId && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl p-6 w-full max-w-md shadow-xl">
            <h3 className="font-bold text-gray-900 mb-4 flex items-center gap-2"><ArrowRightLeft className="w-4 h-4 text-blue-600" /> Hand off to another team</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1.5">Send to team</label>
                <div className="flex gap-2 flex-wrap">
                  {TEAMS.map(t => (
                    <button key={t} onClick={() => setHandoffTarget(t)} className={`px-3 py-1.5 rounded-lg text-xs font-medium capitalize transition-colors ${handoffTarget === t ? "bg-gray-900 text-white" : `${TEAM_COLORS[t]} hover:opacity-80`}`}>{t}</button>
                  ))}
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1.5">Note (optional)</label>
                <textarea value={handoffNote} onChange={e => setHandoffNote(e.target.value)} rows={3} placeholder="What does the other team need to know or do?"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
            </div>
            <div className="flex gap-2 mt-5">
              <button onClick={sendHandoff} disabled={sending} className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50">
                {sending ? "Sending..." : "Send handoff"}
              </button>
              <button onClick={() => { setHandoffTaskId(null); setHandoffNote(""); }} className="border border-gray-300 px-4 py-2 rounded-lg text-sm font-medium hover:bg-gray-50">Cancel</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function Layers({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M6.429 9.75L2.25 12l4.179 2.25m0-4.5l5.571 3 5.571-3m-11.142 0L2.25 7.5 12 2.25l9.75 5.25-4.179 2.25m0 0L21.75 12l-4.179 2.25m0 0l4.179 2.25L12 21.75 2.25 16.5l4.179-2.25m11.142 0l-5.571 3-5.571-3" />
    </svg>
  );
}

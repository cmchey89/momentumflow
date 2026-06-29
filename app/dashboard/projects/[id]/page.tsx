"use client";
import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { Plus, CheckSquare, Clock, Circle, AlertCircle, Trash2, ArrowLeft, ArrowRightLeft, ChevronDown, ChevronUp } from "lucide-react";
import Link from "next/link";

type Team = "network" | "osp" | "finance" | "management";
type Status = "todo" | "in_progress" | "done";
type HandoffStatus = "active" | "pending" | "returned";

interface Task {
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
}

interface Handoff {
  id: string;
  fromTeam: Team;
  toTeam: Team;
  note: string | null;
  sentBy: string;
  status: "pending" | "resolved" | "returned";
  resolvedNote: string | null;
  resolvedBy: string | null;
  createdAt: string;
  resolvedAt: string | null;
}

interface Project {
  id: string;
  name: string;
  description: string | null;
}

const TEAMS: Team[] = ["network", "osp", "finance", "management"];
const TEAM_COLORS: Record<Team, string> = {
  network: "bg-blue-100 text-blue-700",
  osp: "bg-pink-100 text-pink-700",
  finance: "bg-green-100 text-green-700",
  management: "bg-gray-100 text-gray-700",
};
const statusLabels = { todo: "To Do", in_progress: "In Progress", done: "Done" };
const priorityColors = { low: "text-gray-400", medium: "text-yellow-500", high: "text-red-500" };

export default function ProjectDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [project, setProject] = useState<Project | null>(null);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [priority, setPriority] = useState<"low" | "medium" | "high">("medium");
  const [assignedTo, setAssignedTo] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [sourceTeam, setSourceTeam] = useState<Team | "">("");
  const [loading, setLoading] = useState(false);
  const [expandedTask, setExpandedTask] = useState<string | null>(null);
  const [handoffs, setHandoffs] = useState<Record<string, Handoff[]>>({});
  const [resolveModal, setResolveModal] = useState<{ taskId: string; handoffId: string } | null>(null);
  const [resolveNote, setResolveNote] = useState("");
  const [resolveAction, setResolveAction] = useState<"resolve" | "return">("resolve");

  const loadTasks = () => fetch(`/api/projects/${id}/tasks`).then(r => r.json()).then(setTasks);

  useEffect(() => {
    fetch(`/api/projects/${id}`).then(r => r.json()).then(setProject);
    loadTasks();
  }, [id]);

  const loadHandoffs = async (taskId: string) => {
    const data = await fetch(`/api/tasks/${taskId}/handoff`).then(r => r.json());
    setHandoffs(prev => ({ ...prev, [taskId]: data }));
  };

  const toggleExpand = (taskId: string) => {
    if (expandedTask === taskId) {
      setExpandedTask(null);
    } else {
      setExpandedTask(taskId);
      loadHandoffs(taskId);
    }
  };

  const createTask = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    await fetch(`/api/projects/${id}/tasks`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title, description, priority, assignedTo, dueDate, sourceTeam: sourceTeam || null, currentTeam: sourceTeam || null }),
    });
    setTitle(""); setDescription(""); setPriority("medium"); setAssignedTo(""); setDueDate(""); setSourceTeam("");
    setShowForm(false); setLoading(false);
    loadTasks();
  };

  const updateStatus = async (taskId: string, status: string) => {
    await fetch(`/api/tasks/${taskId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    loadTasks();
  };

  const deleteTask = async (taskId: string) => {
    if (!confirm("Delete this task?")) return;
    await fetch(`/api/tasks/${taskId}`, { method: "DELETE" });
    loadTasks();
  };

  const handleResolve = async () => {
    if (!resolveModal) return;
    await fetch(`/api/tasks/${resolveModal.taskId}/handoff`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ handoffId: resolveModal.handoffId, action: resolveAction, resolvedNote: resolveNote }),
    });
    setResolveModal(null);
    setResolveNote("");
    loadTasks();
    loadHandoffs(resolveModal.taskId);
  };

  const columns: Status[] = ["todo", "in_progress", "done"];

  return (
    <div className="p-8">
      <div className="mb-6">
        <Link href="/dashboard/projects" className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 mb-4">
          <ArrowLeft className="w-3 h-3" /> Back to Projects
        </Link>
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold text-gray-900">{project?.name}</h2>
            {project?.description && <p className="text-gray-500 mt-1">{project.description}</p>}
          </div>
          <button onClick={() => setShowForm(true)} className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 text-sm font-medium">
            <Plus className="w-4 h-4" /> Add Task
          </button>
        </div>
      </div>

      {showForm && (
        <form onSubmit={createTask} className="bg-white border border-gray-200 rounded-xl p-6 mb-6">
          <h3 className="font-semibold text-gray-900 mb-4">New Task</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <input value={title} onChange={e => setTitle(e.target.value)} required placeholder="Task title"
              className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 md:col-span-2" />
            <textarea value={description} onChange={e => setDescription(e.target.value)} placeholder="Description (optional)" rows={2}
              className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 md:col-span-2" />
            <select value={priority} onChange={e => setPriority(e.target.value as "low" | "medium" | "high")}
              className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
              <option value="low">Low Priority</option>
              <option value="medium">Medium Priority</option>
              <option value="high">High Priority</option>
            </select>
            <select value={sourceTeam} onChange={e => setSourceTeam(e.target.value as Team | "")}
              className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
              <option value="">Source team (optional)</option>
              {TEAMS.map(t => <option key={t} value={t} className="capitalize">{t.charAt(0).toUpperCase() + t.slice(1)}</option>)}
            </select>
            <input value={assignedTo} onChange={e => setAssignedTo(e.target.value)} placeholder="Assign to (name/initial)"
              className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            <input type="date" value={dueDate} onChange={e => setDueDate(e.target.value)}
              className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
          <div className="flex gap-2 mt-4">
            <button type="submit" disabled={loading} className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50">
              {loading ? "Adding..." : "Add Task"}
            </button>
            <button type="button" onClick={() => setShowForm(false)} className="border border-gray-300 px-4 py-2 rounded-lg text-sm font-medium hover:bg-gray-50">Cancel</button>
          </div>
        </form>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {columns.map(col => (
          <div key={col} className="bg-gray-100 rounded-xl p-4">
            <h3 className="font-semibold text-gray-700 mb-3 flex items-center gap-2">
              {col === "todo" && <Circle className="w-4 h-4 text-gray-400" />}
              {col === "in_progress" && <Clock className="w-4 h-4 text-yellow-500" />}
              {col === "done" && <CheckSquare className="w-4 h-4 text-green-500" />}
              {statusLabels[col]}
              <span className="ml-auto text-xs text-gray-400 font-normal">{tasks.filter(t => t.status === col).length}</span>
            </h3>
            <div className="space-y-3">
              {tasks.filter(t => t.status === col).map(task => (
                <div key={task.id} className={`bg-white rounded-lg border shadow-sm ${task.handoffStatus === "pending" ? "border-amber-300" : task.handoffStatus === "returned" ? "border-purple-300" : "border-gray-200"}`}>
                  <div className="p-4">
                    <div className="flex items-start justify-between gap-2">
                      <p className="font-medium text-gray-900 text-sm">{task.title}</p>
                      <button onClick={() => deleteTask(task.id)} className="text-gray-300 hover:text-red-500 flex-shrink-0"><Trash2 className="w-3.5 h-3.5" /></button>
                    </div>
                    {task.description && <p className="text-xs text-gray-500 mt-1">{task.description}</p>}
                    <div className="flex items-center gap-2 mt-2 flex-wrap">
                      {task.sourceTeam && (
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium capitalize ${TEAM_COLORS[task.sourceTeam]}`}>
                          {task.sourceTeam}
                        </span>
                      )}
                      {task.currentTeam && task.currentTeam !== task.sourceTeam && (
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium capitalize flex items-center gap-1 ${TEAM_COLORS[task.currentTeam]}`}>
                          <ArrowRightLeft className="w-2.5 h-2.5" />{task.currentTeam}
                        </span>
                      )}
                      {task.handoffStatus === "pending" && <span className="text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full font-medium">Pending</span>}
                      {task.handoffStatus === "returned" && <span className="text-xs bg-purple-100 text-purple-700 px-2 py-0.5 rounded-full font-medium">Returned</span>}
                      <span className={`text-xs flex items-center gap-1 ${priorityColors[task.priority]}`}><AlertCircle className="w-3 h-3" />{task.priority}</span>
                      {task.assignedTo && <span className="text-xs bg-blue-50 text-blue-600 px-2 py-0.5 rounded-full">{task.assignedTo}</span>}
                      {task.dueDate && <span className="text-xs text-gray-400">{new Date(task.dueDate).toLocaleDateString()}</span>}
                    </div>
                    <select value={task.status} onChange={e => updateStatus(task.id, e.target.value)}
                      className="mt-3 w-full text-xs border border-gray-200 rounded-md px-2 py-1 focus:outline-none focus:ring-1 focus:ring-blue-500">
                      <option value="todo">To Do</option>
                      <option value="in_progress">In Progress</option>
                      <option value="done">Done</option>
                    </select>
                    {/* Handoff trail toggle */}
                    <button onClick={() => toggleExpand(task.id)} className="mt-2 w-full flex items-center justify-center gap-1 text-xs text-gray-400 hover:text-gray-600 py-1">
                      {expandedTask === task.id ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                      Handoff trail
                    </button>
                  </div>

                  {/* Handoff trail */}
                  {expandedTask === task.id && (
                    <div className="border-t border-gray-100 px-4 pb-4 pt-3 bg-gray-50 rounded-b-lg">
                      {!handoffs[task.id] ? (
                        <p className="text-xs text-gray-400">Loading...</p>
                      ) : handoffs[task.id].length === 0 ? (
                        <p className="text-xs text-gray-400">No handoffs yet.</p>
                      ) : (
                        <div className="space-y-3">
                          {handoffs[task.id].map(h => (
                            <div key={h.id} className="text-xs">
                              <div className="flex items-center gap-1.5 flex-wrap">
                                <span className={`px-1.5 py-0.5 rounded font-medium capitalize ${TEAM_COLORS[h.fromTeam]}`}>{h.fromTeam}</span>
                                <ArrowRightLeft className="w-3 h-3 text-gray-400" />
                                <span className={`px-1.5 py-0.5 rounded font-medium capitalize ${TEAM_COLORS[h.toTeam]}`}>{h.toTeam}</span>
                                <span className={`px-1.5 py-0.5 rounded font-medium ${h.status === "pending" ? "bg-amber-100 text-amber-700" : h.status === "resolved" ? "bg-green-100 text-green-700" : "bg-purple-100 text-purple-700"}`}>{h.status}</span>
                                <span className="text-gray-400">by {h.sentBy} · {new Date(h.createdAt).toLocaleDateString()}</span>
                              </div>
                              {h.note && <p className="mt-1 text-gray-600 pl-1">"{h.note}"</p>}
                              {h.resolvedNote && <p className="mt-1 text-gray-500 pl-1">Reply: "{h.resolvedNote}" — {h.resolvedBy}</p>}
                              {h.status === "pending" && (
                                <button onClick={() => setResolveModal({ taskId: task.id, handoffId: h.id })}
                                  className="mt-2 text-xs bg-white border border-gray-200 px-2 py-1 rounded-md hover:bg-gray-50 text-gray-700">
                                  Respond to this handoff
                                </button>
                              )}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* Resolve/Return modal */}
      {resolveModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl p-6 w-full max-w-md shadow-xl">
            <h3 className="font-bold text-gray-900 mb-4">Respond to handoff</h3>
            <div className="space-y-4">
              <div className="flex gap-2">
                <button onClick={() => setResolveAction("resolve")} className={`flex-1 py-2 rounded-lg text-sm font-medium border transition-colors ${resolveAction === "resolve" ? "bg-green-600 text-white border-green-600" : "border-gray-300 text-gray-600 hover:bg-gray-50"}`}>
                  Mark resolved
                </button>
                <button onClick={() => setResolveAction("return")} className={`flex-1 py-2 rounded-lg text-sm font-medium border transition-colors ${resolveAction === "return" ? "bg-purple-600 text-white border-purple-600" : "border-gray-300 text-gray-600 hover:bg-gray-50"}`}>
                  Return with note
                </button>
              </div>
              <textarea value={resolveNote} onChange={e => setResolveNote(e.target.value)} rows={3}
                placeholder={resolveAction === "resolve" ? "Optional completion note..." : "What needs clarification or further action?"}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
            <div className="flex gap-2 mt-5">
              <button onClick={handleResolve} className={`px-4 py-2 rounded-lg text-sm font-medium text-white ${resolveAction === "resolve" ? "bg-green-600 hover:bg-green-700" : "bg-purple-600 hover:bg-purple-700"}`}>
                Confirm
              </button>
              <button onClick={() => { setResolveModal(null); setResolveNote(""); }} className="border border-gray-300 px-4 py-2 rounded-lg text-sm font-medium hover:bg-gray-50">Cancel</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

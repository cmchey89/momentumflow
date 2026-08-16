"use client";
import { useEffect, useState, useRef } from "react";
import { CheckSquare, Clock, Circle, AlertCircle, Plus, X, Paperclip, Upload, Trash2 } from "lucide-react";
import { upload } from "@vercel/blob/client";

type Status = "todo" | "in_progress" | "done";
type Priority = "low" | "medium" | "high";

interface Task {
  id: string;
  title: string;
  description: string | null;
  status: Status;
  priority: Priority;
  assignedTo: string | null;
  dueDate: string | null;
  projectId: string;
  projectName: string | null;
  createdAt: string;
}

interface PersonalTask {
  id: string;
  title: string;
  notes: string | null;
  status: Status;
  priority: Priority;
  dueDate: string | null;
  completedAt: string | null;
  createdAt: string;
}

interface PersonalTaskAttachment {
  id: string;
  taskId: string;
  name: string;
  url: string;
  pathname: string | null;
}

type Card =
  | { kind: "project"; id: string; title: string; notes: string | null; status: Status; priority: Priority; dueDate: string | null; createdAt: string; projectName: string | null }
  | { kind: "personal"; id: string; title: string; notes: string | null; status: Status; priority: Priority; dueDate: string | null; createdAt: string; attachments: PersonalTaskAttachment[] };

const priorityColors: Record<Priority, string> = { low: "text-gray-400 bg-gray-50", medium: "text-amber-600 bg-amber-50", high: "text-red-600 bg-red-50" };
const COLUMNS: { status: Status; label: string; icon: React.ReactNode }[] = [
  { status: "todo", label: "To Do", icon: <Circle className="w-4 h-4 text-gray-400" /> },
  { status: "in_progress", label: "In Progress", icon: <Clock className="w-4 h-4 text-amber-500" /> },
  { status: "done", label: "Done", icon: <CheckSquare className="w-4 h-4 text-green-500" /> },
];

function isAging(createdAt: string, status: Status) {
  if (status === "done") return false;
  return Date.now() - new Date(createdAt).getTime() > 5 * 24 * 60 * 60 * 1000;
}
function blobDownloadHref(pathname: string, name: string) {
  return `/api/blob/download?pathname=${encodeURIComponent(pathname)}&name=${encodeURIComponent(name)}`;
}

export default function MyTasksPage() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [personal, setPersonal] = useState<PersonalTask[]>([]);
  const [attachments, setAttachments] = useState<PersonalTaskAttachment[]>([]);
  const [loaded, setLoaded] = useState(false);

  const [draggedCard, setDraggedCard] = useState<{ kind: "project" | "personal"; id: string } | null>(null);
  const [dragOverStatus, setDragOverStatus] = useState<Status | null>(null);

  const [showAddForm, setShowAddForm] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newNotes, setNewNotes] = useState("");
  const [newPriority, setNewPriority] = useState<Priority>("medium");
  const [newDue, setNewDue] = useState("");

  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [uploadingFor, setUploadingFor] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const pendingUploadTaskId = useRef<string | null>(null);

  const load = () => {
    Promise.all([
      fetch("/api/tasks/mine").then(r => r.json()),
      fetch("/api/personal-tasks").then(r => r.json()),
    ]).then(([taskRows, personalData]) => {
      setTasks(taskRows);
      setPersonal(personalData.tasks ?? []);
      setAttachments(personalData.attachments ?? []);
      setLoaded(true);
    });
  };
  useEffect(() => { load(); }, []);

  const cards: Card[] = [
    ...tasks.map(t => ({ kind: "project" as const, id: t.id, title: t.title, notes: t.description, status: t.status, priority: t.priority, dueDate: t.dueDate, createdAt: t.createdAt, projectName: t.projectName })),
    ...personal.map(t => ({ kind: "personal" as const, id: t.id, title: t.title, notes: t.notes, status: t.status, priority: t.priority, dueDate: t.dueDate, createdAt: t.createdAt, attachments: attachments.filter(a => a.taskId === t.id) })),
  ];
  const columns: Record<Status, Card[]> = { todo: [], in_progress: [], done: [] };
  for (const c of cards) columns[c.status].push(c);

  const updateStatus = async (card: Card, status: Status) => {
    if (card.kind === "project") {
      setTasks(prev => prev.map(t => t.id === card.id ? { ...t, status } : t));
      await fetch(`/api/tasks/${card.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status }) });
    } else {
      setPersonal(prev => prev.map(t => t.id === card.id ? { ...t, status } : t));
      await fetch(`/api/personal-tasks/${card.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status }) });
    }
  };

  const handleDrop = (status: Status) => {
    setDragOverStatus(null);
    if (!draggedCard) return;
    const card = cards.find(c => c.kind === draggedCard.kind && c.id === draggedCard.id);
    setDraggedCard(null);
    if (card && card.status !== status) updateStatus(card, status);
  };

  const addPersonalTask = async () => {
    if (!newTitle.trim()) return;
    const res = await fetch("/api/personal-tasks", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: newTitle.trim(), notes: newNotes || null, priority: newPriority, dueDate: newDue || null }),
    });
    const task = await res.json();
    setPersonal(prev => [...prev, task]);
    setNewTitle(""); setNewNotes(""); setNewPriority("medium"); setNewDue(""); setShowAddForm(false);
  };

  const deletePersonalTask = async (id: string) => {
    if (!confirm("Delete this task?")) return;
    setPersonal(prev => prev.filter(t => t.id !== id));
    setExpandedId(null);
    await fetch(`/api/personal-tasks/${id}`, { method: "DELETE" });
  };

  const patchPersonal = async (id: string, patch: Record<string, unknown>) => {
    setPersonal(prev => prev.map(t => t.id === id ? { ...t, ...patch } : t));
    await fetch(`/api/personal-tasks/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(patch) });
  };

  const triggerAttach = (taskId: string) => {
    pendingUploadTaskId.current = taskId;
    fileInputRef.current?.click();
  };
  const handleFileSelected = async (file: File) => {
    const taskId = pendingUploadTaskId.current;
    if (!taskId) return;
    setUploadingFor(taskId);
    try {
      const blob = await upload(file.name, file, { access: "private", handleUploadUrl: "/api/blob/upload" });
      const res = await fetch(`/api/personal-tasks/${taskId}/attachments`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: file.name, url: blob.url, pathname: blob.pathname }),
      });
      const attachment = await res.json();
      setAttachments(prev => [...prev, attachment]);
    } finally {
      setUploadingFor(null);
    }
  };
  const deleteAttachment = async (attachmentId: string, taskId: string) => {
    setAttachments(prev => prev.filter(a => a.id !== attachmentId));
    await fetch(`/api/personal-tasks/${taskId}/attachments/${attachmentId}`, { method: "DELETE" });
  };

  return (
    <div className="p-8">
      <input ref={fileInputRef} type="file" className="hidden"
        onChange={e => { const file = e.target.files?.[0]; if (file) handleFileSelected(file); e.target.value = ""; }} />

      <div className="mb-6 flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">My Tasks</h2>
          <p className="text-gray-500 mt-1 text-sm">Project-assigned tasks and your personal to-dos, all in one board</p>
        </div>
        <button onClick={() => setShowAddForm(v => !v)} className="flex items-center gap-1.5 bg-blue-600 text-white px-3 py-1.5 rounded-lg text-sm font-medium hover:bg-blue-700">
          <Plus className="w-3.5 h-3.5" /> Add task
        </button>
      </div>

      {showAddForm && (
        <div className="bg-white border border-gray-200 rounded-xl p-4 mb-6 space-y-2">
          <input autoFocus value={newTitle} onChange={e => setNewTitle(e.target.value)} placeholder="Task title"
            className="w-full text-sm border border-gray-300 rounded-lg px-2.5 py-1.5" />
          <textarea value={newNotes} onChange={e => setNewNotes(e.target.value)} placeholder="Notes (optional)" rows={2}
            className="w-full text-sm border border-gray-300 rounded-lg px-2.5 py-1.5 resize-none" />
          <div className="flex gap-2">
            <select value={newPriority} onChange={e => setNewPriority(e.target.value as Priority)}
              className="text-sm border border-gray-300 rounded-lg px-2.5 py-1.5">
              <option value="low">Low priority</option>
              <option value="medium">Medium priority</option>
              <option value="high">High priority</option>
            </select>
            <input type="date" value={newDue} onChange={e => setNewDue(e.target.value)}
              className="text-sm border border-gray-300 rounded-lg px-2.5 py-1.5" />
          </div>
          <div className="flex gap-2 pt-1">
            <button onClick={addPersonalTask} className="bg-blue-600 text-white text-sm px-3 py-1.5 rounded-lg font-medium">Add</button>
            <button onClick={() => setShowAddForm(false)} className="border border-gray-300 text-sm px-3 py-1.5 rounded-lg">Cancel</button>
          </div>
        </div>
      )}

      {loaded && cards.length === 0 ? (
        <div className="text-center py-16 text-gray-400">
          <CheckSquare className="w-12 h-12 mx-auto mb-3 opacity-30" />
          <p>No tasks yet.</p>
        </div>
      ) : (
        <div className="grid grid-cols-3 gap-4">
          {COLUMNS.map(col => (
            <div key={col.status}
              onDragOver={e => { e.preventDefault(); if (dragOverStatus !== col.status) setDragOverStatus(col.status); }}
              onDragLeave={() => setDragOverStatus(prev => (prev === col.status ? null : prev))}
              onDrop={e => { e.preventDefault(); handleDrop(col.status); }}
              className={`rounded-xl border p-3 min-h-[200px] transition-colors ${dragOverStatus === col.status ? "bg-blue-50 border-blue-300" : "bg-gray-50 border-gray-200"}`}>
              <h3 className="font-semibold text-gray-700 mb-3 flex items-center gap-2 text-sm">
                {col.icon} {col.label}
                <span className="text-xs text-gray-400 font-normal">({columns[col.status].length})</span>
              </h3>
              <div className="space-y-2">
                {columns[col.status].map(card => {
                  const aging = isAging(card.createdAt, card.status);
                  const overdue = card.dueDate && new Date(card.dueDate) < new Date() && card.status !== "done";
                  const isExpanded = card.kind === "personal" && expandedId === card.id;
                  return (
                    <div key={`${card.kind}-${card.id}`}
                      draggable
                      onDragStart={() => setDraggedCard({ kind: card.kind, id: card.id })}
                      onDragEnd={() => setDraggedCard(null)}
                      onClick={() => card.kind === "personal" && setExpandedId(isExpanded ? null : card.id)}
                      className={`bg-white border border-gray-200 rounded-lg p-3 cursor-grab active:cursor-grabbing ${card.kind === "personal" ? "cursor-pointer" : ""} ${draggedCard?.id === card.id ? "opacity-40" : ""} ${card.status === "done" ? "opacity-70" : ""}`}>
                      <div className="flex items-start justify-between gap-2">
                        <p className={`font-medium text-sm ${card.status === "done" ? "line-through text-gray-400" : "text-gray-900"}`}>{card.title}</p>
                        {card.kind === "personal" && (
                          <button onClick={e => { e.stopPropagation(); deletePersonalTask(card.id); }} className="text-gray-300 hover:text-red-400 flex-shrink-0"><X className="w-3.5 h-3.5" /></button>
                        )}
                      </div>
                      {card.notes && !isExpanded && <p className="text-xs text-gray-500 mt-1 line-clamp-2">{card.notes}</p>}
                      <div className="flex items-center gap-1.5 mt-2 flex-wrap">
                        <span className={`text-xs px-1.5 py-0.5 rounded flex items-center gap-1 ${priorityColors[card.priority]}`}>
                          <AlertCircle className="w-3 h-3" /> {card.priority}
                        </span>
                        {card.kind === "project" ? (
                          <span className="text-xs px-1.5 py-0.5 rounded bg-blue-50 text-blue-600">{card.projectName ?? "Project"}</span>
                        ) : (
                          <span className="text-xs px-1.5 py-0.5 rounded bg-purple-50 text-purple-600">Personal</span>
                        )}
                        {card.dueDate && (
                          <span className={`text-xs ${overdue ? "text-red-500 font-medium" : "text-gray-400"}`}>
                            Due {new Date(card.dueDate).toLocaleDateString()}
                          </span>
                        )}
                        {aging && <span className="text-xs px-1.5 py-0.5 rounded bg-amber-50 text-amber-600">Aging</span>}
                        {card.kind === "personal" && card.attachments.length > 0 && (
                          <span className="text-xs text-gray-400 flex items-center gap-0.5"><Paperclip className="w-3 h-3" /> {card.attachments.length}</span>
                        )}
                      </div>

                      {isExpanded && card.kind === "personal" && (
                        <div className="mt-3 pt-3 border-t border-gray-100 space-y-2" onClick={e => e.stopPropagation()}>
                          <textarea value={card.notes ?? ""} onChange={e => patchPersonal(card.id, { notes: e.target.value })}
                            placeholder="Notes…" rows={2} className="w-full text-xs border border-gray-200 rounded-lg px-2 py-1.5 resize-none" />
                          <div className="flex gap-2">
                            <select value={card.priority} onChange={e => patchPersonal(card.id, { priority: e.target.value })}
                              className="text-xs border border-gray-200 rounded-lg px-2 py-1">
                              <option value="low">Low</option>
                              <option value="medium">Medium</option>
                              <option value="high">High</option>
                            </select>
                            <input type="date" value={card.dueDate ?? ""} onChange={e => patchPersonal(card.id, { dueDate: e.target.value })}
                              className="text-xs border border-gray-200 rounded-lg px-2 py-1" />
                          </div>
                          <div className="space-y-1">
                            {card.attachments.map(a => (
                              <div key={a.id} className="flex items-center gap-1.5 text-xs">
                                <a href={a.pathname ? blobDownloadHref(a.pathname, a.name) : a.url} target="_blank"
                                  className="flex items-center gap-1 text-blue-600 hover:underline flex-1 min-w-0 truncate">
                                  <Paperclip className="w-3 h-3 flex-shrink-0" /> {a.name}
                                </a>
                                <button onClick={() => deleteAttachment(a.id, card.id)} className="text-gray-300 hover:text-red-400"><Trash2 className="w-3 h-3" /></button>
                              </div>
                            ))}
                            <button onClick={() => triggerAttach(card.id)} disabled={uploadingFor === card.id}
                              className="flex items-center gap-1 text-xs text-gray-400 hover:text-blue-600">
                              <Upload className="w-3 h-3" /> {uploadingFor === card.id ? "Uploading…" : "Attach file"}
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

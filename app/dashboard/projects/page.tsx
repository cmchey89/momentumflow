"use client";
import { useEffect, useState } from "react";

import { Plus, FolderKanban, Trash2, GripVertical, Eye, EyeOff } from "lucide-react";
import Link from "next/link";

interface Project {
  id: string;
  name: string;
  description: string | null;
  createdAt: string;
  hidden: boolean;
}

export default function ProjectsPage() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [loading, setLoading] = useState(false);
  const [draggedId, setDraggedId] = useState<string | null>(null);
  const [dragOverId, setDragOverId] = useState<string | null>(null);
  const [showHidden, setShowHidden] = useState(false);

  const load = () => fetch("/api/projects").then(r => r.json()).then(setProjects);
  useEffect(() => { load(); }, []);

  const setHidden = async (id: string, hidden: boolean) => {
    setProjects(prev => prev.map(p => p.id === id ? { ...p, hidden } : p));
    await fetch(`/api/projects/${id}`, {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ hidden }),
    });
  };

  const visibleProjects = projects.filter(p => !p.hidden);
  const hiddenProjects = projects.filter(p => p.hidden);

  const reorder = async (orderedIds: string[]) => {
    await fetch("/api/projects", {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ orderedIds }),
    });
  };
  const handleDrop = (targetId: string) => {
    setDragOverId(null);
    if (!draggedId || draggedId === targetId) { setDraggedId(null); return; }
    const current = [...projects];
    const fromIdx = current.findIndex(p => p.id === draggedId);
    const toIdx = current.findIndex(p => p.id === targetId);
    setDraggedId(null);
    if (fromIdx === -1 || toIdx === -1) return;
    const [moved] = current.splice(fromIdx, 1);
    current.splice(toIdx, 0, moved);
    setProjects(current);
    reorder(current.map(p => p.id));
  };

  const create = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    await fetch("/api/projects", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, description }),
    });
    setName(""); setDescription(""); setShowForm(false); setLoading(false);
    load();
  };

  const remove = async (id: string) => {
    if (!confirm("Delete this project?")) return;
    await fetch(`/api/projects/${id}`, { method: "DELETE" });
    load();
  };

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Projects</h2>
          <p className="text-gray-500 mt-1">Manage your team projects</p>
        </div>
        <div className="flex items-center gap-3">
          {hiddenProjects.length > 0 && (
            <button onClick={() => setShowHidden(v => !v)}
              className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700">
              {showHidden ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              {showHidden ? "Hide" : "Show"} hidden ({hiddenProjects.length})
            </button>
          )}
          <button
            onClick={() => setShowForm(true)}
            className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium"
          >
            <Plus className="w-4 h-4" /> New Project
          </button>
        </div>
      </div>

      {showForm && (
        <form onSubmit={create} className="bg-white border border-gray-200 rounded-xl p-6 mb-6">
          <h3 className="font-semibold text-gray-900 mb-4">New Project</h3>
          <div className="space-y-3">
            <input
              value={name} onChange={e => setName(e.target.value)} required
              placeholder="Project name"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <textarea
              value={description} onChange={e => setDescription(e.target.value)}
              placeholder="Description (optional)"
              rows={2}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div className="flex gap-2 mt-4">
            <button type="submit" disabled={loading}
              className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50">
              {loading ? "Creating..." : "Create"}
            </button>
            <button type="button" onClick={() => setShowForm(false)}
              className="border border-gray-300 px-4 py-2 rounded-lg text-sm font-medium hover:bg-gray-50">
              Cancel
            </button>
          </div>
        </form>
      )}

      {visibleProjects.length === 0 && hiddenProjects.length === 0 ? (
        <div className="text-center py-16 text-gray-400">
          <FolderKanban className="w-12 h-12 mx-auto mb-3 opacity-30" />
          <p>No projects yet. Create one to get started.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {visibleProjects.map(p => (
            <div key={p.id}
              draggable
              onDragStart={() => setDraggedId(p.id)}
              onDragOver={e => { e.preventDefault(); if (dragOverId !== p.id) setDragOverId(p.id); }}
              onDragLeave={() => setDragOverId(prev => (prev === p.id ? null : prev))}
              onDrop={e => { e.preventDefault(); handleDrop(p.id); }}
              onDragEnd={() => { setDraggedId(null); setDragOverId(null); }}
              className={`bg-white border rounded-xl p-6 hover:border-blue-300 hover:shadow-sm transition-all ${dragOverId === p.id && draggedId !== p.id ? "border-t-4 border-t-blue-400 border-gray-200" : "border-gray-200"} ${draggedId === p.id ? "opacity-40" : ""}`}>
              <div className="flex items-start justify-between">
                <Link href={`/dashboard/projects/${p.id}`} className="flex-1">
                  <div className="flex items-center gap-1.5 mb-3">
                    <span className="cursor-grab active:cursor-grabbing text-gray-300 hover:text-gray-500" onClick={e => e.preventDefault()}>
                      <GripVertical className="w-4 h-4" />
                    </span>
                    <div className="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center">
                      <FolderKanban className="w-4 h-4 text-blue-600" />
                    </div>
                  </div>
                  <h3 className="font-semibold text-gray-900">{p.name}</h3>
                  {p.description && <p className="text-sm text-gray-500 mt-1 line-clamp-2">{p.description}</p>}
                </Link>
                <div className="flex items-center gap-1 ml-2">
                  <button onClick={() => setHidden(p.id, true)} title="Hide project" className="text-gray-400 hover:text-gray-600 transition-colors">
                    <EyeOff className="w-4 h-4" />
                  </button>
                  <button onClick={() => remove(p.id)} className="text-gray-400 hover:text-red-500 transition-colors">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
              <p className="text-xs text-gray-400 mt-4">{new Date(p.createdAt).toLocaleDateString()}</p>
            </div>
          ))}
        </div>
      )}

      {showHidden && hiddenProjects.length > 0 && (
        <div className="mt-8">
          <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">Hidden projects</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {hiddenProjects.map(p => (
              <div key={p.id} className="bg-gray-50 border border-gray-200 rounded-xl p-6 opacity-70">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="w-8 h-8 bg-gray-200 rounded-lg flex items-center justify-center mb-3">
                      <FolderKanban className="w-4 h-4 text-gray-400" />
                    </div>
                    <h3 className="font-semibold text-gray-600">{p.name}</h3>
                    {p.description && <p className="text-sm text-gray-400 mt-1 line-clamp-2">{p.description}</p>}
                  </div>
                  <div className="flex items-center gap-1 ml-2">
                    <button onClick={() => setHidden(p.id, false)} title="Unhide project" className="text-gray-400 hover:text-blue-600 transition-colors">
                      <Eye className="w-4 h-4" />
                    </button>
                    <button onClick={() => remove(p.id)} className="text-gray-400 hover:text-red-500 transition-colors">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
                <p className="text-xs text-gray-400 mt-4">{new Date(p.createdAt).toLocaleDateString()}</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

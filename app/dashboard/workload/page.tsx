"use client";
import { useEffect, useState } from "react";
import { Users, AlertCircle, Upload, Download, Trash2, CheckSquare, Square, Loader2 } from "lucide-react";
import { upload } from "@vercel/blob/client";

interface MemberLoad {
  name: string;
  total: number;
  active: number;
  done: number;
  overdue: number;
}

interface WorkloadPhoto { id: string; name: string; url: string; pathname: string | null; createdAt: string }

export default function WorkloadPage() {
  const [data, setData] = useState<MemberLoad[]>([]);
  const [loading, setLoading] = useState(true);

  const [photos, setPhotos] = useState<WorkloadPhoto[]>([]);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<{ done: number; total: number } | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [downloading, setDownloading] = useState(false);

  const loadPhotos = () => fetch("/api/workload-photos").then(r => r.json()).then(setPhotos);

  useEffect(() => {
    fetch("/api/workload").then(r => r.json()).then(d => { setData(d); setLoading(false); });
    loadPhotos();
  }, []);

  const handleFilesSelected = async (files: FileList) => {
    const fileList = Array.from(files);
    if (fileList.length === 0) return;
    setUploading(true);
    setUploadProgress({ done: 0, total: fileList.length });
    for (const file of fileList) {
      // Raw file straight to Blob -- no canvas resize/recompress step, so the
      // uploaded bytes are byte-for-byte what was selected.
      const blob = await upload(file.name, file, { access: "private", handleUploadUrl: "/api/blob/upload" });
      await fetch("/api/workload-photos", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: file.name, url: blob.url, pathname: blob.pathname }),
      });
      setUploadProgress(prev => prev ? { ...prev, done: prev.done + 1 } : prev);
    }
    setUploading(false);
    setUploadProgress(null);
    loadPhotos();
  };

  const toggleSelect = (id: string) => {
    setSelected(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });
  };
  const selectAll = () => setSelected(new Set(photos.map(p => p.id)));
  const clearSelection = () => setSelected(new Set());

  const downloadSelected = async () => {
    setDownloading(true);
    try {
      const ids = [...selected];
      // Never let the button hang forever, even if the connection stalls
      // instead of erroring cleanly server-side.
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 75_000);
      const res = await fetch("/api/workload-photos/download-zip", {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ids }),
        signal: controller.signal,
      });
      clearTimeout(timeoutId);
      if (!res.ok) throw new Error("Download failed");
      const blob = await res.blob();
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = "workload-photos.zip";
      a.click();
      URL.revokeObjectURL(a.href);
    } catch (err) {
      alert((err as Error)?.name === "AbortError"
        ? "Download timed out. Try selecting fewer photos at once."
        : "Download failed. Please try again.");
    } finally {
      setDownloading(false);
    }
  };

  const deleteSelected = async () => {
    if (!confirm(`Delete ${selected.size} photo${selected.size !== 1 ? "s" : ""}? This can't be undone.`)) return;
    const ids = [...selected];
    setPhotos(prev => prev.filter(p => !selected.has(p.id)));
    clearSelection();
    await fetch("/api/workload-photos/delete-batch", {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ids }),
    });
  };

  const maxTotal = Math.max(...data.map(d => d.total), 1);

  return (
    <div className="p-8">
      <div className="mb-8">
        <h2 className="text-2xl font-bold text-gray-900">Workload</h2>
        <p className="text-gray-500 mt-1">Task distribution across all team members</p>
      </div>

      {loading ? (
        <div className="text-center py-16 text-gray-400">Loading...</div>
      ) : data.length === 0 ? (
        <div className="text-center py-16 text-gray-400">
          <Users className="w-12 h-12 mx-auto mb-3 opacity-30" />
          <p>No tasks assigned yet.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {data.map(member => (
            <div key={member.name} className="bg-white rounded-xl border border-gray-200 p-6">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-full bg-blue-100 flex items-center justify-center text-sm font-bold text-blue-700">
                    {member.name[0]?.toUpperCase() || "?"}
                  </div>
                  <div>
                    <p className="font-semibold text-gray-900">{member.name}</p>
                    <p className="text-xs text-gray-500">{member.total} task{member.total !== 1 ? "s" : ""} total</p>
                  </div>
                </div>
                <div className="flex items-center gap-4 text-sm">
                  <span className="flex items-center gap-1.5 text-yellow-600">
                    <span className="w-2 h-2 rounded-full bg-yellow-400 inline-block" />
                    {member.active} active
                  </span>
                  <span className="flex items-center gap-1.5 text-green-600">
                    <span className="w-2 h-2 rounded-full bg-green-400 inline-block" />
                    {member.done} done
                  </span>
                  {member.overdue > 0 && (
                    <span className="flex items-center gap-1 text-red-600 font-medium">
                      <AlertCircle className="w-3.5 h-3.5" />
                      {member.overdue} overdue
                    </span>
                  )}
                </div>
              </div>
              {/* Progress bar */}
              <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                <div className="h-full flex">
                  <div className="bg-green-400 transition-all" style={{ width: `${(member.done / maxTotal) * 100}%` }} />
                  <div className="bg-yellow-400 transition-all" style={{ width: `${(member.active / maxTotal) * 100}%` }} />
                </div>
              </div>
              <div className="flex items-center justify-between mt-1.5">
                <p className="text-xs text-gray-400">
                  {member.total > 0 ? Math.round((member.done / member.total) * 100) : 0}% complete
                </p>
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="mt-10">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-lg font-semibold text-gray-900">Photos</h3>
            <p className="text-sm text-gray-500 mt-0.5">Upload site/work photos here — select multiple to download as a zip or delete in bulk</p>
          </div>
          <div className="flex items-center gap-2">
            {selected.size > 0 && (
              <>
                <span className="text-sm text-gray-500">{selected.size} selected</span>
                <button onClick={downloadSelected} disabled={downloading}
                  className="flex items-center gap-1.5 border border-gray-300 px-3 py-1.5 rounded-lg text-sm font-medium hover:bg-gray-50 active:scale-95 active:bg-gray-100 transition-transform disabled:opacity-70 disabled:cursor-wait disabled:active:scale-100">
                  {downloading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5" />}
                  {downloading ? "Preparing download…" : "Download"}
                </button>
                <button onClick={deleteSelected} className="flex items-center gap-1.5 border border-red-200 text-red-600 px-3 py-1.5 rounded-lg text-sm font-medium hover:bg-red-50">
                  <Trash2 className="w-3.5 h-3.5" /> Delete
                </button>
                <button onClick={clearSelection} className="text-sm text-gray-400 hover:text-gray-600">Clear</button>
              </>
            )}
            {photos.length > 0 && selected.size === 0 && (
              <button onClick={selectAll} className="text-sm text-blue-600 hover:text-blue-700">Select all</button>
            )}
            <label className="flex items-center gap-1.5 bg-blue-600 text-white px-3 py-1.5 rounded-lg text-sm font-medium hover:bg-blue-700 cursor-pointer">
              <Upload className="w-3.5 h-3.5" /> {uploading ? `Uploading ${uploadProgress?.done ?? 0}/${uploadProgress?.total ?? 0}…` : "Upload photos"}
              <input type="file" accept="image/*" multiple disabled={uploading} className="hidden"
                onChange={e => { if (e.target.files) handleFilesSelected(e.target.files); e.target.value = ""; }} />
            </label>
          </div>
        </div>

        {photos.length === 0 ? (
          <div className="text-center py-12 text-gray-400 border border-dashed border-gray-200 rounded-xl">
            <p className="text-sm">No photos uploaded yet.</p>
          </div>
        ) : (
          // Plain list, not a thumbnail grid -- no image bytes are fetched
          // just to browse the list, only filenames/dates from the DB. Avoids
          // pulling full-resolution originals just to render a small preview.
          <div className="border border-gray-200 rounded-xl divide-y divide-gray-100 bg-white">
            {photos.map(p => {
              const isSelected = selected.has(p.id);
              return (
                <div key={p.id} onClick={() => toggleSelect(p.id)}
                  className={`flex items-center gap-3 px-4 py-2.5 cursor-pointer ${isSelected ? "bg-blue-50" : "hover:bg-gray-50"}`}>
                  {isSelected ? <CheckSquare className="w-4 h-4 text-blue-600 flex-shrink-0" /> : <Square className="w-4 h-4 text-gray-300 flex-shrink-0" />}
                  <p className="text-sm text-gray-700 truncate flex-1">{p.name}</p>
                  <p className="text-xs text-gray-400 flex-shrink-0">{new Date(p.createdAt).toLocaleDateString()}</p>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

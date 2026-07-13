"use client";
import { useEffect, useState, useCallback, useRef, Fragment } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft, Plus, ChevronRight, MessageSquare, Flag, Trash2,
  Upload, Download, FileText, X, Pencil,
} from "lucide-react";

// ── Types ───────────────────────────────────────────────────────────────

interface Project { id: string; name: string; description: string | null }

interface Background {
  why: string | null;
  client: string | null;
  poNumber: string | null;
  poValue: number | null;
  targetStart: string | null;
  targetEnd: string | null;
}
interface ProjFile { id: string; name: string; url: string }

type StageStatus = "pending" | "in_progress" | "done";

interface Stage {
  id: string; name: string; sortOrder: number; status: StageStatus;
  planStart: string | null; planEnd: string | null; actualStart: string | null; actualEnd: string | null;
}
interface PlanTask {
  id: string; stageId: string; parentId: string | null; title: string;
  isMilestone: boolean; sortOrder: number; status: StageStatus;
  planStart: string | null; planEnd: string | null; actualStart: string | null; actualEnd: string | null;
}
interface Comment { id: string; taskId: string; authorName: string; text: string | null; imageUrl: string | null; createdAt: string }

type ClaimStatus = "pending" | "submitted" | "approved" | "paid";
interface Contractor { id: string; name: string; scope: string | null }
interface ContractorClaim { id: string; contractorId: string; stageId: string | null; amount: number; invoiceNo: string | null; status: ClaimStatus }
interface ClientClaim { id: string; stageId: string | null; amount: number; invoiceNo: string | null; status: ClaimStatus }

interface Template { id: string; name: string; team: string | null; structure: string; createdAt: string }

type DragCtl = {
  dragging: { kind: "stage" | "task"; id: string } | null;
  hoverId: string | null;
  startDrag: (kind: "stage" | "task", id: string) => void;
};

interface BulkSubTask { title: string; planStart: string | null; planEnd: string | null; actualStart: string | null; actualEnd: string | null; status?: StageStatus }
interface BulkTask { title: string; planStart: string | null; planEnd: string | null; actualStart: string | null; actualEnd: string | null; status?: StageStatus; subTasks: BulkSubTask[] }
interface BulkStage { name: string; tasks: BulkTask[] }

const MONTH_LOOKUP: Record<string, number> = { jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5, jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11 };

function parseFlexibleDate(raw: string): string | null {
  const s = raw.trim();
  if (!s) return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  const m = s.match(/^(\d{1,2})[-\s](\w{3,})[-\s](\d{2,4})$/);
  if (m) {
    const day = parseInt(m[1], 10);
    const mon = MONTH_LOOKUP[m[2].slice(0, 3).toLowerCase()];
    let year = parseInt(m[3], 10);
    if (year < 100) year += 2000;
    if (mon !== undefined && !isNaN(day)) return new Date(Date.UTC(year, mon, day)).toISOString().slice(0, 10);
  }
  const d = new Date(s);
  return isNaN(d.getTime()) ? null : d.toISOString().slice(0, 10);
}

function parseBulkStatus(raw: string): StageStatus | undefined {
  const s = raw.trim().toLowerCase();
  if (["done", "complete", "completed", "d"].includes(s)) return "done";
  if (["in_progress", "in-progress", "in progress", "inprogress", "ongoing", "ip"].includes(s)) return "in_progress";
  if (["pending", "not started", "not_started", "todo", "p"].includes(s)) return "pending";
  return undefined; // left blank or unrecognized — fall back to inferring from actual dates
}

// Mirrors the server's inferStatus() in app/api/projects/[id]/bulk-import/route.ts, used only to
// preview what status a row will get when no explicit status column is provided.
function inferBulkStatus(actualStart: string | null, actualEnd: string | null): StageStatus {
  const today = new Date().toISOString().slice(0, 10);
  if (actualEnd && actualEnd <= today) return "done";
  if (actualStart && actualStart <= today) return "in_progress";
  return "pending";
}

const STATUS_LABEL: Record<StageStatus, string> = { pending: "Pending", in_progress: "In Progress", done: "Done" };
const STATUS_BADGE_COLOR: Record<StageStatus, string> = {
  pending: "bg-gray-100 text-gray-500", in_progress: "bg-amber-100 text-amber-700", done: "bg-green-100 text-green-700",
};
function StatusBadge({ status, explicit }: { status: StageStatus; explicit: boolean }) {
  return (
    <span className={`ml-1.5 text-[10px] px-1.5 py-0.5 rounded-full ${STATUS_BADGE_COLOR[status]}`} title={explicit ? "Set explicitly in the status column" : "Auto-detected from actual dates"}>
      {STATUS_LABEL[status]}{!explicit && " (auto)"}
    </span>
  );
}

function parseBulkText(text: string): { stages: BulkStage[]; errors: string[] } {
  const lines = text.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
  const stages: BulkStage[] = [];
  let currentStage: BulkStage | null = null;
  let currentTask: BulkTask | null = null;
  const errors: string[] = [];

  lines.forEach((line, i) => {
    const parts = line.split("|").map(p => p.trim());
    const level = parseInt(parts[0], 10);
    const title = parts[1] || "";
    const planStart = parseFlexibleDate(parts[2] || "");
    const planEnd = parseFlexibleDate(parts[3] || "");
    const actualStart = parseFlexibleDate(parts[4] || "");
    const actualEnd = parseFlexibleDate(parts[5] || "");
    const status = parseBulkStatus(parts[6] || "");

    if (![1, 2, 3].includes(level) || !title) {
      errors.push(`Line ${i + 1}: couldn't read "${line}" — expected "1/2/3 | title | plan start | plan end | actual start | actual end | status"`);
      return;
    }
    if (level === 1) {
      currentStage = { name: title, tasks: [] };
      stages.push(currentStage);
      currentTask = null;
    } else if (level === 2) {
      if (!currentStage) { errors.push(`Line ${i + 1}: main task "${title}" has no stage above it`); return; }
      currentTask = { title, planStart, planEnd, actualStart, actualEnd, status, subTasks: [] };
      currentStage.tasks.push(currentTask);
    } else {
      if (!currentTask) { errors.push(`Line ${i + 1}: sub task "${title}" has no main task above it`); return; }
      currentTask.subTasks.push({ title, planStart, planEnd, actualStart, actualEnd, status });
    }
  });

  return { stages, errors };
}

const CLAIM_COLORS: Record<ClaimStatus, string> = {
  pending: "bg-gray-100 text-gray-500",
  submitted: "bg-amber-100 text-amber-700",
  approved: "bg-blue-100 text-blue-700",
  paid: "bg-green-100 text-green-700",
};
const STAGE_DOT: Record<StageStatus, string> = { pending: "bg-gray-300", in_progress: "bg-amber-500", done: "bg-green-600" };
const TAB_LABELS: Record<"background" | "plan" | "finance", string> = {
  background: "Background", plan: "Plan", finance: "Finance",
};

function fmtMoney(n: number) { return `$${n.toLocaleString()}`; }
function fmtDate(d: string | null) { return d ? new Date(d).toLocaleDateString("en-GB", { day: "numeric", month: "short" }) : "—"; }

// Press and hold ~1s (without moving) to start a drag, so a normal click/tap
// still works for opening rows or triggering rename. Movement before the
// timer fires cancels it (treated as a scroll or misclick, not a drag).
// Plain closure, not a hook, so it can be called fresh inside .map() callbacks.
function longPressHandlers(onActivate: () => void, delay = 500) {
  let timer: number | null = null;
  let start: { x: number; y: number } | null = null;
  const clear = () => { if (timer !== null) { window.clearTimeout(timer); timer = null; } start = null; };
  return {
    onPointerDown: (e: React.PointerEvent) => {
      if (e.button !== 0) return;
      start = { x: e.clientX, y: e.clientY };
      timer = window.setTimeout(() => { onActivate(); clear(); }, delay);
    },
    onPointerMove: (e: React.PointerEvent) => {
      if (!start) return;
      if (Math.hypot(e.clientX - start.x, e.clientY - start.y) > 6) clear();
    },
    onPointerUp: clear,
    onPointerLeave: clear,
  };
}

export default function ProjectDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [tab, setTab] = useState<"background" | "plan" | "finance">("background");
  const [project, setProject] = useState<Project | null>(null);

  // background
  const [bg, setBg] = useState<Background | null>(null);
  const [files, setFiles] = useState<ProjFile[]>([]);
  const [editingBg, setEditingBg] = useState(false);
  const [bgForm, setBgForm] = useState<Background>({ why: "", client: "", poNumber: "", poValue: null, targetStart: "", targetEnd: "" });

  // stages/tasks
  const [stages, setStages] = useState<Stage[]>([]);
  const [tasks, setTasks] = useState<PlanTask[]>([]);
  const [comments, setComments] = useState<Comment[]>([]);
  const [openTasks, setOpenTasks] = useState<Set<string>>(new Set());
  const [openComments, setOpenComments] = useState<Set<string>>(new Set());
  const [addingTaskFor, setAddingTaskFor] = useState<{ stageId: string; parentId: string | null } | null>(null);
  const [taskView, setTaskView] = useState<"list" | "timeline">("list");
  const [dragging, setDragging] = useState<{ kind: "stage" | "task"; id: string } | null>(null);
  const [hoverId, setHoverId] = useState<string | null>(null);
  const hoverIdRef = useRef<string | null>(null);

  // finance
  const [contractors, setContractors] = useState<Contractor[]>([]);
  const [contractorClaims, setContractorClaims] = useState<ContractorClaim[]>([]);
  const [clientClaims, setClientClaims] = useState<ClientClaim[]>([]);
  const [showContractorForm, setShowContractorForm] = useState(false);
  const [showClaimForm, setShowClaimForm] = useState<"client" | "contractor" | null>(null);

  // export/import
  const [showExport, setShowExport] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const [templates, setTemplates] = useState<Template[]>([]);
  const [importStep, setImportStep] = useState(1);
  const [selectedTpl, setSelectedTpl] = useState<Template | null>(null);
  const [importStartDate, setImportStartDate] = useState(new Date().toISOString().slice(0, 10));
  const [showBulkImport, setShowBulkImport] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  const showToast = (msg: string) => { setToast(msg); setTimeout(() => setToast(null), 3000); };

  const loadBackground = useCallback(() => {
    fetch(`/api/projects/${id}/background`).then(r => r.json()).then(d => {
      setBg(d.background); setFiles(d.files);
      if (d.background) setBgForm(d.background);
    });
  }, [id]);

  const loadStages = useCallback(() => {
    fetch(`/api/projects/${id}/stages`).then(r => r.json()).then(d => {
      setStages(d.stages); setTasks(d.tasks); setComments(d.comments);
    });
  }, [id]);

  const loadFinance = useCallback(() => {
    fetch(`/api/projects/${id}/finance`).then(r => r.json()).then(d => {
      setContractors(d.contractors); setContractorClaims(d.contractorClaims); setClientClaims(d.clientClaims);
    });
  }, [id]);

  useEffect(() => {
    fetch(`/api/projects/${id}`).then(r => r.json()).then(setProject);
    loadBackground(); loadStages(); loadFinance();
  }, [id, loadBackground, loadStages, loadFinance]);

  // ── Background handlers ──
  const saveBg = async () => {
    await fetch(`/api/projects/${id}/background`, {
      method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(bgForm),
    });
    setEditingBg(false); loadBackground();
  };
  const addFile = async () => {
    const name = prompt("File name (e.g. network_diagram.png)");
    if (!name) return;
    const url = prompt("File URL") || "#";
    await fetch(`/api/projects/${id}/files`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name, url }) });
    loadBackground();
  };
  const deleteFile = async (fileId: string) => {
    if (!confirm("Remove this file from the project?")) return;
    setFiles(prev => prev.filter(f => f.id !== fileId));
    fetch(`/api/projects/${id}/files/${fileId}`, { method: "DELETE" });
  };

  // ── Stage/task handlers ──
  // These update local state immediately (optimistic) instead of writing then
  // re-fetching everything, so the UI reacts instantly instead of waiting on
  // two sequential round trips per click.
  const addStage = async (name: string) => {
    if (!name.trim()) return;
    const tempId = `temp-${Date.now()}`;
    setStages(prev => [...prev, {
      id: tempId, name, sortOrder: prev.length, status: "pending",
      planStart: null, planEnd: null, actualStart: null, actualEnd: null,
    }]);
    const res = await fetch(`/api/projects/${id}/stages`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name }) });
    const stage = await res.json();
    setStages(prev => prev.map(s => s.id === tempId ? stage : s));
  };
  const deleteStage = async (stageId: string) => {
    if (!confirm("Delete this stage and all its tasks?")) return;
    setStages(prev => prev.filter(s => s.id !== stageId));
    const removedTaskIds = new Set(tasks.filter(t => t.stageId === stageId).map(t => t.id));
    setTasks(prev => prev.filter(t => t.stageId !== stageId));
    setComments(prev => prev.filter(c => !removedTaskIds.has(c.taskId)));
    fetch(`/api/stages/${stageId}`, { method: "DELETE" });
  };
  const patchStage = async (stageId: string, values: Partial<Stage>) => {
    setStages(prev => prev.map(s => s.id === stageId ? { ...s, ...values } : s));
    fetch(`/api/stages/${stageId}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(values) });
  };
  const addTask = async (stageId: string, parentId: string | null, title: string) => {
    if (!title.trim()) return;
    setAddingTaskFor(null);
    const tempId = `temp-${Date.now()}`;
    setTasks(prev => [...prev, {
      id: tempId, stageId, parentId, title,
      isMilestone: false, sortOrder: prev.length, status: "pending",
      planStart: null, planEnd: null, actualStart: null, actualEnd: null,
    }]);
    // Auto-expand the stage (and parent task, for a sub task) so the new row is visible right away.
    setOpenTasks(prev => {
      const s = new Set(prev);
      s.add(stageId);
      if (parentId) s.add(parentId);
      return s;
    });
    const res = await fetch(`/api/stages/${stageId}/tasks`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title, parentId }),
    });
    const task = await res.json();
    setTasks(prev => prev.map(t => t.id === tempId ? task : t));
  };
  const deleteTask = async (taskId: string) => {
    if (!confirm("Delete this task?")) return;
    const removedIds = new Set([taskId, ...tasks.filter(t => t.parentId === taskId).map(t => t.id)]);
    setTasks(prev => prev.filter(t => !removedIds.has(t.id)));
    setComments(prev => prev.filter(c => !removedIds.has(c.taskId)));
    fetch(`/api/plan-tasks/${taskId}`, { method: "DELETE" });
  };
  const patchTask = async (taskId: string, values: Partial<PlanTask>) => {
    setTasks(prev => prev.map(t => t.id === taskId ? { ...t, ...values } : t));
    fetch(`/api/plan-tasks/${taskId}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(values) });
  };
  const toggleMilestone = (task: PlanTask) => patchTask(task.id, { isMilestone: !task.isMilestone });
  const toggleOpen = (taskId: string) => setOpenTasks(prev => { const s = new Set(prev); s.has(taskId) ? s.delete(taskId) : s.add(taskId); return s; });
  const toggleComments = (taskId: string) => setOpenComments(prev => { const s = new Set(prev); s.has(taskId) ? s.delete(taskId) : s.add(taskId); return s; });
  const closeAllComments = () => setOpenComments(new Set());
  const expandAllTasks = () => setOpenTasks(new Set([...stages.map(s => s.id), ...tasks.filter(t => !t.parentId).map(t => t.id)]));
  const collapseAllTasks = () => setOpenTasks(new Set());

  // ── Press-and-hold drag to reorder/move stages, main tasks, and sub tasks ──
  const startDrag = (kind: "stage" | "task", id: string) => setDragging({ kind, id });

  const moveStage = (stageId: string, beforeStageId: string | null) => {
    setStages(prev => {
      const dragged = prev.find(s => s.id === stageId);
      if (!dragged) return prev;
      const without = prev.filter(s => s.id !== stageId);
      const idx = beforeStageId ? without.findIndex(s => s.id === beforeStageId) : -1;
      const insertAt = idx === -1 ? without.length : idx;
      const next = [...without.slice(0, insertAt), dragged, ...without.slice(insertAt)].map((s, i) => ({ ...s, sortOrder: i }));
      next.forEach(s => fetch(`/api/stages/${s.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ sortOrder: s.sortOrder }) }));
      return next;
    });
  };

  const moveTask = (taskId: string, newStageId: string, newParentId: string | null, beforeTaskId: string | null) => {
    setTasks(prev => {
      const dragged = prev.find(t => t.id === taskId);
      if (!dragged) return prev;
      const moved = { ...dragged, stageId: newStageId, parentId: newParentId };
      const rest = prev.filter(t => t.id !== taskId);
      const group = rest.filter(t => t.stageId === newStageId && t.parentId === newParentId);
      const untouched = rest.filter(t => !(t.stageId === newStageId && t.parentId === newParentId));
      const idx = beforeTaskId ? group.findIndex(t => t.id === beforeTaskId) : -1;
      const insertAt = idx === -1 ? group.length : idx;
      const reorderedGroup = [...group.slice(0, insertAt), moved, ...group.slice(insertAt)].map((t, i) => ({ ...t, sortOrder: i }));
      reorderedGroup.forEach(t => {
        const body = t.id === taskId ? { stageId: newStageId, parentId: newParentId, sortOrder: t.sortOrder } : { sortOrder: t.sortOrder };
        fetch(`/api/plan-tasks/${t.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      });
      return [...untouched, ...reorderedGroup];
    });
  };

  const handleDrop = (dragged: { kind: "stage" | "task"; id: string }, targetId: string) => {
    if (dragged.kind === "stage") {
      if (stages.some(s => s.id === targetId)) moveStage(dragged.id, targetId);
      return;
    }
    const draggedTask = tasks.find(t => t.id === dragged.id);
    if (!draggedTask) return;
    const isDraggedMain = draggedTask.parentId === null;
    const targetTask = tasks.find(t => t.id === targetId);
    const targetStage = stages.find(s => s.id === targetId);

    if (isDraggedMain) {
      if (targetTask && targetTask.parentId === null) {
        moveTask(draggedTask.id, targetTask.stageId, null, targetTask.id);
      } else if (targetStage) {
        moveTask(draggedTask.id, targetStage.id, null, null);
      }
    } else {
      if (targetTask && targetTask.parentId !== null) {
        const targetParent = tasks.find(t => t.id === targetTask.parentId);
        if (targetParent) moveTask(draggedTask.id, targetParent.stageId, targetParent.id, targetTask.id);
      } else if (targetTask && targetTask.parentId === null) {
        moveTask(draggedTask.id, targetTask.stageId, targetTask.id, null);
      }
    }
  };

  useEffect(() => {
    if (!dragging) return;
    const onMove = (e: PointerEvent) => {
      const el = document.elementFromPoint(e.clientX, e.clientY) as HTMLElement | null;
      const target = el?.closest("[data-drop-id]") as HTMLElement | null;
      const id = target?.getAttribute("data-drop-id") ?? null;
      hoverIdRef.current = id;
      setHoverId(id);
    };
    const onUp = () => {
      const finalHoverId = hoverIdRef.current;
      if (finalHoverId && finalHoverId !== dragging.id) handleDrop(dragging, finalHoverId);
      setDragging(null);
      setHoverId(null);
      hoverIdRef.current = null;
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dragging]);

  const submitRemark = async (taskId: string, text: string) => {
    if (!text.trim()) return;
    const tempId = `temp-${Date.now()}`;
    setComments(prev => [...prev, { id: tempId, taskId, authorName: "You", text, imageUrl: null, createdAt: new Date().toISOString() }]);
    const res = await fetch(`/api/plan-tasks/${taskId}/comments`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ text }) });
    const comment = await res.json();
    setComments(prev => prev.map(c => c.id === tempId ? comment : c));
  };
  const updateRemark = async (commentId: string, text: string) => {
    const target = comments.find(c => c.id === commentId);
    setComments(prev => prev.map(c => c.id === commentId ? { ...c, text } : c));
    if (target) await fetch(`/api/plan-tasks/${target.taskId}/comments/${commentId}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ text }) });
  };
  const deleteRemark = async (commentId: string) => {
    const target = comments.find(c => c.id === commentId);
    setComments(prev => prev.filter(c => c.id !== commentId));
    if (target) await fetch(`/api/plan-tasks/${target.taskId}/comments/${commentId}`, { method: "DELETE" });
  };
  const attachPhoto = async (taskId: string) => {
    const url = prompt("Photo URL (placeholder — no file storage wired up yet)");
    if (!url) return;
    const tempId = `temp-${Date.now()}`;
    setComments(prev => [...prev, { id: tempId, taskId, authorName: "You", text: null, imageUrl: url, createdAt: new Date().toISOString() }]);
    const res = await fetch(`/api/plan-tasks/${taskId}/comments`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ imageUrl: url, text: null }) });
    const comment = await res.json();
    setComments(prev => prev.map(c => c.id === tempId ? comment : c));
  };

  // ── Finance handlers ──
  const addContractor = async (name: string, scope: string) => {
    await fetch(`/api/projects/${id}/finance`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ kind: "contractor", name, scope }) });
    setShowContractorForm(false); loadFinance();
  };
  const addClaim = async (kind: "client" | "contractor", data: Record<string, unknown>) => {
    await fetch(`/api/projects/${id}/finance`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ kind: kind === "client" ? "client_claim" : "contractor_claim", ...data }) });
    setShowClaimForm(null); loadFinance();
  };
  const setClaimStatus = async (kind: "client" | "contractor", claimId: string, status: ClaimStatus) => {
    await fetch(`/api/finance/claims/${claimId}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ kind, status }) });
    loadFinance();
  };

  // ── Export/import ──
  const doExport = async (name: string, includeDurations: boolean, save: boolean) => {
    const res = await fetch(`/api/projects/${id}/export`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name, includeDurations, save }) });
    const data = await res.json();
    const blob = new Blob([JSON.stringify(data.structure, null, 2)], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `${name.replace(/\s+/g, "_").toLowerCase()}.json`;
    a.click();
    setShowExport(false);
    showToast(save ? "Template saved to library and downloaded" : "Template downloaded");
  };
  const openImport = () => {
    setImportStep(1); setSelectedTpl(null);
    fetch("/api/templates").then(r => r.json()).then(setTemplates);
    setShowImport(true);
  };
  const doImport = async () => {
    if (!selectedTpl) return;
    const res = await fetch(`/api/projects/${id}/import`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ templateId: selectedTpl.id, startDate: importStartDate }),
    });
    const data = await res.json();
    setShowImport(false); loadStages();
    showToast(`Imported ${data.stagesCreated} stages, ${data.mainCreated} main tasks, ${data.subCreated} sub tasks`);
  };
  const doBulkImport = async (stages: BulkStage[]) => {
    const res = await fetch(`/api/projects/${id}/bulk-import`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ stages }),
    });
    const data = await res.json();
    setShowBulkImport(false); loadStages();
    showToast(`Imported ${data.stagesCreated} stages, ${data.mainCreated} main tasks, ${data.subCreated} sub tasks`);
  };

  const poValue = bg?.poValue ?? 0;
  const clientTotal = clientClaims.reduce((s, c) => s + c.amount, 0);
  const contractorTotal = contractorClaims.reduce((s, c) => s + c.amount, 0);

  return (
    <div className="p-8 max-w-[1920px] mx-auto">
      <Link href="/dashboard/projects" className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 mb-4">
        <ArrowLeft className="w-3.5 h-3.5" /> Back to Projects
      </Link>

      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{project?.name}</h1>
          {project?.description && <p className="text-gray-500 mt-1 text-sm">{project.description}</p>}
        </div>
        <div className="flex gap-2">
          <button onClick={openImport} className="flex items-center gap-1.5 border border-gray-300 px-3 py-1.5 rounded-lg text-sm font-medium hover:bg-gray-50">
            <Upload className="w-3.5 h-3.5" /> Import template
          </button>
          <button onClick={() => setShowExport(true)} className="flex items-center gap-1.5 bg-blue-600 text-white px-3 py-1.5 rounded-lg text-sm font-medium hover:bg-blue-700">
            <Download className="w-3.5 h-3.5" /> Export as template
          </button>
        </div>
      </div>

      <div className="flex border-b border-gray-200 mb-6">
        {(["background", "plan", "finance"] as const).map(t => (
          <button key={t} onClick={() => setTab(t)}
            className={`px-4 py-2 text-sm -mb-px border-b-2 ${tab === t ? "border-blue-600 text-blue-600 font-medium" : "border-transparent text-gray-500 hover:text-gray-700"}`}>
            {TAB_LABELS[t]}
          </button>
        ))}
      </div>

      {tab === "background" && (
        <BackgroundTab
          bg={bg} bgForm={bgForm} setBgForm={setBgForm} editing={editingBg} setEditing={setEditingBg} save={saveBg}
          files={files} addFile={addFile} deleteFile={deleteFile}
          stages={stages} tasks={tasks} comments={comments} submitRemark={submitRemark}
          updateRemark={updateRemark} deleteRemark={deleteRemark}
          openTasks={openTasks} toggleOpen={toggleOpen}
        />
      )}

      {tab === "plan" && (
        <PlanTab
          stages={stages} tasks={tasks} comments={comments}
          openTasks={openTasks} toggleOpen={toggleOpen} expandAllTasks={expandAllTasks} collapseAllTasks={collapseAllTasks}
          openComments={openComments} toggleComments={toggleComments} closeAllComments={closeAllComments}
          submitRemark={submitRemark} attachPhoto={attachPhoto}
          toggleMilestone={toggleMilestone} deleteTask={deleteTask} patchTask={patchTask} patchStage={patchStage}
          addStage={addStage} deleteStage={deleteStage}
          addingTaskFor={addingTaskFor} setAddingTaskFor={setAddingTaskFor} addTask={addTask}
          taskView={taskView} setTaskView={setTaskView}
          dragging={dragging} hoverId={hoverId} startDrag={startDrag}
          showBulkImport={showBulkImport} setShowBulkImport={setShowBulkImport}
        />
      )}

      {tab === "finance" && (
        <FinanceTab
          poValue={poValue} poNumber={bg?.poNumber ?? null} clientTotal={clientTotal} contractorTotal={contractorTotal}
          stages={stages} contractors={contractors} contractorClaims={contractorClaims} clientClaims={clientClaims}
          showContractorForm={showContractorForm} setShowContractorForm={setShowContractorForm} addContractor={addContractor}
          showClaimForm={showClaimForm} setShowClaimForm={setShowClaimForm} addClaim={addClaim} setClaimStatus={setClaimStatus}
        />
      )}

      {showExport && <ExportModal onClose={() => setShowExport(false)} onExport={doExport} />}
      {showImport && (
        <ImportModal
          templates={templates} step={importStep} setStep={setImportStep}
          selected={selectedTpl} setSelected={setSelectedTpl}
          startDate={importStartDate} setStartDate={setImportStartDate}
          onClose={() => setShowImport(false)} onImport={doImport}
        />
      )}
      {showBulkImport && <BulkImportModal onClose={() => setShowBulkImport(false)} onImport={doBulkImport} />}
      {toast && (
        <div className="fixed bottom-5 right-5 bg-white border border-gray-200 shadow-lg rounded-lg px-4 py-2.5 text-sm text-gray-700 z-50">
          {toast}
        </div>
      )}
    </div>
  );
}

// ── Small local-state inputs (kept isolated so typing doesn't re-render the whole tree) ──

function AddStageRow({ addStage }: { addStage: (name: string) => void }) {
  const [value, setValue] = useState("");
  const submit = () => { if (value.trim()) { addStage(value); setValue(""); } };
  return (
    <div className="bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 flex gap-2">
      <input value={value} onChange={e => setValue(e.target.value)} onKeyDown={e => e.key === "Enter" && submit()}
        placeholder="New stage name…" className="flex-1 text-sm border border-gray-300 rounded-lg px-3 py-2 bg-white" />
      <button onClick={submit} className="text-sm text-blue-600 flex items-center gap-1 px-2 font-medium"><Plus className="w-4 h-4" /> Add stage</button>
    </div>
  );
}

function AddTaskRow({ placeholder, indent, onAdd, onCancel }: {
  placeholder: string; indent: number; onAdd: (title: string) => void; onCancel: () => void;
}) {
  const [value, setValue] = useState("");
  const submit = () => { if (value.trim()) onAdd(value); };
  return (
    <div className="px-2.5 py-2 bg-blue-50 border-b border-gray-200 flex gap-2" style={{ paddingLeft: indent }}>
      <input autoFocus value={value} onChange={e => setValue(e.target.value)} onKeyDown={e => e.key === "Enter" && submit()}
        placeholder={placeholder} className="flex-1 text-sm border border-gray-300 rounded-lg px-3 py-2" />
      <button onClick={submit} className="text-sm bg-blue-600 text-white px-3 py-2 rounded-lg font-medium">Add</button>
      <button onClick={onCancel} className="text-gray-400"><X className="w-4 h-4" /></button>
    </div>
  );
}

// Click a name to rename it in place. Local state keeps typing from re-rendering the tree.
function EditableName({ value, onSave, className }: { value: string; onSave: (v: string) => void; className: string }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);

  if (editing) {
    return (
      <input
        autoFocus
        value={draft}
        onChange={e => setDraft(e.target.value)}
        onFocus={e => e.target.select()}
        onClick={e => e.stopPropagation()}
        onBlur={() => {
          setEditing(false);
          const trimmed = draft.trim();
          if (trimmed && trimmed !== value) onSave(trimmed); else setDraft(value);
        }}
        onKeyDown={e => {
          if (e.key === "Enter") e.currentTarget.blur();
          if (e.key === "Escape") { setDraft(value); setEditing(false); }
        }}
        className={`${className} border border-blue-300 rounded px-1 -mx-1 bg-white`}
      />
    );
  }
  return (
    <span
      onClick={e => { e.stopPropagation(); setDraft(value); setEditing(true); }}
      title="Click to rename"
      className={`${className} cursor-text hover:bg-yellow-50 rounded px-0.5 -mx-0.5`}
    >
      {value}
    </span>
  );
}

// ── Background Tab ─────────────────────────────────────────────────────

function BackgroundTab(props: {
  bg: Background | null; bgForm: Background; setBgForm: (b: Background) => void; editing: boolean; setEditing: (b: boolean) => void; save: () => void;
  files: ProjFile[]; addFile: () => void; deleteFile: (fileId: string) => void;
  stages: Stage[]; tasks: PlanTask[]; comments: Comment[];
  submitRemark: (taskId: string, text: string) => void;
  updateRemark: (commentId: string, text: string) => void;
  deleteRemark: (commentId: string) => void;
  openTasks: Set<string>; toggleOpen: (id: string) => void;
}) {
  const { bg, bgForm, setBgForm, editing, setEditing, save, files, addFile, deleteFile, stages, tasks, comments, submitRemark, updateRemark, deleteRemark, openTasks, toggleOpen } = props;
  const [notesEditMode, setNotesEditMode] = useState(false);
  return (
    <div>
      <div className="grid grid-cols-2 gap-4 mb-6">
        <div className="bg-gray-50 border border-gray-200 rounded-xl p-4">
          <p className="text-sm font-semibold text-gray-400 uppercase tracking-wide mb-2">Why this project started</p>
          {editing ? (
            <textarea autoFocus value={bgForm.why ?? ""} onChange={e => setBgForm({ ...bgForm, why: e.target.value })} rows={4}
              className="w-full text-sm border border-gray-300 rounded-lg px-2 py-1.5" />
          ) : (
            <p onDoubleClick={() => setEditing(true)} title="Double-click to edit"
              className="text-sm text-gray-700 leading-relaxed cursor-text hover:bg-yellow-50 rounded px-1 -mx-1">
              {bg?.why || "Not set yet. Double-click to add."}
            </p>
          )}
        </div>
        <div className="bg-gray-50 border border-gray-200 rounded-xl p-4">
          <p className="text-sm font-semibold text-gray-400 uppercase tracking-wide mb-2">Project details</p>
          {editing ? (
            <div className="space-y-2">
              <input value={bgForm.client ?? ""} onChange={e => setBgForm({ ...bgForm, client: e.target.value })} placeholder="Client" className="w-full text-sm border border-gray-300 rounded-lg px-2 py-1" />
              <input value={bgForm.poNumber ?? ""} onChange={e => setBgForm({ ...bgForm, poNumber: e.target.value })} placeholder="PO number" className="w-full text-sm border border-gray-300 rounded-lg px-2 py-1" />
              <input type="number" value={bgForm.poValue ?? ""} onChange={e => setBgForm({ ...bgForm, poValue: e.target.value ? Number(e.target.value) : null })} placeholder="PO value ($)" className="w-full text-sm border border-gray-300 rounded-lg px-2 py-1" />
              <div className="flex gap-2">
                <input type="date" value={bgForm.targetStart ?? ""} onChange={e => setBgForm({ ...bgForm, targetStart: e.target.value })} className="w-full text-sm border border-gray-300 rounded-lg px-2 py-1" />
                <input type="date" value={bgForm.targetEnd ?? ""} onChange={e => setBgForm({ ...bgForm, targetEnd: e.target.value })} className="w-full text-sm border border-gray-300 rounded-lg px-2 py-1" />
              </div>
              <div className="flex gap-2 pt-1">
                <button onClick={save} className="bg-blue-600 text-white text-sm px-3 py-1.5 rounded-lg">Save</button>
                <button onClick={() => setEditing(false)} className="border border-gray-300 text-sm px-3 py-1.5 rounded-lg">Cancel</button>
              </div>
            </div>
          ) : (
            <div onDoubleClick={() => setEditing(true)} title="Double-click to edit" className="text-sm space-y-1 cursor-text hover:bg-yellow-50 rounded px-1 -mx-1">
              <Row label="Client" value={bg?.client} />
              <Row label="PO no." value={bg?.poNumber} />
              <Row label="PO value" value={bg?.poValue ? fmtMoney(bg.poValue) : null} />
              <Row label="Target" value={bg?.targetStart ? `${fmtDate(bg.targetStart)} – ${fmtDate(bg.targetEnd)}` : null} />
            </div>
          )}
        </div>
      </div>

      <p className="text-sm font-semibold text-gray-400 uppercase tracking-wide mb-2 flex items-center gap-1.5"><FileText className="w-3.5 h-3.5" /> Diagrams &amp; project plans</p>
      <div className="flex gap-2 flex-wrap mb-6">
        {files.map(f => (
          <div key={f.id} className="flex items-center gap-1.5 border border-gray-200 rounded-lg pl-2.5 pr-1.5 py-1.5 text-sm bg-white hover:border-blue-300">
            <a href={f.url} target="_blank" className="flex items-center gap-1.5">
              <FileText className="w-3.5 h-3.5 text-gray-400" /> {f.name}
            </a>
            <button onClick={() => deleteFile(f.id)} title="Remove file" className="text-gray-300 hover:text-red-500 p-0.5">
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        ))}
        <button onClick={addFile} className="flex items-center gap-1.5 border border-dashed border-gray-300 rounded-lg px-2.5 py-1.5 text-sm text-gray-500 hover:border-blue-300">
          <Upload className="w-3.5 h-3.5" /> Upload…
        </button>
      </div>

      <div className="border-t border-gray-100 pt-5">
        <div className="flex items-center justify-between mb-1">
          <p className="text-sm font-semibold text-gray-500 uppercase tracking-wide">Project updates &amp; blockers</p>
          <button
            onClick={() => setNotesEditMode(v => !v)}
            className={`text-xs px-3 py-1 rounded-lg border transition-colors font-medium ${notesEditMode ? "bg-sky-500 text-white border-sky-500 hover:bg-sky-600" : "border-gray-300 text-gray-500 hover:border-sky-400 hover:text-sky-500"}`}
          >
            {notesEditMode ? "Done" : "Edit"}
          </button>
        </div>
        <p className="text-sm text-gray-400 mb-2">Click <b className="text-gray-500">Edit</b> then the <span className="inline-flex items-center justify-center w-4 h-4 rounded-full bg-sky-100 text-sky-500 text-[10px] font-bold align-middle">+</span> on any task to post a status update or blocker — it shows here and in the Plan tab's remarks.</p>
        <StatusTaskTree stages={stages} tasks={tasks} comments={comments} submitRemark={submitRemark} updateRemark={updateRemark} deleteRemark={deleteRemark} openTasks={openTasks} toggleOpen={toggleOpen} editMode={notesEditMode} />
      </div>
    </div>
  );
}

function StatusTaskTree({ stages, tasks, comments, submitRemark, updateRemark, deleteRemark, openTasks, toggleOpen, editMode }: {
  stages: Stage[]; tasks: PlanTask[]; comments: Comment[];
  submitRemark: (taskId: string, text: string) => void;
  updateRemark: (commentId: string, text: string) => void;
  deleteRemark: (commentId: string) => void;
  openTasks: Set<string>; toggleOpen: (id: string) => void; editMode: boolean;
}) {
  if (stages.length === 0) return <p className="text-sm text-gray-400 text-center py-10 border border-gray-200 rounded-xl">No stages yet — add them in the Plan tab.</p>;
  return (
    <div className="border border-gray-200 rounded-xl overflow-hidden">
      <div className="grid grid-cols-[1fr_70px_70px_70px_70px] gap-1 bg-gray-50 border-b border-gray-200 px-2.5 py-1.5 text-sm font-medium text-gray-400 uppercase">
        <span>Activity</span><span>Plan start</span><span>Plan end</span><span>Act. start</span><span>Act. end</span>
      </div>
      {stages.map(stage => {
        const mainTasks = tasks.filter(t => t.stageId === stage.id && !t.parentId);
        return (
          <div key={stage.id}>
            <div className="grid grid-cols-[1fr_70px_70px_70px_70px] gap-1 items-center px-2.5 py-2 bg-gray-50 border-b border-gray-200 cursor-pointer" onClick={() => toggleOpen(stage.id)}>
              <div className="flex items-center gap-1.5 min-w-0">
                <ChevronRight className={`w-3 h-3 flex-shrink-0 transition-transform ${openTasks.has(stage.id) ? "rotate-90" : ""}`} />
                <span className={`w-2 h-2 rounded-full flex-shrink-0 ${STAGE_DOT[stage.status]}`} />
                <b className="text-sm truncate">{stage.name}</b>
              </div>
              <span className="text-sm text-gray-400">{fmtDate(stage.planStart)}</span>
              <span className="text-sm text-gray-400">{fmtDate(stage.planEnd)}</span>
              <span className="text-sm text-blue-500">{fmtDate(stage.actualStart)}</span>
              <span className="text-sm text-blue-500">{fmtDate(stage.actualEnd)}</span>
            </div>
            {openTasks.has(stage.id) && mainTasks.map(mt => (
              <StatusTaskRow key={mt.id} task={mt} subTasks={tasks.filter(t => t.parentId === mt.id)}
                comments={comments} submitRemark={submitRemark} updateRemark={updateRemark} deleteRemark={deleteRemark} openTasks={openTasks} toggleOpen={toggleOpen} editMode={editMode} />
            ))}
          </div>
        );
      })}
    </div>
  );
}

function StatusTaskRow({ task, subTasks, comments, submitRemark, updateRemark, deleteRemark, openTasks, toggleOpen, editMode }: {
  task: PlanTask; subTasks: PlanTask[]; comments: Comment[];
  submitRemark: (taskId: string, text: string) => void;
  updateRemark: (commentId: string, text: string) => void;
  deleteRemark: (commentId: string) => void;
  openTasks: Set<string>; toggleOpen: (id: string) => void; editMode: boolean;
}) {
  const hasChildren = subTasks.length > 0;
  return (
    <>
      <div className="grid grid-cols-[1fr_70px_70px_70px_70px] gap-1 items-center pl-5 pr-2.5 py-1.5 bg-white border-b border-gray-100 hover:bg-gray-50 cursor-pointer" onClick={() => hasChildren && toggleOpen(task.id)}>
        <div className="flex items-center gap-1.5 min-w-0">
          {hasChildren ? <ChevronRight className={`w-3 h-3 flex-shrink-0 transition-transform ${openTasks.has(task.id) ? "rotate-90" : ""}`} /> : <span className="w-3 text-center text-gray-300 text-sm">—</span>}
          <span className={`w-1.5 h-1.5 rotate-45 flex-shrink-0 ${task.isMilestone ? "bg-purple-600" : "bg-gray-400"}`} />
          <span className="text-sm truncate">{task.title}</span>
          {task.isMilestone && <span className="text-[11px] bg-purple-100 text-purple-700 px-1.5 py-0.5 rounded-full flex items-center gap-0.5 flex-shrink-0"><Flag className="w-2 h-2" /></span>}
        </div>
        <span className="text-sm text-gray-400">{fmtDate(task.planStart)}</span>
        <span className="text-sm text-gray-400">{fmtDate(task.planEnd)}</span>
        <span className="text-sm text-blue-500">{fmtDate(task.actualStart)}</span>
        <span className="text-sm text-blue-500">{fmtDate(task.actualEnd)}</span>
      </div>
      <TaskNotes taskId={task.id} comments={comments} submitRemark={submitRemark} updateRemark={updateRemark} deleteRemark={deleteRemark} indent="pl-9" editMode={editMode} />
      {openTasks.has(task.id) && subTasks.map(st => (
        <div key={st.id}>
          <div className="grid grid-cols-[1fr_70px_70px_70px_70px] gap-1 items-center pl-9 pr-2.5 py-1.5 bg-white border-b border-gray-100 hover:bg-gray-50">
            <div className="flex items-center gap-1.5 min-w-0">
              <span className="w-1.5 h-[1.5px] bg-gray-300 flex-shrink-0" />
              <span className="text-sm text-gray-500 truncate">{st.title}</span>
            </div>
            <span className="text-sm text-gray-400">{fmtDate(st.planStart)}</span>
            <span className="text-sm text-gray-400">{fmtDate(st.planEnd)}</span>
            <span className="text-sm text-blue-500">{fmtDate(st.actualStart)}</span>
            <span className="text-sm text-blue-500">{fmtDate(st.actualEnd)}</span>
          </div>
          <TaskNotes taskId={st.id} comments={comments} submitRemark={submitRemark} updateRemark={updateRemark} deleteRemark={deleteRemark} indent="pl-12" editMode={editMode} />
        </div>
      ))}
    </>
  );
}

function TaskNotes({ taskId, comments, submitRemark, updateRemark, deleteRemark, indent, editMode }: {
  taskId: string; comments: Comment[];
  submitRemark: (taskId: string, text: string) => void;
  updateRemark: (commentId: string, text: string) => void;
  deleteRemark: (commentId: string) => void;
  indent: string; editMode: boolean;
}) {
  const [draft, setDraft] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingText, setEditingText] = useState("");
  const notes = comments.filter(c => c.taskId === taskId && c.text);

  const submit = () => { if (draft.trim()) { submitRemark(taskId, draft); setDraft(""); } };
  const saveEdit = (commentId: string) => {
    if (editingText.trim()) updateRemark(commentId, editingText.trim());
    setEditingId(null); setEditingText("");
  };

  useEffect(() => { if (!editMode) { setDraft(""); setEditingId(null); setEditingText(""); } }, [editMode]);

  if (notes.length === 0 && !editMode) return null;

  return (
    <div className={`grid grid-cols-[minmax(0,1fr)_70px_70px_70px_70px] gap-1 ${indent} pr-2.5 ${notes.length > 0 ? "bg-amber-50/50" : ""} border-b border-gray-100`}>
      <div className="py-1 space-y-0.5 min-w-0 overflow-hidden">
        {notes.map(c => (
          <div key={c.id} className="flex items-start gap-1.5">
            <MessageSquare className="w-3 h-3 mt-0.5 flex-shrink-0 text-amber-500" />
            {editMode && editingId === c.id ? (
              <div className="flex items-start gap-1.5 flex-1 min-w-0">
                <textarea autoFocus value={editingText} onChange={e => setEditingText(e.target.value)}
                  onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); saveEdit(c.id); } if (e.key === "Escape") setEditingId(null); }}
                  rows={1}
                  onInput={(e) => { const t = e.currentTarget; t.style.height = "auto"; t.style.height = t.scrollHeight + "px"; }}
                  className="flex-1 min-w-0 text-sm border border-sky-300 rounded-lg px-2 py-0.5 bg-white focus:outline-none resize-none overflow-hidden" />
                <button onClick={() => saveEdit(c.id)} className="text-xs text-sky-600 font-medium flex-shrink-0 mt-0.5">Save</button>
                <button onClick={() => setEditingId(null)} className="text-gray-300 hover:text-gray-500 flex-shrink-0 mt-0.5"><X className="w-3 h-3" /></button>
              </div>
            ) : (
              <span className="text-sm text-amber-800 flex-1 min-w-0 break-words">
                <b className="font-medium">{c.authorName}</b> · {new Date(c.createdAt).toLocaleDateString()} — {c.text}
              </span>
            )}
            {editMode && editingId !== c.id && (
              <div className="flex items-center gap-1 ml-auto flex-shrink-0">
                <button onClick={() => { setEditingId(c.id); setEditingText(c.text ?? ""); }} title="Edit comment" className="text-gray-300 hover:text-sky-500 transition-colors"><Pencil className="w-3 h-3" /></button>
                <button onClick={() => deleteRemark(c.id)} title="Delete comment" className="text-gray-300 hover:text-red-500 transition-colors"><Trash2 className="w-3 h-3" /></button>
              </div>
            )}
          </div>
        ))}
        {editMode && (
          <div className="flex items-start gap-1.5 pt-0.5 max-w-[50%]">
            <textarea value={draft} onChange={e => setDraft(e.target.value)}
              onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); submit(); } }}
              onInput={(e) => { const t = e.currentTarget; t.style.height = "auto"; t.style.height = t.scrollHeight + "px"; }}
              placeholder="Add update or blocker…"
              rows={1}
              className="flex-1 text-sm border border-gray-200 rounded-lg px-2 py-1 bg-white focus:border-sky-300 focus:outline-none resize-none overflow-hidden" />
            <button onClick={submit} disabled={!draft.trim()}
              className="text-xs text-sky-600 font-medium flex-shrink-0 disabled:opacity-40 px-1 mt-1">Post</button>
          </div>
        )}
      </div>
      <span /><span /><span /><span />
    </div>
  );
}

// ── Plan Tab (full task-breakdown editing: add/rename/reorder/delete/drag) ──

function PlanTab(props: {
  stages: Stage[]; tasks: PlanTask[]; comments: Comment[];
  openTasks: Set<string>; toggleOpen: (id: string) => void; expandAllTasks: () => void; collapseAllTasks: () => void;
  openComments: Set<string>; toggleComments: (id: string) => void; closeAllComments: () => void;
  submitRemark: (taskId: string, text: string) => void; attachPhoto: (id: string) => void;
  toggleMilestone: (t: PlanTask) => void; deleteTask: (id: string) => void; patchTask: (id: string, v: Partial<PlanTask>) => void; patchStage: (id: string, v: Partial<Stage>) => void;
  addStage: (name: string) => void; deleteStage: (id: string) => void;
  addingTaskFor: { stageId: string; parentId: string | null } | null; setAddingTaskFor: (v: { stageId: string; parentId: string | null } | null) => void;
  addTask: (stageId: string, parentId: string | null, title: string) => void;
  taskView: "list" | "timeline"; setTaskView: (v: "list" | "timeline") => void;
  showBulkImport: boolean; setShowBulkImport: (b: boolean) => void;
} & DragCtl) {
  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <p className="text-sm text-gray-400">Build the stage / main task / sub task structure, set planned dates, and log actual progress and remarks here. Background shows a read-only summary.</p>
        <button onClick={() => props.setShowBulkImport(true)} className="flex items-center gap-1.5 border border-gray-300 px-3 py-1.5 rounded-lg text-sm font-medium hover:bg-gray-50 flex-shrink-0 ml-3">
          <Upload className="w-3.5 h-3.5" /> Bulk import from text
        </button>
      </div>
      <TaskTree {...props} />
    </div>
  );
}

function Row({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <div className="flex justify-between border-b border-gray-100 py-1 text-sm">
      <span className="text-gray-400">{label}</span>
      <span className="text-gray-800 font-medium">{value || "—"}</span>
    </div>
  );
}

// ── Task Tree (shared structure for Background) ────────────────────────

function TaskTree(props: {
  stages: Stage[]; tasks: PlanTask[]; comments: Comment[];
  openTasks: Set<string>; toggleOpen: (id: string) => void; expandAllTasks: () => void; collapseAllTasks: () => void;
  openComments: Set<string>; toggleComments: (id: string) => void; closeAllComments: () => void;
  submitRemark: (taskId: string, text: string) => void; attachPhoto: (id: string) => void;
  toggleMilestone: (t: PlanTask) => void; deleteTask: (id: string) => void; patchTask: (id: string, v: Partial<PlanTask>) => void; patchStage: (id: string, v: Partial<Stage>) => void;
  addStage: (name: string) => void; deleteStage: (id: string) => void;
  addingTaskFor: { stageId: string; parentId: string | null } | null; setAddingTaskFor: (v: { stageId: string; parentId: string | null } | null) => void;
  addTask: (stageId: string, parentId: string | null, title: string) => void;
  taskView: "list" | "timeline"; setTaskView: (v: "list" | "timeline") => void;
} & DragCtl) {
  const {
    stages, tasks, comments, openTasks, toggleOpen, expandAllTasks, collapseAllTasks,
    openComments, toggleComments, closeAllComments, submitRemark, attachPhoto,
    toggleMilestone, deleteTask, patchTask, patchStage, addStage, deleteStage,
    addingTaskFor, setAddingTaskFor, addTask, taskView, setTaskView,
    dragging, hoverId, startDrag,
  } = props;

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <p className="text-sm font-semibold text-gray-500 uppercase tracking-wide flex items-center gap-1.5">Task breakdown</p>
        <div className="flex items-center gap-3">
          <div className="flex border border-gray-200 rounded-lg overflow-hidden text-sm">
            <button onClick={() => setTaskView("list")} className={`px-2.5 py-1 ${taskView === "list" ? "bg-gray-100 font-medium text-gray-900" : "text-gray-400"}`}>List</button>
            <button onClick={() => setTaskView("timeline")} className={`px-2.5 py-1 border-l border-gray-200 ${taskView === "timeline" ? "bg-gray-100 font-medium text-gray-900" : "text-gray-400"}`}>Timeline</button>
          </div>
          <button onClick={expandAllTasks} className="text-sm text-blue-600 hover:underline">Expand all</button>
          <button onClick={collapseAllTasks} className="text-sm text-blue-600 hover:underline">Collapse all</button>
          <button onClick={closeAllComments} className="text-sm text-blue-600 hover:underline">Close remarks</button>
        </div>
      </div>

      {taskView === "timeline" ? (
        <GanttView stages={stages} tasks={tasks} openTasks={openTasks} toggleOpen={toggleOpen}
          comments={comments} patchTask={patchTask} toggleMilestone={toggleMilestone} deleteTask={deleteTask}
          submitRemark={submitRemark} attachPhoto={attachPhoto} />
      ) : (
      <div className="overflow-x-auto">
      <div className="border border-gray-200 rounded-xl overflow-hidden">
        <div className="grid grid-cols-[minmax(200px,1fr)_118px_118px_118px_118px_100px_100px] min-w-[1080px] gap-1 bg-gray-50 border-b border-gray-200 px-2.5 py-1.5 text-sm font-medium text-gray-400 uppercase">
          <span>Activity</span><span>Plan start</span><span>Plan end</span><span>Act. start</span><span>Act. end</span><span>Status</span><span></span>
        </div>

        {stages.map(stage => {
          const mainTasks = tasks.filter(t => t.stageId === stage.id && !t.parentId);
          return (
            <div key={stage.id}>
              <div data-drop-id={stage.id} {...longPressHandlers(() => startDrag("stage", stage.id))}
                className={`grid grid-cols-[minmax(200px,1fr)_118px_118px_118px_118px_100px_100px] min-w-[1080px] gap-1 items-center px-2.5 py-2 border-b border-gray-200 cursor-pointer select-none ${dragging?.id === stage.id ? "opacity-40" : "bg-gray-50"} ${hoverId === stage.id && dragging && dragging.id !== stage.id ? "ring-2 ring-blue-400 ring-inset" : ""}`}
                onClick={() => toggleOpen(stage.id)}>
                <div className="flex items-center gap-1.5 min-w-0">
                  <ChevronRight className={`w-3 h-3 flex-shrink-0 transition-transform ${openTasks.has(stage.id) ? "rotate-90" : ""}`} />
                  <span className={`w-2 h-2 rounded-full flex-shrink-0 ${STAGE_DOT[stage.status]}`} />
                  <EditableName value={stage.name} onSave={v => patchStage(stage.id, { name: v })} className="text-sm font-bold truncate" />
                </div>
                <span className="text-sm text-gray-400">{fmtDate(stage.planStart)}</span>
                <span className="text-sm text-gray-400">{fmtDate(stage.planEnd)}</span>
                <span className="text-sm text-blue-500">{fmtDate(stage.actualStart)}</span>
                <span className="text-sm text-blue-500">{fmtDate(stage.actualEnd)}</span>
                <select value={stage.status} onChange={e => { e.stopPropagation(); patchStage(stage.id, { status: e.target.value as StageStatus }); }} onClick={e => e.stopPropagation()}
                  className="text-sm border border-gray-200 rounded px-1 py-0.5">
                  <option value="pending">Pending</option>
                  <option value="in_progress">In progress</option>
                  <option value="done">Done</option>
                </select>
                <div className="flex gap-1 justify-end">
                  <button onClick={e => { e.stopPropagation(); setAddingTaskFor({ stageId: stage.id, parentId: null }); if (!openTasks.has(stage.id)) toggleOpen(stage.id); }} className="w-5 h-5 border border-gray-200 rounded flex items-center justify-center hover:border-blue-300"><Plus className="w-3 h-3" /></button>
                  <button onClick={e => { e.stopPropagation(); deleteStage(stage.id); }} className="w-5 h-5 border border-gray-200 rounded flex items-center justify-center hover:border-red-300 text-gray-400 hover:text-red-500"><Trash2 className="w-3 h-3" /></button>
                </div>
              </div>

              {openTasks.has(stage.id) && mainTasks.map(mt => (
                <MainTaskRow key={mt.id} task={mt} subTasks={tasks.filter(t => t.parentId === mt.id)} comments={comments}
                  openTasks={openTasks} toggleOpen={toggleOpen} openComments={openComments} toggleComments={toggleComments}
                  submitRemark={submitRemark} attachPhoto={attachPhoto}
                  toggleMilestone={toggleMilestone} deleteTask={deleteTask} patchTask={patchTask}
                  setAddingTaskFor={setAddingTaskFor} stageId={stage.id}
                  addingTaskFor={addingTaskFor} addTask={addTask}
                  dragging={dragging} hoverId={hoverId} startDrag={startDrag} />
              ))}

              {openTasks.has(stage.id) && addingTaskFor?.stageId === stage.id && addingTaskFor.parentId === null && (
                <AddTaskRow
                  placeholder="Main task title…"
                  indent={20}
                  onAdd={title => addTask(stage.id, null, title)}
                  onCancel={() => setAddingTaskFor(null)}
                />
              )}
            </div>
          );
        })}

        <div className="p-2.5 bg-gray-50">
          <AddStageRow addStage={addStage} />
        </div>
      </div>
      </div>
      )}
    </div>
  );
}

// ── Gantt / Timeline view ────────────────────────────────────────────────

function GanttView({ stages, tasks, openTasks, toggleOpen, comments, patchTask, toggleMilestone, deleteTask, submitRemark, attachPhoto }: {
  stages: Stage[]; tasks: PlanTask[]; openTasks: Set<string>; toggleOpen: (id: string) => void;
  comments: Comment[];
  patchTask: (id: string, v: Partial<PlanTask>) => void;
  toggleMilestone: (t: PlanTask) => void;
  deleteTask: (id: string) => void;
  submitRemark: (taskId: string, text: string) => void;
  attachPhoto: (id: string) => void;
}) {
  const [focusMode, setFocusMode] = useState(false);
  const [showPast, setShowPast] = useState(false);
  const [showFuture, setShowFuture] = useState(false);
  const [focusTaskId, setFocusTaskId] = useState<string | null>(null);
  const [detailTaskId, setDetailTaskId] = useState<string | null>(null);

  const allDates: number[] = [];
  for (const s of stages) {
    if (s.planStart) allDates.push(new Date(s.planStart).getTime());
    if (s.planEnd) allDates.push(new Date(s.planEnd).getTime());
  }
  for (const t of tasks) {
    for (const d of [t.planStart, t.planEnd, t.actualStart, t.actualEnd]) {
      if (d) allDates.push(new Date(d).getTime());
    }
  }
  const today = Date.now();

  if (allDates.length === 0) {
    return <p className="text-sm text-gray-400 text-center py-12 border border-gray-200 rounded-xl">No planned dates yet — add plan start/end dates in Plan view to see the timeline.</p>;
  }

  const rangeStart = Math.min(...allDates, today);
  const rangeEnd = Math.max(...allDates, today);
  const span = Math.max(rangeEnd - rangeStart, 86400000);

  const pct = (d: string | null) => d ? ((new Date(d).getTime() - rangeStart) / span) * 100 : null;
  const todayPct = ((today - rangeStart) / span) * 100;

  const ticks = 5;
  const tickDates = Array.from({ length: ticks + 1 }, (_, i) => new Date(rangeStart + (span * i) / ticks));
  const totalDays = Math.round(span / 86400000);
  const showDailyRuler = totalDays <= 90; // beyond ~3 months, per-day ticks would be too dense to read

  const weekendBands: { left: number; width: number }[] = [];
  if (showDailyRuler) {
    for (let i = 0; i <= totalDays; i++) {
      const d = new Date(rangeStart + i * 86400000);
      if (d.getUTCDay() === 6 || d.getUTCDay() === 0) {
        weekendBands.push({ left: (i / totalDays) * 100, width: (1 / totalDays) * 100 });
      }
    }
  }
  const gridlinePcts = showDailyRuler
    ? Array.from({ length: totalDays + 1 }, (_, i) => (i % 5 === 0 || i === totalDays) ? (i / totalDays) * 100 : null).filter((v): v is number => v !== null)
    : tickDates.map((_, i) => (i / ticks) * 100);

  // RAG risk model, bumped to more saturated tones for presentation visibility.
  const WARNING_WINDOW_MS = 2 * 86400000;
  const taskRisk = (t: PlanTask): "risk" | "warning" | "ontrack" => {
    if (t.status === "done") return "ontrack";
    const planEndMs = t.planEnd ? new Date(t.planEnd).getTime() : null;
    const planStartMs = t.planStart ? new Date(t.planStart).getTime() : null;
    if (planEndMs !== null && planEndMs < today) return "risk";
    if (t.status === "pending" && planStartMs !== null && planStartMs < today) return "warning";
    if (t.status === "in_progress" && planEndMs !== null && planEndMs - today <= WARNING_WINDOW_MS) return "warning";
    return "ontrack";
  };
  const RISK_COLOR = { risk: "#DC2626", warning: "#F59E0B", ontrack: "#16A34A" } as const;
  const CURRENT_COLOR = "#2563EB";
  const barColor = (t: PlanTask) => RISK_COLOR[taskRisk(t)];

  // Flatten main tasks in stage order, so Focus mode can anchor on a specific task, not just a stage.
  const flatMainTasks: { task: PlanTask; stage: Stage }[] = [];
  stages.forEach(s => tasks.filter(t => t.stageId === s.id && !t.parentId).forEach(t => flatMainTasks.push({ task: t, stage: s })));
  const autoCurrentIdx = flatMainTasks.findIndex(x => x.task.status !== "done");
  const autoCurrentTaskId = autoCurrentIdx >= 0 ? flatMainTasks[autoCurrentIdx].task.id : (flatMainTasks.length ? flatMainTasks[flatMainTasks.length - 1].task.id : null);
  const effectiveCurrentTaskId = focusTaskId ?? autoCurrentTaskId;
  const currentIdx = flatMainTasks.findIndex(x => x.task.id === effectiveCurrentTaskId);
  const currentEntry = currentIdx >= 0 ? flatMainTasks[currentIdx] : null;
  const nextEntry = currentIdx >= 0 && currentIdx + 1 < flatMainTasks.length ? flatMainTasks[currentIdx + 1] : null;
  const currentStageIdx = currentEntry ? stages.findIndex(s => s.id === currentEntry.stage.id) : -1;
  const nextStageIdx = nextEntry ? stages.findIndex(s => s.id === nextEntry.stage.id) : currentStageIdx;
  const pastStages = currentStageIdx >= 0 ? stages.slice(0, currentStageIdx) : [];
  const futureStages = nextStageIdx >= 0 ? stages.slice(nextStageIdx + 1) : [];
  const activeStageIds = [currentEntry?.stage.id, nextEntry?.stage.id].filter((v, i, a): v is string => !!v && a.indexOf(v) === i);

  const renderDecorations = () => (
    <>
      {weekendBands.map((b, i) => <div key={`w${i}`} className="absolute top-0 bottom-0 bg-gray-100/60" style={{ left: `${b.left}%`, width: `${b.width}%` }} />)}
      {gridlinePcts.map((p, i) => <div key={`g${i}`} className="absolute top-0 bottom-0 w-px bg-gray-100" style={{ left: `${p}%` }} />)}
      {todayPct >= 0 && todayPct <= 100 && <div className="absolute top-0 bottom-0 w-px bg-blue-500" style={{ left: `${todayPct}%` }} />}
    </>
  );

  // Label pane and bar pane are two separate scroll contexts, so every visual row is built as a
  // {label, bar} pair pushed into one shared array — this keeps the two panes in lockstep without
  // relying on position:sticky inside a horizontally-scrolling grid (which doesn't hold a full-width
  // column pinned once the grid's own track starts scrolling).
  type Row = { key: string; label: React.ReactNode; bar: React.ReactNode };
  const rows: Row[] = [];

  const pushTaskRows = (t: PlanTask, opts: { dim?: boolean; badge?: "current" | "next" }) => {
    const planL = pct(t.planStart), planR = pct(t.planEnd);
    const actL = pct(t.actualStart) ?? planL, actR = pct(t.actualEnd) ?? (t.status === "done" ? planR : (planL !== null ? Math.min(todayPct, 100) : null));
    const hasChildren = !t.parentId && tasks.some(x => x.parentId === t.id);
    const tooltip = `${t.title}\nPlan: ${fmtDate(t.planStart)} – ${fmtDate(t.planEnd)}\nActual: ${fmtDate(t.actualStart)} – ${fmtDate(t.actualEnd)}`;
    const dim = !!opts.dim;
    rows.push({
      key: t.id,
      label: (
        <div className={`h-10 flex items-center gap-1.5 pr-4 text-sm cursor-pointer ${t.parentId ? "pl-6" : ""} ${dim ? "opacity-50" : ""}`} onClick={() => setDetailTaskId(t.id)}>
          {hasChildren && <ChevronRight className={`w-3 h-3 flex-shrink-0 transition-transform ${openTasks.has(t.id) ? "rotate-90" : ""}`} onClick={e => { e.stopPropagation(); toggleOpen(t.id); }} />}
          {t.isMilestone ? <span className="w-1.5 h-1.5 rotate-45 flex-shrink-0" style={{ background: "#9333EA" }} /> : <span className="w-1.5 h-1.5 rounded-full flex-shrink-0 bg-gray-300" />}
          <span className={`line-clamp-2 ${t.status === "done" ? "line-through text-gray-400" : t.isMilestone ? "text-purple-700 font-medium" : t.parentId ? "text-gray-500" : "text-gray-700"}`}>{t.title}</span>
          {opts.badge === "current" && <span className="text-[10px] font-bold text-white px-1.5 py-0.5 rounded-full animate-pulse flex-shrink-0" style={{ background: CURRENT_COLOR }}>● CURRENT</span>}
          {opts.badge === "next" && <span className="text-[10px] font-bold text-purple-700 bg-purple-100 px-1.5 py-0.5 rounded-full flex-shrink-0">NEXT UP</span>}
        </div>
      ),
      bar: (
        <div title={tooltip} onClick={() => setDetailTaskId(t.id)} className={`relative h-10 rounded cursor-pointer hover:bg-gray-50 ${dim ? "opacity-50" : ""}`}>
          {renderDecorations()}
          <div className="absolute top-1/2 -translate-y-1/2 left-0 right-0 h-1.5 bg-gray-100 rounded" />
          {planL !== null && planR !== null && (
            <div className="absolute top-1/2 -translate-y-1/2 h-1.5 rounded bg-gray-300" style={{ left: `${planL}%`, width: `${Math.max(planR - planL, 0.5)}%` }} />
          )}
          {actL !== null && actR !== null && (
            <div className="absolute top-1/2 -translate-y-1/2 h-1.5 rounded" style={{ left: `${actL}%`, width: `${Math.max(actR - actL, 0.5)}%`, background: t.status === "in_progress" && !dim ? CURRENT_COLOR : barColor(t) }} />
          )}
          {actR !== null && (
            t.isMilestone
              ? <div className="absolute top-1/2 -translate-x-1/2 -translate-y-1/2 w-2.5 h-2.5 rotate-45 border-2 border-white shadow" style={{ left: `${actR}%`, background: barColor(t) }} />
              : <div className="absolute top-1/2 -translate-x-1/2 -translate-y-1/2 w-2.5 h-2.5 rounded-full border-2 border-white shadow" style={{ left: `${actR}%`, background: t.status === "in_progress" && !dim ? CURRENT_COLOR : barColor(t) }} />
          )}
        </div>
      ),
    });
    if (hasChildren && openTasks.has(t.id)) {
      tasks.filter(x => x.parentId === t.id).forEach(st => pushTaskRows(st, { dim }));
    }
  };

  const pushStageRows = (stage: Stage, opts: { forceOpen?: boolean; dim?: boolean; currentTaskId?: string; nextTaskId?: string }) => {
    const mainTasks = tasks.filter(t => t.stageId === stage.id && !t.parentId);
    const isOpen = opts.forceOpen || openTasks.has(stage.id);
    rows.push({
      key: `stage-${stage.id}`,
      label: (
        <div className="h-12 cursor-pointer rounded hover:bg-gray-50 flex items-center gap-1.5" onClick={() => toggleOpen(stage.id)}>
          <ChevronRight className={`w-3 h-3 flex-shrink-0 transition-transform ${isOpen ? "rotate-90" : ""}`} />
          <span className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${STAGE_DOT[stage.status]}`} />
          <span className="text-sm font-semibold line-clamp-2">{stage.name}</span>
        </div>
      ),
      bar: <div className="h-12" />,
    });
    if (!isOpen) return;
    if (mainTasks.length === 0) {
      rows.push({
        key: `empty-${stage.id}`,
        label: <p className="text-sm text-gray-400">No tasks yet.</p>,
        bar: <p className="text-sm opacity-0" aria-hidden>No tasks yet.</p>,
      });
      return;
    }
    mainTasks.forEach(t => pushTaskRows(t, {
      dim: opts.dim,
      badge: t.id === opts.currentTaskId ? "current" : t.id === opts.nextTaskId ? "next" : undefined,
    }));
  };

  const pushToggleRow = (key: string, expanded: boolean, onToggle: () => void, text: string) => {
    rows.push({
      key,
      label: (
        <button onClick={onToggle} className="w-full text-left text-sm text-gray-400 bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 hover:bg-gray-100 whitespace-nowrap">
          {expanded ? "▾" : "▸"} {text}
        </button>
      ),
      bar: <div className="bg-gray-50 border border-gray-200 rounded-lg px-3 py-2" aria-hidden>&nbsp;</div>,
    });
  };

  if (!focusMode) {
    stages.forEach(stage => pushStageRows(stage, {}));
  } else {
    if (pastStages.length > 0) pushToggleRow("past-toggle", showPast, () => setShowPast(v => !v), `✓ ${pastStages.length} stage${pastStages.length > 1 ? "s" : ""} completed`);
    if (showPast) pastStages.forEach(stage => pushStageRows(stage, { forceOpen: true, dim: true }));

    activeStageIds.forEach(id => pushStageRows(stages.find(s => s.id === id)!, {
      forceOpen: true,
      currentTaskId: currentEntry?.task.id,
      nextTaskId: nextEntry?.task.id,
    }));

    if (futureStages.length > 0) pushToggleRow("future-toggle", showFuture, () => setShowFuture(v => !v), `${futureStages.length} more stage${futureStages.length > 1 ? "s" : ""} upcoming`);
    if (showFuture) futureStages.forEach(stage => pushStageRows(stage, { forceOpen: true, dim: true }));

    if (!currentEntry) {
      rows.push({
        key: "all-done",
        label: <p className="text-sm text-center py-6 font-medium" style={{ color: RISK_COLOR.ontrack }}>🎉 All tasks completed</p>,
        bar: <p className="text-sm text-center py-6 opacity-0" aria-hidden>placeholder</p>,
      });
    }
  }

  const focusOptions: { taskId: string; stageName: string; title: string }[] = flatMainTasks.map(x => ({ taskId: x.task.id, stageName: x.stage.name, title: x.task.title }));

  return (
    <div className="border border-gray-200 rounded-xl p-4">
      <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
        <div className="flex gap-4 text-sm text-gray-500 flex-wrap">
          <span className="flex items-center gap-1"><span className="w-3 h-1 rounded bg-gray-300 inline-block" /> Planned</span>
          <span className="flex items-center gap-1"><span className="w-3 h-1 rounded inline-block" style={{ background: RISK_COLOR.ontrack }} /> On track</span>
          <span className="flex items-center gap-1"><span className="w-3 h-1 rounded inline-block" style={{ background: CURRENT_COLOR }} /> In progress</span>
          <span className="flex items-center gap-1"><span className="w-3 h-1 rounded inline-block" style={{ background: RISK_COLOR.warning }} /> Warning</span>
          <span className="flex items-center gap-1"><span className="w-3 h-1 rounded inline-block" style={{ background: RISK_COLOR.risk }} /> Risk</span>
          <span className="flex items-center gap-1"><span className="w-1.5 h-1.5 rotate-45 inline-block" style={{ background: "#9333EA" }} /> Milestone</span>
          <span className="flex items-center gap-1"><span className="w-px h-3 inline-block bg-blue-500" /> Today</span>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          {focusMode && (
            <select value={effectiveCurrentTaskId ?? ""} onChange={e => setFocusTaskId(e.target.value)}
              className="text-[11px] border border-gray-300 rounded-lg px-2 py-1.5 text-gray-600 max-w-[220px]">
              {focusOptions.map(o => <option key={o.taskId} value={o.taskId}>Focus: {o.stageName} – {o.title}</option>)}
            </select>
          )}
          <button onClick={() => setFocusMode(f => !f)}
            className={`text-[11px] font-semibold px-3 py-1.5 rounded-lg flex-shrink-0 ${focusMode ? "text-white" : "border border-gray-300 text-gray-600 hover:bg-gray-50"}`}
            style={focusMode ? { background: CURRENT_COLOR } : undefined}>
            {focusMode ? "✓ Focus mode" : "Focus mode (current + next)"}
          </button>
        </div>
      </div>

      <div className="flex">
        <div className="flex-shrink-0 bg-white pr-2 flex flex-col gap-y-1.5 w-80">
          <div className={showDailyRuler ? "h-7" : "h-4"} />
          {rows.map(r => <Fragment key={r.key}>{r.label}</Fragment>)}
        </div>
        <div className="overflow-x-auto flex-1 min-w-0">
          <div className="flex flex-col gap-y-1.5" style={{ minWidth: 560 }}>
            {showDailyRuler ? (
              <div className="relative h-7 text-[11px] text-gray-400">
                {Array.from({ length: totalDays + 1 }, (_, i) => {
                  const d = new Date(rangeStart + i * 86400000);
                  const isMajor = i % 5 === 0 || i % 5 === 4 || i === totalDays;
                  const leftPct = (i / totalDays) * 100;
                  return (
                    <div key={i} className="absolute top-0" style={{ left: `${leftPct}%` }}>
                      <div className={isMajor ? "w-px h-2 bg-gray-400" : "w-px h-1 bg-gray-200"} />
                      {isMajor && <span className="absolute top-2.5 -translate-x-1/2 whitespace-nowrap text-gray-500 font-medium">{d.toLocaleDateString("en-GB", { day: "numeric", month: "short" })}</span>}
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="relative h-4 text-[11px] text-gray-400">
                {tickDates.map((d, i) => (
                  <span key={i} className="absolute -translate-x-1/2" style={{ left: `${(i / ticks) * 100}%` }}>{d.toLocaleDateString("en-GB", { day: "numeric", month: "short" })}</span>
                ))}
              </div>
            )}
            {rows.map(r => <Fragment key={r.key}>{r.bar}</Fragment>)}
          </div>
        </div>
      </div>

      {detailTaskId && tasks.find(t => t.id === detailTaskId) && (
        <TaskDetailModal
          task={tasks.find(t => t.id === detailTaskId)!}
          comments={comments}
          onClose={() => setDetailTaskId(null)}
          patchTask={patchTask}
          toggleMilestone={toggleMilestone}
          deleteTask={deleteTask}
          submitRemark={submitRemark}
          attachPhoto={attachPhoto}
        />
      )}
    </div>
  );
}

function MainTaskRow({
  task, subTasks, comments, openTasks, toggleOpen, openComments, toggleComments,
  submitRemark, attachPhoto, toggleMilestone, deleteTask, patchTask, setAddingTaskFor, stageId,
  addingTaskFor, addTask, dragging, hoverId, startDrag,
}: {
  task: PlanTask; subTasks: PlanTask[]; comments: Comment[];
  openTasks: Set<string>; toggleOpen: (id: string) => void;
  openComments: Set<string>; toggleComments: (id: string) => void;
  submitRemark: (taskId: string, text: string) => void; attachPhoto: (id: string) => void;
  toggleMilestone: (t: PlanTask) => void; deleteTask: (id: string) => void; patchTask: (id: string, v: Partial<PlanTask>) => void;
  setAddingTaskFor: (v: { stageId: string; parentId: string | null } | null) => void; stageId: string;
  addingTaskFor: { stageId: string; parentId: string | null } | null;
  addTask: (stageId: string, parentId: string | null, title: string) => void;
} & DragCtl) {
  const hasChildren = subTasks.length > 0;
  const taskComments = comments.filter(c => c.taskId === task.id);
  return (
    <>
      <div data-drop-id={task.id} {...longPressHandlers(() => startDrag("task", task.id))}
        className={`grid grid-cols-[minmax(200px,1fr)_118px_118px_118px_118px_100px_100px] min-w-[1080px] gap-1 items-center pl-5 pr-2.5 py-1.5 border-b border-gray-100 cursor-pointer select-none ${dragging?.id === task.id ? "opacity-40" : "bg-white hover:bg-gray-50"} ${hoverId === task.id && dragging && dragging.id !== task.id ? "ring-2 ring-blue-400 ring-inset" : ""}`}
        onClick={() => hasChildren && toggleOpen(task.id)}>
        <div className="flex items-center gap-1.5 min-w-0">
          {hasChildren ? <ChevronRight className={`w-3 h-3 flex-shrink-0 transition-transform ${openTasks.has(task.id) ? "rotate-90" : ""}`} /> : <span className="w-3 text-center text-gray-300 text-sm">—</span>}
          <span className={`w-1.5 h-1.5 rotate-45 flex-shrink-0 ${task.isMilestone ? "bg-purple-600" : "bg-gray-400"}`} />
          <EditableName value={task.title} onSave={v => patchTask(task.id, { title: v })} className="text-sm truncate" />
          {task.isMilestone && <span className="text-[11px] bg-purple-100 text-purple-700 px-1.5 py-0.5 rounded-full flex items-center gap-0.5 flex-shrink-0"><Flag className="w-2 h-2" /> Milestone</span>}
        </div>
        <DateCell value={task.planStart} onChange={v => patchTask(task.id, { planStart: v })} />
        <DateCell value={task.planEnd} onChange={v => patchTask(task.id, { planEnd: v })} />
        <DateCell value={task.actualStart} onChange={v => patchTask(task.id, { actualStart: v })} accent />
        <DateCell value={task.actualEnd} onChange={v => patchTask(task.id, { actualEnd: v })} accent />
        <select value={task.status} onChange={e => { e.stopPropagation(); patchTask(task.id, { status: e.target.value as StageStatus }); }} onClick={e => e.stopPropagation()}
          className="text-sm border border-gray-200 rounded px-1 py-0.5">
          <option value="pending">Pending</option>
          <option value="in_progress">In progress</option>
          <option value="done">Done</option>
        </select>
        <div className="flex gap-1 justify-end" onClick={e => e.stopPropagation()}>
          <button onClick={() => toggleComments(task.id)} className={`w-5 h-5 border rounded flex items-center justify-center ${openComments.has(task.id) || taskComments.length ? "border-blue-400 text-blue-600 bg-blue-50" : "border-gray-200 text-gray-400"}`}><MessageSquare className="w-3 h-3" /></button>
          <button onClick={() => toggleMilestone(task)} title="Toggle milestone" className={`w-5 h-5 border rounded flex items-center justify-center ${task.isMilestone ? "border-purple-300 text-purple-600 bg-purple-50" : "border-gray-200 text-gray-400"}`}><Flag className="w-3 h-3" /></button>
          <button onClick={() => { setAddingTaskFor({ stageId, parentId: task.id }); if (!openTasks.has(task.id)) toggleOpen(task.id); }} className="w-5 h-5 border border-gray-200 rounded flex items-center justify-center text-gray-400 hover:border-blue-300"><Plus className="w-3 h-3" /></button>
          <button onClick={() => deleteTask(task.id)} className="w-5 h-5 border border-gray-200 rounded flex items-center justify-center text-gray-400 hover:border-red-300 hover:text-red-500"><Trash2 className="w-3 h-3" /></button>
        </div>
      </div>

      {openComments.has(task.id) && (
        <CommentBox taskId={task.id} comments={taskComments} submitRemark={submitRemark} attachPhoto={() => attachPhoto(task.id)} indent={20} />
      )}

      {openTasks.has(task.id) && subTasks.map(st => (
        <SubTaskRow key={st.id} task={st} comments={comments.filter(c => c.taskId === st.id)}
          openComments={openComments} toggleComments={toggleComments}
          submitRemark={submitRemark} attachPhoto={attachPhoto}
          deleteTask={deleteTask} patchTask={patchTask}
          dragging={dragging} hoverId={hoverId} startDrag={startDrag} />
      ))}

      {addingTaskFor?.parentId === task.id && (
        <AddTaskRow
          placeholder="Sub task title…"
          indent={36}
          onAdd={title => addTask(stageId, task.id, title)}
          onCancel={() => setAddingTaskFor(null)}
        />
      )}
    </>
  );
}

function SubTaskRow({
  task, comments, openComments, toggleComments, submitRemark, attachPhoto, deleteTask, patchTask,
  dragging, hoverId, startDrag,
}: {
  task: PlanTask; comments: Comment[]; openComments: Set<string>; toggleComments: (id: string) => void;
  submitRemark: (taskId: string, text: string) => void; attachPhoto: (id: string) => void;
  deleteTask: (id: string) => void; patchTask: (id: string, v: Partial<PlanTask>) => void;
} & DragCtl) {
  return (
    <>
      <div data-drop-id={task.id} {...longPressHandlers(() => startDrag("task", task.id))}
        className={`grid grid-cols-[minmax(200px,1fr)_118px_118px_118px_118px_100px_100px] min-w-[1080px] gap-1 items-center pl-9 pr-2.5 py-1.5 border-b border-gray-100 select-none ${dragging?.id === task.id ? "opacity-40" : "bg-gray-50/70"} ${hoverId === task.id && dragging && dragging.id !== task.id ? "ring-2 ring-blue-400 ring-inset" : ""}`}>
        <div className="flex items-center gap-1.5 min-w-0">
          <span className="w-1.5 h-[1.5px] bg-gray-300 flex-shrink-0" />
          <EditableName value={task.title} onSave={v => patchTask(task.id, { title: v })} className="text-sm text-gray-500 truncate" />
        </div>
        <DateCell value={task.planStart} onChange={v => patchTask(task.id, { planStart: v })} />
        <DateCell value={task.planEnd} onChange={v => patchTask(task.id, { planEnd: v })} />
        <DateCell value={task.actualStart} onChange={v => patchTask(task.id, { actualStart: v })} accent />
        <DateCell value={task.actualEnd} onChange={v => patchTask(task.id, { actualEnd: v })} accent />
        <select value={task.status} onChange={e => patchTask(task.id, { status: e.target.value as StageStatus })}
          className="text-sm border border-gray-200 rounded px-1 py-0.5">
          <option value="pending">Pending</option>
          <option value="in_progress">In progress</option>
          <option value="done">Done</option>
        </select>
        <div className="flex gap-1 justify-end">
          <button onClick={() => toggleComments(task.id)} className={`w-5 h-5 border rounded flex items-center justify-center ${openComments.has(task.id) || comments.length ? "border-blue-400 text-blue-600 bg-blue-50" : "border-gray-200 text-gray-400"}`}><MessageSquare className="w-3 h-3" /></button>
          <button onClick={() => deleteTask(task.id)} className="w-5 h-5 border border-gray-200 rounded flex items-center justify-center text-gray-400 hover:border-red-300 hover:text-red-500"><Trash2 className="w-3 h-3" /></button>
        </div>
      </div>
      {openComments.has(task.id) && (
        <CommentBox taskId={task.id} comments={comments} submitRemark={submitRemark} attachPhoto={() => attachPhoto(task.id)} indent={36} />
      )}
    </>
  );
}

function DateCell({ value, onChange, accent }: { value: string | null; onChange: (v: string) => void; accent?: boolean }) {
  return (
    <input type="date" value={value ?? ""} onChange={e => onChange(e.target.value)}
      className={`text-sm bg-transparent border-none focus:ring-1 focus:ring-blue-300 rounded px-0.5 ${accent ? "text-blue-600" : "text-gray-500"}`} />
  );
}

function CommentBox({ taskId, comments, submitRemark, attachPhoto, indent }: {
  taskId: string; comments: Comment[]; submitRemark: (taskId: string, text: string) => void; attachPhoto: () => void; indent: number;
}) {
  const [draft, setDraft] = useState("");
  const submit = () => { if (draft.trim()) { submitRemark(taskId, draft); setDraft(""); } };
  return (
    <div className="bg-gray-50 border-b border-gray-100" style={{ paddingLeft: indent, paddingRight: 10 }}>
      <div className="border border-gray-200 rounded-lg overflow-hidden bg-white my-1.5">
        {comments.map(c => (
          <div key={c.id} className="px-3 py-2 border-b border-gray-100 last:border-none">
            <p className="text-sm text-gray-400">{c.authorName} · {new Date(c.createdAt).toLocaleDateString()}</p>
            {c.text && <p className="text-sm text-gray-700 mt-0.5">{c.text}</p>}
            {c.imageUrl && <a href={c.imageUrl} target="_blank" className="text-sm text-blue-600 flex items-center gap-1 mt-1"><FileText className="w-3.5 h-3.5" /> Photo attached</a>}
          </div>
        ))}
        <div className="flex items-center gap-2 px-2.5 py-2 bg-gray-50">
          <input value={draft} onChange={e => setDraft(e.target.value)} onKeyDown={e => e.key === "Enter" && submit()}
            placeholder="Add remark…" className="flex-1 text-sm border border-gray-200 rounded-lg px-3 py-2 bg-white" />
          <button onClick={submit} className="text-sm text-blue-600 px-2 font-medium">Add</button>
          <button onClick={attachPhoto} className="w-8 h-8 border border-gray-200 rounded-lg flex items-center justify-center text-gray-400 flex-shrink-0"><Upload className="w-4 h-4" /></button>
        </div>
      </div>
    </div>
  );
}

function TaskDetailModal({ task, comments, onClose, patchTask, toggleMilestone, deleteTask, submitRemark, attachPhoto }: {
  task: PlanTask; comments: Comment[]; onClose: () => void;
  patchTask: (id: string, v: Partial<PlanTask>) => void;
  toggleMilestone: (t: PlanTask) => void;
  deleteTask: (id: string) => void;
  submitRemark: (taskId: string, text: string) => void;
  attachPhoto: (id: string) => void;
}) {
  const taskComments = comments.filter(c => c.taskId === task.id);
  return (
    <Modal title={task.parentId ? "Sub task details" : "Main task details"} onClose={onClose} wide>
      <EditableName value={task.title} onSave={v => patchTask(task.id, { title: v })} className="text-base font-semibold block mb-3" />
      <div className="grid grid-cols-2 gap-3 mb-3">
        <label className="text-sm text-gray-500">Plan start
          <input type="date" value={task.planStart ?? ""} onChange={e => patchTask(task.id, { planStart: e.target.value || null })} className="w-full text-sm border border-gray-300 rounded-lg px-2 py-1.5 mt-0.5" />
        </label>
        <label className="text-sm text-gray-500">Plan end
          <input type="date" value={task.planEnd ?? ""} onChange={e => patchTask(task.id, { planEnd: e.target.value || null })} className="w-full text-sm border border-gray-300 rounded-lg px-2 py-1.5 mt-0.5" />
        </label>
        <label className="text-sm text-gray-500">Actual start
          <input type="date" value={task.actualStart ?? ""} onChange={e => patchTask(task.id, { actualStart: e.target.value || null })} className="w-full text-sm border border-gray-300 rounded-lg px-2 py-1.5 mt-0.5" />
        </label>
        <label className="text-sm text-gray-500">Actual end
          <input type="date" value={task.actualEnd ?? ""} onChange={e => patchTask(task.id, { actualEnd: e.target.value || null })} className="w-full text-sm border border-gray-300 rounded-lg px-2 py-1.5 mt-0.5" />
        </label>
      </div>
      <div className="flex items-center gap-3 mb-4">
        <select value={task.status} onChange={e => patchTask(task.id, { status: e.target.value as StageStatus })} className="text-sm border border-gray-300 rounded-lg px-2 py-1.5">
          <option value="pending">Pending</option>
          <option value="in_progress">In progress</option>
          <option value="done">Done</option>
        </select>
        <label className="flex items-center gap-1.5 text-sm text-gray-600 cursor-pointer">
          <input type="checkbox" checked={task.isMilestone} onChange={() => toggleMilestone(task)} /> Milestone
        </label>
        <button onClick={() => { if (confirm("Delete this task?")) { deleteTask(task.id); onClose(); } }}
          className="ml-auto text-sm text-red-500 hover:underline flex items-center gap-1"><Trash2 className="w-3.5 h-3.5" /> Delete</button>
      </div>
      <p className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-1">Remarks</p>
      <CommentBox taskId={task.id} comments={taskComments} submitRemark={submitRemark} attachPhoto={() => attachPhoto(task.id)} indent={0} />
    </Modal>
  );
}

// ── Finance Tab ─────────────────────────────────────────────────────────

function FinanceTab({
  poValue, poNumber, clientTotal, contractorTotal, stages, contractors, contractorClaims, clientClaims,
  showContractorForm, setShowContractorForm, addContractor, showClaimForm, setShowClaimForm, addClaim, setClaimStatus,
}: {
  poValue: number; poNumber: string | null; clientTotal: number; contractorTotal: number;
  stages: Stage[]; contractors: Contractor[]; contractorClaims: ContractorClaim[]; clientClaims: ClientClaim[];
  showContractorForm: boolean; setShowContractorForm: (b: boolean) => void; addContractor: (name: string, scope: string) => void;
  showClaimForm: "client" | "contractor" | null; setShowClaimForm: (v: "client" | "contractor" | null) => void;
  addClaim: (kind: "client" | "contractor", data: Record<string, unknown>) => void;
  setClaimStatus: (kind: "client" | "contractor", claimId: string, status: ClaimStatus) => void;
}) {
  const [conName, setConName] = useState(""); const [conScope, setConScope] = useState("");
  const [claimAmount, setClaimAmount] = useState(""); const [claimStage, setClaimStage] = useState(""); const [claimContractor, setClaimContractor] = useState(""); const [claimInvoice, setClaimInvoice] = useState("");

  const submitClaim = () => {
    if (!showClaimForm || !claimAmount) return;
    addClaim(showClaimForm, {
      amount: claimAmount, stageId: claimStage || null, invoiceNo: claimInvoice || null,
      contractorId: showClaimForm === "contractor" ? claimContractor : undefined,
    });
    setClaimAmount(""); setClaimStage(""); setClaimContractor(""); setClaimInvoice("");
  };

  return (
    <div>
      <div className="grid grid-cols-3 gap-3 mb-6">
        <div className="bg-gray-50 rounded-xl p-3">
          <p className="text-sm text-gray-400 mb-1">PO value</p>
          <p className="text-lg font-semibold">{fmtMoney(poValue)}</p>
          <p className="text-sm text-gray-400">{poNumber || "—"}</p>
        </div>
        <div className="bg-gray-50 rounded-xl p-3">
          <p className="text-sm text-gray-400 mb-1">Claimed to client</p>
          <p className="text-lg font-semibold text-blue-600">{fmtMoney(clientTotal)}</p>
          <p className="text-sm text-gray-400">{fmtMoney(Math.max(poValue - clientTotal, 0))} remaining</p>
        </div>
        <div className="bg-gray-50 rounded-xl p-3">
          <p className="text-sm text-gray-400 mb-1">Contractor costs</p>
          <p className="text-lg font-semibold text-amber-600">{fmtMoney(contractorTotal)}</p>
        </div>
      </div>

      <div className="flex items-center justify-between mb-2">
        <p className="text-sm font-semibold text-gray-500 uppercase tracking-wide">Your claims to client</p>
        <button onClick={() => setShowClaimForm("client")} className="text-sm text-blue-600 flex items-center gap-1"><Plus className="w-3.5 h-3.5" /> Add claim</button>
      </div>
      <table className="w-full text-sm border border-gray-200 rounded-lg overflow-hidden mb-6">
        <thead><tr className="bg-gray-50 text-gray-400 text-sm uppercase"><th className="text-left px-3 py-1.5">Stage</th><th className="text-left px-3 py-1.5">Amount</th><th className="text-left px-3 py-1.5">Invoice</th><th className="text-left px-3 py-1.5">Status</th></tr></thead>
        <tbody>
          {clientClaims.map(c => (
            <tr key={c.id} className="border-t border-gray-100">
              <td className="px-3 py-1.5">{stages.find(s => s.id === c.stageId)?.name || "—"}</td>
              <td className="px-3 py-1.5">{fmtMoney(c.amount)}</td>
              <td className="px-3 py-1.5">{c.invoiceNo || "—"}</td>
              <td className="px-3 py-1.5">
                <select value={c.status} onChange={e => setClaimStatus("client", c.id, e.target.value as ClaimStatus)} className={`text-sm rounded-full px-2 py-0.5 border-none ${CLAIM_COLORS[c.status]}`}>
                  {(["pending", "submitted", "approved", "paid"] as ClaimStatus[]).map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </td>
            </tr>
          ))}
          {clientClaims.length === 0 && <tr><td colSpan={4} className="px-3 py-3 text-center text-gray-400">No claims yet.</td></tr>}
        </tbody>
      </table>

      <div className="flex items-center justify-between mb-2">
        <p className="text-sm font-semibold text-gray-500 uppercase tracking-wide">Contractor claims</p>
        <div className="flex gap-3">
          <button onClick={() => setShowContractorForm(true)} className="text-sm text-blue-600 flex items-center gap-1"><Plus className="w-3.5 h-3.5" /> Add contractor</button>
          <button onClick={() => setShowClaimForm("contractor")} className="text-sm text-blue-600 flex items-center gap-1"><Plus className="w-3.5 h-3.5" /> Add claim</button>
        </div>
      </div>
      <table className="w-full text-sm border border-gray-200 rounded-lg overflow-hidden">
        <thead><tr className="bg-gray-50 text-gray-400 text-sm uppercase"><th className="text-left px-3 py-1.5">Contractor</th><th className="text-left px-3 py-1.5">Scope</th><th className="text-left px-3 py-1.5">Stage</th><th className="text-left px-3 py-1.5">Amount</th><th className="text-left px-3 py-1.5">Invoice</th><th className="text-left px-3 py-1.5">Status</th></tr></thead>
        <tbody>
          {contractorClaims.map(c => (
            <tr key={c.id} className="border-t border-gray-100">
              <td className="px-3 py-1.5">{contractors.find(k => k.id === c.contractorId)?.name || "—"}</td>
              <td className="px-3 py-1.5">{contractors.find(k => k.id === c.contractorId)?.scope || "—"}</td>
              <td className="px-3 py-1.5">{stages.find(s => s.id === c.stageId)?.name || "—"}</td>
              <td className="px-3 py-1.5">{fmtMoney(c.amount)}</td>
              <td className="px-3 py-1.5">{c.invoiceNo || "—"}</td>
              <td className="px-3 py-1.5">
                <select value={c.status} onChange={e => setClaimStatus("contractor", c.id, e.target.value as ClaimStatus)} className={`text-sm rounded-full px-2 py-0.5 border-none ${CLAIM_COLORS[c.status]}`}>
                  {(["pending", "submitted", "approved", "paid"] as ClaimStatus[]).map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </td>
            </tr>
          ))}
          {contractorClaims.length === 0 && <tr><td colSpan={6} className="px-3 py-3 text-center text-gray-400">No claims yet.</td></tr>}
        </tbody>
      </table>

      {showContractorForm && (
        <Modal title="Add contractor" onClose={() => setShowContractorForm(false)}>
          <input value={conName} onChange={e => setConName(e.target.value)} placeholder="Contractor name" className="w-full text-sm border border-gray-300 rounded-lg px-2.5 py-1.5 mb-2" />
          <input value={conScope} onChange={e => setConScope(e.target.value)} placeholder="Scope (e.g. Cabling)" className="w-full text-sm border border-gray-300 rounded-lg px-2.5 py-1.5 mb-3" />
          <button onClick={() => { addContractor(conName, conScope); setConName(""); setConScope(""); }} className="bg-blue-600 text-white text-sm px-3 py-1.5 rounded-lg">Add</button>
        </Modal>
      )}

      {showClaimForm && (
        <Modal title={showClaimForm === "client" ? "Add client claim" : "Add contractor claim"} onClose={() => setShowClaimForm(null)}>
          {showClaimForm === "contractor" && (
            <select value={claimContractor} onChange={e => setClaimContractor(e.target.value)} className="w-full text-sm border border-gray-300 rounded-lg px-2.5 py-1.5 mb-2">
              <option value="">Select contractor…</option>
              {contractors.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          )}
          <select value={claimStage} onChange={e => setClaimStage(e.target.value)} className="w-full text-sm border border-gray-300 rounded-lg px-2.5 py-1.5 mb-2">
            <option value="">Stage (optional)…</option>
            {stages.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
          <input type="number" value={claimAmount} onChange={e => setClaimAmount(e.target.value)} placeholder="Amount ($)" className="w-full text-sm border border-gray-300 rounded-lg px-2.5 py-1.5 mb-2" />
          <input value={claimInvoice} onChange={e => setClaimInvoice(e.target.value)} placeholder="Invoice no. (optional)" className="w-full text-sm border border-gray-300 rounded-lg px-2.5 py-1.5 mb-3" />
          <button onClick={submitClaim} className="bg-blue-600 text-white text-sm px-3 py-1.5 rounded-lg">Add claim</button>
        </Modal>
      )}
    </div>
  );
}

function Modal({ title, onClose, children, wide }: { title: string; onClose: () => void; children: React.ReactNode; wide?: boolean }) {
  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
      <div className={`bg-white rounded-2xl p-5 w-full shadow-xl ${wide ? "max-w-xl" : "max-w-sm"}`}>
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-semibold text-gray-900 text-sm">{title}</h3>
          <button onClick={onClose}><X className="w-4 h-4 text-gray-400" /></button>
        </div>
        {children}
      </div>
    </div>
  );
}

// ── Export / Import Modals ──────────────────────────────────────────────

function ExportModal({ onClose, onExport }: { onClose: () => void; onExport: (name: string, includeDurations: boolean, save: boolean) => void }) {
  const [name, setName] = useState("Untitled SOP");
  const [includeDurations, setIncludeDurations] = useState(false);
  return (
    <Modal title="Export as template" onClose={onClose}>
      <input value={name} onChange={e => setName(e.target.value)} placeholder="Template name" className="w-full text-sm border border-gray-300 rounded-lg px-2.5 py-1.5 mb-3" />
      <label className="flex items-start gap-2 text-sm text-gray-600 mb-4 cursor-pointer">
        <input type="checkbox" checked={includeDurations} onChange={e => setIncludeDurations(e.target.checked)} className="mt-0.5" />
        Include planned durations (days per task) — gives the next project a head-start estimate. Leave unchecked for structure-only SOP.
      </label>
      <div className="flex gap-2">
        <button onClick={() => onExport(name, includeDurations, true)} className="bg-blue-600 text-white text-sm px-3 py-1.5 rounded-lg flex items-center gap-1"><Download className="w-3.5 h-3.5" /> Save to library &amp; download</button>
        <button onClick={() => onExport(name, includeDurations, false)} className="border border-gray-300 text-sm px-3 py-1.5 rounded-lg">Download only</button>
      </div>
    </Modal>
  );
}

function BulkImportModal({ onClose, onImport }: { onClose: () => void; onImport: (stages: BulkStage[]) => void }) {
  const [text, setText] = useState("");
  const [parsed, setParsed] = useState<{ stages: BulkStage[]; errors: string[] } | null>(null);

  return (
    <Modal title="Bulk import from text" onClose={onClose}>
      {!parsed ? (
        <>
          <p className="text-sm text-gray-500 mb-2">
            One line per row, separated by <code className="bg-gray-100 px-1 rounded">|</code>: <b>level</b> (1=stage, 2=main task, 3=sub task) | <b>title</b> | plan start | plan end | actual start | actual end | <b>status</b>. Dates and status are optional.
          </p>
          <p className="text-sm text-gray-500 mb-2">
            Leave status blank to auto-detect from actual dates (no actual dates → Pending, actual start only → In Progress, actual end → Done), or set it explicitly with <code className="bg-gray-100 px-1 rounded">pending</code>, <code className="bg-gray-100 px-1 rounded">in_progress</code>, or <code className="bg-gray-100 px-1 rounded">done</code>.
          </p>
          <pre className="text-sm bg-gray-50 border border-gray-200 rounded-lg p-2 mb-2 whitespace-pre-wrap text-gray-500 leading-relaxed">
{`1 | Pre-Quotation
2 | Initiate discussion on requirements | 10-Sep-25 | 17-Sep-25 | 10-Sep-25 | 17-Sep-25 | done
3 | Receive query on affected infra
2 | Next main task | 20-Sep-25 | 25-Sep-25 | | | in_progress`}
          </pre>
          <textarea value={text} onChange={e => setText(e.target.value)} rows={10}
            placeholder="Paste or type here…"
            className="w-full text-sm font-mono border border-gray-300 rounded-lg px-2 py-1.5 mb-3" />
          <button disabled={!text.trim()} onClick={() => setParsed(parseBulkText(text))}
            className="bg-blue-600 text-white text-sm px-3 py-1.5 rounded-lg disabled:opacity-40">Preview</button>
        </>
      ) : (
        <>
          <p className="text-sm text-gray-500 mb-2">
            {parsed.stages.length} stage(s), {parsed.stages.reduce((s, st) => s + st.tasks.length, 0)} main task(s),{" "}
            {parsed.stages.reduce((s, st) => s + st.tasks.reduce((s2, t) => s2 + t.subTasks.length, 0), 0)} sub task(s) found.
          </p>
          {parsed.errors.length > 0 && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-2 mb-2 text-sm text-red-600 max-h-24 overflow-y-auto">
              {parsed.errors.map((e, i) => <p key={i}>{e}</p>)}
            </div>
          )}
          <div className="border border-gray-200 rounded-lg overflow-hidden mb-3 max-h-56 overflow-y-auto">
            {parsed.stages.length === 0 && <p className="text-sm text-gray-400 text-center py-4">Nothing valid parsed — check the format.</p>}
            {parsed.stages.map((s, i) => (
              <div key={i}>
                <div className="bg-gray-50 px-3 py-1.5 text-sm font-medium border-b border-gray-100">{s.name}</div>
                {s.tasks.map((t, j) => (
                  <div key={j}>
                    <div className="px-5 py-1 text-sm border-b border-gray-100">
                      {t.title}
                      {t.planStart && <span className="text-gray-400"> plan: {fmtDate(t.planStart)}–{fmtDate(t.planEnd)}</span>}
                      {t.actualStart && <span className="text-blue-500"> actual: {fmtDate(t.actualStart)}–{fmtDate(t.actualEnd)}</span>}
                      <StatusBadge status={t.status ?? inferBulkStatus(t.actualStart, t.actualEnd)} explicit={!!t.status} />
                    </div>
                    {t.subTasks.map((st, k) => (
                      <div key={k} className="px-8 py-1 text-[11px] text-gray-500 border-b border-gray-100">
                        {st.title}
                        {st.planStart && <span className="text-gray-400"> plan: {fmtDate(st.planStart)}–{fmtDate(st.planEnd)}</span>}
                        {st.actualStart && <span className="text-blue-500"> actual: {fmtDate(st.actualStart)}–{fmtDate(st.actualEnd)}</span>}
                        <StatusBadge status={st.status ?? inferBulkStatus(st.actualStart, st.actualEnd)} explicit={!!st.status} />
                      </div>
                    ))}
                  </div>
                ))}
              </div>
            ))}
          </div>
          <div className="flex gap-2">
            <button onClick={() => setParsed(null)} className="border border-gray-300 text-sm px-3 py-1.5 rounded-lg">Back</button>
            <button disabled={parsed.stages.length === 0} onClick={() => onImport(parsed.stages)}
              className="bg-blue-600 text-white text-sm px-3 py-1.5 rounded-lg disabled:opacity-40">Import into project</button>
          </div>
        </>
      )}
    </Modal>
  );
}

function ImportModal({ templates, step, setStep, selected, setSelected, startDate, setStartDate, onClose, onImport }: {
  templates: Template[]; step: number; setStep: (n: number) => void;
  selected: Template | null; setSelected: (t: Template | null) => void;
  startDate: string; setStartDate: (s: string) => void; onClose: () => void; onImport: () => void;
}) {
  const structure = selected ? JSON.parse(selected.structure) as { stages: { name: string; tasks: { title: string; isMilestone?: boolean; subTasks: { title: string }[] }[] }[] } : null;
  return (
    <Modal title="Import template" onClose={onClose}>
      {step === 1 && (
        <>
          <p className="text-sm text-gray-400 mb-2">Choose a saved SOP template</p>
          <div className="space-y-1.5 mb-4 max-h-52 overflow-y-auto">
            {templates.length === 0 && <p className="text-sm text-gray-400 py-4 text-center">No templates saved yet. Export a project first.</p>}
            {templates.map(t => (
              <div key={t.id} onClick={() => setSelected(t)} className={`border rounded-lg px-3 py-2 cursor-pointer ${selected?.id === t.id ? "border-blue-400 bg-blue-50" : "border-gray-200"}`}>
                <p className="text-sm font-medium">{t.name}</p>
                <p className="text-sm text-gray-400">{new Date(t.createdAt).toLocaleDateString()} {t.team ? `· ${t.team}` : ""}</p>
              </div>
            ))}
          </div>
          <button disabled={!selected} onClick={() => setStep(2)} className="bg-blue-600 text-white text-sm px-3 py-1.5 rounded-lg disabled:opacity-40">Next — Preview</button>
        </>
      )}
      {step === 2 && structure && (
        <>
          <p className="text-sm text-gray-400 mb-2">Preview of <b>{selected?.name}</b></p>
          <div className="border border-gray-200 rounded-lg overflow-hidden mb-4 max-h-56 overflow-y-auto">
            {structure.stages.map((s, i) => (
              <div key={i}>
                <div className="bg-gray-50 px-3 py-1.5 text-sm font-medium border-b border-gray-100">{s.name}</div>
                {s.tasks.map((t, j) => (
                  <div key={j} className="px-5 py-1 text-sm border-b border-gray-100 flex items-center gap-1.5">
                    {t.title} {t.isMilestone && <span className="text-[11px] bg-purple-100 text-purple-700 px-1.5 rounded-full">Milestone</span>}
                  </div>
                ))}
              </div>
            ))}
          </div>
          <div className="flex gap-2">
            <button onClick={() => setStep(1)} className="border border-gray-300 text-sm px-3 py-1.5 rounded-lg">Back</button>
            <button onClick={() => setStep(3)} className="bg-blue-600 text-white text-sm px-3 py-1.5 rounded-lg">Next — Set dates</button>
          </div>
        </>
      )}
      {step === 3 && (
        <>
          <p className="text-sm text-gray-400 mb-2">Set the project start date. End dates calculate from durations, editable after import.</p>
          <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className="w-full text-sm border border-gray-300 rounded-lg px-2.5 py-1.5 mb-4" />
          <div className="flex gap-2">
            <button onClick={() => setStep(2)} className="border border-gray-300 text-sm px-3 py-1.5 rounded-lg">Back</button>
            <button onClick={onImport} className="bg-blue-600 text-white text-sm px-3 py-1.5 rounded-lg flex items-center gap-1"><Upload className="w-3.5 h-3.5" /> Import into project</button>
          </div>
        </>
      )}
    </Modal>
  );
}

"use client";
import { useEffect, useState, useCallback } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft, Plus, ChevronRight, MessageSquare, Flag, Trash2,
  Upload, Download, FileText, X,
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

const CLAIM_COLORS: Record<ClaimStatus, string> = {
  pending: "bg-gray-100 text-gray-500",
  submitted: "bg-amber-100 text-amber-700",
  approved: "bg-blue-100 text-blue-700",
  paid: "bg-green-100 text-green-700",
};
const STAGE_DOT: Record<StageStatus, string> = { pending: "bg-gray-300", in_progress: "bg-amber-500", done: "bg-green-600" };

function fmtMoney(n: number) { return `$${n.toLocaleString()}`; }
function fmtDate(d: string | null) { return d ? new Date(d).toLocaleDateString("en-GB", { day: "numeric", month: "short" }) : "—"; }

export default function ProjectDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [tab, setTab] = useState<"background" | "stages" | "finance">("background");
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
  const [remarkDrafts, setRemarkDrafts] = useState<Record<string, string>>({});
  const [newStageName, setNewStageName] = useState("");
  const [addingTaskFor, setAddingTaskFor] = useState<{ stageId: string; parentId: string | null } | null>(null);
  const [newTaskTitle, setNewTaskTitle] = useState("");
  const [taskView, setTaskView] = useState<"list" | "timeline">("list");

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

  // ── Stage/task handlers ──
  const addStage = async () => {
    if (!newStageName.trim()) return;
    await fetch(`/api/projects/${id}/stages`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: newStageName }) });
    setNewStageName(""); loadStages();
  };
  const deleteStage = async (stageId: string) => {
    if (!confirm("Delete this stage and all its tasks?")) return;
    await fetch(`/api/stages/${stageId}`, { method: "DELETE" }); loadStages();
  };
  const patchStage = async (stageId: string, values: Partial<Stage>) => {
    await fetch(`/api/stages/${stageId}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(values) });
    loadStages();
  };
  const addTask = async () => {
    if (!addingTaskFor || !newTaskTitle.trim()) return;
    await fetch(`/api/stages/${addingTaskFor.stageId}/tasks`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: newTaskTitle, parentId: addingTaskFor.parentId }),
    });
    setNewTaskTitle(""); setAddingTaskFor(null); loadStages();
  };
  const deleteTask = async (taskId: string) => {
    if (!confirm("Delete this task?")) return;
    await fetch(`/api/plan-tasks/${taskId}`, { method: "DELETE" }); loadStages();
  };
  const patchTask = async (taskId: string, values: Partial<PlanTask>) => {
    await fetch(`/api/plan-tasks/${taskId}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(values) });
    loadStages();
  };
  const toggleMilestone = (task: PlanTask) => patchTask(task.id, { isMilestone: !task.isMilestone });
  const toggleOpen = (taskId: string) => setOpenTasks(prev => { const s = new Set(prev); s.has(taskId) ? s.delete(taskId) : s.add(taskId); return s; });
  const toggleComments = (taskId: string) => setOpenComments(prev => { const s = new Set(prev); s.has(taskId) ? s.delete(taskId) : s.add(taskId); return s; });
  const closeAllComments = () => setOpenComments(new Set());
  const expandAllTasks = () => setOpenTasks(new Set(tasks.filter(t => !t.parentId).map(t => t.id)));
  const collapseAllTasks = () => setOpenTasks(new Set());

  const submitRemark = async (taskId: string) => {
    const text = (remarkDrafts[taskId] || "").trim();
    if (!text) return;
    await fetch(`/api/plan-tasks/${taskId}/comments`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ text }) });
    setRemarkDrafts(prev => ({ ...prev, [taskId]: "" }));
    loadStages();
  };
  const attachPhoto = async (taskId: string) => {
    const url = prompt("Photo URL (placeholder — no file storage wired up yet)");
    if (!url) return;
    await fetch(`/api/plan-tasks/${taskId}/comments`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ imageUrl: url, text: null }) });
    loadStages();
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

  const poValue = bg?.poValue ?? 0;
  const clientTotal = clientClaims.reduce((s, c) => s + c.amount, 0);
  const contractorTotal = contractorClaims.reduce((s, c) => s + c.amount, 0);

  return (
    <div className="p-8 max-w-5xl mx-auto">
      <Link href="/dashboard/projects" className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 mb-4">
        <ArrowLeft className="w-3.5 h-3.5" /> Back to Projects
      </Link>

      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{project?.name}</h1>
          {project?.description && <p className="text-gray-500 mt-1 text-sm">{project.description}</p>}
        </div>
        <div className="flex gap-2">
          <button onClick={openImport} className="flex items-center gap-1.5 border border-gray-300 px-3 py-1.5 rounded-lg text-xs font-medium hover:bg-gray-50">
            <Upload className="w-3.5 h-3.5" /> Import template
          </button>
          <button onClick={() => setShowExport(true)} className="flex items-center gap-1.5 bg-blue-600 text-white px-3 py-1.5 rounded-lg text-xs font-medium hover:bg-blue-700">
            <Download className="w-3.5 h-3.5" /> Export as template
          </button>
        </div>
      </div>

      <div className="flex border-b border-gray-200 mb-6">
        {(["background", "stages", "finance"] as const).map(t => (
          <button key={t} onClick={() => setTab(t)}
            className={`px-4 py-2 text-sm capitalize -mb-px border-b-2 ${tab === t ? "border-blue-600 text-blue-600 font-medium" : "border-transparent text-gray-500 hover:text-gray-700"}`}>
            {t}
          </button>
        ))}
      </div>

      {tab === "background" && (
        <BackgroundTab
          bg={bg} bgForm={bgForm} setBgForm={setBgForm} editing={editingBg} setEditing={setEditingBg} save={saveBg}
          files={files} addFile={addFile}
          stages={stages} tasks={tasks} comments={comments}
          openTasks={openTasks} toggleOpen={toggleOpen} expandAllTasks={expandAllTasks} collapseAllTasks={collapseAllTasks}
          openComments={openComments} toggleComments={toggleComments}
          remarkDrafts={remarkDrafts} setRemarkDrafts={setRemarkDrafts} submitRemark={submitRemark} attachPhoto={attachPhoto}
          toggleMilestone={toggleMilestone} deleteTask={deleteTask} patchTask={patchTask}
          newStageName={newStageName} setNewStageName={setNewStageName} addStage={addStage} deleteStage={deleteStage}
          addingTaskFor={addingTaskFor} setAddingTaskFor={setAddingTaskFor} newTaskTitle={newTaskTitle} setNewTaskTitle={setNewTaskTitle} addTask={addTask}
          taskView={taskView} setTaskView={setTaskView}
        />
      )}

      {tab === "stages" && (
        <StagesTab
          stages={stages} tasks={tasks} comments={comments}
          openTasks={openTasks} toggleOpen={toggleOpen} expandAllTasks={expandAllTasks} collapseAllTasks={collapseAllTasks}
          openComments={openComments} toggleComments={toggleComments} closeAllComments={closeAllComments}
          remarkDrafts={remarkDrafts} setRemarkDrafts={setRemarkDrafts} submitRemark={submitRemark} attachPhoto={attachPhoto}
          patchTask={patchTask} patchStage={patchStage}
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
      {toast && (
        <div className="fixed bottom-5 right-5 bg-white border border-gray-200 shadow-lg rounded-lg px-4 py-2.5 text-sm text-gray-700 z-50">
          {toast}
        </div>
      )}
    </div>
  );
}

// ── Background Tab ─────────────────────────────────────────────────────

function BackgroundTab(props: {
  bg: Background | null; bgForm: Background; setBgForm: (b: Background) => void; editing: boolean; setEditing: (b: boolean) => void; save: () => void;
  files: ProjFile[]; addFile: () => void;
  stages: Stage[]; tasks: PlanTask[]; comments: Comment[];
  openTasks: Set<string>; toggleOpen: (id: string) => void; expandAllTasks: () => void; collapseAllTasks: () => void;
  openComments: Set<string>; toggleComments: (id: string) => void;
  remarkDrafts: Record<string, string>; setRemarkDrafts: (r: Record<string, string>) => void; submitRemark: (id: string) => void; attachPhoto: (id: string) => void;
  toggleMilestone: (t: PlanTask) => void; deleteTask: (id: string) => void; patchTask: (id: string, v: Partial<PlanTask>) => void;
  newStageName: string; setNewStageName: (s: string) => void; addStage: () => void; deleteStage: (id: string) => void;
  addingTaskFor: { stageId: string; parentId: string | null } | null; setAddingTaskFor: (v: { stageId: string; parentId: string | null } | null) => void;
  newTaskTitle: string; setNewTaskTitle: (s: string) => void; addTask: () => void;
  taskView: "list" | "timeline"; setTaskView: (v: "list" | "timeline") => void;
}) {
  const { bg, bgForm, setBgForm, editing, setEditing, save, files, addFile } = props;
  return (
    <div>
      <div className="grid grid-cols-2 gap-4 mb-6">
        <div className="bg-gray-50 border border-gray-200 rounded-xl p-4">
          <div className="flex items-center justify-between mb-2">
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Why this project started</p>
            {!editing && <button onClick={() => setEditing(true)} className="text-xs text-blue-600 hover:underline">Edit</button>}
          </div>
          {editing ? (
            <textarea value={bgForm.why ?? ""} onChange={e => setBgForm({ ...bgForm, why: e.target.value })} rows={4}
              className="w-full text-sm border border-gray-300 rounded-lg px-2 py-1.5" />
          ) : (
            <p className="text-sm text-gray-700 leading-relaxed">{bg?.why || "Not set yet."}</p>
          )}
        </div>
        <div className="bg-gray-50 border border-gray-200 rounded-xl p-4">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">Project details</p>
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
                <button onClick={save} className="bg-blue-600 text-white text-xs px-3 py-1.5 rounded-lg">Save</button>
                <button onClick={() => setEditing(false)} className="border border-gray-300 text-xs px-3 py-1.5 rounded-lg">Cancel</button>
              </div>
            </div>
          ) : (
            <div className="text-sm space-y-1">
              <Row label="Client" value={bg?.client} />
              <Row label="PO no." value={bg?.poNumber} />
              <Row label="PO value" value={bg?.poValue ? fmtMoney(bg.poValue) : null} />
              <Row label="Target" value={bg?.targetStart ? `${fmtDate(bg.targetStart)} – ${fmtDate(bg.targetEnd)}` : null} />
            </div>
          )}
        </div>
      </div>

      <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2 flex items-center gap-1.5"><FileText className="w-3.5 h-3.5" /> Diagrams &amp; project plans</p>
      <div className="flex gap-2 flex-wrap mb-6">
        {files.map(f => (
          <a key={f.id} href={f.url} target="_blank" className="flex items-center gap-1.5 border border-gray-200 rounded-lg px-2.5 py-1.5 text-xs bg-white hover:border-blue-300">
            <FileText className="w-3.5 h-3.5 text-gray-400" /> {f.name}
          </a>
        ))}
        <button onClick={addFile} className="flex items-center gap-1.5 border border-dashed border-gray-300 rounded-lg px-2.5 py-1.5 text-xs text-gray-500 hover:border-blue-300">
          <Upload className="w-3.5 h-3.5" /> Upload…
        </button>
      </div>

      <div className="border-t border-gray-100 pt-5">
        <TaskTree {...props} />
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <div className="flex justify-between border-b border-gray-100 py-1 text-xs">
      <span className="text-gray-400">{label}</span>
      <span className="text-gray-800 font-medium">{value || "—"}</span>
    </div>
  );
}

// ── Task Tree (shared structure for Background) ────────────────────────

function TaskTree(props: {
  stages: Stage[]; tasks: PlanTask[]; comments: Comment[];
  openTasks: Set<string>; toggleOpen: (id: string) => void; expandAllTasks: () => void; collapseAllTasks: () => void;
  openComments: Set<string>; toggleComments: (id: string) => void;
  remarkDrafts: Record<string, string>; setRemarkDrafts: (r: Record<string, string>) => void; submitRemark: (id: string) => void; attachPhoto: (id: string) => void;
  toggleMilestone: (t: PlanTask) => void; deleteTask: (id: string) => void; patchTask: (id: string, v: Partial<PlanTask>) => void;
  newStageName: string; setNewStageName: (s: string) => void; addStage: () => void; deleteStage: (id: string) => void;
  addingTaskFor: { stageId: string; parentId: string | null } | null; setAddingTaskFor: (v: { stageId: string; parentId: string | null } | null) => void;
  newTaskTitle: string; setNewTaskTitle: (s: string) => void; addTask: () => void;
  taskView: "list" | "timeline"; setTaskView: (v: "list" | "timeline") => void;
}) {
  const {
    stages, tasks, comments, openTasks, toggleOpen, expandAllTasks, collapseAllTasks,
    openComments, toggleComments, remarkDrafts, setRemarkDrafts, submitRemark, attachPhoto,
    toggleMilestone, deleteTask, patchTask, newStageName, setNewStageName, addStage, deleteStage,
    addingTaskFor, setAddingTaskFor, newTaskTitle, setNewTaskTitle, addTask, taskView, setTaskView,
  } = props;

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide flex items-center gap-1.5">Task breakdown</p>
        <div className="flex items-center gap-3">
          <div className="flex border border-gray-200 rounded-lg overflow-hidden text-xs">
            <button onClick={() => setTaskView("list")} className={`px-2.5 py-1 ${taskView === "list" ? "bg-gray-100 font-medium text-gray-900" : "text-gray-400"}`}>List</button>
            <button onClick={() => setTaskView("timeline")} className={`px-2.5 py-1 border-l border-gray-200 ${taskView === "timeline" ? "bg-gray-100 font-medium text-gray-900" : "text-gray-400"}`}>Timeline</button>
          </div>
          <button onClick={expandAllTasks} className="text-xs text-blue-600 hover:underline">Expand all</button>
          <button onClick={collapseAllTasks} className="text-xs text-blue-600 hover:underline">Collapse all</button>
        </div>
      </div>

      {taskView === "timeline" ? (
        <GanttView stages={stages} tasks={tasks} />
      ) : (
      <div className="border border-gray-200 rounded-xl overflow-hidden">
        <div className="grid grid-cols-[1fr_70px_70px_70px_70px_60px] gap-1 bg-gray-50 border-b border-gray-200 px-2.5 py-1.5 text-[10px] font-medium text-gray-400 uppercase">
          <span>Activity</span><span>Plan start</span><span>Plan end</span><span>Act. start</span><span>Act. end</span><span></span>
        </div>

        {stages.map(stage => {
          const mainTasks = tasks.filter(t => t.stageId === stage.id && !t.parentId);
          return (
            <div key={stage.id}>
              <div className="grid grid-cols-[1fr_70px_70px_70px_70px_60px] gap-1 items-center px-2.5 py-2 bg-gray-50 border-b border-gray-200 cursor-pointer" onClick={() => toggleOpen(stage.id)}>
                <div className="flex items-center gap-1.5 min-w-0">
                  <ChevronRight className={`w-3 h-3 flex-shrink-0 transition-transform ${openTasks.has(stage.id) ? "rotate-90" : ""}`} />
                  <span className={`w-2 h-2 rounded-full flex-shrink-0 ${STAGE_DOT[stage.status]}`} />
                  <b className="text-xs truncate">{stage.name}</b>
                </div>
                <span className="text-xs text-gray-400">{fmtDate(stage.planStart)}</span>
                <span className="text-xs text-gray-400">{fmtDate(stage.planEnd)}</span>
                <span className="text-xs text-blue-500">{fmtDate(stage.actualStart)}</span>
                <span className="text-xs text-blue-500">{fmtDate(stage.actualEnd)}</span>
                <div className="flex gap-1 justify-end">
                  <button onClick={e => { e.stopPropagation(); setAddingTaskFor({ stageId: stage.id, parentId: null }); }} className="w-5 h-5 border border-gray-200 rounded flex items-center justify-center hover:border-blue-300"><Plus className="w-3 h-3" /></button>
                  <button onClick={e => { e.stopPropagation(); deleteStage(stage.id); }} className="w-5 h-5 border border-gray-200 rounded flex items-center justify-center hover:border-red-300 text-gray-400 hover:text-red-500"><Trash2 className="w-3 h-3" /></button>
                </div>
              </div>

              {openTasks.has(stage.id) && mainTasks.map(mt => (
                <MainTaskRow key={mt.id} task={mt} subTasks={tasks.filter(t => t.parentId === mt.id)} comments={comments}
                  openTasks={openTasks} toggleOpen={toggleOpen} openComments={openComments} toggleComments={toggleComments}
                  remarkDrafts={remarkDrafts} setRemarkDrafts={setRemarkDrafts} submitRemark={submitRemark} attachPhoto={attachPhoto}
                  toggleMilestone={toggleMilestone} deleteTask={deleteTask} patchTask={patchTask}
                  setAddingTaskFor={setAddingTaskFor} stageId={stage.id} />
              ))}

              {addingTaskFor?.stageId === stage.id && (
                <div className="px-2.5 py-2 bg-blue-50 border-b border-gray-200 flex gap-2" style={{ paddingLeft: addingTaskFor.parentId ? 36 : 20 }}>
                  <input autoFocus value={newTaskTitle} onChange={e => setNewTaskTitle(e.target.value)} onKeyDown={e => e.key === "Enter" && addTask()}
                    placeholder={addingTaskFor.parentId ? "Sub task title…" : "Main task title…"}
                    className="flex-1 text-xs border border-gray-300 rounded px-2 py-1" />
                  <button onClick={addTask} className="text-xs bg-blue-600 text-white px-2.5 py-1 rounded">Add</button>
                  <button onClick={() => setAddingTaskFor(null)} className="text-xs text-gray-400"><X className="w-3.5 h-3.5" /></button>
                </div>
              )}
            </div>
          );
        })}

        <div className="px-2.5 py-2 bg-gray-50 flex gap-2">
          <input value={newStageName} onChange={e => setNewStageName(e.target.value)} onKeyDown={e => e.key === "Enter" && addStage()}
            placeholder="New stage name…" className="flex-1 text-xs border border-gray-300 rounded px-2 py-1" />
          <button onClick={addStage} className="text-xs text-blue-600 flex items-center gap-1"><Plus className="w-3.5 h-3.5" /> Add stage</button>
        </div>
      </div>
      )}
    </div>
  );
}

// ── Gantt / Timeline view ────────────────────────────────────────────────

function GanttView({ stages, tasks }: { stages: Stage[]; tasks: PlanTask[] }) {
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
    return <p className="text-sm text-gray-400 text-center py-12 border border-gray-200 rounded-xl">No planned dates yet — add plan start/end dates in List view to see the timeline.</p>;
  }

  const rangeStart = Math.min(...allDates, today);
  const rangeEnd = Math.max(...allDates, today);
  const span = Math.max(rangeEnd - rangeStart, 86400000);

  const pct = (d: string | null) => d ? ((new Date(d).getTime() - rangeStart) / span) * 100 : null;
  const todayPct = ((today - rangeStart) / span) * 100;

  const ticks = 5;
  const tickDates = Array.from({ length: ticks + 1 }, (_, i) => new Date(rangeStart + (span * i) / ticks));

  const isOverdue = (t: PlanTask) => t.status !== "done" && t.planEnd && new Date(t.planEnd).getTime() < today;
  const barColor = (t: PlanTask) => isOverdue(t) ? "#E24B4A" : t.status === "done" ? "#639922" : t.status === "in_progress" ? "#BA7517" : "#9CA3AF";

  return (
    <div className="border border-gray-200 rounded-xl p-4">
      <div className="flex gap-4 mb-3 text-[10px] text-gray-500">
        <span className="flex items-center gap-1"><span className="w-3 h-1 rounded bg-gray-300 inline-block" /> Planned</span>
        <span className="flex items-center gap-1"><span className="w-3 h-1 rounded inline-block" style={{ background: "#639922" }} /> Done</span>
        <span className="flex items-center gap-1"><span className="w-3 h-1 rounded inline-block" style={{ background: "#BA7517" }} /> In progress</span>
        <span className="flex items-center gap-1"><span className="w-3 h-1 rounded inline-block" style={{ background: "#E24B4A" }} /> Overdue</span>
        <span className="flex items-center gap-1"><span className="w-1.5 h-1.5 rotate-45 inline-block" style={{ background: "#9333EA" }} /> Milestone</span>
      </div>

      <div className="flex mb-2">
        <div className="w-36 flex-shrink-0" />
        <div className="flex-1 relative h-4 text-[9px] text-gray-400">
          {tickDates.map((d, i) => (
            <span key={i} className="absolute -translate-x-1/2" style={{ left: `${(i / ticks) * 100}%` }}>
              {d.toLocaleDateString("en-GB", { day: "numeric", month: "short" })}
            </span>
          ))}
        </div>
      </div>

      {stages.map(stage => {
        const mainTasks = tasks.filter(t => t.stageId === stage.id && !t.parentId);
        return (
          <div key={stage.id} className="mb-4">
            <div className="flex items-center gap-1.5 mb-1.5">
              <span className={`w-2 h-2 rounded-full flex-shrink-0 ${STAGE_DOT[stage.status]}`} />
              <span className="text-xs font-medium">{stage.name}</span>
            </div>
            {mainTasks.length === 0 ? (
              <p className="text-[10px] text-gray-400 pl-4">No tasks yet.</p>
            ) : mainTasks.map(t => {
              const planL = pct(t.planStart), planR = pct(t.planEnd);
              const actL = pct(t.actualStart) ?? planL, actR = pct(t.actualEnd) ?? (t.status === "done" ? planR : (planL !== null ? Math.min(todayPct, 100) : null));
              return (
                <div key={t.id} className="flex items-center gap-0 mb-1.5" style={{ height: 20 }}>
                  <div className="w-36 flex-shrink-0 text-[10px] flex items-center gap-1 truncate pr-2">
                    {t.isMilestone ? <span className="w-1.5 h-1.5 rotate-45 flex-shrink-0" style={{ background: "#9333EA" }} /> : <span className="w-1.5 h-1.5 rounded-full flex-shrink-0 bg-gray-300" />}
                    <span className={`truncate ${t.isMilestone ? "text-purple-700" : "text-gray-600"}`}>{t.title}</span>
                  </div>
                  <div className="flex-1 relative h-5">
                    <div className="absolute top-2 left-0 right-0 h-1 bg-gray-100 rounded" />
                    {planL !== null && planR !== null && (
                      <div className="absolute top-2 h-1 rounded bg-gray-300" style={{ left: `${planL}%`, width: `${Math.max(planR - planL, 0.5)}%` }} />
                    )}
                    {actL !== null && actR !== null && (
                      <div className="absolute top-2 h-1 rounded" style={{ left: `${actL}%`, width: `${Math.max(actR - actL, 0.5)}%`, background: barColor(t) }} />
                    )}
                    {actR !== null && (
                      t.isMilestone
                        ? <div className="absolute top-[6px] w-2 h-2 rotate-45 -translate-x-1/2 border border-white" style={{ left: `${actR}%`, background: barColor(t) }} />
                        : <div className="absolute top-[6px] w-2 h-2 rounded-full -translate-x-1/2 border border-white" style={{ left: `${actR}%`, background: barColor(t) }} />
                    )}
                  </div>
                  <div className="w-14 flex-shrink-0 text-[10px] text-right" style={{ color: isOverdue(t) ? "#E24B4A" : t.status === "done" ? "#3B6D11" : "#9CA3AF" }}>
                    {isOverdue(t) ? "Overdue" : t.status === "done" ? `Done ${fmtDate(t.actualEnd)}` : t.status === "in_progress" ? "In progress" : "Pending"}
                  </div>
                </div>
              );
            })}
          </div>
        );
      })}
    </div>
  );
}

function MainTaskRow({
  task, subTasks, comments, openTasks, toggleOpen, openComments, toggleComments,
  remarkDrafts, setRemarkDrafts, submitRemark, attachPhoto, toggleMilestone, deleteTask, patchTask, setAddingTaskFor, stageId,
}: {
  task: PlanTask; subTasks: PlanTask[]; comments: Comment[];
  openTasks: Set<string>; toggleOpen: (id: string) => void;
  openComments: Set<string>; toggleComments: (id: string) => void;
  remarkDrafts: Record<string, string>; setRemarkDrafts: (r: Record<string, string>) => void; submitRemark: (id: string) => void; attachPhoto: (id: string) => void;
  toggleMilestone: (t: PlanTask) => void; deleteTask: (id: string) => void; patchTask: (id: string, v: Partial<PlanTask>) => void;
  setAddingTaskFor: (v: { stageId: string; parentId: string | null } | null) => void; stageId: string;
}) {
  const hasChildren = subTasks.length > 0;
  const taskComments = comments.filter(c => c.taskId === task.id);
  return (
    <>
      <div className="grid grid-cols-[1fr_70px_70px_70px_70px_60px] gap-1 items-center pl-5 pr-2.5 py-1.5 bg-white border-b border-gray-100 cursor-pointer hover:bg-gray-50"
        onClick={() => hasChildren && toggleOpen(task.id)}>
        <div className="flex items-center gap-1.5 min-w-0">
          {hasChildren ? <ChevronRight className={`w-3 h-3 flex-shrink-0 transition-transform ${openTasks.has(task.id) ? "rotate-90" : ""}`} /> : <span className="w-3 text-center text-gray-300 text-xs">—</span>}
          <span className={`w-1.5 h-1.5 rotate-45 flex-shrink-0 ${task.isMilestone ? "bg-purple-600" : "bg-gray-400"}`} />
          <span className="text-xs truncate">{task.title}</span>
          {task.isMilestone && <span className="text-[9px] bg-purple-100 text-purple-700 px-1.5 py-0.5 rounded-full flex items-center gap-0.5 flex-shrink-0"><Flag className="w-2 h-2" /> Milestone</span>}
        </div>
        <DateCell value={task.planStart} onChange={v => patchTask(task.id, { planStart: v })} />
        <DateCell value={task.planEnd} onChange={v => patchTask(task.id, { planEnd: v })} />
        <DateCell value={task.actualStart} onChange={v => patchTask(task.id, { actualStart: v })} accent />
        <DateCell value={task.actualEnd} onChange={v => patchTask(task.id, { actualEnd: v })} accent />
        <div className="flex gap-1 justify-end" onClick={e => e.stopPropagation()}>
          <button onClick={() => toggleComments(task.id)} className={`w-5 h-5 border rounded flex items-center justify-center ${openComments.has(task.id) || taskComments.length ? "border-blue-400 text-blue-600 bg-blue-50" : "border-gray-200 text-gray-400"}`}><MessageSquare className="w-3 h-3" /></button>
          <button onClick={() => toggleMilestone(task)} title="Toggle milestone" className={`w-5 h-5 border rounded flex items-center justify-center ${task.isMilestone ? "border-purple-300 text-purple-600 bg-purple-50" : "border-gray-200 text-gray-400"}`}><Flag className="w-3 h-3" /></button>
          <button onClick={() => setAddingTaskFor({ stageId, parentId: task.id })} className="w-5 h-5 border border-gray-200 rounded flex items-center justify-center text-gray-400 hover:border-blue-300"><Plus className="w-3 h-3" /></button>
          <button onClick={() => deleteTask(task.id)} className="w-5 h-5 border border-gray-200 rounded flex items-center justify-center text-gray-400 hover:border-red-300 hover:text-red-500"><Trash2 className="w-3 h-3" /></button>
        </div>
      </div>

      {openComments.has(task.id) && (
        <CommentBox taskId={task.id} comments={taskComments} draft={remarkDrafts[task.id] || ""}
          setDraft={v => setRemarkDrafts({ ...remarkDrafts, [task.id]: v })} submit={() => submitRemark(task.id)} attachPhoto={() => attachPhoto(task.id)} indent={20} />
      )}

      {openTasks.has(task.id) && subTasks.map(st => (
        <SubTaskRow key={st.id} task={st} comments={comments.filter(c => c.taskId === st.id)}
          openComments={openComments} toggleComments={toggleComments}
          remarkDrafts={remarkDrafts} setRemarkDrafts={setRemarkDrafts} submitRemark={submitRemark} attachPhoto={attachPhoto}
          deleteTask={deleteTask} patchTask={patchTask} />
      ))}
    </>
  );
}

function SubTaskRow({
  task, comments, openComments, toggleComments, remarkDrafts, setRemarkDrafts, submitRemark, attachPhoto, deleteTask, patchTask,
}: {
  task: PlanTask; comments: Comment[]; openComments: Set<string>; toggleComments: (id: string) => void;
  remarkDrafts: Record<string, string>; setRemarkDrafts: (r: Record<string, string>) => void; submitRemark: (id: string) => void; attachPhoto: (id: string) => void;
  deleteTask: (id: string) => void; patchTask: (id: string, v: Partial<PlanTask>) => void;
}) {
  return (
    <>
      <div className="grid grid-cols-[1fr_70px_70px_70px_70px_60px] gap-1 items-center pl-9 pr-2.5 py-1.5 bg-white border-b border-gray-100">
        <div className="flex items-center gap-1.5 min-w-0">
          <span className="w-1.5 h-[1.5px] bg-gray-300 flex-shrink-0" />
          <span className="text-xs text-gray-500 truncate">{task.title}</span>
        </div>
        <DateCell value={task.planStart} onChange={v => patchTask(task.id, { planStart: v })} />
        <DateCell value={task.planEnd} onChange={v => patchTask(task.id, { planEnd: v })} />
        <DateCell value={task.actualStart} onChange={v => patchTask(task.id, { actualStart: v })} accent />
        <DateCell value={task.actualEnd} onChange={v => patchTask(task.id, { actualEnd: v })} accent />
        <div className="flex gap-1 justify-end">
          <button onClick={() => toggleComments(task.id)} className={`w-5 h-5 border rounded flex items-center justify-center ${openComments.has(task.id) || comments.length ? "border-blue-400 text-blue-600 bg-blue-50" : "border-gray-200 text-gray-400"}`}><MessageSquare className="w-3 h-3" /></button>
          <button onClick={() => deleteTask(task.id)} className="w-5 h-5 border border-gray-200 rounded flex items-center justify-center text-gray-400 hover:border-red-300 hover:text-red-500"><Trash2 className="w-3 h-3" /></button>
        </div>
      </div>
      {openComments.has(task.id) && (
        <CommentBox taskId={task.id} comments={comments} draft={remarkDrafts[task.id] || ""}
          setDraft={v => setRemarkDrafts({ ...remarkDrafts, [task.id]: v })} submit={() => submitRemark(task.id)} attachPhoto={() => attachPhoto(task.id)} indent={36} />
      )}
    </>
  );
}

function DateCell({ value, onChange, accent }: { value: string | null; onChange: (v: string) => void; accent?: boolean }) {
  return (
    <input type="date" value={value ?? ""} onChange={e => onChange(e.target.value)}
      className={`text-[10px] bg-transparent border-none focus:ring-1 focus:ring-blue-300 rounded px-0.5 ${accent ? "text-blue-600" : "text-gray-500"}`} />
  );
}

function CommentBox({ comments, draft, setDraft, submit, attachPhoto, indent }: {
  taskId: string; comments: Comment[]; draft: string; setDraft: (v: string) => void; submit: () => void; attachPhoto: () => void; indent: number;
}) {
  return (
    <div className="bg-gray-50 border-b border-gray-100" style={{ paddingLeft: indent, paddingRight: 10 }}>
      <div className="border border-gray-200 rounded-lg overflow-hidden bg-white my-1.5">
        {comments.map(c => (
          <div key={c.id} className="px-2.5 py-1.5 border-b border-gray-100 last:border-none">
            <p className="text-[10px] text-gray-400">{c.authorName} · {new Date(c.createdAt).toLocaleDateString()}</p>
            {c.text && <p className="text-xs text-gray-700 mt-0.5">{c.text}</p>}
            {c.imageUrl && <a href={c.imageUrl} target="_blank" className="text-[10px] text-blue-600 flex items-center gap-1 mt-1"><FileText className="w-3 h-3" /> Photo attached</a>}
          </div>
        ))}
        <div className="flex items-center gap-1.5 px-2.5 py-1.5 bg-gray-50">
          <input value={draft} onChange={e => setDraft(e.target.value)} onKeyDown={e => e.key === "Enter" && submit()}
            placeholder="Add remark…" className="flex-1 text-xs border border-gray-200 rounded px-2 py-1 bg-white" />
          <button onClick={submit} className="text-xs text-blue-600 px-1.5">Add</button>
          <button onClick={attachPhoto} className="w-6 h-6 border border-gray-200 rounded flex items-center justify-center text-gray-400"><Upload className="w-3 h-3" /></button>
        </div>
      </div>
    </div>
  );
}

// ── Stages Tab ──────────────────────────────────────────────────────────

function StagesTab(props: {
  stages: Stage[]; tasks: PlanTask[]; comments: Comment[];
  openTasks: Set<string>; toggleOpen: (id: string) => void; expandAllTasks: () => void; collapseAllTasks: () => void;
  openComments: Set<string>; toggleComments: (id: string) => void; closeAllComments: () => void;
  remarkDrafts: Record<string, string>; setRemarkDrafts: (r: Record<string, string>) => void; submitRemark: (id: string) => void; attachPhoto: (id: string) => void;
  patchTask: (id: string, v: Partial<PlanTask>) => void; patchStage: (id: string, v: Partial<Stage>) => void;
}) {
  const {
    stages, tasks, comments, openTasks, toggleOpen, expandAllTasks, collapseAllTasks,
    openComments, toggleComments, closeAllComments, remarkDrafts, setRemarkDrafts, submitRemark, attachPhoto, patchTask, patchStage,
  } = props;

  if (stages.length === 0) return <p className="text-sm text-gray-400 text-center py-16">No stages yet — add stages in the Background tab.</p>;

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <p className="text-xs text-gray-400">Planned dates come from Background. Log actual dates as work progresses. Click <MessageSquare className="w-3 h-3 inline" /> to add remarks.</p>
        <div className="flex gap-2 flex-shrink-0">
          <button onClick={expandAllTasks} className="text-xs border border-gray-300 rounded px-2 py-1">Expand all</button>
          <button onClick={collapseAllTasks} className="text-xs border border-gray-300 rounded px-2 py-1">Collapse all</button>
          <button onClick={closeAllComments} className="text-xs border border-gray-300 rounded px-2 py-1">Close remarks</button>
        </div>
      </div>

      {stages.map(stage => {
        const mainTasks = tasks.filter(t => t.stageId === stage.id && !t.parentId);
        return (
          <div key={stage.id} className="bg-gray-50 border border-gray-200 rounded-xl overflow-hidden mb-4">
            <div className="flex items-center gap-2 px-3 py-2.5 bg-white border-b border-gray-200">
              <span className={`w-2 h-2 rounded-full ${STAGE_DOT[stage.status]}`} />
              <b className="text-sm flex-1">{stage.name}</b>
              <select value={stage.status} onChange={e => patchStage(stage.id, { status: e.target.value as StageStatus })} className="text-xs border border-gray-200 rounded px-1.5 py-0.5">
                <option value="pending">Pending</option>
                <option value="in_progress">In progress</option>
                <option value="done">Done</option>
              </select>
            </div>
            {mainTasks.length === 0 ? (
              <p className="text-xs text-gray-400 px-3 py-3">No tasks yet.</p>
            ) : mainTasks.map(mt => (
              <StageMainTask key={mt.id} task={mt} subTasks={tasks.filter(t => t.parentId === mt.id)} comments={comments}
                openTasks={openTasks} toggleOpen={toggleOpen} openComments={openComments} toggleComments={toggleComments}
                remarkDrafts={remarkDrafts} setRemarkDrafts={setRemarkDrafts} submitRemark={submitRemark} attachPhoto={attachPhoto} patchTask={patchTask} />
            ))}
          </div>
        );
      })}
    </div>
  );
}

function StageMainTask({ task, subTasks, comments, openTasks, toggleOpen, openComments, toggleComments, remarkDrafts, setRemarkDrafts, submitRemark, attachPhoto, patchTask }: {
  task: PlanTask; subTasks: PlanTask[]; comments: Comment[];
  openTasks: Set<string>; toggleOpen: (id: string) => void; openComments: Set<string>; toggleComments: (id: string) => void;
  remarkDrafts: Record<string, string>; setRemarkDrafts: (r: Record<string, string>) => void; submitRemark: (id: string) => void; attachPhoto: (id: string) => void;
  patchTask: (id: string, v: Partial<PlanTask>) => void;
}) {
  const hasChildren = subTasks.length > 0;
  const taskComments = comments.filter(c => c.taskId === task.id);
  return (
    <>
      <div className="flex items-center gap-2 px-3 py-2 border-b border-gray-200 bg-gray-50 cursor-pointer" onClick={() => hasChildren && toggleOpen(task.id)}>
        {hasChildren ? <ChevronRight className={`w-3 h-3 transition-transform ${openTasks.has(task.id) ? "rotate-90" : ""}`} /> : <span className="w-3 text-center text-gray-300 text-xs">—</span>}
        <span className={`w-1.5 h-1.5 rotate-45 flex-shrink-0 ${task.isMilestone ? "bg-purple-600" : "bg-gray-400"}`} />
        <span className="text-xs flex-1">{task.title}</span>
        {task.isMilestone && <span className="text-[9px] bg-purple-100 text-purple-700 px-1.5 py-0.5 rounded-full">Milestone</span>}
        <span className="text-[10px] text-gray-400 flex-shrink-0">{fmtDate(task.planStart)} – {fmtDate(task.planEnd)}</span>
        <select value={task.status} onChange={e => { e.stopPropagation(); patchTask(task.id, { status: e.target.value as StageStatus }); }} onClick={e => e.stopPropagation()}
          className="text-[10px] border border-gray-200 rounded px-1 py-0.5">
          <option value="pending">Pending</option>
          <option value="in_progress">In progress</option>
          <option value="done">Done</option>
        </select>
        <button onClick={e => { e.stopPropagation(); toggleComments(task.id); }} className={`w-5 h-5 border rounded flex items-center justify-center flex-shrink-0 ${openComments.has(task.id) || taskComments.length ? "border-blue-400 text-blue-600 bg-blue-50" : "border-gray-200 text-gray-400"}`}><MessageSquare className="w-3 h-3" /></button>
      </div>
      {openComments.has(task.id) && (
        <CommentBox taskId={task.id} comments={taskComments} draft={remarkDrafts[task.id] || ""}
          setDraft={v => setRemarkDrafts({ ...remarkDrafts, [task.id]: v })} submit={() => submitRemark(task.id)} attachPhoto={() => attachPhoto(task.id)} indent={12} />
      )}
      {openTasks.has(task.id) && subTasks.map(st => {
        const stComments = comments.filter(c => c.taskId === st.id);
        return (
          <div key={st.id}>
            <div className="flex items-center gap-2 pl-8 pr-3 py-1.5 border-b border-gray-200 bg-gray-50">
              <span className="w-1.5 h-[1.5px] bg-gray-300 flex-shrink-0" />
              <span className="text-xs text-gray-500 flex-1">{st.title}</span>
              <span className="text-[10px] text-gray-400 flex-shrink-0">{fmtDate(st.planStart)} – {fmtDate(st.planEnd)}</span>
              <button onClick={() => toggleComments(st.id)} className={`w-5 h-5 border rounded flex items-center justify-center flex-shrink-0 ${openComments.has(st.id) || stComments.length ? "border-blue-400 text-blue-600 bg-blue-50" : "border-gray-200 text-gray-400"}`}><MessageSquare className="w-3 h-3" /></button>
            </div>
            {openComments.has(st.id) && (
              <CommentBox taskId={st.id} comments={stComments} draft={remarkDrafts[st.id] || ""}
                setDraft={v => setRemarkDrafts({ ...remarkDrafts, [st.id]: v })} submit={() => submitRemark(st.id)} attachPhoto={() => attachPhoto(st.id)} indent={28} />
            )}
          </div>
        );
      })}
    </>
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
          <p className="text-[10px] text-gray-400 mb-1">PO value</p>
          <p className="text-lg font-semibold">{fmtMoney(poValue)}</p>
          <p className="text-[10px] text-gray-400">{poNumber || "—"}</p>
        </div>
        <div className="bg-gray-50 rounded-xl p-3">
          <p className="text-[10px] text-gray-400 mb-1">Claimed to client</p>
          <p className="text-lg font-semibold text-blue-600">{fmtMoney(clientTotal)}</p>
          <p className="text-[10px] text-gray-400">{fmtMoney(Math.max(poValue - clientTotal, 0))} remaining</p>
        </div>
        <div className="bg-gray-50 rounded-xl p-3">
          <p className="text-[10px] text-gray-400 mb-1">Contractor costs</p>
          <p className="text-lg font-semibold text-amber-600">{fmtMoney(contractorTotal)}</p>
        </div>
      </div>

      <div className="flex items-center justify-between mb-2">
        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Your claims to client</p>
        <button onClick={() => setShowClaimForm("client")} className="text-xs text-blue-600 flex items-center gap-1"><Plus className="w-3.5 h-3.5" /> Add claim</button>
      </div>
      <table className="w-full text-xs border border-gray-200 rounded-lg overflow-hidden mb-6">
        <thead><tr className="bg-gray-50 text-gray-400 text-[10px] uppercase"><th className="text-left px-3 py-1.5">Stage</th><th className="text-left px-3 py-1.5">Amount</th><th className="text-left px-3 py-1.5">Invoice</th><th className="text-left px-3 py-1.5">Status</th></tr></thead>
        <tbody>
          {clientClaims.map(c => (
            <tr key={c.id} className="border-t border-gray-100">
              <td className="px-3 py-1.5">{stages.find(s => s.id === c.stageId)?.name || "—"}</td>
              <td className="px-3 py-1.5">{fmtMoney(c.amount)}</td>
              <td className="px-3 py-1.5">{c.invoiceNo || "—"}</td>
              <td className="px-3 py-1.5">
                <select value={c.status} onChange={e => setClaimStatus("client", c.id, e.target.value as ClaimStatus)} className={`text-[10px] rounded-full px-2 py-0.5 border-none ${CLAIM_COLORS[c.status]}`}>
                  {(["pending", "submitted", "approved", "paid"] as ClaimStatus[]).map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </td>
            </tr>
          ))}
          {clientClaims.length === 0 && <tr><td colSpan={4} className="px-3 py-3 text-center text-gray-400">No claims yet.</td></tr>}
        </tbody>
      </table>

      <div className="flex items-center justify-between mb-2">
        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Contractor claims</p>
        <div className="flex gap-3">
          <button onClick={() => setShowContractorForm(true)} className="text-xs text-blue-600 flex items-center gap-1"><Plus className="w-3.5 h-3.5" /> Add contractor</button>
          <button onClick={() => setShowClaimForm("contractor")} className="text-xs text-blue-600 flex items-center gap-1"><Plus className="w-3.5 h-3.5" /> Add claim</button>
        </div>
      </div>
      <table className="w-full text-xs border border-gray-200 rounded-lg overflow-hidden">
        <thead><tr className="bg-gray-50 text-gray-400 text-[10px] uppercase"><th className="text-left px-3 py-1.5">Contractor</th><th className="text-left px-3 py-1.5">Scope</th><th className="text-left px-3 py-1.5">Stage</th><th className="text-left px-3 py-1.5">Amount</th><th className="text-left px-3 py-1.5">Invoice</th><th className="text-left px-3 py-1.5">Status</th></tr></thead>
        <tbody>
          {contractorClaims.map(c => (
            <tr key={c.id} className="border-t border-gray-100">
              <td className="px-3 py-1.5">{contractors.find(k => k.id === c.contractorId)?.name || "—"}</td>
              <td className="px-3 py-1.5">{contractors.find(k => k.id === c.contractorId)?.scope || "—"}</td>
              <td className="px-3 py-1.5">{stages.find(s => s.id === c.stageId)?.name || "—"}</td>
              <td className="px-3 py-1.5">{fmtMoney(c.amount)}</td>
              <td className="px-3 py-1.5">{c.invoiceNo || "—"}</td>
              <td className="px-3 py-1.5">
                <select value={c.status} onChange={e => setClaimStatus("contractor", c.id, e.target.value as ClaimStatus)} className={`text-[10px] rounded-full px-2 py-0.5 border-none ${CLAIM_COLORS[c.status]}`}>
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
          <button onClick={() => { addContractor(conName, conScope); setConName(""); setConScope(""); }} className="bg-blue-600 text-white text-xs px-3 py-1.5 rounded-lg">Add</button>
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
          <button onClick={submitClaim} className="bg-blue-600 text-white text-xs px-3 py-1.5 rounded-lg">Add claim</button>
        </Modal>
      )}
    </div>
  );
}

function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
      <div className="bg-white rounded-2xl p-5 w-full max-w-sm shadow-xl">
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
      <label className="flex items-start gap-2 text-xs text-gray-600 mb-4 cursor-pointer">
        <input type="checkbox" checked={includeDurations} onChange={e => setIncludeDurations(e.target.checked)} className="mt-0.5" />
        Include planned durations (days per task) — gives the next project a head-start estimate. Leave unchecked for structure-only SOP.
      </label>
      <div className="flex gap-2">
        <button onClick={() => onExport(name, includeDurations, true)} className="bg-blue-600 text-white text-xs px-3 py-1.5 rounded-lg flex items-center gap-1"><Download className="w-3.5 h-3.5" /> Save to library &amp; download</button>
        <button onClick={() => onExport(name, includeDurations, false)} className="border border-gray-300 text-xs px-3 py-1.5 rounded-lg">Download only</button>
      </div>
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
          <p className="text-xs text-gray-400 mb-2">Choose a saved SOP template</p>
          <div className="space-y-1.5 mb-4 max-h-52 overflow-y-auto">
            {templates.length === 0 && <p className="text-xs text-gray-400 py-4 text-center">No templates saved yet. Export a project first.</p>}
            {templates.map(t => (
              <div key={t.id} onClick={() => setSelected(t)} className={`border rounded-lg px-3 py-2 cursor-pointer ${selected?.id === t.id ? "border-blue-400 bg-blue-50" : "border-gray-200"}`}>
                <p className="text-xs font-medium">{t.name}</p>
                <p className="text-[10px] text-gray-400">{new Date(t.createdAt).toLocaleDateString()} {t.team ? `· ${t.team}` : ""}</p>
              </div>
            ))}
          </div>
          <button disabled={!selected} onClick={() => setStep(2)} className="bg-blue-600 text-white text-xs px-3 py-1.5 rounded-lg disabled:opacity-40">Next — Preview</button>
        </>
      )}
      {step === 2 && structure && (
        <>
          <p className="text-xs text-gray-400 mb-2">Preview of <b>{selected?.name}</b></p>
          <div className="border border-gray-200 rounded-lg overflow-hidden mb-4 max-h-56 overflow-y-auto">
            {structure.stages.map((s, i) => (
              <div key={i}>
                <div className="bg-gray-50 px-3 py-1.5 text-xs font-medium border-b border-gray-100">{s.name}</div>
                {s.tasks.map((t, j) => (
                  <div key={j} className="px-5 py-1 text-xs border-b border-gray-100 flex items-center gap-1.5">
                    {t.title} {t.isMilestone && <span className="text-[9px] bg-purple-100 text-purple-700 px-1.5 rounded-full">Milestone</span>}
                  </div>
                ))}
              </div>
            ))}
          </div>
          <div className="flex gap-2">
            <button onClick={() => setStep(1)} className="border border-gray-300 text-xs px-3 py-1.5 rounded-lg">Back</button>
            <button onClick={() => setStep(3)} className="bg-blue-600 text-white text-xs px-3 py-1.5 rounded-lg">Next — Set dates</button>
          </div>
        </>
      )}
      {step === 3 && (
        <>
          <p className="text-xs text-gray-400 mb-2">Set the project start date. End dates calculate from durations, editable after import.</p>
          <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className="w-full text-sm border border-gray-300 rounded-lg px-2.5 py-1.5 mb-4" />
          <div className="flex gap-2">
            <button onClick={() => setStep(2)} className="border border-gray-300 text-xs px-3 py-1.5 rounded-lg">Back</button>
            <button onClick={onImport} className="bg-blue-600 text-white text-xs px-3 py-1.5 rounded-lg flex items-center gap-1"><Upload className="w-3.5 h-3.5" /> Import into project</button>
          </div>
        </>
      )}
    </Modal>
  );
}

import * as XLSX from "xlsx";

interface StageLike { id: string; name: string; sortOrder: number }
interface TaskLike { id: string; stageId: string; parentId: string | null; title: string; status: string; isMilestone: boolean; sortOrder: number }

const STATUS_LABEL: Record<string, string> = { pending: "Pending", in_progress: "In Progress", done: "Done" };

function planRows(stages: StageLike[], tasks: TaskLike[]) {
  const rows: Record<string, string>[] = [];
  const sortedStages = [...stages].sort((a, b) => a.sortOrder - b.sortOrder);
  for (const stage of sortedStages) {
    const mainTasks = tasks.filter(t => t.stageId === stage.id && !t.parentId).sort((a, b) => a.sortOrder - b.sortOrder);
    for (const mt of mainTasks) {
      rows.push({
        Stage: stage.name, Task: mt.title, "Sub-Task": "",
        Status: STATUS_LABEL[mt.status] ?? mt.status, Milestone: mt.isMilestone ? "Yes" : "",
      });
      const subs = tasks.filter(t => t.parentId === mt.id).sort((a, b) => a.sortOrder - b.sortOrder);
      for (const st of subs) {
        rows.push({
          Stage: stage.name, Task: mt.title, "Sub-Task": st.title,
          Status: STATUS_LABEL[st.status] ?? st.status, Milestone: st.isMilestone ? "Yes" : "",
        });
      }
    }
  }
  return rows;
}

// Excel sheet names can't exceed 31 chars and can't contain: \ / ? * [ ]
function safeSheetName(name: string, usedNames: Set<string>): string {
  let base = name.replace(/[\\/?*[\]]/g, " ").trim().slice(0, 31) || "Project";
  let candidate = base;
  let n = 2;
  while (usedNames.has(candidate.toLowerCase())) {
    const suffix = ` (${n++})`;
    candidate = base.slice(0, 31 - suffix.length) + suffix;
  }
  usedNames.add(candidate.toLowerCase());
  return candidate;
}

const COLS = [{ wch: 24 }, { wch: 32 }, { wch: 32 }, { wch: 14 }, { wch: 11 }];

export function buildSinglePlanWorkbook(projectName: string, stages: StageLike[], tasks: TaskLike[]): Buffer {
  const wb = XLSX.utils.book_new();
  const rows = planRows(stages, tasks);
  const ws = XLSX.utils.json_to_sheet(rows.length > 0 ? rows : [{ Stage: "", Task: "", "Sub-Task": "", Status: "", Milestone: "" }]);
  ws["!cols"] = COLS;
  XLSX.utils.book_append_sheet(wb, ws, safeSheetName(projectName, new Set()));
  return XLSX.write(wb, { type: "buffer", bookType: "xlsx" }) as Buffer;
}

export function buildAllPlansWorkbook(projects: { name: string; stages: StageLike[]; tasks: TaskLike[] }[]): Buffer {
  const wb = XLSX.utils.book_new();
  const usedNames = new Set<string>();
  for (const p of projects) {
    const rows = planRows(p.stages, p.tasks);
    const ws = XLSX.utils.json_to_sheet(rows.length > 0 ? rows : [{ Stage: "", Task: "", "Sub-Task": "", Status: "", Milestone: "" }]);
    ws["!cols"] = COLS;
    XLSX.utils.book_append_sheet(wb, ws, safeSheetName(p.name, usedNames));
  }
  if (projects.length === 0) XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet([]), "No projects");
  return XLSX.write(wb, { type: "buffer", bookType: "xlsx" }) as Buffer;
}

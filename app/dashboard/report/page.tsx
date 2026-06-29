"use client";
import { useEffect, useState } from "react";
import { BarChart2, Download } from "lucide-react";

interface ReportRow {
  name: string;
  total: number;
  done: number;
  in_progress: number;
  todo: number;
  completionRate: number;
  teamsServed: string[];
}

const TEAM_COLORS: Record<string, string> = {
  network: "bg-blue-100 text-blue-700",
  osp: "bg-pink-100 text-pink-700",
  finance: "bg-green-100 text-green-700",
  management: "bg-gray-100 text-gray-700",
};

export default function ReportPage() {
  const currentYear = new Date().getFullYear();
  const [from, setFrom] = useState(`${currentYear}-01-01`);
  const [to, setTo] = useState(`${currentYear}-12-31`);
  const [data, setData] = useState<ReportRow[]>([]);
  const [loading, setLoading] = useState(false);

  const load = () => {
    setLoading(true);
    fetch(`/api/report?from=${from}&to=${to}`)
      .then(r => r.json())
      .then(d => { setData(d); setLoading(false); });
  };

  useEffect(() => { load(); }, []);

  const exportCSV = () => {
    const header = "Name,Total,Done,In Progress,To Do,Completion %,Teams Served";
    const rows = data.map(r =>
      `${r.name},${r.total},${r.done},${r.in_progress},${r.todo},${r.completionRate}%,"${r.teamsServed.join(", ")}"`
    );
    const csv = [header, ...rows].join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `teamhub-report-${from}-to-${to}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const totalDone = data.reduce((s, r) => s + r.done, 0);
  const totalTasks = data.reduce((s, r) => s + r.total, 0);

  return (
    <div className="p-8">
      <div className="mb-8">
        <h2 className="text-2xl font-bold text-gray-900">Year-End Report</h2>
        <p className="text-gray-500 mt-1">Task completion by team member — for performance review &amp; awards</p>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl border border-gray-200 p-5 mb-6 flex flex-wrap items-end gap-4">
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">From</label>
          <input type="date" value={from} onChange={e => setFrom(e.target.value)}
            className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">To</label>
          <input type="date" value={to} onChange={e => setTo(e.target.value)}
            className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
        </div>
        <button onClick={load} disabled={loading}
          className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50">
          {loading ? "Loading..." : "Generate"}
        </button>
        {data.length > 0 && (
          <button onClick={exportCSV} className="flex items-center gap-2 border border-gray-300 px-4 py-2 rounded-lg text-sm font-medium hover:bg-gray-50 ml-auto">
            <Download className="w-4 h-4" /> Export CSV
          </button>
        )}
      </div>

      {/* Summary */}
      {data.length > 0 && (
        <div className="grid grid-cols-3 gap-4 mb-6">
          <div className="bg-white rounded-xl border border-gray-200 p-5 text-center">
            <p className="text-3xl font-bold text-gray-900">{data.length}</p>
            <p className="text-sm text-gray-500 mt-1">Members</p>
          </div>
          <div className="bg-white rounded-xl border border-gray-200 p-5 text-center">
            <p className="text-3xl font-bold text-green-600">{totalDone}</p>
            <p className="text-sm text-gray-500 mt-1">Tasks Completed</p>
          </div>
          <div className="bg-white rounded-xl border border-gray-200 p-5 text-center">
            <p className="text-3xl font-bold text-blue-600">{totalTasks > 0 ? Math.round((totalDone / totalTasks) * 100) : 0}%</p>
            <p className="text-sm text-gray-500 mt-1">Overall Completion Rate</p>
          </div>
        </div>
      )}

      {/* Table */}
      {data.length === 0 && !loading ? (
        <div className="text-center py-16 text-gray-400">
          <BarChart2 className="w-12 h-12 mx-auto mb-3 opacity-30" />
          <p>No data for selected period.</p>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50">
                <th className="text-left px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Member</th>
                <th className="text-center px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Total</th>
                <th className="text-center px-4 py-3 text-xs font-semibold text-green-600 uppercase tracking-wider">Done</th>
                <th className="text-center px-4 py-3 text-xs font-semibold text-yellow-600 uppercase tracking-wider">In Progress</th>
                <th className="text-center px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">To Do</th>
                <th className="text-center px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Rate</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Teams Served</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {data.map((row, i) => (
                <tr key={row.name} className={i === 0 ? "bg-amber-50" : "hover:bg-gray-50"}>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      {i === 0 && <span className="text-amber-500 text-sm">🏆</span>}
                      <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center text-xs font-bold text-blue-700">
                        {row.name[0]?.toUpperCase()}
                      </div>
                      <span className="font-medium text-gray-900">{row.name}</span>
                    </div>
                  </td>
                  <td className="px-4 py-4 text-center font-medium text-gray-700">{row.total}</td>
                  <td className="px-4 py-4 text-center font-bold text-green-600">{row.done}</td>
                  <td className="px-4 py-4 text-center text-yellow-600">{row.in_progress}</td>
                  <td className="px-4 py-4 text-center text-gray-500">{row.todo}</td>
                  <td className="px-4 py-4 text-center">
                    <div className="flex items-center justify-center gap-1.5">
                      <div className="w-16 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                        <div className="h-full bg-green-400 rounded-full" style={{ width: `${row.completionRate}%` }} />
                      </div>
                      <span className="text-xs font-medium text-gray-600">{row.completionRate}%</span>
                    </div>
                  </td>
                  <td className="px-4 py-4">
                    <div className="flex gap-1 flex-wrap">
                      {row.teamsServed.map(t => (
                        <span key={t} className={`text-xs px-2 py-0.5 rounded-full font-medium capitalize ${TEAM_COLORS[t] || "bg-gray-100 text-gray-600"}`}>{t}</span>
                      ))}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

"use client";
import { useCallback, useEffect, useState } from "react";
import { History } from "lucide-react";
import { getCached, fetchCached } from "../../lib/pageCache";

interface ChangeLogEntry { id: string; weekLabel: string; title: string; createdAt: string }
interface ChangeLogItem { id: string; entryId: string; text: string; sortOrder: number }
interface ChangeLogData { entries: ChangeLogEntry[]; items: ChangeLogItem[] }

// Read-only reference rail that fills the space freed by collapsing the main
// nav on a project page -- shows the full Change Logs history (all years) so
// past discussions stay visible while working in Background/Plan/Finance.
// Editing still happens in the project's own Change Logs tab.
export default function ChangeLogSidePanel({ projectId }: { projectId: string }) {
  const url = `/api/projects/${projectId}/changelog`;
  const [data, setData] = useState<ChangeLogData | null>(() => getCached(url) ?? null);

  const load = useCallback(() => { fetchCached<ChangeLogData>(url).then(setData); }, [url]);
  useEffect(() => { load(); }, [load]);

  const entries = data?.entries ?? [];
  const items = data?.items ?? [];

  const byYear: Record<string, ChangeLogEntry[]> = {};
  for (const e of entries) {
    const year = new Date(e.createdAt).getFullYear().toString();
    if (!byYear[year]) byYear[year] = [];
    byYear[year].push(e);
  }
  const years = Object.keys(byYear).sort((a, b) => Number(b) - Number(a));

  return (
    <aside className="w-72 flex-shrink-0 bg-white border-r border-gray-200 flex flex-col">
      <div className="px-4 py-3 border-b border-gray-200 flex items-center gap-2 flex-shrink-0">
        <History className="w-4 h-4 text-gray-400" />
        <h2 className="text-sm font-semibold text-gray-700">Change Logs</h2>
      </div>
      <div className="flex-1 overflow-y-auto px-4 py-3">
        {years.length === 0 ? (
          <p className="text-xs text-gray-400">No change log entries yet. Add one from the Change Logs tab.</p>
        ) : (
          <div className="space-y-5">
            {years.map(year => (
              <div key={year}>
                <h3 className="text-xs font-bold text-gray-500 mb-2">{year}</h3>
                <div className="space-y-3">
                  {byYear[year].map(entry => {
                    const entryItems = items.filter(i => i.entryId === entry.id).sort((a, b) => a.sortOrder - b.sortOrder);
                    return (
                      <div key={entry.id} className="border-l-2 border-blue-100 pl-2.5">
                        <p className="text-xs">
                          <span className="font-mono font-semibold text-blue-600">{entry.weekLabel}</span>
                          <span className="text-gray-400">: </span>
                          <span className="font-medium text-gray-700">{entry.title}</span>
                        </p>
                        {entryItems.length > 0 && (
                          <ul className="mt-1 space-y-0.5">
                            {entryItems.map(item => (
                              <li key={item.id} className="text-xs text-gray-500 flex items-start gap-1.5">
                                <span className="text-gray-300 mt-0.5">•</span>
                                <span>{item.text}</span>
                              </li>
                            ))}
                          </ul>
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
    </aside>
  );
}

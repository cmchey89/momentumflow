"use client";
import { useEffect, useState } from "react";
import { Users, AlertCircle } from "lucide-react";

interface MemberLoad {
  name: string;
  total: number;
  active: number;
  done: number;
  overdue: number;
}

export default function WorkloadPage() {
  const [data, setData] = useState<MemberLoad[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/workload").then(r => r.json()).then(d => { setData(d); setLoading(false); });
  }, []);

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
    </div>
  );
}

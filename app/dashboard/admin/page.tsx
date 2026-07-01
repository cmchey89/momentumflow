"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, Users, Shield } from "lucide-react";

interface Member { id: string; email: string; name: string; role: string; team: string | null; createdAt: string; }
interface ResetModal { userId: string; name: string; }
interface Me { id: string; email: string; name: string; role: string; team: string | null; }

const TEAMS = ["network", "osp", "finance", "management"] as const;
const ROLE_COLORS: Record<string, string> = {
  superadmin: "bg-purple-100 text-purple-700",
  manager: "bg-blue-100 text-blue-700",
  member: "bg-gray-100 text-gray-600",
};

export default function AdminPage() {
  const router = useRouter();
  const [me, setMe] = useState<Me | null>(null);
  const [members, setMembers] = useState<Member[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<"manager" | "member">("member");
  const [team, setTeam] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [resetModal, setResetModal] = useState<ResetModal | null>(null);
  const [newPassword, setNewPassword] = useState("");
  const [resetError, setResetError] = useState<string | null>(null);
  const [resetLoading, setResetLoading] = useState(false);
  const [resetSuccess, setResetSuccess] = useState(false);

  useEffect(() => {
    fetch("/api/auth/me").then(r => r.ok ? r.json() : Promise.reject()).then(d => setMe(d.user)).catch(() => router.push("/dashboard"));
  }, [router]);

  const load = () =>
    fetch("/api/auth/register")
      .then(r => { if (r.status === 403) { router.push("/dashboard"); return null; } return r.json(); })
      .then(d => d && setMembers(d));

  useEffect(() => { load(); }, []);

  // When manager opens form, pre-fill their team
  useEffect(() => {
    if (me?.role === "manager" && me.team) setTeam(me.team);
  }, [me]);

  const create = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!team) { setError("Please select a team."); return; }
    setLoading(true); setError(null);
    const res = await fetch("/api/auth/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, name, password, role: me?.role === "manager" ? "member" : role, team }),
    });
    if (!res.ok) {
      const d = await res.json().catch(() => ({}));
      setError(d.error || "Failed to create account");
      setLoading(false); return;
    }
    setName(""); setEmail(""); setPassword(""); setRole("member");
    if (me?.role !== "manager") setTeam("");
    setShowForm(false); setLoading(false);
    load();
  };

  const handleReset = async () => {
    if (!resetModal) return;
    if (newPassword.length < 8) { setResetError("Password must be at least 8 characters."); return; }
    setResetLoading(true); setResetError(null);
    const res = await fetch("/api/auth/reset-password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId: resetModal.userId, newPassword }),
    });
    if (!res.ok) {
      const d = await res.json().catch(() => ({}));
      setResetError(d.error || "Failed."); setResetLoading(false); return;
    }
    setResetSuccess(true); setResetLoading(false);
    setTimeout(() => { setResetModal(null); setNewPassword(""); setResetSuccess(false); }, 1500);
  };

  const isSuperAdmin = me?.role === "superadmin";

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Team Members</h2>
          <p className="text-gray-500 mt-1">
            {isSuperAdmin ? "Manage all teams and accounts" : `Managing ${me?.team?.toUpperCase()} team`}
          </p>
        </div>
        <button onClick={() => setShowForm(true)}
          className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 text-sm font-medium">
          <Plus className="w-4 h-4" /> Add Member
        </button>
      </div>

      {showForm && (
        <form onSubmit={create} className="bg-white border border-gray-200 rounded-xl p-6 mb-6">
          <h3 className="font-semibold text-gray-900 mb-4">New Team Member</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <input value={name} onChange={e => setName(e.target.value)} required placeholder="Full name or nickname"
              className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            <input type="email" value={email} onChange={e => setEmail(e.target.value)} required placeholder="Email"
              className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            <input type="password" value={password} onChange={e => setPassword(e.target.value)} required placeholder="Password (min 8 chars)" minLength={8}
              className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            {/* Team selector — locked for managers */}
            {isSuperAdmin ? (
              <select value={team} onChange={e => setTeam(e.target.value)} required
                className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                <option value="">Select team…</option>
                {TEAMS.map(t => <option key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1)}</option>)}
              </select>
            ) : (
              <input value={team.charAt(0).toUpperCase() + team.slice(1)} readOnly
                className="border border-gray-200 rounded-lg px-3 py-2 text-sm bg-gray-50 text-gray-500 cursor-not-allowed" />
            )}
            {/* Role selector — superadmin only */}
            {isSuperAdmin && (
              <select value={role} onChange={e => setRole(e.target.value as "manager" | "member")}
                className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                <option value="member">Member</option>
                <option value="manager">Manager</option>
              </select>
            )}
          </div>
          {error && <p className="text-xs text-red-600 mt-2">{error}</p>}
          <div className="flex gap-2 mt-4">
            <button type="submit" disabled={loading}
              className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50">
              {loading ? "Creating…" : "Create Account"}
            </button>
            <button type="button" onClick={() => { setShowForm(false); setError(null); }}
              className="border border-gray-300 px-4 py-2 rounded-lg text-sm font-medium hover:bg-gray-50">
              Cancel
            </button>
          </div>
        </form>
      )}

      {members.length === 0 ? (
        <div className="text-center py-16 text-gray-400">
          <Users className="w-12 h-12 mx-auto mb-3 opacity-30" />
          <p>No team members yet.</p>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50">
                <th className="text-left px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Name</th>
                <th className="text-left px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Email</th>
                <th className="text-left px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Team</th>
                <th className="text-left px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Role</th>
                <th className="text-left px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Added</th>
                <th className="px-6 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {members.map(m => (
                <tr key={m.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center text-xs font-bold text-blue-700">
                        {m.name[0]?.toUpperCase()}
                      </div>
                      <span className="font-medium text-gray-900">{m.name}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-gray-600">{m.email}</td>
                  <td className="px-6 py-4">
                    {m.team ? (
                      <span className="text-xs px-2 py-0.5 rounded-full font-medium bg-green-100 text-green-700 capitalize">{m.team}</span>
                    ) : (
                      <span className="text-xs text-gray-400">—</span>
                    )}
                  </td>
                  <td className="px-6 py-4">
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium flex items-center gap-1 w-fit ${ROLE_COLORS[m.role] ?? "bg-gray-100 text-gray-600"}`}>
                      {m.role === "superadmin" && <Shield className="w-3 h-3" />}
                      {m.role}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-gray-500">{new Date(m.createdAt).toLocaleDateString()}</td>
                  <td className="px-6 py-4">
                    <button onClick={() => { setResetModal({ userId: m.id, name: m.name }); setNewPassword(""); setResetError(null); setResetSuccess(false); }}
                      className="text-xs text-blue-600 hover:underline">Reset password</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {resetModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl p-6 w-full max-w-sm shadow-xl">
            <h3 className="font-bold text-gray-900 mb-1">Reset Password</h3>
            <p className="text-sm text-gray-500 mb-4">Set a new password for <span className="font-medium text-gray-800">{resetModal.name}</span></p>
            <input type="password" value={newPassword} onChange={e => setNewPassword(e.target.value)}
              placeholder="New password (min 8 chars)" minLength={8}
              className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 mb-3" />
            {resetError && <p className="text-xs text-red-600 mb-3">{resetError}</p>}
            {resetSuccess && <p className="text-xs text-green-600 mb-3">Password updated successfully!</p>}
            <div className="flex gap-2">
              <button onClick={handleReset} disabled={resetLoading}
                className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50">
                {resetLoading ? "Saving…" : "Save"}
              </button>
              <button onClick={() => setResetModal(null)}
                className="border border-gray-300 px-4 py-2 rounded-lg text-sm font-medium hover:bg-gray-50">
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

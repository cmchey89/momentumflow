"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { ClipboardList, Download, Plus, X } from "lucide-react";
import { getCached, fetchCached } from "../../../lib/pageCache";

interface MeetingMinute { id: string; meetingDate: string; title: string; attendees: string | null; createdAt: string }
interface MeetingMinuteItem { id: string; meetingId: string; text: string; sortOrder: number }
interface MeetingMinutesData { meetings: MeetingMinute[]; items: MeetingMinuteItem[] }

function fmtDate(d: string | null) { return d ? new Date(d).toLocaleDateString("en-GB", { day: "numeric", month: "short" }) : "—"; }
function fmtDateLong(d: string) { return new Date(d).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" }); }

// Builds a plain-text .txt of one meeting's minutes and downloads it, so it
// can be attached to an email straight from the file picker — no server
// round trip, no new dependency.
function exportMeetingAsTxt(meeting: MeetingMinute, points: string[]) {
  const lines = [
    meeting.title,
    fmtDateLong(meeting.meetingDate),
    "",
    `Attendees: ${meeting.attendees?.trim() || "—"}`,
    "",
    "Discussion Points:",
    ...(points.length > 0 ? points.map(p => `- ${p}`) : ["(none)"]),
  ];
  const blob = new Blob([lines.join("\n")], { type: "text/plain" });
  const safeTitle = meeting.title.replace(/[^\w\-]+/g, "-").replace(/-+/g, "-").replace(/^-|-$/g, "");
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = `${meeting.meetingDate}-${safeTitle || "meeting-minutes"}.txt`;
  a.click();
  URL.revokeObjectURL(a.href);
}

// Click-to-edit span/input, same behavior as the one on the project detail
// page — duplicated locally since that one isn't exported.
function EditableCell({
  value, displayValue, onSave, type = "text", inputClass = "", textClass = "", placeholder = "—",
}: {
  value: string; displayValue?: React.ReactNode; onSave: (v: string) => void;
  type?: "text" | "number" | "date"; inputClass?: string; textClass?: string; placeholder?: string;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => { if (!editing) setDraft(value); }, [value, editing]);
  useEffect(() => { if (editing) { inputRef.current?.focus(); inputRef.current?.select(); } }, [editing]);

  const commit = () => {
    setEditing(false);
    if (draft !== value) onSave(draft);
  };

  if (editing) {
    return (
      <input ref={inputRef} type={type} value={draft}
        onChange={e => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={e => { if (e.key === "Enter") commit(); if (e.key === "Escape") { setEditing(false); setDraft(value); } }}
        className={`border border-blue-300 rounded px-1.5 py-0.5 text-sm outline-none focus:ring-1 focus:ring-blue-400 bg-white ${inputClass}`}
      />
    );
  }

  return (
    <span onClick={e => { e.stopPropagation(); setEditing(true); }}
      className={`cursor-pointer rounded px-0.5 hover:bg-blue-50 hover:outline hover:outline-1 hover:outline-blue-200 transition-all ${textClass}`}
      title="Click to edit">
      {displayValue !== undefined ? displayValue
        : value ? value : <span className="text-gray-300 italic text-xs">{placeholder}</span>}
    </span>
  );
}

const url = "/api/meeting-minutes";

export default function MeetingMinutesPage() {
  const [data, setData] = useState<MeetingMinutesData | null>(() => getCached(url) ?? null);
  const [showAddMeeting, setShowAddMeeting] = useState(false);
  const [newDate, setNewDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [newTitle, setNewTitle] = useState("Meeting Minutes");
  const [newAttendees, setNewAttendees] = useState("");
  const [newPoints, setNewPoints] = useState("");
  const [addingItemFor, setAddingItemFor] = useState<string | null>(null);
  const [newItemText, setNewItemText] = useState("");

  const load = useCallback(() => { fetchCached<MeetingMinutesData>(url).then(setData); }, []);
  useEffect(() => { load(); }, [load]);

  const meetings = data?.meetings ?? [];
  const items = data?.items ?? [];

  // meetings already come back newest-first from the API, so grouping preserves that order.
  const byYear: Record<string, MeetingMinute[]> = {};
  for (const m of meetings) {
    const year = new Date(m.meetingDate).getFullYear().toString();
    if (!byYear[year]) byYear[year] = [];
    byYear[year].push(m);
  }
  const years = Object.keys(byYear).sort((a, b) => Number(b) - Number(a));

  const addMeeting = async () => {
    if (!newDate) return;
    const res = await fetch(url, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ meetingDate: newDate, title: newTitle, attendees: newAttendees }),
    });
    const meeting = await res.json();
    const lines = newPoints.split("\n").map(l => l.trim()).filter(Boolean);
    for (const line of lines) {
      await fetch(`/api/meeting-minutes/${meeting.id}/items`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: line }),
      });
    }
    setNewDate(new Date().toISOString().slice(0, 10)); setNewTitle("Meeting Minutes"); setNewAttendees(""); setNewPoints(""); setShowAddMeeting(false);
    load();
  };
  const patchMeeting = async (id: string, patch: Record<string, unknown>) => {
    await fetch(`/api/meeting-minutes/${id}`, {
      method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(patch),
    });
    load();
  };
  const deleteMeeting = async (id: string) => {
    if (!confirm("Delete these meeting minutes and all their points?")) return;
    await fetch(`/api/meeting-minutes/${id}`, { method: "DELETE" });
    load();
  };
  const addItem = async (meetingId: string) => {
    if (!newItemText.trim()) return;
    await fetch(`/api/meeting-minutes/${meetingId}/items`, {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ text: newItemText }),
    });
    setNewItemText(""); setAddingItemFor(null);
    load();
  };
  const patchItem = async (id: string, text: string) => {
    await fetch(`/api/meeting-minute-items/${id}`, {
      method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ text }),
    });
    load();
  };
  const deleteItem = async (id: string) => {
    await fetch(`/api/meeting-minute-items/${id}`, { method: "DELETE" });
    load();
  };

  return (
    <div className="p-8 max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Meeting Minutes</h1>
          <p className="text-gray-500 mt-1 text-sm">A standalone record of what was discussed and agreed at each meeting</p>
        </div>
        <button onClick={() => setShowAddMeeting(true)} className="flex items-center gap-1.5 bg-blue-600 text-white px-3 py-1.5 rounded-lg text-sm font-medium hover:bg-blue-700">
          <Plus className="w-3.5 h-3.5" /> New meeting
        </button>
      </div>

      {showAddMeeting && (
        <div className="bg-white border border-gray-200 rounded-xl p-4 mb-6 space-y-2">
          <div className="flex gap-2">
            <input autoFocus type="date" value={newDate} onChange={e => setNewDate(e.target.value)}
              className="text-sm border border-gray-300 rounded-lg px-2.5 py-1.5" />
            <input value={newTitle} onChange={e => setNewTitle(e.target.value)} placeholder="Title"
              className="flex-1 text-sm border border-gray-300 rounded-lg px-2.5 py-1.5" />
          </div>
          <input value={newAttendees} onChange={e => setNewAttendees(e.target.value)} placeholder="Attendees (comma-separated)"
            className="w-full text-sm border border-gray-300 rounded-lg px-2.5 py-1.5" />
          <textarea value={newPoints} onChange={e => setNewPoints(e.target.value)} placeholder="Discussion points, one per line (optional)"
            rows={4} className="w-full text-sm border border-gray-300 rounded-lg px-2.5 py-1.5 resize-none" />
          <div className="flex gap-2 pt-1">
            <button onClick={addMeeting} className="bg-blue-600 text-white text-sm px-3 py-1.5 rounded-lg font-medium">Add meeting</button>
            <button onClick={() => setShowAddMeeting(false)} className="border border-gray-300 text-sm px-3 py-1.5 rounded-lg">Cancel</button>
          </div>
        </div>
      )}

      {meetings.length === 0 && !showAddMeeting ? (
        <div className="text-center py-16 text-gray-400">
          <ClipboardList className="w-10 h-10 mx-auto mb-2 opacity-30" />
          <p>No meeting minutes yet. Add one after your next meeting.</p>
        </div>
      ) : (
        <div className="space-y-6">
          {years.map(year => (
            <div key={year}>
              <h4 className="text-sm font-bold text-gray-700 mb-2">{year}</h4>
              <div className="space-y-3">
                {byYear[year].map(meeting => {
                  const meetingItems = items.filter(i => i.meetingId === meeting.id).sort((a, b) => a.sortOrder - b.sortOrder);
                  return (
                    <div key={meeting.id} className="bg-white border border-gray-200 rounded-xl p-4">
                      <div className="flex items-start justify-between mb-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <EditableCell value={meeting.meetingDate} type="date" onSave={v => patchMeeting(meeting.id, { meetingDate: v })}
                            displayValue={fmtDate(meeting.meetingDate)} inputClass="w-32 font-mono text-sm font-semibold" textClass="font-mono text-sm font-semibold text-blue-600" />
                          <span className="text-gray-300">·</span>
                          <EditableCell value={meeting.title} onSave={v => patchMeeting(meeting.id, { title: v })}
                            inputClass="w-48 text-sm" textClass="text-sm font-medium text-gray-700" />
                        </div>
                        <div className="flex items-center gap-2 flex-shrink-0">
                          <button onClick={() => exportMeetingAsTxt(meeting, meetingItems.map(i => i.text))}
                            title="Export as .txt — attach to an email" className="text-gray-300 hover:text-blue-500">
                            <Download className="w-4 h-4" />
                          </button>
                          <button onClick={() => deleteMeeting(meeting.id)} className="text-gray-300 hover:text-red-400"><X className="w-4 h-4" /></button>
                        </div>
                      </div>
                      <p className="text-xs text-gray-400 mb-2">
                        Attendees: <EditableCell value={meeting.attendees ?? ""} onSave={v => patchMeeting(meeting.id, { attendees: v })}
                          inputClass="w-64 text-xs" textClass="text-xs text-gray-500" placeholder="Click to add attendees" />
                      </p>
                      {meetingItems.length > 0 && (
                        <ul className="space-y-1 mb-2">
                          {meetingItems.map(item => (
                            <li key={item.id} className="flex items-start gap-2 text-sm text-gray-600">
                              <span className="text-gray-300 mt-1">•</span>
                              <div className="flex-1 flex items-center justify-between gap-2">
                                <EditableCell value={item.text} onSave={v => patchItem(item.id, v)}
                                  inputClass="w-full text-sm" textClass="text-sm text-gray-600" />
                                <button onClick={() => deleteItem(item.id)} className="text-gray-200 hover:text-red-400 flex-shrink-0"><X className="w-3 h-3" /></button>
                              </div>
                            </li>
                          ))}
                        </ul>
                      )}
                      {addingItemFor === meeting.id ? (
                        <div className="flex gap-2 mt-2">
                          <input autoFocus value={newItemText} onChange={e => setNewItemText(e.target.value)}
                            onKeyDown={e => { if (e.key === "Enter") addItem(meeting.id); if (e.key === "Escape") setAddingItemFor(null); }}
                            placeholder="New point…" className="flex-1 text-sm border border-gray-300 rounded-lg px-2.5 py-1" />
                          <button onClick={() => addItem(meeting.id)} className="text-sm text-blue-600 font-medium">Add</button>
                          <button onClick={() => setAddingItemFor(null)} className="text-gray-400"><X className="w-4 h-4" /></button>
                        </div>
                      ) : (
                        <button onClick={() => { setAddingItemFor(meeting.id); setNewItemText(""); }} className="text-xs text-blue-600 flex items-center gap-1 hover:text-blue-700">
                          <Plus className="w-3 h-3" /> Add point
                        </button>
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

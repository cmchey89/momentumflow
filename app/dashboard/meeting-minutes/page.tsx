"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { jsPDF } from "jspdf";
import { CheckSquare, ClipboardList, Download, Plus, Square, X } from "lucide-react";
import { getCached, setCached, fetchCached, subscribeCached } from "../../../lib/pageCache";

interface MeetingMinute { id: string; meetingDate: string; title: string; attendees: string | null; createdAt: string }
interface MeetingMinuteItem { id: string; meetingId: string; text: string; sortOrder: number }
interface AgendaItem { id: string; meetingId: string; text: string; sortOrder: number }
type ActionStatus = "open" | "done";
interface ActionItem { id: string; meetingId: string; text: string; owner: string | null; dueDate: string | null; status: ActionStatus; sortOrder: number }
interface MeetingMinutesData { meetings: MeetingMinute[]; items: MeetingMinuteItem[]; agendaItems: AgendaItem[]; actionItems: ActionItem[] }

function fmtDate(d: string | null) { return d ? new Date(d).toLocaleDateString("en-GB", { day: "numeric", month: "short" }) : "—"; }
function fmtDateLong(d: string) { return new Date(d).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" }); }

// Lays out one meeting's minutes on an A4 page and downloads it as a PDF, so
// it can be attached to an email straight from the file picker — generated
// entirely client-side, no server round trip.
function exportMeetingAsPdf(meeting: MeetingMinute, agenda: string[], points: string[], actionItems: ActionItem[]) {
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const marginX = 56;
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const contentWidth = pageWidth - marginX * 2;
  let y = 64;

  const ensureSpace = (needed: number) => {
    if (y + needed > pageHeight - 56) { doc.addPage(); y = 64; }
  };
  const sectionHeading = (label: string) => {
    ensureSpace(18);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.setTextColor(107, 114, 128); // gray-500
    doc.text(label, marginX, y);
    y += 16;
  };
  const bulletedList = (lines: string[], numbered: boolean) => {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(11);
    doc.setTextColor(31, 41, 55); // gray-800
    const indent = numbered ? 18 : 14;
    lines.forEach((line, i) => {
      const marker = numbered ? `${i + 1}.` : "•";
      const wrapped = doc.splitTextToSize(line, contentWidth - indent);
      ensureSpace(wrapped.length * 15 + 6);
      doc.text(marker, marginX, y);
      doc.text(wrapped, marginX + indent, y);
      y += wrapped.length * 15 + 6;
    });
    y += 10;
  };

  doc.setFont("helvetica", "bold");
  doc.setFontSize(18);
  const titleLines = doc.splitTextToSize(meeting.title, contentWidth);
  doc.text(titleLines, marginX, y);
  y += titleLines.length * 22 + 4;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(11);
  doc.setTextColor(107, 114, 128);
  doc.text(fmtDateLong(meeting.meetingDate), marginX, y);
  y += 20;

  doc.setDrawColor(229, 231, 235); // gray-200
  doc.line(marginX, y, pageWidth - marginX, y);
  y += 24;

  sectionHeading("ATTENDEES");
  doc.setFont("helvetica", "normal");
  doc.setFontSize(11);
  doc.setTextColor(31, 41, 55);
  const attendeeLines = doc.splitTextToSize(meeting.attendees?.trim() || "—", contentWidth);
  doc.text(attendeeLines, marginX, y);
  y += attendeeLines.length * 15 + 24;

  if (agenda.length > 0) {
    sectionHeading("AGENDA");
    bulletedList(agenda, true);
  }

  sectionHeading("DISCUSSION POINTS");
  bulletedList(points.length > 0 ? points : ["(none)"], false);

  if (actionItems.length > 0) {
    sectionHeading("ACTION ITEMS");
    doc.setFontSize(11);
    for (const a of actionItems) {
      const meta = [a.owner ? `Owner: ${a.owner}` : null, a.dueDate ? `Due: ${fmtDate(a.dueDate)}` : null, a.status === "done" ? "Done" : "Open"]
        .filter(Boolean).join("  ·  ");
      const wrapped = doc.splitTextToSize(a.text, contentWidth - 14);
      ensureSpace(wrapped.length * 15 + 16);
      doc.setFont("helvetica", "normal");
      doc.setTextColor(31, 41, 55);
      doc.text(a.status === "done" ? "[x]" : "[ ]", marginX, y);
      doc.text(wrapped, marginX + 20, y);
      y += wrapped.length * 15 + 2;
      doc.setFontSize(9);
      doc.setTextColor(156, 163, 175); // gray-400
      doc.text(meta, marginX + 20, y);
      doc.setFontSize(11);
      y += 18;
    }
  }

  const safeTitle = meeting.title.replace(/[^\w\-]+/g, "-").replace(/-+/g, "-").replace(/^-|-$/g, "");
  doc.save(`${meeting.meetingDate}-${safeTitle || "meeting-minutes"}.pdf`);
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

interface Person { id: string; name: string }
const peopleUrl = "/api/people";

// Chip-style attendee input backed by a saved, reusable name list — pick a
// saved name from the dropdown, or type a new one and it's saved for next
// time. `value`/`onChange` stay a plain comma-separated string so the rest
// of the app (schema, PDF export) doesn't need to know this exists.
function AttendeesPicker({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const [people, setPeople] = useState<Person[]>(() => getCached<Person[]>(peopleUrl) ?? []);
  const [input, setInput] = useState("");
  const [open, setOpen] = useState(false);

  useEffect(() => {
    fetchCached<Person[]>(peopleUrl).then(setPeople);
    return subscribeCached(peopleUrl, () => setPeople(getCached<Person[]>(peopleUrl) ?? []));
  }, []);

  const selected = value.split(",").map(s => s.trim()).filter(Boolean);
  const commit = (names: string[]) => onChange(names.join(", "));

  const addName = async (raw: string) => {
    const name = raw.trim();
    setInput("");
    if (!name || selected.some(s => s.toLowerCase() === name.toLowerCase())) return;
    commit([...selected, name]);
    if (!people.some(p => p.name.toLowerCase() === name.toLowerCase())) {
      const res = await fetch(peopleUrl, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name }) });
      const person = await res.json();
      const next = [...(getCached<Person[]>(peopleUrl) ?? people), person].sort((a, b) => a.name.localeCompare(b.name));
      setCached(peopleUrl, next);
    }
  };
  const removeName = (name: string) => commit(selected.filter(n => n !== name));

  const suggestions = people.filter(p =>
    !selected.some(s => s.toLowerCase() === p.name.toLowerCase()) &&
    (input === "" || p.name.toLowerCase().includes(input.toLowerCase()))
  );

  return (
    <div className="relative">
      <div className="flex flex-wrap items-center gap-1.5 border border-gray-300 rounded-lg px-2 py-1.5 bg-white focus-within:ring-1 focus-within:ring-blue-400">
        {selected.map(name => (
          <span key={name} className="flex items-center gap-1 bg-blue-50 text-blue-700 text-xs font-medium pl-2 pr-1 py-0.5 rounded-full">
            {name}
            <button type="button" onClick={() => removeName(name)} className="hover:text-blue-900"><X className="w-3 h-3" /></button>
          </span>
        ))}
        <input
          value={input}
          onChange={e => { setInput(e.target.value); setOpen(true); }}
          onFocus={() => setOpen(true)}
          onBlur={() => setTimeout(() => setOpen(false), 150)}
          onKeyDown={e => {
            if (e.key === "Enter") { e.preventDefault(); addName(input); }
            if (e.key === "Backspace" && !input && selected.length > 0) removeName(selected[selected.length - 1]);
          }}
          placeholder={selected.length === 0 ? "Add attendee…" : ""}
          className="flex-1 min-w-[100px] text-sm outline-none py-0.5"
        />
      </div>
      {open && suggestions.length > 0 && (
        <div className="absolute z-10 mt-1 w-full bg-white border border-gray-200 rounded-lg shadow-lg max-h-48 overflow-y-auto">
          {suggestions.map(p => (
            <button key={p.id} type="button" onMouseDown={e => e.preventDefault()} onClick={() => addName(p.name)}
              className="w-full text-left px-3 py-1.5 text-sm text-gray-700 hover:bg-blue-50">
              {p.name}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// Matches the section-heading style already used on each meeting card
// (Attendees/Agenda/Discussion Points/Action Items), reused here for the
// new-meeting form's field labels so nothing goes unlabeled once typed in.
const fieldLabelClass = "block text-[11px] font-semibold text-gray-400 uppercase tracking-wide mb-1";

const url = "/api/meeting-minutes";

export default function MeetingMinutesPage() {
  const [data, setData] = useState<MeetingMinutesData | null>(() => getCached(url) ?? null);
  const [showAddMeeting, setShowAddMeeting] = useState(false);
  const [newDate, setNewDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [newTitle, setNewTitle] = useState("Meeting Minutes");
  const [newAttendees, setNewAttendees] = useState("");
  const [newAgenda, setNewAgenda] = useState("");
  const [newPoints, setNewPoints] = useState("");

  const [addingItemFor, setAddingItemFor] = useState<string | null>(null);
  const [newItemText, setNewItemText] = useState("");
  const [addingAgendaFor, setAddingAgendaFor] = useState<string | null>(null);
  const [newAgendaText, setNewAgendaText] = useState("");
  const [addingActionFor, setAddingActionFor] = useState<string | null>(null);
  const [newActionText, setNewActionText] = useState("");
  const [newActionOwner, setNewActionOwner] = useState("");
  const [newActionDue, setNewActionDue] = useState("");

  const load = useCallback(() => { fetchCached<MeetingMinutesData>(url).then(setData); }, []);
  useEffect(() => { load(); }, [load]);

  const meetings = data?.meetings ?? [];
  const items = data?.items ?? [];
  const agendaItems = data?.agendaItems ?? [];
  const actionItems = data?.actionItems ?? [];

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
    const agendaLines = newAgenda.split("\n").map(l => l.trim()).filter(Boolean);
    for (const line of agendaLines) {
      await fetch(`/api/meeting-minutes/${meeting.id}/agenda-items`, {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ text: line }),
      });
    }
    const pointLines = newPoints.split("\n").map(l => l.trim()).filter(Boolean);
    for (const line of pointLines) {
      await fetch(`/api/meeting-minutes/${meeting.id}/items`, {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ text: line }),
      });
    }
    setNewDate(new Date().toISOString().slice(0, 10)); setNewTitle("Meeting Minutes"); setNewAttendees(""); setNewAgenda(""); setNewPoints(""); setShowAddMeeting(false);
    load();
  };
  const patchMeeting = async (id: string, patch: Record<string, unknown>) => {
    await fetch(`/api/meeting-minutes/${id}`, {
      method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(patch),
    });
    load();
  };
  const deleteMeeting = async (id: string) => {
    if (!confirm("Delete these meeting minutes and everything in them?")) return;
    await fetch(`/api/meeting-minutes/${id}`, { method: "DELETE" });
    load();
  };

  // Discussion points
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

  // Agenda
  const addAgendaItem = async (meetingId: string) => {
    if (!newAgendaText.trim()) return;
    await fetch(`/api/meeting-minutes/${meetingId}/agenda-items`, {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ text: newAgendaText }),
    });
    setNewAgendaText(""); setAddingAgendaFor(null);
    load();
  };
  const patchAgendaItem = async (id: string, text: string) => {
    await fetch(`/api/meeting-agenda-items/${id}`, {
      method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ text }),
    });
    load();
  };
  const deleteAgendaItem = async (id: string) => {
    await fetch(`/api/meeting-agenda-items/${id}`, { method: "DELETE" });
    load();
  };

  // Action items
  const addActionItem = async (meetingId: string) => {
    if (!newActionText.trim()) return;
    await fetch(`/api/meeting-minutes/${meetingId}/action-items`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text: newActionText, owner: newActionOwner, dueDate: newActionDue || null }),
    });
    setNewActionText(""); setNewActionOwner(""); setNewActionDue(""); setAddingActionFor(null);
    load();
  };
  const patchActionItem = async (id: string, patch: Record<string, unknown>) => {
    await fetch(`/api/meeting-action-items/${id}`, {
      method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(patch),
    });
    load();
  };
  const deleteActionItem = async (id: string) => {
    await fetch(`/api/meeting-action-items/${id}`, { method: "DELETE" });
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
        <div className="bg-white border border-gray-200 rounded-xl p-4 mb-6 space-y-3">
          <div className="flex gap-2">
            <div>
              <label className={fieldLabelClass}>Date</label>
              <input autoFocus type="date" value={newDate} onChange={e => setNewDate(e.target.value)}
                className="text-sm border border-gray-300 rounded-lg px-2.5 py-1.5" />
            </div>
            <div className="flex-1">
              <label className={fieldLabelClass}>Title</label>
              <input value={newTitle} onChange={e => setNewTitle(e.target.value)} placeholder="Title"
                className="w-full text-sm border border-gray-300 rounded-lg px-2.5 py-1.5" />
            </div>
          </div>
          <div>
            <label className={fieldLabelClass}>Attendees</label>
            <AttendeesPicker value={newAttendees} onChange={setNewAttendees} />
          </div>
          <div>
            <label className={fieldLabelClass}>Agenda <span className="normal-case font-normal text-gray-300">(optional)</span></label>
            <textarea value={newAgenda} onChange={e => setNewAgenda(e.target.value)} placeholder="One topic per line"
              rows={3} className="w-full text-sm border border-gray-300 rounded-lg px-2.5 py-1.5 resize-none" />
          </div>
          <div>
            <label className={fieldLabelClass}>Discussion Points <span className="normal-case font-normal text-gray-300">(optional)</span></label>
            <textarea value={newPoints} onChange={e => setNewPoints(e.target.value)} placeholder="One point per line"
              rows={4} className="w-full text-sm border border-gray-300 rounded-lg px-2.5 py-1.5 resize-none" />
          </div>
          <p className="text-xs text-gray-400">Action items can be added after the meeting is created.</p>
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
                  const meetingAgenda = agendaItems.filter(a => a.meetingId === meeting.id).sort((a, b) => a.sortOrder - b.sortOrder);
                  const meetingActions = actionItems.filter(a => a.meetingId === meeting.id).sort((a, b) => a.sortOrder - b.sortOrder);
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
                          <button onClick={() => exportMeetingAsPdf(meeting, meetingAgenda.map(a => a.text), meetingItems.map(i => i.text), meetingActions)}
                            title="Export as PDF — attach to an email" className="text-gray-300 hover:text-blue-500">
                            <Download className="w-4 h-4" />
                          </button>
                          <button onClick={() => deleteMeeting(meeting.id)} className="text-gray-300 hover:text-red-400"><X className="w-4 h-4" /></button>
                        </div>
                      </div>
                      <div className="mb-3">
                        <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wide mb-1.5">Attendees</p>
                        <AttendeesPicker value={meeting.attendees ?? ""} onChange={v => patchMeeting(meeting.id, { attendees: v })} />
                      </div>

                      {/* Agenda */}
                      <div className="mb-3">
                        <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wide mb-1.5">Agenda</p>
                        {meetingAgenda.length > 0 && (
                          <ol className="space-y-1 mb-1.5">
                            {meetingAgenda.map((a, i) => (
                              <li key={a.id} className="flex items-start gap-2 text-sm text-gray-600">
                                <span className="text-gray-300 w-4 flex-shrink-0">{i + 1}.</span>
                                <div className="flex-1 flex items-center justify-between gap-2">
                                  <EditableCell value={a.text} onSave={v => patchAgendaItem(a.id, v)}
                                    inputClass="w-full text-sm" textClass="text-sm text-gray-600" />
                                  <button onClick={() => deleteAgendaItem(a.id)} className="text-gray-200 hover:text-red-400 flex-shrink-0"><X className="w-3 h-3" /></button>
                                </div>
                              </li>
                            ))}
                          </ol>
                        )}
                        {addingAgendaFor === meeting.id ? (
                          <div className="flex gap-2 mt-1">
                            <input autoFocus value={newAgendaText} onChange={e => setNewAgendaText(e.target.value)}
                              onKeyDown={e => { if (e.key === "Enter") addAgendaItem(meeting.id); if (e.key === "Escape") setAddingAgendaFor(null); }}
                              placeholder="New agenda topic…" className="flex-1 text-sm border border-gray-300 rounded-lg px-2.5 py-1" />
                            <button onClick={() => addAgendaItem(meeting.id)} className="text-sm text-blue-600 font-medium">Add</button>
                            <button onClick={() => setAddingAgendaFor(null)} className="text-gray-400"><X className="w-4 h-4" /></button>
                          </div>
                        ) : (
                          <button onClick={() => { setAddingAgendaFor(meeting.id); setNewAgendaText(""); }} className="text-xs text-blue-600 flex items-center gap-1 hover:text-blue-700">
                            <Plus className="w-3 h-3" /> Add agenda topic
                          </button>
                        )}
                      </div>

                      {/* Discussion points */}
                      <div className="mb-3">
                        <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wide mb-1.5">Discussion Points</p>
                        {meetingItems.length > 0 && (
                          <ul className="space-y-1 mb-1.5">
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
                          <div className="flex gap-2 mt-1">
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

                      {/* Action items */}
                      <div>
                        <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wide mb-1.5">Action Items</p>
                        {meetingActions.length > 0 && (
                          <div className="space-y-1 mb-1.5">
                            {meetingActions.map(a => (
                              <div key={a.id} className={`flex items-start gap-2 text-sm rounded-lg px-2 py-1.5 ${a.status === "done" ? "bg-green-50" : "bg-gray-50"}`}>
                                <button onClick={() => patchActionItem(a.id, { status: a.status === "done" ? "open" : "done" })}
                                  className="mt-0.5 flex-shrink-0" title={a.status === "done" ? "Mark open" : "Mark done"}>
                                  {a.status === "done"
                                    ? <CheckSquare className="w-3.5 h-3.5 text-green-600" />
                                    : <Square className="w-3.5 h-3.5 text-gray-300" />}
                                </button>
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center justify-between gap-2">
                                    <EditableCell value={a.text} onSave={v => patchActionItem(a.id, { text: v })}
                                      inputClass="w-full text-sm" textClass={`text-sm ${a.status === "done" ? "text-gray-400 line-through" : "text-gray-700"}`} />
                                    <button onClick={() => deleteActionItem(a.id)} className="text-gray-200 hover:text-red-400 flex-shrink-0"><X className="w-3 h-3" /></button>
                                  </div>
                                  <div className="flex items-center gap-3 mt-0.5 text-xs text-gray-400">
                                    <span>Owner: <EditableCell value={a.owner ?? ""} onSave={v => patchActionItem(a.id, { owner: v })}
                                      inputClass="w-28 text-xs" textClass="text-xs text-gray-500" placeholder="unassigned" /></span>
                                    <span>Due: <EditableCell value={a.dueDate ?? ""} type="date" onSave={v => patchActionItem(a.id, { dueDate: v || null })}
                                      displayValue={fmtDate(a.dueDate)} inputClass="w-28 text-xs" textClass="text-xs text-gray-500" /></span>
                                  </div>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                        {addingActionFor === meeting.id ? (
                          <div className="bg-gray-50 border border-gray-200 rounded-lg p-2 mt-1 space-y-1.5">
                            <input autoFocus value={newActionText} onChange={e => setNewActionText(e.target.value)}
                              placeholder="Action description…" className="w-full text-sm border border-gray-300 rounded-lg px-2.5 py-1" />
                            <div className="flex gap-1.5">
                              <input value={newActionOwner} onChange={e => setNewActionOwner(e.target.value)}
                                placeholder="Owner" className="flex-1 text-sm border border-gray-300 rounded-lg px-2.5 py-1" />
                              <input type="date" value={newActionDue} onChange={e => setNewActionDue(e.target.value)}
                                className="text-sm border border-gray-300 rounded-lg px-2.5 py-1" />
                            </div>
                            <div className="flex gap-2">
                              <button onClick={() => addActionItem(meeting.id)} className="text-sm text-blue-600 font-medium">Add</button>
                              <button onClick={() => setAddingActionFor(null)} className="text-sm text-gray-400">Cancel</button>
                            </div>
                          </div>
                        ) : (
                          <button onClick={() => { setAddingActionFor(meeting.id); setNewActionText(""); setNewActionOwner(""); setNewActionDue(""); }}
                            className="text-xs text-blue-600 flex items-center gap-1 hover:text-blue-700">
                            <Plus className="w-3 h-3" /> Add action item
                          </button>
                        )}
                      </div>
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

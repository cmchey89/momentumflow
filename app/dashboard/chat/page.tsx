"use client";
import { useEffect, useState, useRef } from "react";
import { useSession } from "next-auth/react";
import { Send, MessageSquare } from "lucide-react";

interface Message {
  id: string;
  userId: string;
  userName: string;
  content: string;
  createdAt: string;
}

interface Project {
  id: string;
  name: string;
}

export default function ChatPage() {
  const { data: session } = useSession();
  const user = session?.user;
  const [projects, setProjects] = useState<Project[]>([]);
  const [selectedProject, setSelectedProject] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetch("/api/projects").then(r => r.json()).then((p: Project[]) => {
      setProjects(p);
      if (p.length > 0) setSelectedProject(p[0].id);
    });
  }, []);

  useEffect(() => {
    if (!selectedProject) return;
    const load = () => fetch(`/api/projects/${selectedProject}/messages`).then(r => r.json()).then(setMessages);
    load();
    const interval = setInterval(load, 3000);
    return () => clearInterval(interval);
  }, [selectedProject]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const send = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || !selectedProject) return;
    setSending(true);
    await fetch(`/api/projects/${selectedProject}/messages`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content: input }),
    });
    setInput("");
    setSending(false);
    fetch(`/api/projects/${selectedProject}/messages`).then(r => r.json()).then(setMessages);
  };

  return (
    <div className="flex h-full">
      {/* Project list */}
      <div className="w-56 border-r border-gray-200 bg-white p-4">
        <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Projects</p>
        {projects.length === 0 ? (
          <p className="text-xs text-gray-400">No projects yet</p>
        ) : (
          <div className="space-y-1">
            {projects.map(p => (
              <button
                key={p.id}
                onClick={() => setSelectedProject(p.id)}
                className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-colors ${
                  selectedProject === p.id ? "bg-blue-50 text-blue-700 font-medium" : "text-gray-600 hover:bg-gray-100"
                }`}
              >
                # {p.name}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Chat area */}
      <div className="flex-1 flex flex-col">
        {selectedProject ? (
          <>
            <div className="border-b border-gray-200 bg-white px-6 py-3">
              <p className="font-semibold text-gray-900">
                # {projects.find(p => p.id === selectedProject)?.name}
              </p>
            </div>
            <div className="flex-1 overflow-y-auto p-6 space-y-4">
              {messages.length === 0 && (
                <div className="text-center text-gray-400 py-16">
                  <MessageSquare className="w-10 h-10 mx-auto mb-2 opacity-30" />
                  <p className="text-sm">No messages yet. Start the conversation!</p>
                </div>
              )}
              {messages.map(msg => (
                <div key={msg.id} className={`flex gap-3 ${msg.userId === user?.id ? "flex-row-reverse" : ""}`}>
                  <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center text-xs font-semibold text-blue-600 flex-shrink-0">
                    {msg.userName?.[0]?.toUpperCase() || "?"}
                  </div>
                  <div className={`max-w-xs ${msg.userId === user?.id ? "items-end" : "items-start"} flex flex-col`}>
                    <p className="text-xs text-gray-400 mb-1">{msg.userName}</p>
                    <div className={`px-4 py-2 rounded-2xl text-sm ${
                      msg.userId === user?.id ? "bg-blue-600 text-white rounded-tr-sm" : "bg-white border border-gray-200 text-gray-900 rounded-tl-sm"
                    }`}>
                      {msg.content}
                    </div>
                    <p className="text-xs text-gray-300 mt-1">
                      {new Date(msg.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                    </p>
                  </div>
                </div>
              ))}
              <div ref={bottomRef} />
            </div>
            <form onSubmit={send} className="border-t border-gray-200 bg-white p-4 flex gap-3">
              <input
                value={input} onChange={e => setInput(e.target.value)}
                placeholder="Type a message..."
                className="flex-1 border border-gray-300 rounded-full px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <button type="submit" disabled={sending || !input.trim()}
                className="w-10 h-10 bg-blue-600 text-white rounded-full flex items-center justify-center hover:bg-blue-700 disabled:opacity-50 transition-colors">
                <Send className="w-4 h-4" />
              </button>
            </form>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center text-gray-400">
            <p>Select a project to start chatting</p>
          </div>
        )}
      </div>
    </div>
  );
}

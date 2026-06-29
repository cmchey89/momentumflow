"use client";
import { useEffect, useState } from "react";
import { CheckSquare, Clock, Circle, AlertCircle } from "lucide-react";

interface Task {
  id: string;
  title: string;
  description: string | null;
  status: "todo" | "in_progress" | "done";
  priority: "low" | "medium" | "high";
  assignedTo: string | null;
  dueDate: string | null;
  projectId: string;
}

const priorityColors = { low: "text-gray-400", medium: "text-yellow-500", high: "text-red-500" };

export default function MyTasksPage() {
  const [tasks, setTasks] = useState<Task[]>([]);

  const load = () => fetch("/api/tasks/mine").then(r => r.json()).then(setTasks);
  useEffect(() => { load(); }, []);

  const updateStatus = async (id: string, status: string) => {
    await fetch(`/api/tasks/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    load();
  };

  const groups = {
    in_progress: tasks.filter(t => t.status === "in_progress"),
    todo: tasks.filter(t => t.status === "todo"),
    done: tasks.filter(t => t.status === "done"),
  };

  return (
    <div className="p-8">
      <div className="mb-8">
        <h2 className="text-2xl font-bold text-gray-900">My Tasks</h2>
        <p className="text-gray-500 mt-1">Tasks assigned to you across all projects</p>
      </div>

      {tasks.length === 0 ? (
        <div className="text-center py-16 text-gray-400">
          <CheckSquare className="w-12 h-12 mx-auto mb-3 opacity-30" />
          <p>No tasks assigned to you yet.</p>
        </div>
      ) : (
        <div className="space-y-8">
          {(["in_progress", "todo", "done"] as const).map(status => (
            groups[status].length > 0 && (
              <div key={status}>
                <h3 className="font-semibold text-gray-700 mb-3 flex items-center gap-2">
                  {status === "todo" && <Circle className="w-4 h-4 text-gray-400" />}
                  {status === "in_progress" && <Clock className="w-4 h-4 text-yellow-500" />}
                  {status === "done" && <CheckSquare className="w-4 h-4 text-green-500" />}
                  {status === "todo" ? "To Do" : status === "in_progress" ? "In Progress" : "Done"}
                  <span className="text-xs text-gray-400 font-normal">({groups[status].length})</span>
                </h3>
                <div className="space-y-2">
                  {groups[status].map(task => (
                    <div key={task.id} className="bg-white border border-gray-200 rounded-lg p-4 flex items-center gap-4">
                      <div className="flex-1">
                        <p className={`font-medium text-sm ${status === "done" ? "line-through text-gray-400" : "text-gray-900"}`}>
                          {task.title}
                        </p>
                        {task.description && <p className="text-xs text-gray-500 mt-0.5">{task.description}</p>}
                        <div className="flex items-center gap-2 mt-2">
                          <span className={`text-xs flex items-center gap-1 ${priorityColors[task.priority]}`}>
                            <AlertCircle className="w-3 h-3" /> {task.priority}
                          </span>
                          {task.dueDate && (
                            <span className={`text-xs ${new Date(task.dueDate) < new Date() && status !== "done" ? "text-red-500" : "text-gray-400"}`}>
                              Due {new Date(task.dueDate).toLocaleDateString()}
                            </span>
                          )}
                        </div>
                      </div>
                      <select
                        value={task.status}
                        onChange={e => updateStatus(task.id, e.target.value)}
                        className="text-xs border border-gray-200 rounded-md px-2 py-1 focus:outline-none focus:ring-1 focus:ring-blue-500"
                      >
                        <option value="todo">To Do</option>
                        <option value="in_progress">In Progress</option>
                        <option value="done">Done</option>
                      </select>
                    </div>
                  ))}
                </div>
              </div>
            )
          ))}
        </div>
      )}
    </div>
  );
}

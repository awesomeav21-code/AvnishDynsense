"use client";

import { useState } from "react";

interface PriorityLevel {
  key: string;
  label: string;
  color: string;
  description: string;
}

const DEFAULT_PRIORITIES: PriorityLevel[] = [
  { key: "critical", label: "Critical", color: "#EF4444", description: "Blocking issues that need immediate attention" },
  { key: "high", label: "High", color: "#F97316", description: "Important tasks that should be done soon" },
  { key: "medium", label: "Medium", color: "#3B82F6", description: "Normal priority work" },
  { key: "low", label: "Low", color: "#9CA3AF", description: "Nice to have, no urgency" },
];

export default function PrioritiesPage() {
  const [priorities] = useState<PriorityLevel[]>(DEFAULT_PRIORITIES);
  const [editingKey, setEditingKey] = useState<string | null>(null);
  const [editLabel, setEditLabel] = useState("");
  const [editDesc, setEditDesc] = useState("");

  function startEdit(p: PriorityLevel) {
    setEditingKey(p.key);
    setEditLabel(p.label);
    setEditDesc(p.description);
  }

  function cancelEdit() {
    setEditingKey(null);
    setEditLabel("");
    setEditDesc("");
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-lg font-bold">Priorities</h1>
        <p className="text-xs text-gray-500 mt-0.5">Configure the priority levels used across all tasks.</p>
      </div>

      <div className="bg-white rounded-lg border divide-y">
        {priorities.map((p, index) => (
          <div key={p.key} className="px-4 py-4">
            {editingKey === p.key ? (
              <div className="space-y-2">
                <div className="flex items-center gap-3">
                  <span
                    className="w-3 h-3 rounded-full flex-shrink-0"
                    style={{ backgroundColor: p.color }}
                  />
                  <input
                    type="text"
                    value={editLabel}
                    onChange={(e) => setEditLabel(e.target.value)}
                    className="text-sm font-medium px-2 py-1 border rounded-md focus:outline-none focus:ring-1 focus:ring-ai/50"
                    autoFocus
                  />
                </div>
                <input
                  type="text"
                  value={editDesc}
                  onChange={(e) => setEditDesc(e.target.value)}
                  className="w-full text-xs px-2 py-1 border rounded-md focus:outline-none focus:ring-1 focus:ring-ai/50"
                  placeholder="Description"
                />
                <div className="flex gap-2">
                  <button
                    onClick={cancelEdit}
                    className="px-3 py-1 text-xs font-medium text-gray-600 border rounded-md hover:bg-gray-50"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-1 text-xs text-gray-400 w-6">
                  {index + 1}
                </div>
                <span
                  className="w-3 h-3 rounded-full flex-shrink-0"
                  style={{ backgroundColor: p.color }}
                />
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium text-gray-900">{p.label}</div>
                  <div className="text-xs text-gray-500">{p.description}</div>
                </div>
                <span className="text-xs font-mono text-gray-400 px-2 py-0.5 bg-gray-50 rounded">
                  {p.key}
                </span>
                <button
                  onClick={() => startEdit(p)}
                  className="text-xs text-gray-400 hover:text-ai px-2 py-1 transition-colors"
                >
                  Edit
                </button>
              </div>
            )}
          </div>
        ))}
      </div>

      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <p className="text-xs text-blue-700">
          Priority levels are system-wide and apply to all tasks across all projects. The order shown here represents the severity ranking from highest to lowest.
        </p>
      </div>
    </div>
  );
}

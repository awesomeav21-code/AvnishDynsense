"use client";

import { useEffect, useState, useCallback } from "react";
import { api } from "@/lib/api";

interface Tag {
  id: string;
  name: string;
  color: string;
  createdAt: string;
}

const PRESET_COLORS = [
  "#3B82F6", "#10B981", "#EF4444", "#F59E0B",
  "#8B5CF6", "#6366F1", "#EC4899", "#14B8A6",
];

export default function TagsPage() {
  const [tags, setTags] = useState<Tag[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState("");
  const [newColor, setNewColor] = useState(PRESET_COLORS[0]!);
  const [creating, setCreating] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  useEffect(() => {
    api.getTags()
      .then((res) => setTags(res.data))
      .catch(() => setError("Failed to load tags"))
      .finally(() => setLoading(false));
  }, []);

  const handleCreate = useCallback(async () => {
    if (!newName.trim()) return;
    setCreating(true);
    setError("");
    try {
      const res = await api.createTag({ name: newName.trim(), color: newColor });
      setTags((prev) => [...prev, { ...res.data, createdAt: new Date().toISOString() }]);
      setNewName("");
      setNewColor(PRESET_COLORS[0]!);
      setShowCreate(false);
    } catch {
      setError("Failed to create tag");
    } finally {
      setCreating(false);
    }
  }, [newName, newColor]);

  const handleDelete = useCallback(async (id: string, name: string) => {
    if (!confirm(`Delete tag "${name}"? It will be removed from all tasks.`)) return;
    setDeletingId(id);
    try {
      await api.deleteTag(id);
      setTags((prev) => prev.filter((t) => t.id !== id));
    } catch {
      setError("Failed to delete tag");
    } finally {
      setDeletingId(null);
    }
  }, []);

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="h-8 w-48 bg-gray-200 rounded animate-pulse" />
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-12 bg-white rounded border animate-pulse" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-bold">Tags</h1>
          <p className="text-xs text-gray-500 mt-0.5">Manage tags that can be applied to tasks for categorization.</p>
        </div>
        <button
          onClick={() => setShowCreate(true)}
          className="px-3 py-1.5 text-xs font-medium text-white bg-ai rounded-md hover:bg-ai/90"
        >
          + New Tag
        </button>
      </div>

      {error && (
        <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded px-4 py-3">
          {error}
          <button onClick={() => setError("")} className="ml-2 text-red-400 hover:text-red-600">&times;</button>
        </div>
      )}

      {showCreate && (
        <div className="bg-white rounded-lg border p-4 space-y-3">
          <input
            type="text"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="Tag name"
            autoFocus
            onKeyDown={(e) => { if (e.key === "Enter") handleCreate(); if (e.key === "Escape") setShowCreate(false); }}
            className="w-full px-3 py-2 text-xs border rounded-md focus:outline-none focus:ring-1 focus:ring-ai/50"
          />
          <div>
            <label className="text-[10px] text-gray-500 block mb-1">Color</label>
            <div className="flex gap-2">
              {PRESET_COLORS.map((c) => (
                <button
                  key={c}
                  onClick={() => setNewColor(c)}
                  className={`w-6 h-6 rounded-full border-2 transition-all ${newColor === c ? "border-gray-900 scale-110" : "border-transparent"}`}
                  style={{ backgroundColor: c }}
                />
              ))}
            </div>
          </div>
          <div className="flex gap-2">
            <button
              onClick={handleCreate}
              disabled={creating || !newName.trim()}
              className="px-3 py-1.5 text-xs font-medium text-white bg-ai rounded-md disabled:opacity-50"
            >
              {creating ? "Creating..." : "Create"}
            </button>
            <button
              onClick={() => { setShowCreate(false); setNewName(""); }}
              className="px-3 py-1.5 text-xs font-medium text-gray-600 border rounded-md hover:bg-gray-50"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {tags.length === 0 ? (
        <div className="text-sm text-gray-500 bg-white rounded-lg border p-6 text-center">
          No tags yet. Create one to start categorizing tasks.
        </div>
      ) : (
        <div className="bg-white rounded-lg border divide-y">
          {tags.map((tag) => (
            <div
              key={tag.id}
              className={`flex items-center gap-4 px-4 py-3 ${deletingId === tag.id ? "opacity-50" : ""}`}
            >
              <span
                className="w-3 h-3 rounded-full flex-shrink-0"
                style={{ backgroundColor: tag.color }}
              />
              <div className="flex-1 min-w-0">
                <span className="text-sm font-medium text-gray-900">{tag.name}</span>
              </div>
              <span className="text-xs text-gray-400 font-mono">{tag.color}</span>
              <span className="text-xs text-gray-400">
                {new Date(tag.createdAt).toLocaleDateString()}
              </span>
              <button
                onClick={() => handleDelete(tag.id, tag.name)}
                disabled={deletingId === tag.id}
                className="text-xs text-red-500 hover:text-red-700 px-2 py-1 transition-colors"
              >
                Delete
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

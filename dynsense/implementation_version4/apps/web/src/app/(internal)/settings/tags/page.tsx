"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { api } from "@/lib/api";

interface Tag {
  id: string;
  name: string;
  color: string;
  archived: boolean;
  isDefault: boolean;
  taskCount: number;
  createdAt: string;
}

const COLOR_OPTIONS = [
  { name: "Red", hex: "#EF4444" },
  { name: "Amber", hex: "#F59E0B" },
  { name: "Yellow", hex: "#EAB308" },
  { name: "Orange", hex: "#F97316" },
  { name: "Green", hex: "#22C55E" },
  { name: "Blue", hex: "#3B82F6" },
  { name: "Purple", hex: "#8B5CF6" },
  { name: "Teal", hex: "#14B8A6" },
  { name: "Pink", hex: "#EC4899" },
  { name: "Gray", hex: "#6B7280" },
] as const;

function colorName(hex: string): string {
  return COLOR_OPTIONS.find((c) => c.hex.toLowerCase() === hex.toLowerCase())?.name ?? hex;
}

export default function TagsPage() {
  const [tags, setTags] = useState<Tag[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [userRole, setUserRole] = useState<string | null>(null);

  // Add form state
  const [newName, setNewName] = useState("");
  const [newColor, setNewColor] = useState<string>(COLOR_OPTIONS[5]!.hex); // Blue default
  const [colorDropdownOpen, setColorDropdownOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const colorDropdownRef = useRef<HTMLDivElement>(null);

  // Inline rename state
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");

  // Delete modal state
  const [deleteTarget, setDeleteTarget] = useState<Tag | null>(null);
  const [deleting, setDeleting] = useState(false);

  const canMutate = userRole === "site_admin" || userRole === "pm";

  useEffect(() => {
    Promise.all([api.getMe(), api.getTags()])
      .then(([me, res]) => {
        setUserRole(me.role);
        setTags(res.data);
      })
      .catch(() => setError("Failed to load tags"))
      .finally(() => setLoading(false));
  }, []);

  // Close color dropdown on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (colorDropdownRef.current && !colorDropdownRef.current.contains(e.target as Node)) {
        setColorDropdownOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  const handleCreate = useCallback(async () => {
    if (!newName.trim()) return;
    setCreating(true);
    setError("");
    try {
      const res = await api.createTag({ name: newName.trim(), color: newColor });
      setTags((prev) => [
        { ...res.data, taskCount: 0, createdAt: new Date().toISOString() },
        ...prev,
      ]);
      setNewName("");
      setNewColor(COLOR_OPTIONS[5]!.hex);
    } catch {
      setError("Failed to create tag");
    } finally {
      setCreating(false);
    }
  }, [newName, newColor]);

  const handleRenameStart = useCallback((tag: Tag) => {
    setRenamingId(tag.id);
    setRenameValue(tag.name);
  }, []);

  const handleRenameSave = useCallback(async (id: string) => {
    const trimmed = renameValue.trim();
    if (!trimmed) {
      setRenamingId(null);
      return;
    }
    setError("");
    try {
      const res = await api.updateTag(id, { name: trimmed });
      setTags((prev) => prev.map((t) => (t.id === id ? { ...t, name: res.data.name } : t)));
    } catch {
      setError("Failed to rename tag");
    } finally {
      setRenamingId(null);
    }
  }, [renameValue]);

  const handleArchiveToggle = useCallback(async (id: string, archived: boolean) => {
    setError("");
    try {
      await api.updateTag(id, { archived });
      setTags((prev) => prev.map((t) => (t.id === id ? { ...t, archived } : t)));
    } catch {
      setError("Failed to update tag");
    }
  }, []);

  const handleDeleteConfirm = useCallback(async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await api.deleteTag(deleteTarget.id);
      setTags((prev) => prev.filter((t) => t.id !== deleteTarget.id));
      setDeleteTarget(null);
    } catch {
      setError("Failed to delete tag");
    } finally {
      setDeleting(false);
    }
  }, [deleteTarget]);

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

  if (!canMutate && userRole !== null) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-lg font-bold">Tags</h1>
          <p className="text-xs text-gray-500 mt-0.5">Manage tags that can be applied to tasks.</p>
        </div>
        <div className="bg-white rounded-lg border p-8 text-center">
          <div className="text-sm font-medium text-gray-900 mb-1">Permission Denied</div>
          <p className="text-xs text-gray-500">Only administrators and project managers can manage tags.</p>
        </div>
      </div>
    );
  }

  const activeTags = tags.filter((t) => !t.archived);
  const archivedTags = tags.filter((t) => t.archived);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-lg font-bold">Tags</h1>
        <p className="text-xs text-gray-500 mt-0.5">Manage tags that can be applied to tasks for categorization.</p>
      </div>

      {/* Error banner */}
      {error && (
        <div className="text-xs text-red-600 bg-red-50 border border-red-200 rounded px-4 py-3">
          {error}
          <button onClick={() => setError("")} className="ml-2 text-red-400 hover:text-red-600">&times;</button>
        </div>
      )}

      {/* Add Tag Form */}
      <div className="bg-white rounded-lg border p-4">
        <h2 className="text-xs font-bold mb-3">Add Tag</h2>
        <div className="flex items-end gap-3">
          <div className="flex-1">
            <label className="text-[10px] text-gray-500 block mb-1">Name</label>
            <input
              type="text"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="e.g. Bug, Feature, Urgent"
              onKeyDown={(e) => { if (e.key === "Enter") handleCreate(); }}
              className="w-full px-3 py-1.5 text-xs border rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500/50"
            />
          </div>
          <div className="relative" ref={colorDropdownRef}>
            <label className="text-[10px] text-gray-500 block mb-1">Color</label>
            <button
              onClick={() => setColorDropdownOpen((o) => !o)}
              className="flex items-center gap-2 px-3 py-1.5 text-xs border rounded-md hover:bg-gray-50 min-w-[120px]"
            >
              <span className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: newColor }} />
              <span>{colorName(newColor)}</span>
              <svg className="w-3 h-3 ml-auto text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
            </button>
            {colorDropdownOpen && (
              <div className="absolute z-10 mt-1 bg-white border rounded-lg shadow-lg py-1 w-40">
                {COLOR_OPTIONS.map((c) => (
                  <button
                    key={c.hex}
                    onClick={() => { setNewColor(c.hex); setColorDropdownOpen(false); }}
                    className={`w-full flex items-center gap-2 px-3 py-1.5 text-xs hover:bg-gray-50 ${newColor === c.hex ? "bg-blue-50 text-blue-700" : "text-gray-700"}`}
                  >
                    <span className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: c.hex }} />
                    {c.name}
                  </button>
                ))}
              </div>
            )}
          </div>
          <button
            onClick={handleCreate}
            disabled={creating || !newName.trim()}
            className="px-4 py-1.5 text-xs font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 disabled:opacity-50 whitespace-nowrap"
          >
            {creating ? "Adding..." : "Add Tag"}
          </button>
        </div>
      </div>

      {/* Active Tags Table */}
      <div>
        <h2 className="text-xs font-bold mb-2">Active Tags ({activeTags.length})</h2>
        {activeTags.length === 0 ? (
          <div className="text-xs text-gray-500 bg-white rounded-lg border p-6 text-center">
            No active tags. Create one above to start categorizing tasks.
          </div>
        ) : (
          <div className="bg-white rounded-lg border overflow-hidden">
            <table className="w-full">
              <thead>
                <tr className="border-b bg-gray-50">
                  <th className="text-left text-[10px] font-medium text-gray-500 uppercase tracking-wider px-4 py-2">Name</th>
                  <th className="text-left text-[10px] font-medium text-gray-500 uppercase tracking-wider px-4 py-2">Color</th>
                  <th className="text-left text-[10px] font-medium text-gray-500 uppercase tracking-wider px-4 py-2">Tasks</th>
                  <th className="text-left text-[10px] font-medium text-gray-500 uppercase tracking-wider px-4 py-2">Default</th>
                  <th className="text-left text-[10px] font-medium text-gray-500 uppercase tracking-wider px-4 py-2">Status</th>
                  <th className="text-right text-[10px] font-medium text-gray-500 uppercase tracking-wider px-4 py-2">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {activeTags.map((tag) => (
                  <tr key={tag.id} className="hover:bg-gray-50">
                    <td className="px-4 py-2.5">
                      {renamingId === tag.id ? (
                        <input
                          type="text"
                          value={renameValue}
                          onChange={(e) => setRenameValue(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") handleRenameSave(tag.id);
                            if (e.key === "Escape") setRenamingId(null);
                          }}
                          onBlur={() => handleRenameSave(tag.id)}
                          autoFocus
                          className="px-2 py-0.5 text-xs border rounded focus:outline-none focus:ring-1 focus:ring-blue-500/50 w-full max-w-[200px]"
                        />
                      ) : (
                        <span className="text-xs font-medium text-gray-900">{tag.name}</span>
                      )}
                    </td>
                    <td className="px-4 py-2.5">
                      <div className="flex items-center gap-2">
                        <span className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: tag.color }} />
                        <span className="text-xs text-gray-600">{colorName(tag.color)}</span>
                      </div>
                    </td>
                    <td className="px-4 py-2.5">
                      <span className="text-xs text-gray-600">{tag.taskCount}</span>
                    </td>
                    <td className="px-4 py-2.5">
                      {tag.isDefault && (
                        <span className="inline-flex items-center px-1.5 py-0.5 text-[10px] font-medium bg-blue-100 text-blue-700 rounded">
                          Default
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-2.5">
                      <span className="inline-flex items-center px-1.5 py-0.5 text-[10px] font-medium bg-green-100 text-green-700 rounded">
                        Active
                      </span>
                    </td>
                    <td className="px-4 py-2.5 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          onClick={() => handleRenameStart(tag)}
                          className="px-2 py-1 text-[10px] text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded transition-colors"
                        >
                          Rename
                        </button>
                        <button
                          onClick={() => handleArchiveToggle(tag.id, true)}
                          className="px-2 py-1 text-[10px] text-amber-600 hover:text-amber-700 hover:bg-amber-50 rounded transition-colors"
                        >
                          Archive
                        </button>
                        <button
                          onClick={() => setDeleteTarget(tag)}
                          className="px-2 py-1 text-[10px] text-red-500 hover:text-red-700 hover:bg-red-50 rounded transition-colors"
                        >
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Archived Tags Table */}
      {archivedTags.length > 0 && (
        <div>
          <h2 className="text-xs font-bold mb-2">Archived Tags ({archivedTags.length})</h2>
          <div className="bg-white rounded-lg border overflow-hidden opacity-60">
            <table className="w-full">
              <thead>
                <tr className="border-b bg-gray-50">
                  <th className="text-left text-[10px] font-medium text-gray-500 uppercase tracking-wider px-4 py-2">Name</th>
                  <th className="text-left text-[10px] font-medium text-gray-500 uppercase tracking-wider px-4 py-2">Color</th>
                  <th className="text-left text-[10px] font-medium text-gray-500 uppercase tracking-wider px-4 py-2">Tasks</th>
                  <th className="text-left text-[10px] font-medium text-gray-500 uppercase tracking-wider px-4 py-2">Default</th>
                  <th className="text-left text-[10px] font-medium text-gray-500 uppercase tracking-wider px-4 py-2">Status</th>
                  <th className="text-right text-[10px] font-medium text-gray-500 uppercase tracking-wider px-4 py-2">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {archivedTags.map((tag) => (
                  <tr key={tag.id} className="hover:bg-gray-50">
                    <td className="px-4 py-2.5">
                      {renamingId === tag.id ? (
                        <input
                          type="text"
                          value={renameValue}
                          onChange={(e) => setRenameValue(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") handleRenameSave(tag.id);
                            if (e.key === "Escape") setRenamingId(null);
                          }}
                          onBlur={() => handleRenameSave(tag.id)}
                          autoFocus
                          className="px-2 py-0.5 text-xs border rounded focus:outline-none focus:ring-1 focus:ring-blue-500/50 w-full max-w-[200px]"
                        />
                      ) : (
                        <span className="text-xs font-medium text-gray-900">{tag.name}</span>
                      )}
                    </td>
                    <td className="px-4 py-2.5">
                      <div className="flex items-center gap-2">
                        <span className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: tag.color }} />
                        <span className="text-xs text-gray-600">{colorName(tag.color)}</span>
                      </div>
                    </td>
                    <td className="px-4 py-2.5">
                      <span className="text-xs text-gray-600">{tag.taskCount}</span>
                    </td>
                    <td className="px-4 py-2.5">
                      {tag.isDefault && (
                        <span className="inline-flex items-center px-1.5 py-0.5 text-[10px] font-medium bg-blue-100 text-blue-700 rounded">
                          Default
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-2.5">
                      <span className="inline-flex items-center px-1.5 py-0.5 text-[10px] font-medium border border-gray-300 text-gray-500 rounded">
                        Archived
                      </span>
                    </td>
                    <td className="px-4 py-2.5 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          onClick={() => handleRenameStart(tag)}
                          className="px-2 py-1 text-[10px] text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded transition-colors"
                        >
                          Rename
                        </button>
                        <button
                          onClick={() => handleArchiveToggle(tag.id, false)}
                          className="px-2 py-1 text-[10px] text-green-600 hover:text-green-700 hover:bg-green-50 rounded transition-colors"
                        >
                          Unarchive
                        </button>
                        <button
                          onClick={() => setDeleteTarget(tag)}
                          className="px-2 py-1 text-[10px] text-red-500 hover:text-red-700 hover:bg-red-50 rounded transition-colors"
                        >
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/50" onClick={() => !deleting && setDeleteTarget(null)} />
          <div className="relative bg-white rounded-lg border shadow-xl p-6 max-w-sm w-full mx-4">
            <h3 className="text-sm font-bold text-gray-900 mb-2">Delete Tag</h3>
            <p className="text-xs text-gray-600 mb-1">
              Are you sure you want to delete <span className="font-medium">&ldquo;{deleteTarget.name}&rdquo;</span>?
            </p>
            <p className="text-xs text-red-600 mb-4">
              This tag will be removed from all associated tasks. This action cannot be undone.
            </p>
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setDeleteTarget(null)}
                disabled={deleting}
                className="px-3 py-1.5 text-xs font-medium text-gray-600 border rounded-md hover:bg-gray-50 disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={handleDeleteConfirm}
                disabled={deleting}
                className="px-3 py-1.5 text-xs font-medium text-white bg-red-600 rounded-md hover:bg-red-700 disabled:opacity-50"
              >
                {deleting ? "Deleting..." : "Delete"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

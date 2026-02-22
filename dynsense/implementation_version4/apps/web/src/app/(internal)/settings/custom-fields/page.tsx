"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";

// FR-130: Custom field definitions management page
interface FieldDefinition {
  id: string;
  name: string;
  fieldType: string;
  config: unknown;
}

const FIELD_TYPES = [
  { value: "text", label: "Text" },
  { value: "number", label: "Number" },
  { value: "date", label: "Date" },
  { value: "select", label: "Single Select" },
  { value: "multiselect", label: "Multi Select" },
  { value: "checkbox", label: "Checkbox" },
  { value: "url", label: "URL" },
];

export default function CustomFieldsPage() {
  const [fields, setFields] = useState<FieldDefinition[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [newName, setNewName] = useState("");
  const [newType, setNewType] = useState("text");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    api.getCustomFieldDefinitions()
      .then((res) => setFields(res.data))
      .finally(() => setLoading(false));
  }, []);

  async function handleCreate() {
    if (!newName.trim()) return;
    setSaving(true);
    try {
      const res = await api.createCustomFieldDefinition({ name: newName.trim(), fieldType: newType });
      setFields((prev) => [...prev, res.data as FieldDefinition]);
      setNewName("");
      setNewType("text");
      setShowAdd(false);
    } catch {
      // handle error
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: string) {
    try {
      await api.deleteCustomFieldDefinition(id);
      setFields((prev) => prev.filter((f) => f.id !== id));
    } catch {
      // handle error
    }
  }

  if (loading) {
    return (
      <div className="space-y-4 max-w-2xl">
        <h1 className="text-lg font-bold">Custom Fields</h1>
        <div className="animate-pulse space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-12 bg-gray-200 rounded" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-2xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-bold">Custom Fields</h1>
          <p className="text-xs text-gray-500 mt-1">Define custom fields to track additional data on tasks</p>
        </div>
        <button
          onClick={() => setShowAdd(true)}
          className="text-xs bg-blue-600 text-white px-3 py-1.5 rounded hover:bg-blue-700"
        >
          + Add Field
        </button>
      </div>

      {/* Add field form */}
      {showAdd && (
        <div className="bg-white border rounded-lg p-4 space-y-3">
          <h3 className="text-xs font-semibold">New Custom Field</h3>
          <div className="flex gap-3">
            <input
              type="text"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="Field name"
              className="flex-1 text-xs border rounded px-3 py-1.5"
              autoFocus
            />
            <select
              value={newType}
              onChange={(e) => setNewType(e.target.value)}
              className="text-xs border rounded px-3 py-1.5"
            >
              {FIELD_TYPES.map((ft) => (
                <option key={ft.value} value={ft.value}>{ft.label}</option>
              ))}
            </select>
          </div>
          <div className="flex gap-2">
            <button
              onClick={handleCreate}
              disabled={saving || !newName.trim()}
              className="text-xs bg-blue-600 text-white px-3 py-1.5 rounded hover:bg-blue-700 disabled:opacity-50"
            >
              {saving ? "Creating..." : "Create"}
            </button>
            <button
              onClick={() => { setShowAdd(false); setNewName(""); }}
              className="text-xs text-gray-500 px-3 py-1.5 rounded hover:bg-gray-100"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Field list */}
      {fields.length === 0 ? (
        <div className="text-center py-12 bg-white border rounded-lg">
          <p className="text-xs text-gray-500">No custom fields defined yet.</p>
          <p className="text-xs text-gray-400 mt-1">Click &quot;Add Field&quot; to create your first custom field.</p>
        </div>
      ) : (
        <div className="bg-white border rounded-lg divide-y">
          {fields.map((field) => (
            <div key={field.id} className="flex items-center justify-between px-4 py-3">
              <div className="flex items-center gap-3">
                <span className="w-8 h-8 rounded bg-gray-100 flex items-center justify-center text-xs font-medium text-gray-500">
                  {FIELD_TYPES.find((ft) => ft.value === field.fieldType)?.label?.charAt(0) ?? "?"}
                </span>
                <div>
                  <p className="text-xs font-medium">{field.name}</p>
                  <p className="text-[10px] text-gray-400 capitalize">{field.fieldType}</p>
                </div>
              </div>
              <button
                onClick={() => handleDelete(field.id)}
                className="text-xs text-red-500 hover:text-red-700 px-2 py-1"
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

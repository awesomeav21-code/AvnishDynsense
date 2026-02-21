"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";

interface AuditEntry {
  id: string;
  action: string;
  entityType: string;
  entityId: string;
  userId: string;
  createdAt: string;
}

export default function AuditLogPage() {
  const [entries, setEntries] = useState<AuditEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [filterType, setFilterType] = useState<string>("all");

  useEffect(() => {
    api.getAuditLog({ limit: 100 })
      .then((res) => setEntries(res.data))
      .catch(() => setError("Failed to load audit log"))
      .finally(() => setLoading(false));
  }, []);

  const entityTypes = ["all", ...new Set(entries.map((e) => e.entityType))];
  const filtered = filterType === "all" ? entries : entries.filter((e) => e.entityType === filterType);

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="h-8 w-48 bg-gray-200 rounded animate-pulse" />
        {[1, 2, 3, 4, 5].map((i) => (
          <div key={i} className="h-10 bg-white rounded border animate-pulse" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Audit Log</h1>

      {error && (
        <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded px-4 py-3">{error}</div>
      )}

      {/* Filter tabs */}
      {entityTypes.length > 1 && (
        <div className="flex gap-2 flex-wrap">
          {entityTypes.map((t) => (
            <button
              key={t}
              onClick={() => setFilterType(t)}
              className={`px-3 py-1 text-xs rounded-full transition-colors ${
                filterType === t
                  ? "bg-ai text-white"
                  : "bg-gray-100 text-gray-600 hover:bg-gray-200"
              }`}
            >
              {t === "all" ? "All" : t}
            </button>
          ))}
        </div>
      )}

      {/* Log entries */}
      {filtered.length === 0 ? (
        <div className="text-sm text-gray-500 bg-white rounded-lg border p-6 text-center">
          No audit log entries found.
        </div>
      ) : (
        <div className="bg-white rounded-lg border divide-y">
          {filtered.map((entry) => (
            <div key={entry.id} className="flex items-center gap-4 px-4 py-3">
              <div className="flex-shrink-0 w-2 h-2 rounded-full bg-ai" />
              <div className="flex-1 min-w-0">
                <div className="text-xs">
                  <span className="font-medium text-gray-900">{entry.action}</span>
                  <span className="text-gray-500"> on </span>
                  <span className="font-medium text-gray-700">{entry.entityType}</span>
                  <span className="text-gray-400 ml-1 font-mono text-[10px]">{entry.entityId.slice(0, 8)}...</span>
                </div>
              </div>
              <span className="text-xs text-gray-400 whitespace-nowrap">
                {new Date(entry.createdAt).toLocaleString()}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

"use client";

import { useEffect, useState, useCallback } from "react";
import { api, ApiError } from "@/lib/api";

interface AuditEntry {
  id: string;
  action: string;
  entityType: string;
  entityId: string;
  actorId: string | null;
  actorType: string;
  actorName: string | null;
  entityName: string | null;
  createdAt: string;
}

const PAGE_SIZE = 50;
const ENTITY_TYPES = ["all", "task", "project", "user", "phase"];

export default function AuditLogPage() {
  const [entries, setEntries] = useState<AuditEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [filterType, setFilterType] = useState<string>("all");
  const [search, setSearch] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(true);

  const loadEntries = useCallback(async (offset: number, append: boolean) => {
    if (!append) setLoading(true);
    try {
      const res = await api.getAuditLog({
        limit: PAGE_SIZE,
        offset,
        entityType: filterType !== "all" ? filterType : undefined,
        search: search.trim() || undefined,
        startDate: startDate || undefined,
        endDate: endDate || undefined,
      });
      const mapped = res.data.map((d) => ({ ...d, actorName: (d as unknown as AuditEntry).actorName ?? null, entityName: (d as unknown as AuditEntry).entityName ?? null }));
      if (append) {
        setEntries((prev) => [...prev, ...mapped]);
      } else {
        setEntries(mapped);
      }
      setHasMore(res.data.length === PAGE_SIZE);
    } catch (err) {
      if (err instanceof ApiError && err.status === 403) {
        setError("You don't have permission to view the audit log. Only Admins and PMs can access this page.");
      } else {
        setError("Failed to load audit log");
      }
    } finally {
      setLoading(false);
    }
  }, [filterType, search, startDate, endDate]);

  useEffect(() => {
    setPage(0);
    loadEntries(0, false);
  }, [loadEntries]);

  function handleLoadMore() {
    const nextPage = page + 1;
    setPage(nextPage);
    loadEntries(nextPage * PAGE_SIZE, true);
  }

  const entityTypes = ENTITY_TYPES;

  // Client-side search filter (in addition to server-side)
  const displayed = search.trim()
    ? entries.filter((e) =>
        e.action.toLowerCase().includes(search.toLowerCase()) ||
        e.entityType.toLowerCase().includes(search.toLowerCase()) ||
        e.entityId.toLowerCase().includes(search.toLowerCase())
      )
    : entries;

  function handleExport() {
    const csv = [
      "Action,Entity Type,Entity ID,Actor ID,Actor Type,Timestamp",
      ...entries.map((e) =>
        `"${e.action}","${e.entityType}","${e.entityId}","${e.actorId ?? ""}","${e.actorType}","${e.createdAt}"`
      ),
    ].join("\n");

    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `audit-log-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  if (loading && entries.length === 0) {
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
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Audit Log</h1>
        <button
          onClick={handleExport}
          disabled={entries.length === 0}
          className="px-3 py-1.5 text-xs font-medium text-gray-600 border rounded-md hover:bg-gray-50 disabled:opacity-50"
        >
          Export CSV
        </button>
      </div>

      {error && (
        <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded px-4 py-3">
          {error}
          <button onClick={() => setError("")} className="ml-2 text-red-400 hover:text-red-600">&times;</button>
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-wrap gap-3 items-end">
        {/* Search */}
        <div>
          <label className="text-[10px] text-gray-500 block mb-0.5">Search</label>
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search actions, entities..."
            className="text-xs border rounded px-3 py-1.5 w-48 focus:outline-none focus:ring-1 focus:ring-ai/50"
          />
        </div>

        {/* Date range */}
        <div>
          <label className="text-[10px] text-gray-500 block mb-0.5">From</label>
          <input
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            className="text-xs border rounded px-3 py-1.5 focus:outline-none focus:ring-1 focus:ring-ai/50"
          />
        </div>
        <div>
          <label className="text-[10px] text-gray-500 block mb-0.5">To</label>
          <input
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            className="text-xs border rounded px-3 py-1.5 focus:outline-none focus:ring-1 focus:ring-ai/50"
          />
        </div>

        {/* Clear filters */}
        {(search || startDate || endDate || filterType !== "all") && (
          <button
            onClick={() => { setSearch(""); setStartDate(""); setEndDate(""); setFilterType("all"); }}
            className="text-xs text-gray-500 hover:text-gray-700 px-2 py-1.5"
          >
            Clear filters
          </button>
        )}
      </div>

      {/* Entity type tabs */}
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

      {/* Results count */}
      <div className="text-xs text-gray-400">
        Showing {displayed.length} entries{hasMore ? "+" : ""}
      </div>

      {/* Log entries */}
      {displayed.length === 0 ? (
        <div className="text-sm text-gray-500 bg-white rounded-lg border p-6 text-center">
          No audit log entries found matching your criteria.
        </div>
      ) : (
        <div className="bg-white rounded-lg border divide-y">
          {displayed.map((entry) => (
            <div key={entry.id} className="flex items-center gap-4 px-4 py-3">
              <div className="flex-shrink-0 w-2 h-2 rounded-full bg-ai" />
              <div className="flex-1 min-w-0">
                <div className="text-xs">
                  <span className="font-medium text-gray-700 capitalize">{entry.entityType}</span>
                  {entry.entityName ? (
                    <span className="text-gray-600"> &ldquo;{entry.entityName}&rdquo;</span>
                  ) : (
                    <span className="text-gray-400 font-mono text-[10px] ml-1">{entry.entityId?.slice(0, 8) ?? "—"}</span>
                  )}
                  <span className="text-gray-500"> {entry.action.replace(/_/g, " ")}</span>
                  <span className="text-gray-500"> by </span>
                  <span className="font-medium text-gray-900">{entry.actorName ?? (entry.actorType === "ai" ? "AI" : entry.actorId ? "Unknown user" : "System")}</span>
                </div>
              </div>
              <span className="text-xs text-gray-400 whitespace-nowrap">
                {new Date(entry.createdAt).toLocaleString()}
              </span>
            </div>
          ))}
        </div>
      )}

      {/* Load more */}
      {hasMore && (
        <div className="text-center">
          <button
            onClick={handleLoadMore}
            className="px-4 py-2 text-xs font-medium text-ai bg-ai/10 rounded-md hover:bg-ai/20 transition-colors"
          >
            Load more
          </button>
        </div>
      )}
    </div>
  );
}

"use client";

import { useEffect, useState, useCallback } from "react";
import { api } from "@/lib/api";

interface AiSession {
  id: string;
  capability: string;
  turnCount: number;
  status: string;
  parentSessionId: string | null;
  createdAt: string;
  updatedAt: string;
  expiresAt: string;
}

interface SessionAction {
  id: string;
  capability: string;
  status: string;
  input: unknown;
  output: unknown;
  confidence: number | null;
  createdAt: string;
  hooks: Array<{
    hookName: string;
    phase: string;
    decision: string;
    reason: string | null;
    createdAt: string;
  }>;
}

const statusBadge: Record<string, string> = {
  active: "bg-green-100 text-green-700",
  completed: "bg-gray-100 text-gray-600",
  terminated: "bg-red-100 text-red-700",
  expired: "bg-yellow-100 text-yellow-700",
};

const actionStatusBadge: Record<string, string> = {
  completed: "bg-green-100 text-green-700",
  approved: "bg-blue-100 text-blue-700",
  rejected: "bg-red-100 text-red-700",
  pending_review: "bg-yellow-100 text-yellow-700",
  blocked_budget: "bg-orange-100 text-orange-700",
};

export default function AiSessionsPage() {
  const [sessions, setSessions] = useState<AiSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [detail, setDetail] = useState<{ actions: SessionAction[] } | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [terminatingId, setTerminatingId] = useState<string | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    api.getAiSessions()
      .then((res) => setSessions(res.data))
      .catch(() => setError("Failed to load sessions"))
      .finally(() => setLoading(false));
  }, []);

  const toggleExpand = useCallback(async (id: string) => {
    if (expandedId === id) {
      setExpandedId(null);
      setDetail(null);
      return;
    }
    setExpandedId(id);
    setDetail(null);
    setDetailLoading(true);
    try {
      const res = await api.getAiSessionDetail(id);
      setDetail({ actions: res.data.actions });
    } catch {
      setError("Failed to load session detail");
    } finally {
      setDetailLoading(false);
    }
  }, [expandedId]);

  const handleTerminate = useCallback(async (id: string) => {
    setTerminatingId(id);
    try {
      await api.terminateAiSession(id);
      setSessions((prev) => prev.map((s) => s.id === id ? { ...s, status: "terminated" } : s));
    } catch {
      setError("Failed to terminate session");
    } finally {
      setTerminatingId(null);
    }
  }, []);

  if (loading) {
    return (
      <div className="space-y-4">
        <h1 className="text-lg font-bold">AI Sessions</h1>
        <div className="animate-pulse space-y-2">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-14 bg-gray-200 rounded-lg" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-lg font-bold">AI Sessions</h1>
        <p className="text-xs text-gray-500 mt-1">View and manage active AI conversation sessions. Click a session to see its actions.</p>
      </div>

      {error && (
        <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded px-4 py-3">
          {error}
          <button onClick={() => setError("")} className="ml-2 text-red-400 hover:text-red-600">&times;</button>
        </div>
      )}

      {sessions.length === 0 ? (
        <p className="text-xs text-gray-500">No AI sessions yet. Sessions are created when you use AI capabilities.</p>
      ) : (
        <div className="bg-white rounded-lg border divide-y">
          {sessions.map((session) => {
            const isExpired = new Date(session.expiresAt) < new Date();
            const isExpanded = expandedId === session.id;
            const effectiveStatus = isExpired && session.status === "active" ? "expired" : session.status;

            return (
              <div key={session.id}>
                {/* Session row */}
                <button
                  onClick={() => toggleExpand(session.id)}
                  className={`w-full px-4 py-3 flex items-center justify-between text-left transition-colors ${
                    isExpanded ? "bg-gray-50" : "hover:bg-gray-50"
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <svg
                      className={`w-3 h-3 text-gray-400 transition-transform ${isExpanded ? "rotate-90" : ""}`}
                      fill="none" stroke="currentColor" viewBox="0 0 24 24"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                    <span className={`inline-block w-2 h-2 rounded-full ${
                      effectiveStatus === "active" ? "bg-green-500" :
                      effectiveStatus === "terminated" ? "bg-red-400" :
                      effectiveStatus === "expired" ? "bg-yellow-400" : "bg-gray-300"
                    }`} />
                    <div>
                      <div className="text-xs font-medium">{session.capability.replace(/_/g, " ")}</div>
                      <div className="text-xs text-gray-400">
                        {session.turnCount} turn{session.turnCount !== 1 ? "s" : ""}
                        {session.parentSessionId && " (forked)"}
                        {" \u00B7 "}
                        <span className={`px-1.5 py-0.5 rounded-full text-[10px] ${statusBadge[effectiveStatus] ?? "bg-gray-100 text-gray-600"}`}>
                          {effectiveStatus}
                        </span>
                      </div>
                    </div>
                  </div>
                  <div className="text-right flex items-center gap-3">
                    <div>
                      <div className="text-xs text-gray-500">{new Date(session.createdAt).toLocaleDateString()}</div>
                      <div className={`text-xs ${isExpired ? "text-red-400" : "text-gray-400"}`}>
                        {isExpired ? "Expired" : `Expires ${new Date(session.expiresAt).toLocaleDateString()}`}
                      </div>
                    </div>
                    {session.status === "active" && !isExpired && (
                      <button
                        onClick={(e) => { e.stopPropagation(); handleTerminate(session.id); }}
                        disabled={terminatingId === session.id}
                        className="text-[10px] px-2 py-1 text-red-600 bg-red-50 border border-red-200 rounded hover:bg-red-100 disabled:opacity-50 transition-colors"
                      >
                        {terminatingId === session.id ? "..." : "Terminate"}
                      </button>
                    )}
                  </div>
                </button>

                {/* Expanded detail */}
                {isExpanded && (
                  <div className="px-4 pb-4 bg-gray-50 border-t border-dashed">
                    {detailLoading ? (
                      <div className="py-4 space-y-2 animate-pulse">
                        <div className="h-8 bg-gray-200 rounded" />
                        <div className="h-8 bg-gray-200 rounded" />
                      </div>
                    ) : detail && detail.actions.length > 0 ? (
                      <div className="pt-3 space-y-3">
                        <h4 className="text-xs font-semibold text-gray-600">Actions ({detail.actions.length})</h4>
                        {detail.actions.map((action) => (
                          <div key={action.id} className="bg-white rounded border p-3 space-y-2">
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-2">
                                <span className="text-xs font-medium">{action.capability.replace(/_/g, " ")}</span>
                                <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${actionStatusBadge[action.status] ?? "bg-gray-100 text-gray-600"}`}>
                                  {action.status.replace("_", " ")}
                                </span>
                              </div>
                              <div className="flex items-center gap-2">
                                {action.confidence !== null && (
                                  <span className={`text-[10px] font-medium ${
                                    action.confidence >= 0.8 ? "text-green-600" :
                                    action.confidence >= 0.5 ? "text-yellow-600" : "text-red-600"
                                  }`}>
                                    {(action.confidence * 100).toFixed(0)}% confidence
                                  </span>
                                )}
                                <span className="text-[10px] text-gray-400">
                                  {new Date(action.createdAt).toLocaleTimeString()}
                                </span>
                              </div>
                            </div>

                            {/* Input preview */}
                            {action.input != null && (
                              <div>
                                <span className="text-[10px] font-medium text-gray-500">Input:</span>
                                <pre className="text-[10px] bg-gray-50 rounded p-2 mt-0.5 overflow-x-auto max-h-20 text-gray-600">
                                  {typeof action.input === "string" ? action.input : JSON.stringify(action.input as Record<string, unknown>, null, 2)}
                                </pre>
                              </div>
                            )}

                            {/* Output preview */}
                            {action.output != null && (
                              <div>
                                <span className="text-[10px] font-medium text-gray-500">Output:</span>
                                <pre className="text-[10px] bg-gray-50 rounded p-2 mt-0.5 overflow-x-auto max-h-32 text-gray-600">
                                  {typeof action.output === "string" ? action.output : JSON.stringify(action.output as Record<string, unknown>, null, 2)}
                                </pre>
                              </div>
                            )}

                            {/* Hooks */}
                            {action.hooks.length > 0 && (
                              <div>
                                <span className="text-[10px] font-medium text-gray-500">Hooks ({action.hooks.length}):</span>
                                <div className="mt-0.5 space-y-0.5">
                                  {action.hooks.map((hook, i) => (
                                    <div key={i} className="flex items-center gap-2 text-[10px]">
                                      <span className={`w-1.5 h-1.5 rounded-full ${
                                        hook.decision === "allow" ? "bg-green-500" :
                                        hook.decision === "block" ? "bg-red-500" : "bg-yellow-500"
                                      }`} />
                                      <span className="text-gray-600">{hook.hookName}</span>
                                      <span className="text-gray-400">{hook.phase}</span>
                                      <span className={`font-medium ${
                                        hook.decision === "allow" ? "text-green-600" :
                                        hook.decision === "block" ? "text-red-600" : "text-yellow-600"
                                      }`}>
                                        {hook.decision}
                                      </span>
                                      {hook.reason && (
                                        <span className="text-gray-400 truncate">&mdash; {hook.reason}</span>
                                      )}
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-xs text-gray-400 py-4">No actions recorded for this session.</p>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

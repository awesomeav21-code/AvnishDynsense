"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { api } from "@/lib/api";

interface AiAction {
  id: string;
  capability: string;
  status: string;
  disposition: string;
  output: unknown;
  confidence: string | null;
  input: unknown;
  createdAt: string;
  updatedAt: string;
}

const statusColors: Record<string, string> = {
  pending: "bg-gray-100 text-gray-600",
  running: "bg-blue-100 text-blue-700",
  proposed: "bg-yellow-100 text-yellow-700",
  approved: "bg-green-100 text-green-700",
  rejected: "bg-red-100 text-red-700",
  executed: "bg-purple-100 text-purple-700",
  failed: "bg-red-200 text-red-800",
  rolled_back: "bg-orange-100 text-orange-700",
};

const capabilityLabels: Record<string, string> = {
  wbs_generator: "WBS Generator",
  whats_next: "What's Next",
  nl_query: "NL Query",
  summary_writer: "Summary Writer",
  risk_predictor: "Risk Predictor",
  ai_pm_agent: "AI PM Agent",
  scope_detector: "Scope Detector",
  writing_assistant: "Writing Assistant",
  sow_generator: "SOW Generator",
  learning_agent: "Learning Agent",
};

export default function AiReviewPage() {
  const [actions, setActions] = useState<AiAction[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [filterStatus, setFilterStatus] = useState("all");
  const [triggerCap, setTriggerCap] = useState("wbs_generator");
  const [triggering, setTriggering] = useState(false);

  useEffect(() => {
    loadActions();
  }, []);

  async function loadActions() {
    try {
      const res = await api.getAiActions({ limit: 50 });
      setActions(res.data);
    } catch {
      setError("Failed to load AI actions");
    } finally {
      setLoading(false);
    }
  }

  async function handleTrigger() {
    setTriggering(true);
    try {
      const res = await api.executeAi(triggerCap, { source: "manual_trigger" });
      setActions((prev) => [res.data as AiAction, ...prev]);
    } catch {
      setError("Failed to trigger AI action");
    } finally {
      setTriggering(false);
    }
  }

  async function handleQuickReview(id: string, action: "approve" | "reject") {
    try {
      await api.reviewAiAction(id, action);
      setActions((prev) =>
        prev.map((a) => a.id === id ? { ...a, status: action === "approve" ? "approved" : "rejected" } : a)
      );
    } catch {
      setError("Failed to review action");
    }
  }

  const filtered = filterStatus === "all" ? actions : actions.filter((a) => a.status === filterStatus);
  const pendingCount = actions.filter((a) => a.status === "proposed").length;

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="h-8 w-48 bg-gray-200 rounded animate-pulse" />
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-20 bg-white rounded-lg border animate-pulse" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">AI Review</h1>
          {pendingCount > 0 && (
            <p className="text-xs text-yellow-600 mt-1">{pendingCount} action(s) pending review</p>
          )}
        </div>

        {/* Trigger new AI action */}
        <div className="flex items-center gap-2">
          <select
            value={triggerCap}
            onChange={(e) => setTriggerCap(e.target.value)}
            className="text-xs border rounded-md px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-ai/50"
          >
            {Object.entries(capabilityLabels).slice(0, 4).map(([value, label]) => (
              <option key={value} value={value}>{label}</option>
            ))}
          </select>
          <button
            onClick={handleTrigger}
            disabled={triggering}
            className="px-3 py-1.5 text-xs font-medium text-white bg-ai rounded-md disabled:opacity-50 hover:bg-ai/90"
          >
            {triggering ? "Running..." : "Run AI"}
          </button>
        </div>
      </div>

      {error && (
        <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded px-4 py-3">{error}</div>
      )}

      {/* Filter tabs */}
      <div className="flex gap-2 flex-wrap">
        {["all", "proposed", "approved", "rejected", "running", "executed"].map((s) => (
          <button
            key={s}
            onClick={() => setFilterStatus(s)}
            className={`px-3 py-1 text-xs rounded-full transition-colors ${
              filterStatus === s ? "bg-ai text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"
            }`}
          >
            {s === "all" ? "All" : s.replace("_", " ")} ({s === "all" ? actions.length : actions.filter((a) => a.status === s).length})
          </button>
        ))}
      </div>

      {/* Actions list */}
      {filtered.length === 0 ? (
        <div className="text-sm text-gray-500 bg-white rounded-lg border p-6 text-center">
          {actions.length === 0 ? "No AI actions yet. Trigger one above." : "No actions match this filter."}
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((action) => (
            <div key={action.id} className="bg-white rounded-lg border p-4">
              <div className="flex items-start justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium">{capabilityLabels[action.capability] ?? action.capability}</span>
                    <span className={`text-xs px-2 py-0.5 rounded-full ${statusColors[action.status] ?? ""}`}>
                      {action.status.replace("_", " ")}
                    </span>
                    {action.confidence && (
                      <span className="text-xs text-gray-500">
                        Confidence: {(parseFloat(action.confidence) * 100).toFixed(0)}%
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-gray-400 mt-1">
                    {new Date(action.createdAt).toLocaleString()}
                  </p>
                </div>

                {action.status === "proposed" && (
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleQuickReview(action.id, "approve")}
                      className="px-3 py-1 text-xs font-medium text-green-700 bg-green-100 rounded-md hover:bg-green-200"
                    >
                      Approve
                    </button>
                    <button
                      onClick={() => handleQuickReview(action.id, "reject")}
                      className="px-3 py-1 text-xs font-medium text-red-700 bg-red-100 rounded-md hover:bg-red-200"
                    >
                      Reject
                    </button>
                    <Link
                      href={`/ai-review/${action.id}`}
                      className="px-3 py-1 text-xs font-medium text-ai bg-ai/10 rounded-md hover:bg-ai/20"
                    >
                      Review
                    </Link>
                  </div>
                )}
              </div>

              {/* Output preview */}
              {action.output != null && (
                <div className="mt-3 p-3 bg-gray-50 rounded-md">
                  <pre className="text-xs text-gray-700 whitespace-pre-wrap overflow-hidden max-h-32">
                    {String(JSON.stringify(action.output, null, 2))}
                  </pre>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

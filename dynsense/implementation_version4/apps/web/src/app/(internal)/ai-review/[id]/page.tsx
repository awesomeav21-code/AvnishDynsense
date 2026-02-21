"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
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
  reviewedBy: string | null;
}

const capabilityLabels: Record<string, string> = {
  wbs_generator: "WBS Generator",
  whats_next: "What's Next",
  nl_query: "NL Query",
  summary_writer: "Summary Writer",
  risk_predictor: "Risk Predictor",
  ai_pm_agent: "AI PM Agent",
};

export default function AiActionDetailPage() {
  const params = useParams();
  const router = useRouter();
  const actionId = params.id as string;

  const [action, setAction] = useState<AiAction | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [editedOutput, setEditedOutput] = useState("");
  const [reviewing, setReviewing] = useState(false);

  useEffect(() => {
    api.getAiAction(actionId)
      .then((res) => {
        setAction(res.data as AiAction);
        setEditedOutput(JSON.stringify(res.data.output, null, 2));
      })
      .catch(() => setError("Failed to load AI action"))
      .finally(() => setLoading(false));
  }, [actionId]);

  async function handleReview(reviewAction: "approve" | "reject" | "edit") {
    setReviewing(true);
    try {
      let parsedOutput: Record<string, unknown> | undefined;
      if (reviewAction === "edit") {
        parsedOutput = JSON.parse(editedOutput);
      }
      await api.reviewAiAction(actionId, reviewAction, parsedOutput);
      router.push("/ai-review");
    } catch (e) {
      setError(e instanceof SyntaxError ? "Invalid JSON in edited output" : "Failed to review action");
    } finally {
      setReviewing(false);
    }
  }

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="h-8 w-64 bg-gray-200 rounded animate-pulse" />
        <div className="h-64 bg-white rounded-lg border animate-pulse" />
      </div>
    );
  }

  if (error || !action) {
    return (
      <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded px-4 py-3">
        {error || "Action not found"}
      </div>
    );
  }

  const isPending = action.status === "proposed";

  return (
    <div className="space-y-6">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-xs text-gray-500">
        <Link href="/ai-review" className="hover:text-gray-700">AI Review</Link>
        <span>/</span>
        <span className="text-gray-900">{capabilityLabels[action.capability] ?? action.capability}</span>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main content */}
        <div className="lg:col-span-2 space-y-6">
          {/* Input */}
          <div className="bg-white rounded-lg border p-6">
            <h2 className="text-sm font-semibold mb-3">Input</h2>
            <pre className="text-xs text-gray-700 bg-gray-50 rounded-md p-3 whitespace-pre-wrap overflow-auto max-h-40">
              {JSON.stringify(action.input, null, 2)}
            </pre>
          </div>

          {/* Output (editable if proposed) */}
          <div className="bg-white rounded-lg border p-6">
            <h2 className="text-sm font-semibold mb-3">
              Output {isPending && <span className="text-gray-400 font-normal">(editable)</span>}
            </h2>
            {isPending ? (
              <textarea
                value={editedOutput}
                onChange={(e) => setEditedOutput(e.target.value)}
                rows={16}
                className="w-full px-3 py-2 text-xs font-mono border rounded-md focus:outline-none focus:ring-1 focus:ring-ai/50 resize-y"
              />
            ) : (
              <pre className="text-xs text-gray-700 bg-gray-50 rounded-md p-3 whitespace-pre-wrap overflow-auto max-h-96">
                {JSON.stringify(action.output, null, 2)}
              </pre>
            )}
          </div>

          {/* Review buttons */}
          {isPending && (
            <div className="flex gap-3">
              <button
                onClick={() => handleReview("approve")}
                disabled={reviewing}
                className="px-4 py-2 text-xs font-medium text-white bg-green-600 rounded-md disabled:opacity-50 hover:bg-green-700"
              >
                Approve as-is
              </button>
              <button
                onClick={() => handleReview("edit")}
                disabled={reviewing}
                className="px-4 py-2 text-xs font-medium text-white bg-ai rounded-md disabled:opacity-50 hover:bg-ai/90"
              >
                Approve with edits
              </button>
              <button
                onClick={() => handleReview("reject")}
                disabled={reviewing}
                className="px-4 py-2 text-xs font-medium text-white bg-red-600 rounded-md disabled:opacity-50 hover:bg-red-700"
              >
                Reject
              </button>
            </div>
          )}
        </div>

        {/* Sidebar */}
        <div className="space-y-4">
          <div className="bg-white rounded-lg border p-4 space-y-4">
            <div>
              <label className="text-xs text-gray-500 block mb-1">Capability</label>
              <span className="text-xs font-medium">{capabilityLabels[action.capability] ?? action.capability}</span>
            </div>
            <div>
              <label className="text-xs text-gray-500 block mb-1">Status</label>
              <span className={`text-xs px-2 py-0.5 rounded-full ${
                action.status === "proposed" ? "bg-yellow-100 text-yellow-700" :
                action.status === "approved" ? "bg-green-100 text-green-700" :
                action.status === "rejected" ? "bg-red-100 text-red-700" :
                "bg-gray-100 text-gray-600"
              }`}>
                {action.status}
              </span>
            </div>
            <div>
              <label className="text-xs text-gray-500 block mb-1">Disposition</label>
              <span className="text-xs">{action.disposition}</span>
            </div>
            {action.confidence && (
              <div>
                <label className="text-xs text-gray-500 block mb-1">Confidence</label>
                <div className="flex items-center gap-2">
                  <div className="flex-1 bg-gray-200 rounded-full h-1.5">
                    <div
                      className="bg-ai h-1.5 rounded-full"
                      style={{ width: `${parseFloat(action.confidence) * 100}%` }}
                    />
                  </div>
                  <span className="text-xs font-medium">{(parseFloat(action.confidence) * 100).toFixed(0)}%</span>
                </div>
              </div>
            )}
            <div>
              <label className="text-xs text-gray-500 block mb-1">Created</label>
              <span className="text-xs">{new Date(action.createdAt).toLocaleString()}</span>
            </div>
            <div>
              <label className="text-xs text-gray-500 block mb-1">Updated</label>
              <span className="text-xs">{new Date(action.updatedAt).toLocaleString()}</span>
            </div>
            {action.reviewedBy && (
              <div>
                <label className="text-xs text-gray-500 block mb-1">Reviewed by</label>
                <span className="text-xs font-mono">{action.reviewedBy.slice(0, 8)}...</span>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

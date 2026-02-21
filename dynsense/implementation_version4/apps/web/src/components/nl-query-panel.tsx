"use client";

import { useState, useEffect, useRef } from "react";
import { api } from "@/lib/api";

interface NlQueryPanelProps {
  isOpen: boolean;
  onClose: () => void;
}

interface QueryResult {
  query: string;
  answer: string;
  sources: string[];
  confidence?: number;
}

export function NlQueryPanel({ isOpen, onClose }: NlQueryPanelProps) {
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<QueryResult | null>(null);
  const [error, setError] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 100);
    } else {
      setQuery("");
      setResult(null);
      setError("");
    }
  }, [isOpen]);

  // Close on Escape
  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape" && isOpen) onClose();
    }
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [isOpen, onClose]);

  async function handleSubmit() {
    if (!query.trim() || loading) return;
    setLoading(true);
    setError("");
    setResult(null);

    try {
      const res = await api.executeAi("nl_query", { query: query.trim() });
      const output = res.data.output as Record<string, unknown>;
      setResult({
        query: String(output.query ?? query),
        answer: String(output.answer ?? "No answer available"),
        sources: (output.sources as string[]) ?? [],
        confidence: res.data.confidence ? parseFloat(res.data.confidence) : undefined,
      });
    } catch {
      setError("Failed to process query");
    } finally {
      setLoading(false);
    }
  }

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-[15vh]">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />

      {/* Panel */}
      <div className="relative w-full max-w-xl bg-white rounded-xl shadow-2xl border overflow-hidden">
        {/* Search input */}
        <div className="flex items-center gap-3 px-4 py-3 border-b">
          <svg className="w-4 h-4 text-gray-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
            placeholder="Ask anything about your projects..."
            className="flex-1 text-sm bg-transparent border-none outline-none placeholder-gray-400"
          />
          {loading && (
            <div className="w-4 h-4 border-2 border-ai/30 border-t-ai rounded-full animate-spin" />
          )}
          <kbd className="hidden sm:inline-block text-xs text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded">
            Esc
          </kbd>
        </div>

        {/* Results */}
        {(result || error) && (
          <div className="px-4 py-4 max-h-[50vh] overflow-auto">
            {error && (
              <div className="text-xs text-red-600 bg-red-50 rounded-md px-3 py-2">{error}</div>
            )}
            {result && (
              <div className="space-y-3">
                <div className="text-sm text-gray-800 leading-relaxed whitespace-pre-wrap">
                  {result.answer}
                </div>
                {result.confidence !== undefined && (
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-gray-400">Confidence:</span>
                    <div className="w-20 bg-gray-200 rounded-full h-1">
                      <div
                        className="bg-ai h-1 rounded-full"
                        style={{ width: `${result.confidence * 100}%` }}
                      />
                    </div>
                    <span className="text-xs text-gray-500">{(result.confidence * 100).toFixed(0)}%</span>
                  </div>
                )}
                {result.sources.length > 0 && (
                  <div className="text-xs text-gray-400">
                    Sources: {result.sources.join(", ")}
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* Hint */}
        {!result && !error && !loading && (
          <div className="px-4 py-3 text-xs text-gray-400">
            <p>Try: "How many tasks are overdue?" or "Summarize project progress"</p>
          </div>
        )}
      </div>
    </div>
  );
}

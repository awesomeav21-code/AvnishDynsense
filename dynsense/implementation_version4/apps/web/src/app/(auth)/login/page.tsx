"use client";

import { useState, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { api, ApiError } from "@/lib/api";

interface Workspace {
  tenantId: string;
  tenantName: string;
  tenantSlug: string;
  userId: string;
  role: string;
}

export default function LoginPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const registered = searchParams.get("registered") === "true";
  const registeredUid = searchParams.get("uid");

  const [uid, setUid] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);

  // Workspace picker state
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [picking, setPicking] = useState(false);
  const [selectingId, setSelectingId] = useState<string | null>(null);

  function handleError(err: unknown) {
    if (err instanceof ApiError) {
      setError(err.message);
    } else if (err instanceof TypeError && err.message.includes("fetch")) {
      setError("Cannot reach API server. Is it running on localhost:3001?");
    } else {
      setError(err instanceof Error ? err.message : "An unexpected error occurred");
    }
  }

  async function handleSubmit() {
    if (!uid || !email || !password) return;
    setError("");
    setLoading(true);

    try {
      const res = await api.loginIdentify(uid, email, password);

      if (!res.requiresWorkspaceSelection && res.accessToken && res.refreshToken) {
        api.setTokens(res.accessToken, res.refreshToken);
        router.push("/dashboard");
      } else if (res.workspaces && res.workspaces.length > 0) {
        setWorkspaces(res.workspaces);
        setPicking(true);
      }
    } catch (err) {
      handleError(err);
    } finally {
      setLoading(false);
    }
  }

  async function handleSelectWorkspace(tenantId: string) {
    setError("");
    setSelectingId(tenantId);

    try {
      const res = await api.loginSelect(uid, email, password, tenantId);
      api.setTokens(res.accessToken, res.refreshToken);
      router.push("/dashboard");
    } catch (err) {
      handleError(err);
      setSelectingId(null);
    }
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter") {
      e.preventDefault();
      handleSubmit();
    }
  }

  // Workspace picker view
  if (picking) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-gray-50">
        <div className="w-full max-w-sm space-y-6 p-8 bg-white rounded-lg shadow-sm border">
          <div className="text-center">
            <h1 className="text-2xl font-bold">Select a workspace</h1>
            <p className="text-sm text-gray-500 mt-1">You belong to multiple workspaces</p>
          </div>

          {error && (
            <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded px-3 py-2">
              {error}
            </div>
          )}

          <div className="space-y-2">
            {workspaces.map((ws) => (
              <button
                key={ws.tenantId}
                onClick={() => handleSelectWorkspace(ws.tenantId)}
                disabled={selectingId !== null}
                className="w-full text-left bg-white rounded-lg border p-3 hover:border-ai/50 hover:shadow-sm transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-gray-900">{ws.tenantName}</span>
                  <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-600">{ws.role}</span>
                </div>
                {selectingId === ws.tenantId && (
                  <p className="text-xs text-ai mt-1">Signing in...</p>
                )}
              </button>
            ))}
          </div>

          <button
            onClick={() => { setPicking(false); setWorkspaces([]); setError(""); }}
            className="w-full text-center text-xs text-gray-500 hover:text-gray-700 transition-colors"
          >
            Back to login
          </button>
        </div>
      </main>
    );
  }

  // Login form view
  return (
    <main className="flex min-h-screen items-center justify-center bg-gray-50">
      <div className="w-full max-w-sm space-y-6 p-8 bg-white rounded-lg shadow-sm border">
        <div className="text-center">
          <h1 className="text-2xl font-bold">Sign in to Dynsense</h1>
          <p className="text-sm text-gray-500 mt-1">AI-native project management</p>
        </div>

        <div className="space-y-4" onKeyDown={handleKeyDown}>
          {registered && (
            <div className="text-sm text-green-700 bg-green-50 border border-green-200 rounded px-3 py-2">
              Account created successfully.{registeredUid && (
                <> Your UID is <span className="font-mono font-bold">{registeredUid}</span>. Use it to sign in.</>
              )}
            </div>
          )}
          {error && (
            <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded px-3 py-2">
              {error}
            </div>
          )}

          {/* UID field is outside the form so browser autofill ignores it */}
          <div>
            <label htmlFor="uid" className="block text-xs font-medium text-gray-700 mb-1">
              UID
            </label>
            <input
              id="uid"
              type="text"
              autoFocus
              autoComplete="off"
              value={uid}
              onChange={(e) => setUid(e.target.value)}
              className="w-full px-3 py-2 text-sm border rounded-md focus:outline-none focus:ring-2 focus:ring-ai/50 focus:border-ai font-mono"
              placeholder="e.g. DS-ALICE1"
            />
          </div>

          {/* Email + Password inside a form so browser autofills these correctly */}
          <form ref={formRef} autoComplete="on" onSubmit={(e) => { e.preventDefault(); handleSubmit(); }} className="space-y-4">
            <div>
              <label htmlFor="email" className="block text-xs font-medium text-gray-700 mb-1">
                Email
              </label>
              <input
                id="email"
                name="email"
                type="email"
                required
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-3 py-2 text-sm border rounded-md focus:outline-none focus:ring-2 focus:ring-ai/50 focus:border-ai"
                placeholder="you@company.com"
              />
            </div>

            <div>
              <label htmlFor="password" className="block text-xs font-medium text-gray-700 mb-1">
                Password
              </label>
              <input
                id="password"
                name="password"
                type="password"
                required
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-3 py-2 text-sm border rounded-md focus:outline-none focus:ring-2 focus:ring-ai/50 focus:border-ai"
                placeholder="Enter your password"
              />
            </div>

            <button
              type="submit"
              disabled={loading || !uid}
              className="w-full py-2 px-4 text-sm font-medium text-white bg-ai hover:bg-ai-dark rounded-md disabled:opacity-50 transition-colors"
            >
              {loading ? "Signing in..." : "Sign in"}
            </button>
          </form>
        </div>

        <p className="text-center text-xs text-gray-500">
          Don&apos;t have an account?{" "}
          <a href="/register" className="text-ai hover:underline">
            Register
          </a>
        </p>
      </div>
    </main>
  );
}

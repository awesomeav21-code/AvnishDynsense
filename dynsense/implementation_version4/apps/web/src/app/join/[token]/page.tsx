"use client";

import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import Link from "next/link";

export default function JoinPage() {
  const { token } = useParams<{ token: string }>();
  const router = useRouter();
  const [status, setStatus] = useState<"loading" | "success" | "error" | "login_required">("loading");
  const [message, setMessage] = useState("");
  const [projectId, setProjectId] = useState<string | null>(null);

  useEffect(() => {
    async function join() {
      // Check if user is logged in
      try {
        await api.getMe();
      } catch {
        setStatus("login_required");
        return;
      }

      try {
        const res = await api.joinViaInvite(token);
        setProjectId(res.data.projectId);
        setMessage(res.data.message);
        setStatus("success");
      } catch (err) {
        setMessage(err instanceof Error ? err.message : "Failed to join project");
        setStatus("error");
      }
    }
    join();
  }, [token]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="bg-white rounded-lg border shadow-sm p-8 max-w-md w-full text-center">
        {status === "loading" && (
          <>
            <div className="w-8 h-8 border-2 border-gray-200 border-t-blue-600 rounded-full animate-spin mx-auto" />
            <p className="text-sm text-gray-500 mt-4">Joining project...</p>
          </>
        )}

        {status === "login_required" && (
          <>
            <h2 className="text-lg font-semibold text-gray-900">Sign in required</h2>
            <p className="text-sm text-gray-500 mt-2">You need to sign in before joining this project.</p>
            <Link
              href={`/login?redirect=/join/${token}`}
              className="mt-4 inline-block px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700"
            >
              Sign in
            </Link>
          </>
        )}

        {status === "success" && (
          <>
            <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center mx-auto">
              <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h2 className="text-lg font-semibold text-gray-900 mt-4">You&apos;re in!</h2>
            <p className="text-sm text-gray-500 mt-2">{message}</p>
            <button
              onClick={() => router.push(projectId ? `/projects/${projectId}` : "/dashboard")}
              className="mt-4 inline-block px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700"
            >
              Go to project
            </button>
          </>
        )}

        {status === "error" && (
          <>
            <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center mx-auto">
              <svg className="w-6 h-6 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </div>
            <h2 className="text-lg font-semibold text-gray-900 mt-4">Could not join</h2>
            <p className="text-sm text-gray-500 mt-2">{message}</p>
            <Link
              href="/dashboard"
              className="mt-4 inline-block px-4 py-2 text-sm font-medium text-gray-700 border rounded-md hover:bg-gray-50"
            >
              Go to dashboard
            </Link>
          </>
        )}
      </div>
    </div>
  );
}

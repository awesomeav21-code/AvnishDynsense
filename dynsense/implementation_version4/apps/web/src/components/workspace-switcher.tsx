"use client";

import { useState, useRef, useEffect } from "react";

interface Workspace {
  tenantId: string;
  tenantName: string;
  tenantSlug: string;
  role: string;
}

interface WorkspaceSwitcherProps {
  currentTenantId: string;
  workspaces: Workspace[];
  onSwitch: (tenantId: string) => Promise<void>;
}

export function WorkspaceSwitcher({ currentTenantId, workspaces, onSwitch }: WorkspaceSwitcherProps) {
  const [open, setOpen] = useState(false);
  const [switching, setSwitching] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const safeWorkspaces = workspaces ?? [];
  const current = safeWorkspaces.find((w) => w.tenantId === currentTenantId);
  const hasMultiple = safeWorkspaces.length > 1;

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  async function handleSwitch(tenantId: string) {
    if (tenantId === currentTenantId) {
      setOpen(false);
      return;
    }
    setSwitching(true);
    try {
      await onSwitch(tenantId);
    } finally {
      setSwitching(false);
    }
  }

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => hasMultiple && setOpen(!open)}
        className={`w-full text-left flex items-center justify-between px-1 py-0.5 rounded transition-colors ${hasMultiple ? "hover:bg-gray-100 cursor-pointer" : "cursor-default"}`}
      >
        <div className="min-w-0">
          <div className="font-bold text-sm text-gray-900 truncate">{current?.tenantName ?? "Workspace"}</div>
          <div className="text-[10px] text-gray-400 capitalize">{current?.role?.replace("_", " ")}</div>
        </div>
        {hasMultiple && (
          <svg
            className={`w-3.5 h-3.5 text-gray-400 flex-shrink-0 ml-1 transition-transform ${open ? "rotate-180" : ""}`}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        )}
      </button>

      {open && (
        <div className="absolute top-full left-0 right-0 mt-1 bg-white border rounded-md shadow-lg z-50 overflow-hidden">
          <div className="py-1">
            {safeWorkspaces.map((w) => (
              <button
                key={w.tenantId}
                onClick={() => handleSwitch(w.tenantId)}
                disabled={switching}
                className={`w-full text-left px-3 py-2 text-xs transition-colors disabled:opacity-50 ${
                  w.tenantId === currentTenantId
                    ? "bg-gray-50 font-medium text-gray-900"
                    : "text-gray-700 hover:bg-gray-50"
                }`}
              >
                <div className="flex items-center gap-2">
                  {w.tenantId === currentTenantId && (
                    <svg className="w-3 h-3 text-ai flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                    </svg>
                  )}
                  <div className={w.tenantId === currentTenantId ? "" : "ml-5"}>
                    <div className="font-medium">{w.tenantName}</div>
                    <div className="text-gray-400 capitalize">{w.role.replace("_", " ")}</div>
                  </div>
                </div>
              </button>
            ))}
          </div>
          <div className="border-t">
            <a
              href="/register"
              className="block px-3 py-2 text-xs text-ai hover:bg-gray-50 transition-colors"
            >
              + Create new workspace
            </a>
          </div>
        </div>
      )}
    </div>
  );
}

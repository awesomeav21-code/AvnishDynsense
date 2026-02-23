"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState, useCallback } from "react";
import { api } from "@/lib/api";
import { NlQueryPanel } from "@/components/nl-query-panel";

const navItems = [
  { label: "Dashboard", href: "/dashboard", icon: "grid" },
  { label: "Projects", href: "/projects", icon: "folder" },
  { label: "My Tasks", href: "/my-tasks", icon: "check-square" },
  { label: "Kanban", href: "/kanban", icon: "kanban" },
  { label: "Calendar", href: "/calendar", icon: "calendar" },
  { label: "Table View", href: "/table-view", icon: "table" },
  { label: "Timeline", href: "/timeline", icon: "calendar" },
  { label: "Dependencies", href: "/dependencies", icon: "plug" },
  { label: "Portfolio", href: "/portfolio", icon: "grid" },
  { label: "AI Review", href: "/ai-review", icon: "ai" },
  { label: "AI Sessions", href: "/ai-sessions", icon: "ai" },
  { label: "Notifications", href: "/notifications", icon: "scroll" },
  { label: "Team", href: "/team", icon: "users" },
  { label: "Integrations", href: "/integrations", icon: "plug" },
  { label: "Settings", href: "/settings", icon: "settings" },
  { label: "Custom Fields", href: "/settings/custom-fields", icon: "settings" },
  { label: "Recurring Tasks", href: "/settings/recurring-tasks", icon: "calendar" },
  { label: "Audit Log", href: "/audit", icon: "scroll" },
];

const iconMap: Record<string, React.ReactNode> = {
  grid: <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zm10 0a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zm10 0a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" /></svg>,
  folder: <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" /></svg>,
  "check-square": <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" /></svg>,
  ai: <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" /></svg>,
  users: <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" /></svg>,
  scroll: <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>,
  kanban: <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17V7m0 10a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2h2a2 2 0 012 2m0 10a2 2 0 002 2h2a2 2 0 002-2M9 7a2 2 0 012-2h2a2 2 0 012 2m0 10V7m0 10a2 2 0 002 2h2a2 2 0 002-2V7a2 2 0 00-2-2h-2a2 2 0 00-2 2" /></svg>,
  calendar: <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>,
  table: <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M3 14h18m-9-4v8m-7 0h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" /></svg>,
  plug: <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" /></svg>,
  settings: <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>,
};

export default function InternalLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [user, setUser] = useState<{ name: string; email: string; role: string } | null>(null);
  const [queryOpen, setQueryOpen] = useState(false);

  useEffect(() => {
    api.getMe().then(setUser).catch(() => {
      router.push("/login");
    });
  }, [router]);

  // Cmd+K / Ctrl+K shortcut
  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setQueryOpen((prev) => !prev);
      }
    }
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, []);

  const closeQuery = useCallback(() => setQueryOpen(false), []);

  async function handleLogout() {
    try { await api.logout(); } catch { /* ignore */ }
    api.clearTokens();
    router.push("/login");
  }

  const isActive = (href: string) => pathname === href || pathname.startsWith(href + "/");

  return (
    <div className="flex min-h-screen">
      <aside className="w-56 border-r bg-white flex flex-col">
        <div className="p-4 border-b">
          <Link href="/dashboard" className="font-bold text-lg text-ai">
            Dynsense
          </Link>
          <p className="text-xs text-gray-400 mt-0.5">Project Management</p>
        </div>

        {/* Search trigger */}
        <button
          onClick={() => setQueryOpen(true)}
          className="mx-3 mt-3 flex items-center gap-2 px-3 py-1.5 text-xs text-gray-400 border border-dashed rounded-md hover:border-gray-300 hover:text-gray-500 transition-colors"
        >
          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          Ask AI...
          <kbd className="ml-auto text-[10px] bg-gray-100 px-1 py-0.5 rounded">{typeof navigator !== "undefined" && /Mac/.test(navigator.userAgent) ? "\u2318" : "Ctrl"}+K</kbd>
        </button>

        <nav className="flex-1 p-3 space-y-0.5">
          {navItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-2.5 px-3 py-1.5 text-xs rounded-md transition-colors ${
                isActive(item.href)
                  ? "bg-ai/10 text-ai font-medium"
                  : "text-gray-600 hover:text-gray-900 hover:bg-gray-100"
              }`}
            >
              {iconMap[item.icon]}
              {item.label}
            </Link>
          ))}
        </nav>

        {user && (
          <div className="p-4 border-t">
            <div className="text-xs font-medium text-gray-900 truncate">{user.name}</div>
            <div className="text-xs text-gray-500 truncate">{user.email}</div>
            <div className="text-xs text-gray-400 mt-0.5 capitalize">{user.role.replace("_", " ")}</div>
            <button
              onClick={handleLogout}
              className="mt-2 text-xs text-red-600 hover:text-red-800 transition-colors"
            >
              Sign out
            </button>
          </div>
        )}
      </aside>

      <main className="flex-1 p-6 bg-gray-50 overflow-auto">{children}</main>

      {/* NL Query Panel (Cmd+K) */}
      <NlQueryPanel isOpen={queryOpen} onClose={closeQuery} />
    </div>
  );
}

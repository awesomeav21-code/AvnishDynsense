"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { api } from "@/lib/api";

const navItems = [
  { label: "Dashboard", href: "/dashboard" },
  { label: "Projects", href: "/dashboard", description: "View from dashboard" },
];

export default function InternalLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [user, setUser] = useState<{ name: string; email: string; role: string } | null>(null);

  useEffect(() => {
    api.getMe().then(setUser).catch(() => {
      router.push("/login");
    });
  }, [router]);

  function handleLogout() {
    api.clearTokens();
    router.push("/login");
  }

  return (
    <div className="flex min-h-screen">
      <aside className="w-64 border-r bg-white flex flex-col">
        <div className="p-4 border-b">
          <Link href="/dashboard" className="font-bold text-lg text-ai">
            Dynsense
          </Link>
        </div>

        <nav className="flex-1 p-4 space-y-1">
          <Link
            href="/dashboard"
            className={`block px-3 py-2 text-xs rounded-md transition-colors ${
              pathname === "/dashboard"
                ? "bg-ai/10 text-ai font-medium"
                : "text-gray-600 hover:text-gray-900 hover:bg-gray-100"
            }`}
          >
            Dashboard
          </Link>
        </nav>

        {user && (
          <div className="p-4 border-t">
            <div className="text-xs font-medium text-gray-900 truncate">{user.name}</div>
            <div className="text-xs text-gray-500 truncate">{user.email}</div>
            <div className="text-xs text-gray-400 mt-0.5 capitalize">{user.role}</div>
            <button
              onClick={handleLogout}
              className="mt-2 text-xs text-red-600 hover:text-red-800 transition-colors"
            >
              Sign out
            </button>
          </div>
        )}
      </aside>

      <main className="flex-1 p-6 bg-gray-50">{children}</main>
    </div>
  );
}

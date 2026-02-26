"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { api } from "@/lib/api";

interface UserOption {
  id: string;
  name: string;
  email: string;
  role: string;
}

interface UserSearchComboboxProps {
  value: string;
  onChange: (userId: string) => void;
  currentUser?: { id: string; name: string } | null;
  placeholder?: string;
  allowEmpty?: boolean;
  emptyLabel?: string;
}

export function UserSearchCombobox({
  value,
  onChange,
  currentUser,
  placeholder = "Search users...",
  allowEmpty = false,
  emptyLabel = "Unassigned",
}: UserSearchComboboxProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<UserOption[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedLabel, setSelectedLabel] = useState("");
  const [highlightIdx, setHighlightIdx] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>();

  // Resolve the display name for the current value
  useEffect(() => {
    if (!value) {
      setSelectedLabel("");
      return;
    }
    if (currentUser && value === currentUser.id) {
      setSelectedLabel(`${currentUser.name} (You)`);
      return;
    }
    // Fetch user name for the selected value
    api.searchUsers("", 50).then((res) => {
      const match = res.data.find((u) => u.id === value);
      if (match) {
        setSelectedLabel(match.id === currentUser?.id ? `${match.name} (You)` : match.name);
      }
    }).catch(() => {});
  }, [value, currentUser]);

  const doSearch = useCallback((q: string) => {
    setLoading(true);
    api.searchUsers(q, 20)
      .then((res) => {
        setResults(res.data.filter((u) => u.status !== "deactivated"));
        setHighlightIdx(0);
      })
      .catch(() => setResults([]))
      .finally(() => setLoading(false));
  }, []);

  // Debounced search
  useEffect(() => {
    if (!open) return;
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => doSearch(query), 200);
    return () => clearTimeout(debounceRef.current);
  }, [query, open, doSearch]);

  // Load initial results when opening
  const handleOpen = useCallback(() => {
    setOpen(true);
    setQuery("");
    doSearch("");
    setTimeout(() => inputRef.current?.focus(), 0);
  }, [doSearch]);

  // Close on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  const handleSelect = useCallback((userId: string, label: string) => {
    onChange(userId);
    setSelectedLabel(label);
    setOpen(false);
    setQuery("");
  }, [onChange]);

  // Scroll highlighted item into view
  useEffect(() => {
    if (!open || !listRef.current) return;
    const items = listRef.current.querySelectorAll("[data-combobox-item]");
    items[highlightIdx]?.scrollIntoView({ block: "nearest" });
  }, [highlightIdx, open]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    const totalItems = (allowEmpty ? 1 : 0) + results.length;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setHighlightIdx((i) => Math.min(i + 1, totalItems - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setHighlightIdx((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      const offset = allowEmpty ? 1 : 0;
      if (allowEmpty && highlightIdx === 0) {
        handleSelect("", emptyLabel);
      } else {
        const user = results[highlightIdx - offset];
        if (user) {
          const label = user.id === currentUser?.id ? `${user.name} (You)` : user.name;
          handleSelect(user.id, label);
        }
      }
    } else if (e.key === "Escape") {
      setOpen(false);
    }
  }, [results, highlightIdx, allowEmpty, emptyLabel, currentUser, handleSelect]);

  const roleColors: Record<string, string> = {
    site_admin: "bg-purple-100 text-purple-700",
    pm: "bg-blue-100 text-blue-700",
    developer: "bg-green-100 text-green-700",
    client: "bg-orange-100 text-orange-700",
  };

  return (
    <div ref={containerRef} className="relative">
      {/* Trigger button */}
      {!open ? (
        <button
          type="button"
          onClick={handleOpen}
          className="w-full text-left text-xs px-2 py-1.5 border rounded-md bg-white hover:border-gray-400 transition-colors flex items-center justify-between gap-1"
        >
          <span className={selectedLabel ? "text-gray-900" : "text-gray-400"}>
            {selectedLabel || placeholder}
          </span>
          <svg className="w-3 h-3 text-gray-400 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 9l4-4 4 4m0 6l-4 4-4-4" />
          </svg>
        </button>
      ) : (
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          className="w-full text-xs px-2 py-1.5 border border-blue-400 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-400/50"
        />
      )}

      {/* Dropdown */}
      {open && (
        <div
          ref={listRef}
          className="absolute z-30 mt-1 w-full bg-white border rounded-lg shadow-lg max-h-60 overflow-y-auto"
        >
          {loading && results.length === 0 && (
            <div className="px-3 py-2 text-xs text-gray-400">Searching...</div>
          )}

          {allowEmpty && (
            <button
              type="button"
              data-combobox-item
              onClick={() => handleSelect("", emptyLabel)}
              className={`w-full text-left px-3 py-2 text-xs transition-colors ${
                highlightIdx === 0 ? "bg-blue-50 text-blue-700" : "text-gray-500 hover:bg-gray-50"
              }`}
            >
              {emptyLabel}
            </button>
          )}

          {results.map((user, idx) => {
            const itemIdx = idx + (allowEmpty ? 1 : 0);
            const isYou = user.id === currentUser?.id;
            return (
              <button
                key={user.id}
                type="button"
                data-combobox-item
                onClick={() => {
                  const label = isYou ? `${user.name} (You)` : user.name;
                  handleSelect(user.id, label);
                }}
                className={`w-full text-left px-3 py-2 transition-colors ${
                  highlightIdx === itemIdx ? "bg-blue-50" : "hover:bg-gray-50"
                }`}
              >
                <div className="flex items-center gap-2">
                  <div className="w-6 h-6 rounded-full bg-gray-200 flex items-center justify-center text-[10px] font-medium text-gray-600 flex-shrink-0">
                    {user.name.split(" ").map((n) => n[0]).join("").slice(0, 2).toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-xs font-medium text-gray-900 truncate">
                      {user.name}
                      {isYou && <span className="text-blue-600 ml-1">(You)</span>}
                    </div>
                    <div className="text-[10px] text-gray-400 truncate">{user.email}</div>
                  </div>
                  <span className={`text-[9px] px-1.5 py-0.5 rounded-full flex-shrink-0 ${roleColors[user.role] ?? "bg-gray-100 text-gray-600"}`}>
                    {user.role.replace("_", " ")}
                  </span>
                </div>
              </button>
            );
          })}

          {!loading && results.length === 0 && (
            <div className="px-3 py-3 text-xs text-gray-400 text-center">No users found</div>
          )}
        </div>
      )}
    </div>
  );
}

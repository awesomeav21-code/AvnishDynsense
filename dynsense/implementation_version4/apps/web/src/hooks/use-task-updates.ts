"use client";

import { useEffect, useRef, useCallback } from "react";

/** Shape of every SSE task-update event payload forwarded to consumers. */
export interface TaskUpdateEvent {
  type: string;
  taskId: string;
  data: Record<string, unknown>;
}

const API_BASE =
  process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001/api/v1";

/** Delay (ms) before attempting to reconnect after an error. */
const RECONNECT_DELAY_MS = 3_000;

/**
 * React hook that subscribes to the Server-Sent Events stream for real-time
 * task updates.
 *
 * @param onUpdate - Callback invoked every time a task-related SSE event
 *                   arrives. The caller is responsible for memoising this
 *                   callback (e.g. with `useCallback`) to avoid unnecessary
 *                   reconnections.
 *
 * The hook:
 * - Reads the access token from `localStorage` (same location used by the
 *   API client in `lib/api.ts`).
 * - Opens an `EventSource` to `/api/v1/sse/stream?token=<accessToken>`.
 * - Parses every incoming message and delegates to `onUpdate`.
 * - Automatically reconnects with a 3-second delay when the connection drops.
 * - Cleans up the connection on unmount.
 */
export function useTaskUpdates(onUpdate: (event: TaskUpdateEvent) => void): void {
  const onUpdateRef = useRef(onUpdate);
  onUpdateRef.current = onUpdate;

  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const eventSourceRef = useRef<EventSource | null>(null);

  const connect = useCallback(() => {
    // Only runs in the browser.
    if (typeof window === "undefined") return;

    const token = localStorage.getItem("accessToken");
    if (!token) return;

    const url = `${API_BASE}/sse/stream?token=${encodeURIComponent(token)}`;
    const es = new EventSource(url);
    eventSourceRef.current = es;

    // The server sends named events (e.g. `event: task_status_changed`).
    // `onmessage` only fires for events without a name; for named events
    // we use `addEventListener`. We listen for common task event types.
    const handleEvent = (e: MessageEvent) => {
      try {
        const parsed: Record<string, unknown> = JSON.parse(e.data as string);
        onUpdateRef.current({
          type: e.type,
          taskId: (parsed["taskId"] as string) ?? "",
          data: parsed,
        });
      } catch {
        // Malformed payload — ignore silently.
      }
    };

    // Named events the server may emit.
    const eventTypes = [
      "task_status_changed",
      "task_updated",
      "task_created",
      "task_deleted",
    ];
    for (const t of eventTypes) {
      es.addEventListener(t, handleEvent);
    }

    // Catch-all for unnamed events.
    es.onmessage = handleEvent;

    es.onerror = () => {
      // Close the broken connection and schedule a reconnect.
      es.close();
      eventSourceRef.current = null;

      reconnectTimerRef.current = setTimeout(() => {
        connect();
      }, RECONNECT_DELAY_MS);
    };
  }, []);

  useEffect(() => {
    connect();

    return () => {
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
        eventSourceRef.current = null;
      }
      if (reconnectTimerRef.current) {
        clearTimeout(reconnectTimerRef.current);
        reconnectTimerRef.current = null;
      }
    };
  }, [connect]);
}

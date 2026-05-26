"use client";
import { useEffect, useRef, useCallback } from "react";
import type { SSEPayload } from "@/types";

interface UseSSEOptions {
  onMessage: (data: SSEPayload) => void;
  onDone: () => void;
  onError?: (error: Event) => void;
}

export function useSSE(campaignId: string | null, options: UseSSEOptions) {
  const esRef = useRef<EventSource | null>(null);
  const retryCount = useRef(0);
  const maxRetries = 8;

  const connect = useCallback(() => {
    if (!campaignId) return;

    const token = typeof window !== "undefined" ? localStorage.getItem("access_token") : "";
    const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
    const url = `${apiUrl}/sse/campaign/${campaignId}`;

    const headers: Record<string, string> = {};
    if (token) headers["Authorization"] = `Bearer ${token}`;

    const es = new EventSource(url);
    esRef.current = es;

    es.onmessage = (event) => {
      retryCount.current = 0;
      try {
        const data: SSEPayload = JSON.parse(event.data);
        options.onMessage(data);
      } catch {
        // ignore parse errors
      }
    };

    es.addEventListener("done", () => {
      es.close();
      options.onDone();
    });

    es.addEventListener("error", (event) => {
      options.onError?.(event);
    });

    es.onerror = () => {
      es.close();
      esRef.current = null;
      if (retryCount.current < maxRetries) {
        const delay = Math.min(1000 * 2 ** retryCount.current, 30000);
        retryCount.current++;
        setTimeout(connect, delay);
      }
    };
  }, [campaignId]);

  useEffect(() => {
    connect();
    return () => {
      esRef.current?.close();
      esRef.current = null;
    };
  }, [connect]);

  const disconnect = useCallback(() => {
    esRef.current?.close();
    esRef.current = null;
  }, []);

  return { disconnect };
}

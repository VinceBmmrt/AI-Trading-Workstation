"use client";

import { useCallback, useEffect, useState } from "react";
import {
  fetchAlerts,
  createAlert as apiCreateAlert,
  deleteAlert as apiDeleteAlert,
} from "@/lib/api";
import type { Alert, FiredAlert } from "@/lib/types";

export function useAlerts() {
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [toasts, setToasts] = useState<FiredAlert[]>([]);

  const refresh = useCallback(async () => {
    try {
      const data = await fetchAlerts();
      setAlerts(data);
    } catch {
      // silently ignore
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const handleAlertFired = useCallback((fired: FiredAlert) => {
    setAlerts((prev) => prev.filter((a) => a.id !== fired.id));
    setToasts((prev) => [...prev, fired]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== fired.id));
    }, 4000);
  }, []);

  const dismissToast = useCallback((id: number) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const createAlert = useCallback(
    async (ticker: string, targetPrice: number, direction: "above" | "below") => {
      const alert = await apiCreateAlert(ticker, targetPrice, direction);
      setAlerts((prev) => [...prev, alert]);
    },
    []
  );

  const removeAlert = useCallback(async (alertId: number) => {
    await apiDeleteAlert(alertId);
    setAlerts((prev) => prev.filter((a) => a.id !== alertId));
  }, []);

  return { alerts, toasts, handleAlertFired, dismissToast, createAlert, removeAlert };
}

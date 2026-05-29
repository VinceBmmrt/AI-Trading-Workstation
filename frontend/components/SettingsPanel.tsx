"use client";

import { useEffect, useState } from "react";
import { fetchSettings, resetPortfolio, updateSettings } from "@/lib/api";
import { useTheme } from "@/hooks/useTheme";

interface Props {
  onClose: () => void;
  onResetComplete: () => void;
}

export default function SettingsPanel({ onClose, onResetComplete }: Props) {
  const { theme, toggleTheme } = useTheme();
  const [startingCapital, setStartingCapital] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [confirmReset, setConfirmReset] = useState(false);
  const [resetLoading, setResetLoading] = useState(false);

  useEffect(() => {
    fetchSettings()
      .then((s) => setStartingCapital(s.starting_capital.toString()))
      .catch(() => {});
  }, []);

  async function handleSave() {
    const val = parseFloat(startingCapital);
    if (isNaN(val) || val <= 0) {
      setError("Starting capital must be greater than 0");
      return;
    }
    setLoading(true);
    setError("");
    try {
      await updateSettings(val);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to save");
    } finally {
      setLoading(false);
    }
  }

  async function handleReset() {
    setResetLoading(true);
    setError("");
    try {
      await resetPortfolio();
      onResetComplete();
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Reset failed");
    } finally {
      setResetLoading(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      onClick={onClose}
    >
      <div
        className="relative bg-surface border border-border rounded p-4 w-80 shadow-xl font-mono"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={onClose}
          className="absolute top-2 right-2 text-text-dim/50 hover:text-text text-sm"
        >
          ×
        </button>

        <div className="text-[10px] text-text-dim uppercase tracking-widest mb-3">
          Settings
        </div>

        {/* Theme */}
        <div className="text-[10px] text-text-dim uppercase tracking-widest mb-1">
          Theme
        </div>
        <div className="flex gap-2">
          {(["dark", "light"] as const).map((t) => (
            <button
              key={t}
              onClick={() => theme !== t && toggleTheme()}
              className={`flex-1 text-xs py-1 rounded border capitalize ${
                theme === t
                  ? "bg-blue/20 text-blue border-blue/40"
                  : "bg-bg text-text-dim border-border"
              }`}
            >
              {t}
            </button>
          ))}
        </div>

        {/* Starting Capital */}
        <div className="text-[10px] text-text-dim uppercase tracking-widest mt-3 mb-1">
          Starting Capital
        </div>
        <input
          type="number"
          step="100"
          min="100"
          value={startingCapital}
          onChange={(e) => setStartingCapital(e.target.value)}
          className="w-full bg-bg border border-border rounded px-2 py-1 text-xs font-mono text-text"
        />
        <button
          onClick={handleSave}
          disabled={loading}
          className="mt-2 w-full text-xs py-1 rounded bg-blue/20 text-blue border border-blue/40 disabled:opacity-50"
        >
          {loading ? "Saving…" : "Save"}
        </button>

        {error && <p className="text-down text-[10px] mt-1">{error}</p>}

        {/* Reset Portfolio */}
        <div className="border-t border-border mt-4 pt-3">
          <div className="text-[10px] text-down uppercase tracking-widest mb-2">
            Reset Portfolio
          </div>
          {!confirmReset ? (
            <button
              onClick={() => setConfirmReset(true)}
              className="w-full text-xs py-1 rounded bg-down/10 text-down border border-down/30"
            >
              Reset Portfolio
            </button>
          ) : (
            <>
              <p className="text-[10px] text-text-dim mb-2">
                This will wipe all positions, trades and snapshots.
              </p>
              <div className="flex gap-2">
                <button
                  onClick={handleReset}
                  disabled={resetLoading}
                  className="flex-1 text-xs py-1 rounded bg-down/20 text-down border border-down/40 disabled:opacity-50"
                >
                  {resetLoading ? "Resetting…" : "Confirm Reset"}
                </button>
                <button
                  onClick={() => setConfirmReset(false)}
                  className="flex-1 text-xs py-1 rounded bg-bg text-text-dim border border-border"
                >
                  Cancel
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

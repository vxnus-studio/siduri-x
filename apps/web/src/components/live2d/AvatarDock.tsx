"use client";

import React, { useState, useEffect, useCallback } from "react";
import {
  AvatarAction,
  AvatarExpression,
  AvatarRendererStatus,
  AvatarState,
} from "./types";
import AvatarCanvas from "./AvatarCanvas";

export interface ActiveAvatarEvent {
  eventId?: string;
  expression: AvatarExpression;
  action: AvatarAction;
  state: AvatarState;
  speechId?: string;
  lipSyncValue?: number;
  durationMs?: number;
}

export interface AvatarDockProps {
  isOpen: boolean;
  onToggle: () => void;
  activeEvent?: ActiveAvatarEvent | null;
  className?: string;
}

export default function AvatarDock({
  isOpen,
  onToggle,
  activeEvent,
  className = "",
}: AvatarDockProps) {
  const [rendererStatus, setRendererStatus] = useState<AvatarRendererStatus>("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleStatusChange = useCallback((status: AvatarRendererStatus, error?: string) => {
    setRendererStatus(status);
    if (error) {
      setErrorMessage(error);
    } else if (status === "ready") {
      setErrorMessage(null);
    }
  }, []);

  // When closed, reset status
  useEffect(() => {
    if (!isOpen) {
      setRendererStatus("idle");
      setErrorMessage(null);
    }
  }, [isOpen]);

  if (!isOpen) {
    return null;
  }

  const currentExpression = activeEvent?.expression || "neutral";
  const currentAction = activeEvent?.action || "idle";
  const currentState = activeEvent?.state || "idle";

  return (
    <aside
      className={`flex flex-col border-t sm:border-t-0 sm:border-l border-[var(--siduri-border-subtle)] bg-[var(--siduri-sidebar)] h-auto sm:h-full w-full sm:w-[300px] md:w-[320px] lg:w-[340px] flex-shrink-0 z-10 transition-all duration-300 max-sm:max-h-[320px] ${className}`}
      aria-label="Avatar Presence Dock"
    >
      {/* Dock Top Bar */}
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-[var(--siduri-border-subtle)] bg-[var(--siduri-surface)]/50">
        <div className="flex items-center gap-2" role="status" aria-live="polite">
          <span className="siduri-glyph w-5 h-5 text-xs">✦</span>
          <span className="text-[11px] font-mono tracking-widest uppercase text-[var(--siduri-text-primary)] font-semibold">
            Presence
          </span>
          <span
            className={`w-1.5 h-1.5 rounded-full ml-1 ${
              rendererStatus === "ready"
                ? currentState === "speaking"
                  ? "bg-[var(--siduri-ember-highlight)] animate-pulse motion-reduce:animate-none shadow-[0_0_6px_rgba(244,194,141,0.8)]"
                  : "bg-[var(--siduri-online)] shadow-[0_0_6px_rgba(127,199,154,0.6)]"
                : rendererStatus === "loading"
                ? "bg-[var(--siduri-warning)] animate-ping motion-reduce:animate-none"
                : "bg-red-400"
            }`}
            aria-hidden="true"
          />
          <span className="sr-only">
            {rendererStatus === "ready"
              ? `Presence active, currently ${currentState}`
              : rendererStatus === "loading"
              ? "Initializing presence"
              : "Presence unavailable"}
          </span>
        </div>

        <button
          type="button"
          onClick={onToggle}
          className="w-6 h-6 rounded-md grid place-items-center text-xs text-[var(--siduri-text-muted)] hover:text-[var(--siduri-text-primary)] hover:bg-[var(--siduri-elevated)] transition-colors focus-visible:ring-1 focus-visible:ring-[var(--siduri-border-ember)] outline-none"
          aria-label="Close avatar presence dock"
          title="Close presence dock"
        >
          ✕
        </button>
      </div>

      {/* Avatar WebGL Viewport Container */}
      <div className="relative flex-1 min-h-[200px] sm:min-h-[260px] flex flex-col bg-[#0b0b0e] overflow-hidden">
        <AvatarCanvas
          expression={currentExpression}
          action={currentAction}
          state={currentState}
          speechId={activeEvent?.speechId}
          lipSyncValue={activeEvent?.lipSyncValue}
          durationMs={activeEvent?.durationMs}
          onStatusChange={handleStatusChange}
          className="w-full h-full"
        />
      </div>

      {/* Dock Bottom Status Metadata */}
      <div className="px-4 py-2 border-t border-[var(--siduri-border-subtle)] bg-[var(--siduri-surface)]/40 flex items-center justify-between text-[10px] font-mono text-[var(--siduri-text-muted)]">
        <div className="flex items-center gap-2">
          <span>{currentExpression}</span>
          <span>·</span>
          <span>{currentAction}</span>
        </div>
        <span className="text-[9px] uppercase tracking-wider text-[var(--siduri-text-dim)]">
          {currentState}
        </span>
      </div>
    </aside>
  );
}

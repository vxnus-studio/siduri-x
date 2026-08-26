"use client";

import React, { useEffect, useRef, useState } from "react";
import {
  AvatarAction,
  AvatarExpression,
  AvatarRendererStatus,
  AvatarState,
} from "./types";
import { Live2DStateController } from "./controller";
import { loadCubismCore, loadModelAssets } from "./loader";
import { Live2DWebGLRenderer } from "./webgl-renderer";

export interface AvatarCanvasProps {
  modelUrl?: string;
  expression?: AvatarExpression;
  action?: AvatarAction;
  state?: AvatarState;
  speechId?: string;
  lipSyncValue?: number;
  durationMs?: number;
  className?: string;
  onStatusChange?: (status: AvatarRendererStatus, error?: string) => void;
}

export default function AvatarCanvas({
  modelUrl = "/live2d/akaituno/akaituno.model3.json",
  expression = "neutral",
  action = "idle",
  state = "idle",
  speechId,
  lipSyncValue,
  durationMs,
  className = "",
  onStatusChange,
}: AvatarCanvasProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const controllerRef = useRef<Live2DStateController>(
    new Live2DStateController({ expression, action, state, speechId, lipSyncValue, durationMs }),
  );
  const rendererRef = useRef<Live2DWebGLRenderer | null>(null);
  const rafRef = useRef<number | null>(null);

  const [status, setStatus] = useState<AvatarRendererStatus>("loading");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [retryCount, setRetryCount] = useState(0);

  // Listen for prefers-reduced-motion media query
  useEffect(() => {
    if (typeof window === "undefined" || !window.matchMedia) return;
    const mql = window.matchMedia("(prefers-reduced-motion: reduce)");
    const updateMotion = () => {
      controllerRef.current.setReducedMotion(mql.matches);
    };
    updateMotion();
    mql.addEventListener("change", updateMotion);
    return () => mql.removeEventListener("change", updateMotion);
  }, []);

  // Update controller props dynamically without re-triggering model reload
  useEffect(() => {
    controllerRef.current.updateConfig({
      expression,
      action,
      state,
      speechId,
      lipSyncValue,
      durationMs,
    });
  }, [expression, action, state, speechId, lipSyncValue, durationMs]);

  // Main WebGL & Cubism Model Lifecycle
  useEffect(() => {
    let isCancelled = false;
    let resizeObserver: ResizeObserver | null = null;

    async function initAvatar() {
      if (!canvasRef.current || !containerRef.current) return;
      setStatus("loading");
      onStatusChange?.("loading");
      setErrorMessage(null);

      try {
        // 1. Load Cubism Core
        const core = await loadCubismCore();
        if (isCancelled) return;

        // 2. Load Model Assets
        const assets = await loadModelAssets(modelUrl);
        if (isCancelled) return;

        // 3. Initialize WebGL Renderer
        const canvas = canvasRef.current;
        if (!canvas) return;

        const renderer = new Live2DWebGLRenderer(canvas);
        renderer.initialize(core, assets);
        rendererRef.current = renderer;

        // 4. Setup Responsive Resizing
        const updateSize = () => {
          if (!containerRef.current || !canvasRef.current) return;
          const rect = containerRef.current.getBoundingClientRect();
          const dpr = Math.min(window.devicePixelRatio || 1, 2);
          const width = Math.floor(rect.width * dpr);
          const height = Math.floor(rect.height * dpr);

          if (canvasRef.current.width !== width || canvasRef.current.height !== height) {
            canvasRef.current.width = width;
            canvasRef.current.height = height;
          }
        };

        updateSize();
        resizeObserver = new ResizeObserver(updateSize);
        resizeObserver.observe(containerRef.current);

        // 5. Start Animation / Render Loop
        const loop = () => {
          if (isCancelled) return;
          if (rendererRef.current) {
            rendererRef.current.render(controllerRef.current, performance.now());
          }
          rafRef.current = requestAnimationFrame(loop);
        };
        rafRef.current = requestAnimationFrame(loop);

        setStatus("ready");
        onStatusChange?.("ready");
      } catch (err: any) {
        if (isCancelled) return;
        const msg = err?.message || "Failed to initialize Live2D avatar";
        console.warn("[AvatarCanvas] Initialization error:", err);
        setStatus("error");
        setErrorMessage("Avatar unavailable in this browser.");
        onStatusChange?.("error", msg);
      }
    }

    void initAvatar();

    // Context loss handlers
    const canvas = canvasRef.current;
    const handleContextLost = (e: Event) => {
      e.preventDefault();
      console.warn("[AvatarCanvas] WebGL context lost");
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      setStatus("error");
      setErrorMessage("WebGL context lost.");
    };

    const handleContextRestored = () => {
      console.log("[AvatarCanvas] WebGL context restored, re-initializing...");
      void initAvatar();
    };

    if (canvas) {
      canvas.addEventListener("webglcontextlost", handleContextLost, false);
      canvas.addEventListener("webglcontextrestored", handleContextRestored, false);
    }

    return () => {
      isCancelled = true;
      if (rafRef.current) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
      if (resizeObserver) {
        resizeObserver.disconnect();
      }
      if (canvas) {
        canvas.removeEventListener("webglcontextlost", handleContextLost);
        canvas.removeEventListener("webglcontextrestored", handleContextRestored);
      }
      if (rendererRef.current) {
        rendererRef.current.dispose();
        rendererRef.current = null;
      }
    };
  }, [modelUrl, retryCount, onStatusChange]);

  return (
    <div
      ref={containerRef}
      className={`relative w-full h-full min-h-[260px] flex items-center justify-center overflow-hidden bg-[#0b0b0e] ${className}`}
      aria-label="Live2D Companion Presence"
    >
      {/* WebGL Canvas */}
      <canvas
        ref={canvasRef}
        role="img"
        aria-label="Live2D companion presence"
        className={`w-full h-full block transition-opacity duration-500 ${
          status === "ready" ? "opacity-100" : "opacity-0"
        }`}
      />

      {/* Loading Presentation */}
      {status === "loading" && (
        <div
          role="status"
          aria-live="polite"
          className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-[#0b0b0e]/90 text-[var(--siduri-text-muted)]"
        >
          <div className="siduri-glyph w-10 h-10 text-base animate-pulse motion-reduce:animate-none">✦</div>
          <span className="text-[11px] font-mono tracking-widest uppercase text-[var(--siduri-ember-light)]">
            Initializing Presence...
          </span>
        </div>
      )}

      {/* Graceful Error Presentation with Retry */}
      {status === "error" && (
        <div
          role="alert"
          aria-live="polite"
          className="absolute inset-0 flex flex-col items-center justify-center p-6 text-center bg-[#0b0b0e]/95 text-[var(--siduri-text-muted)]"
        >
          <div className="w-8 h-8 rounded-full border border-[var(--siduri-border-subtle)] grid place-items-center text-xs text-[var(--siduri-text-dim)] mb-2 font-mono">
            !
          </div>
          <p className="text-xs font-sans text-[var(--siduri-text-secondary)] mb-1">
            {errorMessage || "Avatar unavailable in this browser."}
          </p>
          <span className="text-[10px] font-mono text-[var(--siduri-text-dim)] mb-3">
            Conversational text mode remains active
          </span>
          <button
            type="button"
            onClick={() => setRetryCount((prev) => prev + 1)}
            className="px-3 py-1 text-[11px] font-mono tracking-wider uppercase rounded border border-[var(--siduri-border-subtle)] hover:border-[var(--siduri-border-ember)] text-[var(--siduri-text-secondary)] hover:text-[var(--siduri-text-primary)] transition-colors focus-visible:ring-1 focus-visible:ring-[var(--siduri-border-ember)] outline-none"
            aria-label="Retry avatar initialization"
          >
            Retry
          </button>
        </div>
      )}
    </div>
  );
}

"use client";

import React, { useEffect, useRef, useState } from "react";
import { AvatarAction, AvatarExpression, AvatarRendererStatus, AvatarState } from "../live2d/types";

export interface VRMCanvasProps {
  modelUrl?: string;
  expression?: AvatarExpression;
  action?: AvatarAction;
  state?: AvatarState;
  speechId?: string;
  lipSyncValue?: number;
  durationMs?: number;
  className?: string;
  vrmConfig?: any;
  onStatusChange?: (status: AvatarRendererStatus, error?: string) => void;
}

/**
 * Interactive WebGL Canvas for 3D humanoid VRM avatars using Three.js and @pixiv/three-vrm.
 */
export default function VRMCanvas({
  modelUrl,
  expression = "neutral",
  action = "idle",
  state = "idle",
  speechId,
  lipSyncValue,
  durationMs: _durationMs,
  className = "",
  vrmConfig,
  onStatusChange,
}: VRMCanvasProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const controllerRef = useRef<any>(null);

  const [status, setStatus] = useState<AvatarRendererStatus>("loading");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Synchronize dynamic expression, action, and speech changes to controller
  useEffect(() => {
    if (!controllerRef.current) return;
    controllerRef.current.updateState({
      expression,
      action,
      state,
      speechId,
      lipSyncValue,
      lookAtMode: vrmConfig?.lookAtMode || 'camera',
    });
  }, [expression, action, state, speechId, lipSyncValue, vrmConfig]);

  // Main Three.js VRM lifecycle
  useEffect(() => {
    let isCancelled = false;
    let resizeObserver: ResizeObserver | null = null;

    async function initVRM() {
      if (!canvasRef.current || !containerRef.current) return;

      if (!modelUrl) {
        setStatus("error");
        const err = "No VRM model URL specified. Place model (.vrm) in assets/body/<name>/";
        setErrorMessage(err);
        onStatusChange?.("error", err);
        return;
      }

      setStatus("loading");
      onStatusChange?.("loading");
      setErrorMessage(null);

      try {
        const canvas = canvasRef.current;
        const { VRMController } = await import("./controller");
        if (isCancelled) return;
        const controller = new VRMController(canvas, vrmConfig);
        controllerRef.current = controller;

        // Load 3D model
        await controller.loadModel(modelUrl);
        if (isCancelled) {
          controller.dispose();
          return;
        }

        // Setup resize handling
        const updateSize = () => {
          if (!containerRef.current || !canvasRef.current) return;
          const rect = containerRef.current.getBoundingClientRect();
          if (rect.width <= 0 || rect.height <= 0) return;
          controller.resize(rect.width, rect.height);
        };

        updateSize();
        resizeObserver = new ResizeObserver(updateSize);
        resizeObserver.observe(containerRef.current);

        // Start render loop
        controller.startLoop();

        setStatus("ready");
        onStatusChange?.("ready");
      } catch (err: any) {
        if (isCancelled) return;
        const message = err?.message || "Failed to initialize 3D VRM avatar canvas";
        console.error("[VRM] Initialization error:", err);
        setStatus("error");
        setErrorMessage(message);
        onStatusChange?.("error", message);
      }
    }

    initVRM();

    return () => {
      isCancelled = true;
      if (resizeObserver) {
        resizeObserver.disconnect();
      }
      if (controllerRef.current) {
        controllerRef.current.dispose();
        controllerRef.current = null;
      }
    };
  }, [modelUrl]);

  return (
    <div
      ref={containerRef}
      className={`relative w-full h-full flex items-center justify-center overflow-hidden select-none bg-transparent ${className}`}
      data-testid="vrm-canvas-container"
    >
      <canvas
        ref={canvasRef}
        className="w-full h-full block touch-none"
        data-testid="vrm-canvas-element"
      />

      {status === "loading" && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/40 backdrop-blur-xs text-xs font-mono text-[var(--siduri-text-secondary)] pointer-events-none transition-opacity">
          <div className="w-6 h-6 rounded-full border-2 border-[var(--siduri-ember)] border-t-transparent animate-spin mb-2" />
          <span>Loading 3D VRM avatar...</span>
        </div>
      )}

      {status === "error" && (
        <div className="absolute inset-0 flex flex-col items-center justify-center p-6 text-center bg-black/60 text-xs font-mono text-red-400">
          <span className="font-semibold mb-1">Avatar Error</span>
          <span className="opacity-80 max-w-sm">{errorMessage}</span>
        </div>
      )}
    </div>
  );
}

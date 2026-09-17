import React from "react";
import { DottedCircleIcon } from "./icons";

export function EmptyState({ title, detail }: { title: string; detail: string }) {
  return (
    <div className="empty-state">
      <span className="flex items-center justify-center" aria-hidden="true">
        <DottedCircleIcon size={24} />
      </span>
      <strong>{title}</strong>
      <p>{detail}</p>
    </div>
  );
}

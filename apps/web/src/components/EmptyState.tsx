import React from "react";

export function EmptyState({ title, detail }: { title: string; detail: string }) {
  return (
    <div className="empty-state">
      <span>◌</span>
      <strong>{title}</strong>
      <p>{detail}</p>
    </div>
  );
}

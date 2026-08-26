"use client";

import React from "react";

export interface PreferencesStarterProps {
  onSelectPrompt: (prompt: string) => void;
  className?: string;
}

export default function PreferencesStarter({
  onSelectPrompt,
  className = "",
}: PreferencesStarterProps) {
  return (
    <div className={`chat-empty-state ${className}`} data-testid="preferences-starter">
      <div className="siduri-orb">✦</div>
      <h2>Teach Siduri your preferences.</h2>
      <p>
        Choose a starting point, replace the blanks, and send it.
        Nothing becomes memory until you approve the receipt.
      </p>
      <div className="starter-prompts onboarding-prompts">
        <button
          type="button"
          onClick={() => onSelectPrompt("Call me [preferred name].")}
        >
          <span>Identity</span>Preferred name or title
        </button>
        <button
          type="button"
          onClick={() =>
            onSelectPrompt(
              "My timezone is [timezone] and my preferred language is [language].",
            )
          }
        >
          <span>Localization</span>Timezone and language
        </button>
        <button
          type="button"
          onClick={() =>
            onSelectPrompt(
              "My preferred response style is [concise / detailed / technical].",
            )
          }
        >
          <span>Response style</span>Tone and verbosity
        </button>
        <button
          type="button"
          onClick={() =>
            onSelectPrompt("I am interested in [topics or domains of interest].")
          }
        >
          <span>Knowledge</span>Topics of interest
        </button>
      </div>
      <p className="onboarding-privacy">
        Teach Siduri preferences explicitly. Information is stored in
        private memory only after you approve the receipt.
      </p>
    </div>
  );
}

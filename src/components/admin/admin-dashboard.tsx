"use client";

import { useEffect, useState } from "react";
import { PromptEditor } from "./prompt-editor";

interface PromptEntry {
  agentName: string;
  promptText: string;
  category: string;
  description: string;
  updatedAt: string | null;
  isCustomized: boolean;
}

type GroupedPrompts = Record<string, PromptEntry[]>;

export function AdminDashboard() {
  const [prompts, setPrompts] = useState<PromptEntry[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/admin/prompts")
      .then((res) => {
        if (!res.ok) throw new Error("Failed to load prompts");
        return res.json();
      })
      .then((data) => {
        setPrompts(data.prompts);
        if (data.prompts.length > 0) {
          setSelected(data.prompts[0].agentName);
        }
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  const grouped: GroupedPrompts = {};
  for (const p of prompts) {
    if (!grouped[p.category]) grouped[p.category] = [];
    grouped[p.category].push(p);
  }

  const categoryOrder = [
    "Chat Personality",
    "Bot Prompts",
    "Internal Prompts",
    "Other",
  ];
  const sortedCategories = categoryOrder.filter((c) => grouped[c]);

  const selectedPrompt = prompts.find((p) => p.agentName === selected);

  const handleSaved = (agentName: string, newText: string) => {
    setPrompts((prev) =>
      prev.map((p) =>
        p.agentName === agentName
          ? { ...p, promptText: newText, isCustomized: true, updatedAt: new Date().toISOString() }
          : p,
      ),
    );
  };

  return (
    <div className="flex flex-col h-screen bg-background">
      {/* Header */}
      <header className="flex items-center justify-between px-6 py-4 border-b border-foreground/5">
        <div className="flex items-center gap-3">
          <a href="/chat" className="text-foreground/40 hover:text-foreground/70 text-sm font-mono transition-colors">
            &larr; chat
          </a>
          <div className="font-mono text-lg font-bold">
            <span className="text-brand">nano</span>
            <span className="text-foreground">bots</span>
            <span className="text-purple-accent">.admin</span>
          </div>
        </div>
        <div className="text-xs text-foreground/30 font-mono">
          System Prompts
        </div>
      </header>

      {loading && (
        <div className="flex-1 flex items-center justify-center">
          <span className="text-foreground/40 font-mono text-sm">Loading prompts...</span>
        </div>
      )}

      {error && (
        <div className="flex-1 flex items-center justify-center">
          <span className="text-red-400 font-mono text-sm">{error}</span>
        </div>
      )}

      {!loading && !error && (
        <div className="flex flex-1 overflow-hidden">
          {/* Sidebar */}
          <aside className="w-72 border-r border-foreground/5 overflow-y-auto p-4 space-y-4">
            {sortedCategories.map((category) => (
              <div key={category}>
                <h3 className="text-xs font-semibold text-foreground/40 uppercase tracking-wider mb-2 font-mono">
                  {category}
                </h3>
                <div className="space-y-1">
                  {grouped[category].map((p) => (
                    <button
                      key={p.agentName}
                      onClick={() => setSelected(p.agentName)}
                      className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-all ${
                        selected === p.agentName
                          ? "bg-purple-accent/15 text-foreground border border-purple-accent/30"
                          : "text-foreground/60 hover:bg-indigo-deep/40 hover:text-foreground/80 border border-transparent"
                      }`}
                    >
                      <div className="font-mono text-xs font-medium">{p.agentName}</div>
                      <div className="text-[10px] text-foreground/30 mt-0.5 truncate">
                        {p.description}
                      </div>
                      {p.isCustomized && (
                        <span className="inline-block mt-1 text-[9px] text-brand/70 font-mono">
                          customized
                        </span>
                      )}
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </aside>

          {/* Editor */}
          <main className="flex-1 overflow-y-auto">
            {selectedPrompt ? (
              <PromptEditor
                key={selectedPrompt.agentName}
                agentName={selectedPrompt.agentName}
                description={selectedPrompt.description}
                category={selectedPrompt.category}
                initialText={selectedPrompt.promptText}
                updatedAt={selectedPrompt.updatedAt}
                isCustomized={selectedPrompt.isCustomized}
                onSaved={handleSaved}
              />
            ) : (
              <div className="flex items-center justify-center h-full text-foreground/30 font-mono text-sm">
                Select a prompt to edit
              </div>
            )}
          </main>
        </div>
      )}
    </div>
  );
}

"use client";

import { useState, useCallback } from "react";

interface PromptEditorProps {
  agentName: string;
  description: string;
  category: string;
  initialText: string;
  updatedAt: string | null;
  isCustomized: boolean;
  onSaved: (agentName: string, newText: string) => void;
}

export function PromptEditor({
  agentName,
  description,
  category,
  initialText,
  updatedAt,
  isCustomized,
  onSaved,
}: PromptEditorProps) {
  const [text, setText] = useState(initialText);
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState<{
    type: "success" | "error";
    message: string;
  } | null>(null);
  const [resetting, setResetting] = useState(false);

  const isDirty = text !== initialText;

  const handleSave = useCallback(async () => {
    setSaving(true);
    setFeedback(null);

    try {
      const res = await fetch(`/api/admin/prompts/${agentName}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ promptText: text, changeReason: "Admin edit" }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Save failed");
      }

      setFeedback({ type: "success", message: "Saved" });
      onSaved(agentName, text);
      setTimeout(() => setFeedback(null), 2000);
    } catch (err) {
      setFeedback({
        type: "error",
        message: err instanceof Error ? err.message : "Save failed",
      });
    } finally {
      setSaving(false);
    }
  }, [agentName, text, onSaved]);

  const handleReset = useCallback(async () => {
    setResetting(true);
    setFeedback(null);

    try {
      const res = await fetch(`/api/admin/prompts/${agentName}`);
      if (!res.ok) throw new Error("Failed to fetch default");
      const data = await res.json();

      if (data.hardcodedDefault) {
        setText(data.hardcodedDefault);
        setFeedback({ type: "success", message: "Reset to default" });
        setTimeout(() => setFeedback(null), 2000);
      } else {
        setFeedback({
          type: "error",
          message: "No hardcoded default available",
        });
      }
    } catch (err) {
      setFeedback({
        type: "error",
        message: err instanceof Error ? err.message : "Reset failed",
      });
    } finally {
      setResetting(false);
    }
  }, [agentName]);

  return (
    <div className="flex flex-col h-full p-6">
      {/* Header */}
      <div className="mb-4">
        <div className="flex items-center gap-3 mb-1">
          <h2 className="font-mono text-lg font-bold text-foreground">
            {agentName}
          </h2>
          <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-purple-accent/10 text-purple-accent/70">
            {category}
          </span>
          {isCustomized && (
            <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-brand/10 text-brand/70">
              customized
            </span>
          )}
        </div>
        <p className="text-sm text-foreground/40">{description}</p>
        {updatedAt && (
          <p className="text-xs text-foreground/20 mt-1 font-mono">
            Last updated: {new Date(updatedAt).toLocaleString()}
          </p>
        )}
      </div>

      {/* Textarea */}
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        className="flex-1 w-full bg-indigo-deep/40 border border-foreground/5 rounded-lg px-4 py-3 text-sm text-foreground/80 font-mono resize-none focus:outline-none focus:border-purple-accent/30 focus:ring-1 focus:ring-purple-accent/20 transition-all"
        spellCheck={false}
      />

      {/* Actions */}
      <div className="flex items-center justify-between mt-4">
        <div className="flex items-center gap-3">
          <button
            onClick={handleSave}
            disabled={saving || !isDirty}
            className="px-4 py-2 rounded-lg bg-purple-accent/20 text-purple-accent text-sm font-mono font-medium hover:bg-purple-accent/30 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
          >
            {saving ? "Saving..." : "Save"}
          </button>
          <button
            onClick={handleReset}
            disabled={resetting}
            className="px-4 py-2 rounded-lg border border-foreground/10 text-foreground/40 text-sm font-mono hover:text-foreground/60 hover:border-foreground/20 disabled:opacity-40 transition-all"
          >
            {resetting ? "Resetting..." : "Reset to default"}
          </button>
        </div>

        {feedback && (
          <span
            className={`text-xs font-mono ${
              feedback.type === "success"
                ? "text-brand/70"
                : "text-red-400"
            }`}
          >
            {feedback.message}
          </span>
        )}
      </div>
    </div>
  );
}

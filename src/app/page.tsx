"use client";

import { Logo } from "@/components/shared/logo";
import { useState } from "react";

/* ── Data ────────────────────────────────────────────────────────── */

const STARTER_SWARMS = [
  {
    name: "Codebase Immunity",
    description: "Security + quality. Runs on every push.",
    bots: ["security-scanner", "code-quality", "actions-hardening"],
    prs: [
      "fix: remove hardcoded API key in config.ts",
      "fix: pin actions/checkout to SHA digest",
      "refactor: extract duplicated auth logic",
    ],
  },
  {
    name: "Living Docs",
    description: "Documentation that updates itself.",
    bots: ["readme-generator", "architecture-mapper", "api-doc-generator"],
    prs: [
      "docs: regenerate README from current exports",
      "docs: update architecture diagram after refactor",
      "docs: add OpenAPI spec for /v2/payments",
    ],
  },
];

const SWARM_GALLERY = [
  { name: "Codebase Immunity", builtIn: true, bots: 3, description: "Security scanning, code quality, CI hardening" },
  { name: "Living Docs", builtIn: true, bots: 3, description: "README, architecture maps, API docs" },
  { name: "Compliance Kit", builtIn: false, bots: 4, description: "License headers, GDPR annotations, audit trails" },
  { name: "React Standards", builtIn: false, bots: 3, description: "Hook rules, accessibility, bundle analysis" },
  { name: "API Guardian", builtIn: false, bots: 2, description: "Breaking change detection, schema drift" },
  { name: "Dependency Health", builtIn: false, bots: 3, description: "Version bumps, CVE patches, license checks" },
];

const LIFECYCLE_STAGES = [
  { name: "draft", description: "Created from a description. Manual test only.", color: "text-foreground/50" },
  { name: "testing", description: "Shadow mode. Runs on scans, results visible to creator.", color: "text-purple-accent" },
  { name: "active", description: "Live on every push. Creates real PRs.", color: "text-green-neon" },
  { name: "archived", description: "Deactivated. Historical data preserved.", color: "text-foreground/30" },
];

const CLI_COMMANDS = [
  { cmd: "scan .", desc: "Run all active bots against current directory" },
  { cmd: "create \"desc\"", desc: "Create a new bot from natural language" },
  { cmd: "test bot-name .", desc: "Test a draft bot against real code" },
  { cmd: "promote bot-name", desc: "Move bot to next lifecycle stage" },
  { cmd: "list", desc: "Show all bots and their statuses" },
];

const COMPARISON = [
  { feature: "Dependency updates", dependabot: true, snyk: true, coderabbit: false, nanobots: true },
  { feature: "Custom scanning rules", dependabot: false, snyk: "YAML", coderabbit: false, nanobots: "Natural language" },
  { feature: "Creates fix PRs", dependabot: "Version bumps", snyk: false, coderabbit: false, nanobots: true },
  { feature: "Bot creation from description", dependabot: false, snyk: false, coderabbit: false, nanobots: true },
  { feature: "Swarm orchestration", dependabot: false, snyk: false, coderabbit: false, nanobots: true },
  { feature: "CLI + SaaS", dependabot: false, snyk: true, coderabbit: false, nanobots: true },
];

/* ── Helpers ──────────────────────────────────────────────────────── */

function ComparisonCell({ value, isNanobots }: { value: boolean | string; isNanobots?: boolean }) {
  if (value === true) {
    return <span className={isNanobots ? "text-green-neon font-bold" : "text-foreground/40"}>&#10003;</span>;
  }
  if (value === false) {
    return <span className="text-foreground/20">&mdash;</span>;
  }
  return <span className={isNanobots ? "text-green-neon text-xs font-semibold" : "text-foreground/40 text-xs"}>{value}</span>;
}

function CopyIcon({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      onClick={() => {
        navigator.clipboard.writeText(text);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      }}
      className="text-foreground/30 hover:text-foreground/60 transition-colors cursor-pointer ml-3"
      aria-label="Copy to clipboard"
    >
      {copied ? (
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6L9 17l-5-5"/></svg>
      ) : (
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect width="14" height="14" x="8" y="8" rx="2" ry="2"/><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/></svg>
      )}
    </button>
  );
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      onClick={() => {
        navigator.clipboard.writeText(text);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      }}
      className="group cursor-pointer bg-green-neon text-background font-mono font-bold px-8 py-3.5 rounded-lg text-base hover:bg-green-neon/90 transition-all hover:shadow-[0_0_30px_rgba(57,255,127,0.2)] inline-flex items-center gap-3"
    >
      <span className="text-background/60">$</span> {text}
      <span className="text-background/50 text-sm">{copied ? "copied!" : "click to copy"}</span>
    </button>
  );
}

/* ── Terminal Mock ────────────────────────────────────────────────── */

function TerminalMock() {
  const [activeTab, setActiveTab] = useState<"create" | "deploy">("create");

  return (
    <div className="max-w-2xl mx-auto">
      <div className="rounded-xl border border-purple-accent/15 bg-indigo-deep/80 backdrop-blur-sm overflow-hidden glow-box-purple">
        {/* Title bar */}
        <div className="flex items-center gap-2 px-4 py-3 border-b border-purple-accent/10">
          <div className="w-3 h-3 rounded-full bg-red-500/60" />
          <div className="w-3 h-3 rounded-full bg-yellow-500/60" />
          <div className="w-3 h-3 rounded-full bg-green-500/60" />
          <span className="ml-3 text-xs text-foreground/30 font-mono">nanobots</span>
        </div>
        {/* Tabs */}
        <div className="flex border-b border-purple-accent/10">
          <button
            onClick={() => setActiveTab("create")}
            className={`px-5 py-2 font-mono text-xs transition-colors cursor-pointer ${
              activeTab === "create"
                ? "text-green-neon border-b-2 border-green-neon bg-green-neon/5"
                : "text-foreground/30 hover:text-foreground/50"
            }`}
          >
            Create
          </button>
          <button
            onClick={() => setActiveTab("deploy")}
            className={`px-5 py-2 font-mono text-xs transition-colors cursor-pointer ${
              activeTab === "deploy"
                ? "text-green-neon border-b-2 border-green-neon bg-green-neon/5"
                : "text-foreground/30 hover:text-foreground/50"
            }`}
          >
            Deploy
          </button>
        </div>
        {/* Content */}
        <div className="p-6 text-left font-mono text-sm leading-7 min-h-[280px]">
          {activeTab === "create" ? (
            <>
              <div className="text-foreground/40">
                $ nanobots create <span className="text-purple-accent">&quot;flag any React component that uses useEffect without a cleanup function&quot;</span>
              </div>
              <div className="mt-4 space-y-1">
                <div><span className="text-green-neon">&#10003;</span> <span className="text-foreground/50">Analyzing description...</span></div>
                <div><span className="text-green-neon">&#10003;</span> <span className="text-foreground/50">Generated system prompt (247 tokens)</span></div>
                <div><span className="text-green-neon">&#10003;</span> <span className="text-foreground/50">Created bot:</span> <span className="text-green-neon">effect-cleanup-checker</span></div>
                <div><span className="text-foreground/30">  status:</span> <span className="text-purple-accent">draft</span></div>
                <div className="mt-3 text-foreground/30">$ nanobots test <span className="text-foreground/50">effect-cleanup-checker</span> <span className="text-purple-accent">.</span></div>
                <div className="mt-2"><span className="text-green-neon">&#10003;</span> <span className="text-foreground/50">Scanned 42 files, found 3 issues</span></div>
                <div><span className="text-foreground/30">  src/hooks/useAuth.tsx:14</span> <span className="text-foreground/50">— missing cleanup for subscription</span></div>
                <div><span className="text-foreground/30">  src/components/Chat.tsx:87</span> <span className="text-foreground/50">— missing cleanup for WebSocket</span></div>
              </div>
            </>
          ) : (
            <>
              <div className="text-foreground/40">
                $ nanobots status <span className="text-purple-accent">acme/payments-api</span>
              </div>
              <div className="mt-4">
                <div className="text-foreground/40 uppercase text-xs tracking-wider mb-2">Active Swarm &mdash; 8 bots</div>
                <div className="space-y-1">
                  <div><span className="text-green-neon">&#9679;</span> <span className="text-foreground/70">security-scanner</span> <span className="text-foreground/30">built-in</span></div>
                  <div><span className="text-green-neon">&#9679;</span> <span className="text-foreground/70">code-quality</span> <span className="text-foreground/30">built-in</span></div>
                  <div><span className="text-green-neon">&#9679;</span> <span className="text-foreground/70">actions-hardening</span> <span className="text-foreground/30">built-in</span></div>
                  <div><span className="text-green-neon">&#9679;</span> <span className="text-foreground/70">readme-generator</span> <span className="text-foreground/30">built-in</span></div>
                  <div><span className="text-purple-accent">&#9679;</span> <span className="text-foreground/70">effect-cleanup-checker</span> <span className="text-foreground/30">custom</span></div>
                  <div><span className="text-purple-accent">&#9679;</span> <span className="text-foreground/70">license-header-bot</span> <span className="text-foreground/30">custom</span></div>
                </div>
              </div>
              <div className="mt-4">
                <div className="text-foreground/40 uppercase text-xs tracking-wider mb-2">Last 24h</div>
                <div className="space-y-1">
                  <div><span className="text-foreground/30">PR #312</span> <span className="text-foreground/50">fix: remove hardcoded API key in config.ts</span></div>
                  <div><span className="text-foreground/30">PR #313</span> <span className="text-foreground/50">fix: add cleanup to useAuth subscription</span></div>
                  <div><span className="text-foreground/30">PR #314</span> <span className="text-foreground/50">docs: update README exports section</span></div>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

/* ── Page ─────────────────────────────────────────────────────────── */

export default function Home() {
  return (
    <div className="min-h-screen bg-background">
      {/* Nav */}
      <nav className="fixed top-0 w-full z-50 bg-background/80 backdrop-blur-md border-b border-purple-accent/10">
        <div className="max-w-6xl mx-auto px-6 h-14 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Logo size={28} />
            <span className="font-mono font-bold text-lg tracking-tight">
              <span className="text-green-neon">nano</span>
              <span className="text-foreground">bots</span>
              <span className="text-purple-accent">.sh</span>
            </span>
          </div>
          <div className="hidden md:flex items-center gap-8 text-sm text-foreground/60">
            <a href="#swarms" className="hover:text-foreground transition-colors">Swarms</a>
            <a href="#create" className="hover:text-foreground transition-colors">Create</a>
            <a href="#lifecycle" className="hover:text-foreground transition-colors">Lifecycle</a>
            <a href="#comparison" className="hover:text-foreground transition-colors">Compare</a>
            <a href="#pricing" className="hover:text-foreground transition-colors">Pricing</a>
            <a
              href="/api/auth/github"
              className="bg-green-neon text-background font-mono font-semibold px-4 py-1.5 rounded-md text-sm hover:bg-green-neon/90 transition-colors"
            >
              Get Started
            </a>
          </div>
        </div>
      </nav>

      {/* ── 1. Hero ──────────────────────────────────────────────── */}
      <section className="relative pt-32 pb-24 overflow-hidden">
        <div className="absolute inset-0 dot-grid opacity-60" />
        <div className="absolute top-20 left-1/2 -translate-x-1/2 w-[600px] h-[400px] bg-purple-accent/15 rounded-full blur-[120px]" />

        <div className="relative max-w-4xl mx-auto px-6 text-center">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full border border-purple-accent/20 bg-purple-accent/5 text-sm text-purple-accent mb-8">
            <span className="w-2 h-2 rounded-full bg-green-neon pulse-dot" />
            Now in public beta &mdash; free for open source
          </div>

          <h1 className="font-mono text-5xl md:text-7xl font-bold tracking-tight leading-[1.1] mb-6 glow-purple">
            Build AI bot swarms
            <br />
            for your GitHub repos
          </h1>

          <p className="text-lg md:text-xl text-foreground/60 max-w-2xl mx-auto mb-10 leading-relaxed">
            Describe a bot in plain English. Test it against your code. Deploy it alongside a swarm that scans, fixes, and ships PRs autonomously. Start with 6 built-in bots. Create your own in seconds.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-4">
            <CopyButton text="npx nanobots scan ." />
          </div>
          <div className="mb-16">
            <a
              href="/api/auth/github"
              className="font-mono text-foreground/40 text-sm hover:text-foreground/60 transition-colors"
            >
              or install the GitHub App &rarr;
            </a>
          </div>

          <TerminalMock />
        </div>
      </section>

      {/* ── Install ─────────────────────────────────────────────── */}
      <section className="py-16 relative">
        <div className="max-w-2xl mx-auto px-6">
          <div className="rounded-xl border border-purple-accent/20 bg-indigo-deep/80 backdrop-blur-sm p-8 text-center">
            <div className="inline-flex items-center gap-2 bg-background/60 rounded-lg border border-purple-accent/15 px-6 py-3 font-mono text-lg mb-6">
              <span className="text-foreground/40">$</span>
              <span className="text-green-neon">npx nanobots scan .</span>
              <CopyIcon text="npx nanobots scan ." />
            </div>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <a
                href="https://github.com/nanobots-sh/nanobots"
                target="_blank"
                rel="noopener noreferrer"
                className="font-mono text-sm px-5 py-2 rounded-lg border border-foreground/20 bg-white/5 text-foreground/70 hover:text-foreground hover:border-foreground/40 transition-colors"
              >
                View on GitHub
              </a>
              <a
                href="/docs"
                className="font-mono text-sm px-5 py-2 rounded-lg border border-foreground/20 bg-white/5 text-foreground/70 hover:text-foreground hover:border-foreground/40 transition-colors"
              >
                Read Documentation
              </a>
            </div>
          </div>
        </div>
      </section>

      {/* ── 2. Starter Swarms ────────────────────────────────────── */}
      <section id="swarms" className="py-24 relative">
        <div className="max-w-6xl mx-auto px-6">
          <div className="text-center mb-16">
            <h2 className="font-mono text-3xl md:text-4xl font-bold mb-4">
              Start with swarms that work out of the box
            </h2>
            <p className="text-foreground/50 text-lg max-w-xl mx-auto">
              6 built-in bots. Two pre-configured swarms. Zero setup.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-10">
            {STARTER_SWARMS.map((swarm) => (
              <div
                key={swarm.name}
                className="swarm-card rounded-xl border border-purple-accent/15 bg-indigo-deep/50 p-8"
              >
                <h3 className="font-mono text-xl font-bold mb-1">{swarm.name}</h3>
                <p className="text-foreground/40 text-sm mb-5">{swarm.description}</p>
                <div className="flex flex-wrap gap-2 mb-6">
                  {swarm.bots.map((bot) => (
                    <span
                      key={bot}
                      className="font-mono text-xs px-3 py-1 rounded-full border border-green-neon/20 bg-green-neon/5 text-green-neon"
                    >
                      {bot}
                    </span>
                  ))}
                </div>
                <div className="space-y-2">
                  {swarm.prs.map((pr) => (
                    <div key={pr} className="font-mono text-xs text-foreground/35 flex items-start gap-2">
                      <span className="text-green-neon mt-0.5 shrink-0">&#10003;</span>
                      {pr}
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>

          <p className="text-center text-foreground/40 font-mono text-sm">
            These are the starting point. The real power is building your own. &rarr;
          </p>
        </div>
      </section>

      {/* ── 3. Create Your Own ───────────────────────────────────── */}
      <section id="create" className="py-24 relative">
        <div className="absolute inset-0 dot-grid opacity-20" />
        <div className="relative max-w-6xl mx-auto px-6">
          <div className="text-center mb-16">
            <h2 className="font-mono text-3xl md:text-4xl font-bold mb-4">
              Describe a bot. Ship it in minutes.
            </h2>
            <p className="text-foreground/50 text-lg max-w-xl mx-auto">
              Bots are data, not code. A system prompt, a config, a lifecycle. Create from the CLI or the chat UI.
            </p>
          </div>

          <div className="split-panel grid grid-cols-1 lg:grid-cols-2 gap-8">
            {/* Left — conversation flow */}
            <div className="rounded-xl border border-purple-accent/15 bg-indigo-deep/50 p-8">
              <div className="text-xs font-mono text-foreground/30 uppercase tracking-wider mb-6">CLI Flow</div>
              <div className="space-y-6 font-mono text-sm">
                <div>
                  <div className="text-foreground/40 mb-1">$ nanobots create <span className="text-purple-accent">&quot;detect React components over 300 lines&quot;</span></div>
                  <div className="text-foreground/50 ml-2">&#10003; Created <span className="text-green-neon">large-component-detector</span> <span className="text-foreground/30">(draft)</span></div>
                </div>
                <div>
                  <div className="text-foreground/40 mb-1">$ nanobots test <span className="text-foreground/50">large-component-detector</span> <span className="text-purple-accent">.</span></div>
                  <div className="text-foreground/50 ml-2">&#10003; Scanned 89 files, found 4 issues</div>
                  <div className="text-foreground/30 ml-2 text-xs mt-1">src/components/Dashboard.tsx (412 lines)</div>
                  <div className="text-foreground/30 ml-2 text-xs">src/components/Settings.tsx (338 lines)</div>
                </div>
                <div>
                  <div className="text-foreground/40 mb-1">$ nanobots promote <span className="text-foreground/50">large-component-detector</span></div>
                  <div className="text-foreground/50 ml-2">&#10003; Promoted to <span className="text-purple-accent">testing</span></div>
                </div>
                <div>
                  <div className="text-foreground/40 mb-1">$ nanobots promote <span className="text-foreground/50">large-component-detector</span></div>
                  <div className="text-foreground/50 ml-2">&#10003; Promoted to <span className="text-green-neon">active</span></div>
                </div>
              </div>
            </div>

            {/* Right — bot definition JSON */}
            <div className="rounded-xl border border-purple-accent/15 bg-indigo-deep/50 p-8">
              <div className="text-xs font-mono text-foreground/30 uppercase tracking-wider mb-6">Generated BotDefinition</div>
              <pre className="font-mono text-sm leading-6 text-foreground/60 overflow-x-auto">
{`{
  "name": "large-component-detector",
  "status": "active",
  "description": "Flag React components over 300 lines",
  "systemPrompt": "You are a code reviewer focused on
    component size. Flag any React component
    (.tsx/.jsx) whose function body exceeds
    300 lines. Suggest extraction points.",
  "config": {
    "filePatterns": ["**/*.tsx", "**/*.jsx"],
    "severity": "warning",
    "batchSize": 10
  }
}`}
              </pre>
            </div>
          </div>
        </div>
      </section>

      {/* ── 4. Lifecycle ─────────────────────────────────────────── */}
      <section id="lifecycle" className="py-24 relative">
        <div className="max-w-4xl mx-auto px-6">
          <h2 className="font-mono text-3xl md:text-4xl font-bold mb-4 text-center">
            <span className="text-foreground/50">draft</span>
            <span className="text-foreground/20"> &rarr; </span>
            <span className="text-purple-accent">testing</span>
            <span className="text-foreground/20"> &rarr; </span>
            <span className="text-green-neon">active</span>
            <span className="text-foreground/20"> &rarr; </span>
            <span className="text-foreground/30">archived</span>
          </h2>
          <p className="text-center text-foreground/50 text-lg max-w-xl mx-auto mb-16">
            Every bot starts as a draft. Test it. Promote to shadow mode. Promote to active. No bot goes live without your approval.
          </p>

          <div className="lifecycle-pipeline">
            {LIFECYCLE_STAGES.map((stage, i) => (
              <div key={stage.name} className="flex items-start gap-6">
                <div className="flex flex-col items-center">
                  <div className={`lifecycle-dot w-10 h-10 rounded-full border-2 flex items-center justify-center font-mono text-xs font-bold ${
                    stage.name === "active"
                      ? "border-green-neon text-green-neon bg-green-neon/10"
                      : stage.name === "testing"
                      ? "border-purple-accent text-purple-accent bg-purple-accent/10"
                      : stage.name === "draft"
                      ? "border-foreground/30 text-foreground/50 bg-foreground/5"
                      : "border-foreground/15 text-foreground/30 bg-foreground/5"
                  }`}>
                    {i + 1}
                  </div>
                  {i < LIFECYCLE_STAGES.length - 1 && (
                    <div className="w-px h-12 bg-purple-accent/15" />
                  )}
                </div>
                <div className="pt-1.5">
                  <div className={`font-mono font-bold text-lg ${stage.color}`}>{stage.name}</div>
                  <div className="text-foreground/40 text-sm mt-1">{stage.description}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── 5. Swarm Gallery ─────────────────────────────────────── */}
      <section className="py-24 relative">
        <div className="absolute inset-0 dot-grid opacity-20" />
        <div className="relative max-w-6xl mx-auto px-6">
          <div className="text-center mb-16">
            <h2 className="font-mono text-3xl md:text-4xl font-bold mb-4">
              A swarm for every problem
            </h2>
            <p className="text-foreground/50 text-lg max-w-xl mx-auto">
              Every swarm is a collection of bots. Mix built-in with your own.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {SWARM_GALLERY.map((swarm) => (
              <div
                key={swarm.name}
                className="swarm-card rounded-xl border border-purple-accent/15 bg-indigo-deep/40 p-6"
              >
                <div className="flex items-center justify-between mb-3">
                  <h3 className="font-mono font-semibold text-sm">{swarm.name}</h3>
                  {swarm.builtIn ? (
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-green-neon/10 text-green-neon border border-green-neon/20">
                      built-in
                    </span>
                  ) : (
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-purple-accent/10 text-purple-accent border border-purple-accent/20">
                      create yours
                    </span>
                  )}
                </div>
                <p className="text-xs text-foreground/40 mb-3">{swarm.description}</p>
                <div className="text-xs font-mono text-foreground/25">{swarm.bots} bots</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── 6. Two Surfaces ──────────────────────────────────────── */}
      <section className="py-24 relative">
        <div className="max-w-6xl mx-auto px-6">
          <div className="text-center mb-16">
            <h2 className="font-mono text-3xl md:text-4xl font-bold mb-4">
              Your terminal. Or our chat. Same bots.
            </h2>
          </div>

          <div className="split-panel grid grid-cols-1 lg:grid-cols-2 gap-8">
            {/* CLI */}
            <div className="rounded-xl border border-purple-accent/15 bg-indigo-deep/50 p-8">
              <div className="font-mono text-green-neon text-sm font-bold uppercase tracking-wider mb-6">CLI</div>
              <div className="space-y-3">
                {CLI_COMMANDS.map((c) => (
                  <div key={c.cmd} className="flex items-start gap-3">
                    <span className="font-mono text-sm text-green-neon shrink-0 w-48 truncate">nanobots {c.cmd}</span>
                    <span className="text-xs text-foreground/35">{c.desc}</span>
                  </div>
                ))}
              </div>
              <p className="mt-8 text-xs text-foreground/30">
                Pipe to CI. Works with any model via OpenRouter.
              </p>
            </div>

            {/* Chat UI */}
            <div className="rounded-xl border border-purple-accent/15 bg-indigo-deep/50 p-8">
              <div className="font-mono text-purple-accent text-sm font-bold uppercase tracking-wider mb-6">Chat UI</div>
              <div className="space-y-4">
                <div className="rounded-lg bg-background/40 p-4 border border-purple-accent/10">
                  <div className="text-xs text-foreground/30 mb-2">You</div>
                  <div className="font-mono text-sm text-foreground/60">Scan acme/payments-api for security issues and create a bot that checks for SQL injection patterns</div>
                </div>
                <div className="rounded-lg bg-background/40 p-4 border border-green-neon/10">
                  <div className="text-xs text-green-neon/50 mb-2">nanobots</div>
                  <div className="font-mono text-sm text-foreground/60">
                    Scanned 147 files. Found 2 security issues.
                    <br />Created <span className="text-green-neon">sql-injection-checker</span> (draft).
                    <br />Run <span className="text-foreground/40">promote sql-injection-checker</span> to activate.
                  </div>
                </div>
              </div>
              <p className="mt-8 text-xs text-foreground/30">
                GitHub App integration. Manage your swarm through conversation.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ── Comparison ───────────────────────────────────────────── */}
      <section id="comparison" className="py-24 relative">
        <div className="absolute inset-0 dot-grid opacity-20" />
        <div className="relative max-w-4xl mx-auto px-6">
          <div className="text-center mb-16">
            <h2 className="font-mono text-3xl md:text-4xl font-bold mb-4">
              What makes this different?
            </h2>
          </div>

          <div className="rounded-xl border border-purple-accent/15 bg-indigo-deep/40 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="comparison-table w-full">
                <thead>
                  <tr>
                    <th className="text-foreground/50">Capability</th>
                    <th className="text-foreground/40">Dependabot</th>
                    <th className="text-foreground/40">Snyk</th>
                    <th className="text-foreground/40">CodeRabbit</th>
                    <th className="text-green-neon">nanobots</th>
                  </tr>
                </thead>
                <tbody>
                  {COMPARISON.map((row) => (
                    <tr key={row.feature}>
                      <td className="text-foreground/60 font-mono text-sm">{row.feature}</td>
                      <td className="text-center"><ComparisonCell value={row.dependabot} /></td>
                      <td className="text-center"><ComparisonCell value={row.snyk} /></td>
                      <td className="text-center"><ComparisonCell value={row.coderabbit} /></td>
                      <td className="text-center"><ComparisonCell value={row.nanobots} isNanobots /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </section>

      {/* ── 7. Pricing ───────────────────────────────────────────── */}
      <section id="pricing" className="py-24 relative">
        <div className="absolute inset-0 dot-grid opacity-20" />
        <div className="relative max-w-5xl mx-auto px-6">
          <div className="text-center mb-16">
            <h2 className="font-mono text-3xl md:text-4xl font-bold mb-4">
              Free for open source. $19/contributor for teams.
            </h2>
            <p className="text-foreground/50 text-lg">
              Only pay for people who push code.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* OSS */}
            <div className="rounded-xl border border-purple-accent/15 bg-indigo-deep/40 p-8">
              <div className="font-mono text-sm text-purple-accent uppercase tracking-wider mb-4">Open Source</div>
              <div className="font-mono text-4xl font-bold mb-1">$0</div>
              <div className="text-sm text-foreground/40 mb-8">forever free</div>
              <ul className="space-y-3 text-sm text-foreground/55">
                <li className="flex items-start gap-2"><span className="text-green-neon mt-0.5">&#10003;</span>All 6 built-in bots</li>
                <li className="flex items-start gap-2"><span className="text-green-neon mt-0.5">&#10003;</span>Unlimited custom bots</li>
                <li className="flex items-start gap-2"><span className="text-green-neon mt-0.5">&#10003;</span>Unlimited public repos</li>
                <li className="flex items-start gap-2"><span className="text-green-neon mt-0.5">&#10003;</span>Community support</li>
              </ul>
            </div>

            {/* Pro */}
            <div className="rounded-xl border border-green-neon/30 bg-indigo-deep/60 p-8 relative glow-box-green">
              <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-green-neon text-background text-xs font-mono font-bold px-3 py-1 rounded-full">
                Popular
              </div>
              <div className="font-mono text-sm text-green-neon uppercase tracking-wider mb-4">Pro</div>
              <div className="font-mono text-4xl font-bold mb-1">
                $19<span className="text-lg text-foreground/40">/contributor</span>
              </div>
              <div className="text-sm text-foreground/40 mb-8">per month</div>
              <ul className="space-y-3 text-sm text-foreground/55">
                <li className="flex items-start gap-2"><span className="text-green-neon mt-0.5">&#10003;</span>Everything in Open Source</li>
                <li className="flex items-start gap-2"><span className="text-green-neon mt-0.5">&#10003;</span>Unlimited custom bots</li>
                <li className="flex items-start gap-2"><span className="text-green-neon mt-0.5">&#10003;</span>Custom swarm definitions</li>
                <li className="flex items-start gap-2"><span className="text-green-neon mt-0.5">&#10003;</span>Private repos</li>
                <li className="flex items-start gap-2"><span className="text-green-neon mt-0.5">&#10003;</span>Slack &amp; email alerts</li>
                <li className="flex items-start gap-2"><span className="text-green-neon mt-0.5">&#10003;</span>Priority support</li>
              </ul>
              <a
                href="/api/auth/github"
                className="block mt-8 text-center bg-green-neon text-background font-mono font-bold py-2.5 rounded-lg hover:bg-green-neon/90 transition-colors"
              >
                Start free trial
              </a>
            </div>

            {/* Enterprise */}
            <div className="rounded-xl border border-purple-accent/15 bg-indigo-deep/40 p-8">
              <div className="font-mono text-sm text-purple-accent uppercase tracking-wider mb-4">Enterprise</div>
              <div className="font-mono text-4xl font-bold mb-1">Custom</div>
              <div className="text-sm text-foreground/40 mb-8">let&apos;s talk</div>
              <ul className="space-y-3 text-sm text-foreground/55">
                <li className="flex items-start gap-2"><span className="text-green-neon mt-0.5">&#10003;</span>Everything in Pro</li>
                <li className="flex items-start gap-2"><span className="text-green-neon mt-0.5">&#10003;</span>Unlimited custom bots</li>
                <li className="flex items-start gap-2"><span className="text-green-neon mt-0.5">&#10003;</span>Custom swarm definitions</li>
                <li className="flex items-start gap-2"><span className="text-green-neon mt-0.5">&#10003;</span>SSO/SCIM integration</li>
                <li className="flex items-start gap-2"><span className="text-green-neon mt-0.5">&#10003;</span>Audit logs</li>
                <li className="flex items-start gap-2"><span className="text-green-neon mt-0.5">&#10003;</span>SLA &amp; dedicated support</li>
              </ul>
              <a
                href="mailto:hello@nanobots.sh"
                className="block mt-8 text-center border border-purple-accent/30 text-foreground/60 font-mono font-bold py-2.5 rounded-lg hover:border-purple-accent/50 hover:text-foreground/80 transition-colors"
              >
                Contact us
              </a>
            </div>
          </div>
        </div>
      </section>

      {/* ── 8. Final CTA ─────────────────────────────────────────── */}
      <section className="py-24">
        <div className="max-w-3xl mx-auto px-6 text-center">
          <h2 className="font-mono text-3xl md:text-5xl font-bold mb-6 glow-purple">
            Your next bot is
            <br />
            one sentence away.
          </h2>
          <p className="text-foreground/50 text-lg mb-10 max-w-lg mx-auto">
            Start scanning. Start building.
          </p>
          <div className="flex flex-col items-center gap-4">
            <CopyButton text="npx nanobots scan ." />
            <a
              href="/api/auth/github"
              className="font-mono text-foreground/40 text-sm hover:text-foreground/60 transition-colors"
            >
              or Get Started with GitHub &rarr;
            </a>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-purple-accent/10 py-12">
        <div className="max-w-6xl mx-auto px-6 flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="flex items-center gap-2 font-mono text-sm text-foreground/30">
            <Logo size={20} />
            <span>
              <span className="text-green-neon">nano</span>
              <span className="text-foreground/50">bots</span>
              <span className="text-purple-accent">.sh</span>
            </span>
            <span className="ml-2">&copy; {new Date().getFullYear()}</span>
          </div>
          <div className="flex items-center gap-6 text-sm text-foreground/30">
            <a href="/chat" className="hover:text-foreground/50 transition-colors">Docs</a>
            <a href="https://github.com/nanobots-sh" target="_blank" rel="noopener noreferrer" className="hover:text-foreground/50 transition-colors">GitHub</a>
            <a href="https://x.com/nanobots_sh" target="_blank" rel="noopener noreferrer" className="hover:text-foreground/50 transition-colors">Twitter</a>
            <a href="mailto:hello@nanobots.sh" className="hover:text-foreground/50 transition-colors">Privacy</a>
          </div>
        </div>
      </footer>
    </div>
  );
}

const WHITE_BLOOD_CELLS = [
  { name: "console-cleanup", description: "Remove console.log/debug statements", icon: "🧹" },
  { name: "unused-imports", description: "Remove imports that aren't referenced", icon: "📦" },
  { name: "actions-updater", description: "Update deprecated GitHub Actions", icon: "⚡" },
  { name: "dead-exports", description: "Remove exports nothing imports", icon: "💀" },
  { name: "secret-scanner", description: "Detect hardcoded secrets and API keys", icon: "🔐" },
  { name: "actions-security", description: "Pin GitHub Actions to SHA digests", icon: "📌" },
  { name: "llm-security", description: "OWASP LLM Top 10 vulnerability detection", icon: "🤖" },
];

const WATCHTOWER_SOURCES = [
  { name: "OSV Database", frequency: "Every 15 min" },
  { name: "GitHub Advisory DB", frequency: "Every 15 min" },
  { name: "CISA KEV", frequency: "Every 30 min" },
  { name: "Hacker News", frequency: "Every 30 min" },
  { name: "oss-security", frequency: "Every 60 min" },
  { name: "npm/PyPI/Go advisories", frequency: "Every 15 min" },
];

const AGENT_COMMANDS = [
  { command: "@nanobots scan this PR for security issues", description: "Run all security checks against changed files" },
  { command: "@nanobots find all uses of deprecated API xyz", description: "Search the entire codebase for a pattern" },
  { command: "@nanobots generate tests for changed functions", description: "Auto-generate test stubs for PR changes" },
];

const STEPS = [
  {
    step: "01",
    title: "Install the GitHub App",
    description: "One click from the GitHub Marketplace. Pick the repos you want to protect.",
    code: "github.com/apps/nanobots-sh → Install",
  },
  {
    step: "02",
    title: "Three layers activate",
    description:
      "White blood cells start scanning your code. The watchtower indexes your dependencies and begins monitoring threat sources. Directed response starts listening for @nanobots mentions.",
    code: "✓ white blood cells scanning 847 files...\n✓ watchtower indexing 142 dependencies...\n✓ directed response listening for @nanobots...",
  },
  {
    step: "03",
    title: "Issues become PRs",
    description:
      "Code hygiene issues become small fix PRs. Vulnerabilities become pinned versions or mitigation PRs. Everything merged with one click.",
    code: 'fix(console-cleanup): remove 8 console.log statements\nfix(actions-security): pin 4 actions to SHA digests\nfix(deps): patch CVE-2024-38816 in spring-web@6.1.0',
  },
];

const COMPARISON = [
  { feature: "Bumps dependency versions", dependabot: true, snyk: true, nanobots: true },
  { feature: "Monitors community chatter", dependabot: false, snyk: false, nanobots: true },
  { feature: "Alerts before official CVE", dependabot: false, snyk: "Sometimes", nanobots: true },
  { feature: "Checks if vuln is reachable in your code", dependabot: false, snyk: "Paid", nanobots: true },
  { feature: "Detects supply chain attacks", dependabot: false, snyk: false, nanobots: true },
  { feature: "Creates fix PRs (not just alerts)", dependabot: "Version bumps", snyk: false, nanobots: true },
  { feature: "LLM security scanning", dependabot: false, snyk: false, nanobots: true },
  { feature: "On-demand agent via @mention", dependabot: false, snyk: false, nanobots: true },
];

function ComparisonCell({ value, isNanobots }: { value: boolean | string; isNanobots?: boolean }) {
  if (value === true) {
    return <span className={isNanobots ? "text-green-neon font-bold" : "text-foreground/40"}>&#10003;</span>;
  }
  if (value === false) {
    return <span className="text-foreground/20">&mdash;</span>;
  }
  return <span className="text-foreground/40 text-xs">{value}</span>;
}

import { Logo } from "@/components/shared/logo";

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
            <a href="#pillars" className="hover:text-foreground transition-colors">
              Pillars
            </a>
            <a href="#comparison" className="hover:text-foreground transition-colors">
              Compare
            </a>
            <a href="#how-it-works" className="hover:text-foreground transition-colors">
              How it works
            </a>
            <a href="#pricing" className="hover:text-foreground transition-colors">
              Pricing
            </a>
            <a
              href="/api/auth/github"
              className="bg-green-neon text-background font-mono font-semibold px-4 py-1.5 rounded-md text-sm hover:bg-green-neon/90 transition-colors"
            >
              Get Started
            </a>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="relative pt-32 pb-24 overflow-hidden">
        {/* Dot grid background */}
        <div className="absolute inset-0 dot-grid opacity-60" />
        {/* Purple gradient blob */}
        <div className="absolute top-20 left-1/2 -translate-x-1/2 w-[600px] h-[400px] bg-purple-accent/15 rounded-full blur-[120px]" />

        <div className="relative max-w-4xl mx-auto px-6 text-center">
          {/* Announcement bar */}
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full border border-purple-accent/20 bg-purple-accent/5 text-sm text-purple-accent mb-8">
            <span className="w-2 h-2 rounded-full bg-green-neon pulse-dot" />
            Now in public beta &mdash; free for open source
          </div>

          <h1 className="font-mono text-5xl md:text-7xl font-bold tracking-tight leading-[1.1] mb-6 glow-purple">
            The immune system
            <br />
            for your codebase
          </h1>

          <p className="text-lg md:text-xl text-foreground/60 max-w-2xl mx-auto mb-10 leading-relaxed">
            Unleash autonomous bots into your GitHub repo that learn, adapt, and
            proactively fix &mdash; no config, no prompting. They self-improve and never sleep.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-16">
            <a
              href="/api/auth/github"
              className="bg-green-neon text-background font-mono font-bold px-8 py-3 rounded-lg text-base hover:bg-green-neon/90 transition-all hover:shadow-[0_0_30px_rgba(57,255,127,0.2)]"
            >
              Get Started
            </a>
            <a
              href="#how-it-works"
              className="font-mono text-foreground/50 px-8 py-3 rounded-lg text-base border border-foreground/10 hover:border-foreground/20 hover:text-foreground/70 transition-colors"
            >
              See how it works
            </a>
          </div>

          {/* Terminal preview */}
          <div className="max-w-2xl mx-auto">
            <div className="rounded-xl border border-purple-accent/15 bg-indigo-deep/80 backdrop-blur-sm overflow-hidden glow-box-purple">
              <div className="flex items-center gap-2 px-4 py-3 border-b border-purple-accent/10">
                <div className="w-3 h-3 rounded-full bg-red-500/60" />
                <div className="w-3 h-3 rounded-full bg-yellow-500/60" />
                <div className="w-3 h-3 rounded-full bg-green-500/60" />
                <span className="ml-3 text-xs text-foreground/30 font-mono">
                  nanobots &mdash; your-repo
                </span>
              </div>
              <div className="p-6 text-left font-mono text-sm leading-7">
                <div className="text-foreground/40">
                  $ nanobots status <span className="text-purple-accent">acme/payments-api</span>
                </div>

                <div className="mt-4">
                  <div className="text-foreground/40 uppercase text-xs tracking-wider mb-2">White Blood Cells &mdash; always cleaning</div>
                  <div className="space-y-1">
                    <div>
                      <span className="text-green-neon">&#10003;</span>{" "}
                      <span className="text-foreground/70">console-cleanup</span>{" "}
                      <span className="text-foreground/30">removed 8 console.logs</span>
                    </div>
                    <div>
                      <span className="text-green-neon">&#10003;</span>{" "}
                      <span className="text-foreground/70">unused-imports</span>{" "}
                      <span className="text-foreground/30">removed 3 dead imports</span>
                    </div>
                    <div>
                      <span className="text-green-neon">&#10003;</span>{" "}
                      <span className="text-foreground/70">secret-scanner</span>{" "}
                      <span className="text-foreground/30">0 secrets detected</span>
                    </div>
                    <div>
                      <span className="text-green-neon">&#10003;</span>{" "}
                      <span className="text-foreground/70">actions-security</span>{" "}
                      <span className="text-foreground/30">pinned 4 actions to SHA</span>
                    </div>
                  </div>
                </div>

                <div className="mt-4">
                  <div className="text-foreground/40 uppercase text-xs tracking-wider mb-2">Watchtower &mdash; scanning the horizon</div>
                  <div className="space-y-1">
                    <div>
                      <span className="text-green-neon">&#10003;</span>{" "}
                      <span className="text-foreground/30">monitoring 142 deps across 3 ecosystems</span>
                    </div>
                    <div>
                      <span className="text-green-neon">&#10003;</span>{" "}
                      <span className="text-foreground/30">last check: 12 min ago</span>
                    </div>
                    <div>
                      <span className="text-amber-warn">&#9888;</span>{" "}
                      <span className="text-amber-warn/80">CVE-2024-38816 affects spring-web@6.1.0</span>{" "}
                      <span className="text-foreground/30">&rarr; PR #847</span>
                    </div>
                  </div>
                </div>

                <div className="mt-4">
                  <div className="text-foreground/40 uppercase text-xs tracking-wider mb-2">Directed Response &mdash; ready</div>
                  <div>
                    <span className="text-foreground/30">&rarr; @nanobots in any PR comment or issue</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Three Pillars */}
      <section id="pillars" className="py-24 relative">
        <div className="max-w-6xl mx-auto px-6">
          <div className="text-center mb-16">
            <h2 className="font-mono text-3xl md:text-4xl font-bold mb-4">
              Your code has an immune system now
            </h2>
            <p className="text-foreground/50 text-lg max-w-xl mx-auto">
              Three layers. Always on. Zero maintenance.
            </p>
          </div>

          <div className="space-y-8">
            {/* Pillar 1 - White Blood Cells */}
            <div className="pillar-card rounded-2xl bg-indigo-deep/50 p-8 md:p-10 border-l-4 border-l-green-neon">
              <div className="flex items-center gap-4 mb-6">
                <span className="font-mono text-5xl font-bold text-green-neon/20">01</span>
                <div>
                  <h3 className="font-mono text-2xl font-bold text-green-neon">White Blood Cells</h3>
                  <p className="text-foreground/40 font-mono text-sm">Always Cleaning</p>
                </div>
              </div>
              <p className="text-foreground/55 text-base leading-relaxed mb-8 max-w-3xl">
                Bots that run automatically on every push to your default branch. No config. No human action needed.
                Small, surgical PRs &mdash; merge or dismiss.
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                {WHITE_BLOOD_CELLS.map((bot) => (
                  <div
                    key={bot.name}
                    className="nanobot-card rounded-xl bg-background/40 p-5"
                  >
                    <div className="text-2xl mb-3">{bot.icon}</div>
                    <h4 className="font-mono font-semibold text-sm mb-1 text-green-neon">
                      {bot.name}
                    </h4>
                    <p className="text-xs text-foreground/40 leading-relaxed">
                      {bot.description}
                    </p>
                  </div>
                ))}
              </div>
            </div>

            {/* Pillar 2 - The Watchtower */}
            <div className="pillar-card rounded-2xl bg-indigo-deep/50 p-8 md:p-10 border-l-4 border-l-purple-accent">
              <div className="flex items-center gap-4 mb-6">
                <span className="font-mono text-5xl font-bold text-purple-accent/20">02</span>
                <div className="flex items-center gap-3">
                  <div>
                    <h3 className="font-mono text-2xl font-bold text-purple-accent">The Watchtower</h3>
                    <p className="text-foreground/40 font-mono text-sm">Always Scanning the Horizon</p>
                  </div>
                  <span className="w-2 h-2 rounded-full bg-purple-accent scan-pulse" />
                </div>
              </div>
              <p className="text-foreground/55 text-base leading-relaxed mb-8 max-w-3xl">
                A continuously-running monitor that watches the outside world and correlates threats
                with YOUR repo&apos;s actual dependency tree.
              </p>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
                {WATCHTOWER_SOURCES.map((source) => (
                  <div
                    key={source.name}
                    className="flex items-center justify-between rounded-lg border border-purple-accent/10 bg-background/30 px-4 py-3"
                  >
                    <span className="font-mono text-sm text-foreground/70">{source.name}</span>
                    <span className="text-xs text-purple-accent/60 font-mono">{source.frequency}</span>
                  </div>
                ))}
              </div>

              <blockquote className="border-l-2 border-purple-accent/30 pl-6 py-2 text-foreground/40 text-sm leading-relaxed italic max-w-2xl">
                You wake up. There&apos;s a PR waiting. At 3am, a vulnerability was disclosed on oss-security.
                By 3:15am, nanobots had already confirmed it affects your code and created a fix PR.
                You merge it before your coffee gets cold.
              </blockquote>
            </div>

            {/* Pillar 3 - Directed Response */}
            <div className="pillar-card rounded-2xl bg-indigo-deep/50 p-8 md:p-10 border-l-4 border-l-foreground/20">
              <div className="flex items-center gap-4 mb-6">
                <span className="font-mono text-5xl font-bold text-foreground/10">03</span>
                <div>
                  <h3 className="font-mono text-2xl font-bold text-foreground/90">Directed Response</h3>
                  <p className="text-foreground/40 font-mono text-sm">Point and Shoot</p>
                </div>
              </div>
              <p className="text-foreground/55 text-base leading-relaxed mb-8 max-w-3xl">
                Type <span className="font-mono text-foreground/80">@nanobots</span> in any PR comment or issue.
                Natural language. Instant results.
              </p>

              <div className="space-y-4 max-w-2xl">
                {AGENT_COMMANDS.map((cmd) => (
                  <div
                    key={cmd.command}
                    className="rounded-lg border border-foreground/10 bg-background/40 p-4"
                  >
                    <div className="font-mono text-sm text-green-neon mb-1.5">
                      {cmd.command}
                    </div>
                    <div className="text-xs text-foreground/35">
                      {cmd.description}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Comparison Table */}
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
                    <th className="text-foreground/50">Feature</th>
                    <th className="text-foreground/40">Dependabot</th>
                    <th className="text-foreground/40">Snyk</th>
                    <th className="text-green-neon">nanobots</th>
                  </tr>
                </thead>
                <tbody>
                  {COMPARISON.map((row) => (
                    <tr key={row.feature}>
                      <td className="text-foreground/60 font-mono text-sm">{row.feature}</td>
                      <td className="text-center">
                        <ComparisonCell value={row.dependabot} />
                      </td>
                      <td className="text-center">
                        <ComparisonCell value={row.snyk} />
                      </td>
                      <td className="text-center">
                        <ComparisonCell value={row.nanobots} isNanobots />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section id="how-it-works" className="py-24 relative">
        <div className="absolute inset-0 dot-grid opacity-30" />
        <div className="relative max-w-4xl mx-auto px-6">
          <div className="text-center mb-16">
            <h2 className="font-mono text-3xl md:text-4xl font-bold mb-4">
              Three steps. Zero config.
            </h2>
            <p className="text-foreground/50 text-lg max-w-xl mx-auto">
              No YAML files. No CI pipeline changes. No tokens to manage.
            </p>
          </div>

          <div className="space-y-12">
            {STEPS.map((step) => (
              <div
                key={step.step}
                className="flex flex-col md:flex-row gap-8 items-start"
              >
                <div className="flex-shrink-0 flex items-start gap-4 md:w-64">
                  <span className="font-mono text-4xl font-bold text-purple-accent/30">
                    {step.step}
                  </span>
                  <div>
                    <h3 className="font-mono font-semibold text-lg mb-1">
                      {step.title}
                    </h3>
                    <p className="text-sm text-foreground/45">
                      {step.description}
                    </p>
                  </div>
                </div>
                <div className="flex-1 rounded-lg border border-purple-accent/10 bg-indigo-deep/60 p-5 font-mono text-sm text-foreground/60 whitespace-pre-wrap leading-6">
                  {step.code}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing */}
      <section id="pricing" className="py-24 relative">
        <div className="absolute inset-0 dot-grid opacity-20" />
        <div className="relative max-w-5xl mx-auto px-6">
          <div className="text-center mb-16">
            <h2 className="font-mono text-3xl md:text-4xl font-bold mb-4">
              Simple pricing
            </h2>
            <p className="text-foreground/50 text-lg">
              Per active contributor. Only pay for people who push code.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* OSS */}
            <div className="rounded-xl border border-purple-accent/15 bg-indigo-deep/40 p-8">
              <div className="font-mono text-sm text-purple-accent uppercase tracking-wider mb-4">
                Open Source
              </div>
              <div className="font-mono text-4xl font-bold mb-1">$0</div>
              <div className="text-sm text-foreground/40 mb-8">
                forever free
              </div>
              <ul className="space-y-3 text-sm text-foreground/55">
                <li className="flex items-start gap-2">
                  <span className="text-green-neon mt-0.5">&#10003;</span>
                  All 7 proactive bots
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-green-neon mt-0.5">&#10003;</span>
                  Basic Watchtower (daily checks)
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-green-neon mt-0.5">&#10003;</span>
                  Unlimited public repos
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-green-neon mt-0.5">&#10003;</span>
                  Community support
                </li>
              </ul>
            </div>

            {/* Pro */}
            <div className="rounded-xl border border-green-neon/30 bg-indigo-deep/60 p-8 relative glow-box-green">
              <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-green-neon text-background text-xs font-mono font-bold px-3 py-1 rounded-full">
                Popular
              </div>
              <div className="font-mono text-sm text-green-neon uppercase tracking-wider mb-4">
                Pro
              </div>
              <div className="font-mono text-4xl font-bold mb-1">
                $19
                <span className="text-lg text-foreground/40">/contributor</span>
              </div>
              <div className="text-sm text-foreground/40 mb-8">per month</div>
              <ul className="space-y-3 text-sm text-foreground/55">
                <li className="flex items-start gap-2">
                  <span className="text-green-neon mt-0.5">&#10003;</span>
                  Everything in Open Source
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-green-neon mt-0.5">&#10003;</span>
                  Real-time Watchtower (15-min polling)
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-green-neon mt-0.5">&#10003;</span>
                  Directed response agent (@nanobots)
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-green-neon mt-0.5">&#10003;</span>
                  LLM security scanning
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-green-neon mt-0.5">&#10003;</span>
                  Slack &amp; email alerts
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-green-neon mt-0.5">&#10003;</span>
                  Private repos
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-green-neon mt-0.5">&#10003;</span>
                  Priority support
                </li>
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
              <div className="font-mono text-sm text-purple-accent uppercase tracking-wider mb-4">
                Enterprise
              </div>
              <div className="font-mono text-4xl font-bold mb-1">Custom</div>
              <div className="text-sm text-foreground/40 mb-8">
                let&apos;s talk
              </div>
              <ul className="space-y-3 text-sm text-foreground/55">
                <li className="flex items-start gap-2">
                  <span className="text-green-neon mt-0.5">&#10003;</span>
                  Everything in Pro
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-green-neon mt-0.5">&#10003;</span>
                  SSO/SCIM integration
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-green-neon mt-0.5">&#10003;</span>
                  Audit logs
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-green-neon mt-0.5">&#10003;</span>
                  Custom bot definitions
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-green-neon mt-0.5">&#10003;</span>
                  On-prem Watchtower
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-green-neon mt-0.5">&#10003;</span>
                  SLA &amp; dedicated support
                </li>
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

      {/* CTA */}
      <section className="py-24">
        <div className="max-w-3xl mx-auto px-6 text-center">
          <h2 className="font-mono text-3xl md:text-5xl font-bold mb-6 glow-purple">
            Stop cleaning up.
            <br />
            Start shipping.
          </h2>
          <p className="text-foreground/50 text-lg mb-10 max-w-lg mx-auto">
            Your repo gets cleaner with every push. Threats get caught before they
            land. And when you need help, just type @nanobots.
          </p>
          <a
            href="/api/auth/github"
            className="inline-block bg-green-neon text-background font-mono font-bold px-10 py-4 rounded-lg text-lg hover:bg-green-neon/90 transition-all hover:shadow-[0_0_40px_rgba(57,255,127,0.25)]"
          >
            Get Started &mdash; it&apos;s free
          </a>
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
            <span className="ml-2">
              &copy; {new Date().getFullYear()}
            </span>
          </div>
          <div className="flex items-center gap-6 text-sm text-foreground/30">
            <a href="/chat" className="hover:text-foreground/50 transition-colors">
              Docs
            </a>
            <a href="https://github.com/nanobots-sh" target="_blank" rel="noopener noreferrer" className="hover:text-foreground/50 transition-colors">
              GitHub
            </a>
            <a href="https://x.com/nanobots_sh" target="_blank" rel="noopener noreferrer" className="hover:text-foreground/50 transition-colors">
              Twitter
            </a>
            <a href="mailto:hello@nanobots.sh" className="hover:text-foreground/50 transition-colors">
              Privacy
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
}

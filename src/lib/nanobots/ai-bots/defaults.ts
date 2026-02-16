import type { BotDefinition } from "./types";

export const BUILT_IN_BOTS: BotDefinition[] = [
  {
    name: "security-scanner",
    description:
      "Detects hardcoded secrets, injection vulnerabilities, and OWASP Top 10 issues",
    category: "security",
    systemPrompt: `You are an expert application security auditor. Analyze source code for security vulnerabilities.

Focus on:
1. **Hardcoded secrets**: API keys, passwords, tokens, private keys. Distinguish real secrets from test fixtures/examples.
2. **Injection vulnerabilities**: SQL injection, command injection, XSS, prompt injection in LLM apps.
3. **OWASP Top 10**: Authentication flaws, broken access control, security misconfigurations.
4. **Sensitive data exposure**: PII in logs, unencrypted storage, overly permissive CORS.

For each finding, respond with JSON:
{
  "findings": [
    {
      "file": "path/to/file.ts",
      "line": 42,
      "severity": "critical|high|medium|low",
      "category": "hardcoded-secret|injection|auth|data-exposure|misconfiguration",
      "description": "What the issue is",
      "suggestion": "How to fix it"
    }
  ]
}

If no issues found, return: { "findings": [] }
Be precise. No false positives. Only flag real security concerns.
Do NOT flag test files, fixtures, or example code unless they contain real secrets.
Respond ONLY with valid JSON. No markdown fences, no explanation outside the JSON.`,
    config: {
      fileExtensions: [
        ".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs",
        ".py", ".rb", ".go", ".java", ".rs",
        ".env", ".yml", ".yaml", ".json", ".toml",
        ".sh", ".bash",
      ],
      outputFormat: "findings",
      maxFilesPerBatch: 15,
    },
    status: "active",
    source: "built-in",
  },
  {
    name: "code-quality",
    description:
      "Detects dead code, unused imports, console pollution, and code smells",
    category: "quality",
    systemPrompt: `You are a code quality expert. Analyze source code for maintainability issues.

Focus on:
1. **Dead code**: Unused exports, unreachable code, unused variables
2. **Console pollution**: console.log/debug/warn statements left from debugging (NOT intentional logging in logger utilities)
3. **Import hygiene**: Unused imports, redundant imports
4. **Code smells**: Overly complex functions (>50 lines), deeply nested logic (>4 levels), magic numbers

For each finding, respond with JSON:
{
  "findings": [
    {
      "file": "path/to/file.ts",
      "line": 42,
      "severity": "low|medium|high",
      "category": "dead-code|console-pollution|unused-import|code-smell",
      "description": "What the issue is",
      "suggestion": "How to fix it"
    }
  ]
}

If no issues found, return: { "findings": [] }
Be conservative. Only flag clear issues, not stylistic preferences.
Do NOT flag console statements in logging utilities, error handlers, or CLI tools.
Respond ONLY with valid JSON. No markdown fences, no explanation outside the JSON.`,
    config: {
      fileExtensions: [
        ".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs",
        ".py", ".rb", ".go", ".java", ".rs",
      ],
      outputFormat: "findings",
      maxFilesPerBatch: 15,
    },
    status: "active",
    source: "built-in",
  },
  {
    name: "actions-hardening",
    description:
      "Detects GitHub Actions security issues: unpinned actions, script injection, excessive permissions",
    category: "security",
    systemPrompt: `You are a GitHub Actions security expert. Analyze workflow files for security issues and hardening opportunities.

Focus on:
1. **Unpinned actions**: Actions using tags (e.g. @v4) instead of SHA pinning (e.g. @abc123...). This is critical for supply chain security.
2. **Excessive permissions**: Workflows with write-all or overly broad permissions. Use least-privilege.
3. **Script injection**: Untrusted input (github.event.*, issue titles, PR bodies) used in run: steps without sanitization.
4. **Secret exposure**: Secrets passed to steps that don't need them, or printed in logs.
5. **Missing security features**: No CODEOWNERS for workflows, no branch protection references, pull_request_target misuse.

For each finding, respond with JSON:
{
  "findings": [
    {
      "file": ".github/workflows/ci.yml",
      "line": 15,
      "severity": "critical|high|medium|low",
      "category": "unpinned-action|excessive-permissions|script-injection|secret-exposure|missing-security",
      "description": "What the issue is",
      "suggestion": "How to fix it (include the SHA-pinned version if applicable)"
    }
  ]
}

If no issues found, return: { "findings": [] }
Be precise about line numbers. Include the recommended SHA for unpinned actions when possible.
Respond ONLY with valid JSON. No markdown fences, no explanation outside the JSON.`,
    config: {
      fileExtensions: [".yml", ".yaml"],
      outputFormat: "findings",
      maxFilesPerBatch: 10,
    },
    status: "active",
    source: "built-in",
  },
  {
    name: "readme-generator",
    description:
      "Generates comprehensive README documentation from repository contents",
    category: "docs",
    systemPrompt: `You are a technical writer. Generate a comprehensive README.md for a project.

Analyze the provided source files, configuration files, and directory structure to produce a well-structured README.

Include these sections:
1. Project title and overview
2. Prerequisites and installation instructions
3. Quick start guide with runnable shell commands
4. Environment variable reference (if applicable)
5. Available scripts/commands
6. Tech stack summary
7. Directory structure overview
8. Contributing guidelines

Respond with JSON:
{
  "findings": [
    {
      "file": "README.md",
      "severity": "info",
      "category": "readme-generated",
      "description": "Generated README documentation",
      "fixedContent": "... the full markdown content ..."
    }
  ]
}

Output the full README markdown content in the fixedContent field.
Respond ONLY with valid JSON. No markdown fences around the JSON (markdown inside fixedContent is fine).`,
    config: {
      fileExtensions: [
        ".ts", ".tsx", ".js", ".jsx", ".json", ".md",
        ".yml", ".yaml", ".toml", ".env",
      ],
      outputFormat: "document",
      maxFilesPerBatch: 30,
    },
    status: "active",
    source: "built-in",
  },
  {
    name: "architecture-mapper",
    description:
      "Generates architecture documentation with Mermaid.js diagrams",
    category: "docs",
    systemPrompt: `You are an expert software architect. Analyze a codebase and generate architecture documentation with Mermaid.js diagrams.

Analyze the provided source files to understand the system architecture, then generate documentation including:
1. System overview (2-3 paragraphs)
2. Architecture diagram (Mermaid flowchart, graph TD)
3. Technology stack table
4. Key patterns and decisions
5. Request flow (Mermaid sequence diagram)
6. Key files and responsibilities

Respond with JSON:
{
  "findings": [
    {
      "file": "docs/architecture.md",
      "severity": "info",
      "category": "architecture-generated",
      "description": "Generated architecture documentation",
      "fixedContent": "... the full markdown content with Mermaid diagrams ..."
    }
  ]
}

Use proper Mermaid syntax. For flowcharts use graph TD. For sequence diagrams use sequenceDiagram.
Output the full architecture markdown in the fixedContent field.
Respond ONLY with valid JSON. No markdown fences around the JSON.`,
    config: {
      fileExtensions: [
        ".ts", ".tsx", ".js", ".jsx", ".json",
        ".yml", ".yaml", ".sql",
      ],
      outputFormat: "document",
      maxFilesPerBatch: 30,
    },
    status: "active",
    source: "built-in",
  },
  {
    name: "api-doc-generator",
    description:
      "Generates API endpoint documentation with runnable curl and fetch examples",
    category: "docs",
    systemPrompt: `You are an expert API documentation writer. Analyze source code containing API route definitions and generate comprehensive API documentation.

For each API endpoint found, document:
1. Method and path
2. Description of what it does
3. Request parameters (path params, query params) with types
4. Request body schema (from Zod schemas or TypeScript types if present)
5. Response shape with status codes
6. Authentication requirements (if detected)
7. A runnable curl example
8. A runnable Node.js fetch example

Use http://localhost:3000 as the base URL in examples.

Respond with JSON:
{
  "findings": [
    {
      "file": "docs/api/README.md",
      "severity": "info",
      "category": "api-docs-generated",
      "description": "Generated API documentation for N endpoints",
      "fixedContent": "... the full markdown content ..."
    }
  ]
}

Output the full API documentation markdown in the fixedContent field.
Respond ONLY with valid JSON. No markdown fences around the JSON.`,
    config: {
      fileExtensions: [".ts", ".tsx", ".js", ".jsx", ".json"],
      outputFormat: "document",
      maxFilesPerBatch: 20,
    },
    status: "active",
    source: "built-in",
  },
];

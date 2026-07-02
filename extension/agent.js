// BYO-model agent loop (Anthropic Messages API or any compatible endpoint)
// with client-side GitHub tools. No middleman server: the model key and the
// GitHub PAT both stay in the browser.

import { searchCode, readFile, searchIssues, listTree, defaultBranch, createIssue, logFiledIssue } from './gh.js';
import { uploadToR2, r2Configured } from './storage.js';

const TOOLS = [
  { name: 'search_code', description: 'Search the repo code. Returns matching file paths.',
    input_schema: { type: 'object', properties: { query: { type: 'string' } }, required: ['query'] } },
  { name: 'read_file', description: 'Read a file from the repo by path.',
    input_schema: { type: 'object', properties: { path: { type: 'string' } }, required: ['path'] } },
  { name: 'search_issues', description: 'Search issues and PRs (dedupe before filing!). Query uses GitHub search syntax.',
    input_schema: { type: 'object', properties: { query: { type: 'string' } }, required: ['query'] } },
  { name: 'list_files', description: 'List all file paths in the repo (truncated at 2000).',
    input_schema: { type: 'object', properties: {}, required: [] } },
  { name: 'file_report', description: 'File a report as a GitHub issue for the nanobots loop. Any screenshots the user attached in this chat are uploaded and embedded automatically.',
    input_schema: { type: 'object', properties: {
      title: { type: 'string', description: 'Specific, observable. No [bug]/[feat] prefix — added automatically.' },
      body: { type: 'string', description: 'Markdown. What happened vs expected, page URL, steps.' },
      type: { type: 'string', enum: ['bug', 'idea'] },
    }, required: ['title', 'body', 'type'] } },
];

async function runTool(cfg, nwo, name, input, attachments) {
  if (name === 'search_code') return searchCode(cfg.pat, nwo, input.query);
  if (name === 'read_file') return readFile(cfg.pat, nwo, input.path);
  if (name === 'search_issues') return searchIssues(cfg.pat, nwo, input.query);
  if (name === 'list_files') return listTree(cfg.pat, nwo, await defaultBranch(cfg.pat, nwo));

  if (name === 'file_report') {
    let imagesMd = '';
    for (const dataUrl of attachments) {
      imagesMd += `\n\n![screenshot](${await uploadToR2(cfg.r2, dataUrl)})`;
    }
    const issue = await createIssue(cfg.pat, nwo, {
      title: `[${input.type === 'bug' ? 'bug' : 'feat'}] ${input.title}`,
      body: `${input.body}${imagesMd}\n\n---\n_filed via nanobots extension chat_`,
      labels: ['nanobots:inbox', 'nanobots:ext', input.type === 'bug' ? 'bug' : 'enhancement'],
    });
    await logFiledIssue({
      nwo, number: issue.number, title: issue.title, url: issue.html_url,
      type: input.type, page: '(chat)', filedAt: new Date().toISOString(),
    });
    return { filed: true, number: issue.number, url: issue.html_url };
  }
  throw new Error(`unknown tool ${name}`);
}

// The system prompt is REPO-OWNED: the outer loop refines .nanobots/EXTENSION-PROMPT.md
// over time (better filing guidance, known duplicates, routing rules).
export async function loadSystemPrompt(cfg, nwo) {
  try {
    const text = await readFile(cfg.pat, nwo, '.nanobots/EXTENSION-PROMPT.md');
    return text.replace(/^<!--[\s\S]*?-->\s*/, '');
  } catch {
    return `You are the repo agent for ${nwo} in the nanobots browser extension. Use your tools to answer repo questions (cite paths/issues) and to file well-specified reports with file_report after checking for duplicates with search_issues.`;
  }
}

async function callModel(ai, system, messages) {
  const res = await fetch(`${ai.baseUrl.replace(/\/$/, '')}/v1/messages`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-api-key': ai.apiKey,
      'anthropic-version': '2023-06-01',
      'anthropic-dangerous-direct-browser-access': 'true',
    },
    body: JSON.stringify({ model: ai.model, max_tokens: 2000, system, tools: TOOLS, messages }),
  });
  if (!res.ok) {
    const detail = await res.json().catch(() => ({}));
    throw new Error(`model → ${res.status}: ${detail.error?.message ?? 'unknown error'}`);
  }
  return res.json();
}

// One user turn: runs the tool loop to completion.
// onEvent receives {kind: 'tool'|'text', ...} for live UI updates.
export async function chatTurn(cfg, nwo, system, history, attachments, onEvent) {
  const messages = [...history];
  for (let i = 0; i < 12; i++) {
    const resp = await callModel(cfg.ai, system, messages);
    messages.push({ role: 'assistant', content: resp.content });
    if (resp.stop_reason !== 'tool_use') {
      const text = resp.content.filter((b) => b.type === 'text').map((b) => b.text).join('\n');
      onEvent({ kind: 'text', text });
      return messages;
    }
    const results = [];
    for (const block of resp.content.filter((b) => b.type === 'tool_use')) {
      onEvent({ kind: 'tool', name: block.name, input: block.input });
      let content;
      try {
        content = JSON.stringify(await runTool(cfg, nwo, block.name, block.input, attachments));
      } catch (e) {
        content = JSON.stringify({ error: e.message });
      }
      results.push({ type: 'tool_result', tool_use_id: block.id, content });
    }
    messages.push({ role: 'user', content: results });
  }
  onEvent({ kind: 'text', text: '(stopped: too many tool rounds)' });
  return messages;
}

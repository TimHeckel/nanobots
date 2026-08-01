// BYO-model agent loop (Anthropic Messages API or any compatible endpoint)
// with client-side GitHub tools. No middleman server: the model key and the
// GitHub PAT both stay in the browser.

import { searchCode, readFile, searchIssues, listTree, defaultBranch, createIssue, logFiledIssue, tokenFor } from './gh.js';
import { uploadToR2, r2Configured } from './storage.js';

// OpenAI function-calling tool definitions (the compat lingua franca:
// OpenAI, Anthropic's compat layer, Gemini, OpenRouter, Ollama, DeepSeek…)
const TOOLS = [
  { name: 'search_code', description: 'Search the repo code. Returns matching file paths.',
    parameters: { type: 'object', properties: { query: { type: 'string' } }, required: ['query'] } },
  { name: 'read_file', description: 'Read a file from the repo by path.',
    parameters: { type: 'object', properties: { path: { type: 'string' } }, required: ['path'] } },
  { name: 'search_issues', description: 'Search issues and PRs (dedupe before filing!). Query uses GitHub search syntax.',
    parameters: { type: 'object', properties: { query: { type: 'string' } }, required: ['query'] } },
  { name: 'list_files', description: 'List all file paths in the repo (truncated at 2000).',
    parameters: { type: 'object', properties: {}, required: [] } },
  { name: 'file_report', description: 'File a report as a GitHub issue for the nanobots loop. Any screenshots the user attached in this chat are uploaded and embedded automatically.',
    parameters: { type: 'object', properties: {
      title: { type: 'string', description: 'Specific, observable. No [bug]/[feat] prefix — added automatically.' },
      body: { type: 'string', description: 'Markdown. What happened vs expected, page URL, steps.' },
      type: { type: 'string', enum: ['bug', 'idea'] },
    }, required: ['title', 'body', 'type'] } },
].map((t) => ({ type: 'function', function: t }));

async function runTool(cfg, nwo, name, input, attachments) {
  const pat = tokenFor(cfg, nwo);
  if (name === 'search_code') return searchCode(pat, nwo, input.query);
  if (name === 'read_file') return readFile(pat, nwo, input.path);
  if (name === 'search_issues') return searchIssues(pat, nwo, input.query);
  if (name === 'list_files') return listTree(pat, nwo, await defaultBranch(pat, nwo));

  if (name === 'file_report') {
    let imagesMd = '';
    for (const dataUrl of attachments) {
      imagesMd += `\n\n![screenshot](${await uploadToR2(cfg.r2, dataUrl)})`;
    }
    const issue = await createIssue(pat, nwo, {
      title: `[${input.type === 'bug' ? 'bug' : 'feat'}] ${input.title}`,
      body: `${input.body}${imagesMd}\n\n---\n_filed via nanobots extension chat_`,
      labels: ['nanobots:inbox', 'nanobots:ext', input.type === 'bug' ? 'bug' : 'enhancement'],
    });
    await logFiledIssue({
      nwo, number: issue.number, title: issue.title, url: issue.html_url,
      type: input.type, page: '(chat)', filedAt: new Date().toISOString(),
    });
    await chrome.storage.local.set({ lastRepo: nwo });
    return { filed: true, number: issue.number, url: issue.html_url };
  }
  throw new Error(`unknown tool ${name}`);
}

// The system prompt is REPO-OWNED: the outer loop refines .nanobots/EXTENSION-PROMPT.md
// over time (better filing guidance, known duplicates, routing rules).
export async function loadSystemPrompt(cfg, nwo) {
  try {
    const text = await readFile(tokenFor(cfg, nwo), nwo, '.nanobots/EXTENSION-PROMPT.md');
    return text.replace(/^<!--[\s\S]*?-->\s*/, '');
  } catch {
    return `You are the repo agent for ${nwo} in the nanobots browser extension. Use your tools to answer repo questions (cite paths/issues) and to file well-specified reports with file_report after checking for duplicates with search_issues.`;
  }
}

// True once any turn in this conversation carries an image part. Text-only models don't
// degrade on an image_url part — they hard-fail the whole request (DeepSeek answers
// "unknown variant `image_url`") — and the history keeps the image around, so once a
// screenshot is in play every subsequent turn needs the vision model too.
export function hasImage(messages) {
  return messages.some((m) => Array.isArray(m.content) && m.content.some((p) => p?.type === 'image_url'));
}

// Route per turn: vision model when a screenshot is involved, cheap text model otherwise.
// The vision endpoint may live at a different provider entirely (e.g. DeepSeek for text,
// Fireworks/Kimi for vision), so each field falls back to the primary config independently.
export function resolveModel(ai, messages) {
  if (!hasImage(messages)) return { base: ai.baseUrl, apiKey: ai.apiKey, model: ai.model, kind: 'text' };
  const v = ai.vision ?? {};
  if (!v.model) return { base: ai.baseUrl, apiKey: ai.apiKey, model: ai.model, kind: 'text-no-vision-configured' };
  return {
    base: v.baseUrl || ai.baseUrl,
    apiKey: v.apiKey || ai.apiKey,
    model: v.model,
    kind: 'vision',
  };
}

async function callModel(ai, messages) {
  const picked = resolveModel(ai, messages);
  const base = picked.base.replace(/\/$/, '').replace(/\/chat\/completions$/, '');
  const res = await fetch(`${base}/chat/completions`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      Authorization: `Bearer ${picked.apiKey}`,
    },
    body: JSON.stringify({ model: picked.model, max_tokens: 2000, tools: TOOLS, messages }),
  });
  if (!res.ok) {
    const detail = await res.json().catch(() => ({}));
    const msg = detail.error?.message ?? detail.message ?? 'unknown error';
    // The overwhelmingly common cause of a 400 here is a screenshot sent to a text-only
    // model. Say so, instead of surfacing "unknown variant `image_url`" to a user.
    if (picked.kind !== 'vision' && hasImage(messages)) {
      throw new Error(`${picked.model} can't read images (${res.status}). Set a vision model in Options → Chat agent model → vision model, e.g. Fireworks \`accounts/fireworks/models/kimi-k3\`.`);
    }
    throw new Error(`model → ${res.status}: ${msg}`);
  }
  return res.json();
}

// One user turn: runs the tool loop to completion (OpenAI chat-completions
// protocol). onEvent receives {kind: 'tool'|'text', ...} for live UI updates.
export async function chatTurn(cfg, nwo, system, history, attachments, onEvent) {
  const messages = [{ role: 'system', content: system }, ...history];
  for (let i = 0; i < 12; i++) {
    const resp = await callModel(cfg.ai, messages);
    const msg = resp.choices?.[0]?.message;
    if (!msg) throw new Error('model returned no choices');
    messages.push(msg);
    if (!msg.tool_calls?.length) {
      onEvent({ kind: 'text', text: msg.content ?? '' });
      return messages.slice(1); // drop the system message from stored history
    }
    for (const call of msg.tool_calls) {
      let input = {};
      try { input = JSON.parse(call.function.arguments || '{}'); } catch { /* tolerate bad JSON */ }
      onEvent({ kind: 'tool', name: call.function.name, input });
      let content;
      try {
        content = JSON.stringify(await runTool(cfg, nwo, call.function.name, input, attachments));
      } catch (e) {
        content = JSON.stringify({ error: e.message });
      }
      messages.push({ role: 'tool', tool_call_id: call.id, content });
    }
  }
  onEvent({ kind: 'text', text: '(stopped: too many tool rounds)' });
  return messages.slice(1);
}

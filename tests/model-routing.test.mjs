// Tests for the extension's dynamic text/vision model routing (extension/agent.js).
// Screenshots are the extension's whole point, and text-only models don't degrade on an
// image part — they hard-fail the request — so picking the wrong model is a broken feature,
// not a quality regression.

import { hasImage, resolveModel } from '../extension/agent.js';

let passed = 0;
const fails = [];
const ok = (c, l) => { if (c) passed++; else fails.push(l); };
const eq = (a, b, l) => ok(JSON.stringify(a) === JSON.stringify(b), `${l} — got ${JSON.stringify(a)}, want ${JSON.stringify(b)}`);

const TEXT = { apiKey: 'k-text', baseUrl: 'https://api.deepseek.com', model: 'deepseek-v4-flash' };
const WITH_VISION = { ...TEXT, vision: { apiKey: 'k-vis', baseUrl: 'https://api.fireworks.ai/inference/v1', model: 'accounts/fireworks/models/kimi-k3' } };

const textTurn = [{ role: 'user', content: 'hello' }];
const imgTurn = [{ role: 'user', content: [{ type: 'text', text: 'look' }, { type: 'image_url', image_url: { url: 'data:image/png;base64,AAAA' } }] }];
const laterTurn = [...imgTurn, { role: 'assistant', content: 'I see it' }, { role: 'user', content: 'and now?' }];

// ── detection ────────────────────────────────────────────────────────────────
ok(!hasImage(textTurn), 'plain string content is not an image turn');
ok(hasImage(imgTurn), 'image_url part is detected');
ok(!hasImage([{ role: 'user', content: [{ type: 'text', text: 'x' }] }]), 'array content without an image is not an image turn');
ok(hasImage(laterTurn), 'an image earlier in history still counts — it stays in the payload');
ok(!hasImage([]), 'empty history is not an image turn');
ok(!hasImage([{ role: 'user' }]), 'missing content does not throw');

// ── routing ──────────────────────────────────────────────────────────────────
eq(resolveModel(WITH_VISION, textTurn).model, 'deepseek-v4-flash', 'text turn uses the cheap text model');
eq(resolveModel(WITH_VISION, textTurn).kind, 'text', 'text turn is labelled text');
eq(resolveModel(WITH_VISION, imgTurn).model, 'accounts/fireworks/models/kimi-k3', 'image turn switches to the vision model');
eq(resolveModel(WITH_VISION, imgTurn).apiKey, 'k-vis', 'image turn uses the vision provider key');
eq(resolveModel(WITH_VISION, imgTurn).base, 'https://api.fireworks.ai/inference/v1', 'image turn uses the vision base url');
eq(resolveModel(WITH_VISION, laterTurn).kind, 'vision', 'follow-up turns stay on vision while the image is in history');

// Switching back matters for cost: a fresh text-only conversation must not pay vision rates.
eq(resolveModel(WITH_VISION, [{ role: 'user', content: 'new topic' }]).kind, 'text', 'routes back to text when no image is present');

// ── fallbacks ────────────────────────────────────────────────────────────────
eq(resolveModel(TEXT, imgTurn).kind, 'text-no-vision-configured', 'no vision configured → falls back and says so (caller turns this into a clear error)');
eq(resolveModel(TEXT, imgTurn).model, 'deepseek-v4-flash', 'fallback uses the primary model');
{
  // "Same provider, bigger model" should need only the model field.
  const sameProvider = { ...TEXT, vision: { model: 'deepseek-vl' } };
  const r = resolveModel(sameProvider, imgTurn);
  eq(r.model, 'deepseek-vl', 'vision model alone is enough');
  eq(r.apiKey, 'k-text', 'blank vision key reuses the primary key');
  eq(r.base, 'https://api.deepseek.com', 'blank vision base url reuses the primary base url');
  eq(r.kind, 'vision', 'partial vision config still routes as vision');
}
eq(resolveModel({ ...TEXT, vision: { model: '' } }, imgTurn).kind, 'text-no-vision-configured', 'empty vision model is treated as unconfigured');

if (fails.length) {
  console.error(`FAILED ${fails.length}:`);
  for (const f of fails) console.error(`  ✗ ${f}`);
  process.exit(1);
}
console.log(`ok — ${passed} model-routing tests passed`);

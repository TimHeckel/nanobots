// Screenshot storage: Cloudflare R2, via Cloudflare's REST API (plain bearer
// token — no S3 signing, no SDK). The issue is the canonical record; the PNG
// lives in the bucket and the issue embeds its public URL. Git stays
// binary-free by design.
//
// NOTE: the object URL is only as private as your bucket's public domain.

export function r2Configured(r2) {
  return Boolean(r2?.accountId && r2?.bucket && r2?.token && r2?.publicBase);
}

// ── "Connect Cloudflare": from ONE pasted token, provision everything else —
// resolve the account, create the bucket if missing, enable the r2.dev public
// domain, and return the four config values.

async function cf(token, method, path, body) {
  const res = await fetch(`https://api.cloudflare.com/client/v4${path}`, {
    method,
    headers: { Authorization: `Bearer ${token}`, 'content-type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  });
  const j = await res.json().catch(() => ({}));
  if (!res.ok || j.success === false) {
    throw new Error(`${method} ${path} → ${res.status}: ${j.errors?.[0]?.message ?? 'unknown error'}`);
  }
  return j.result;
}

export async function r2AutoSetup(token, bucket, onStep, accountIdHint = '') {
  let accountId = accountIdHint.trim();
  if (!accountId) {
    onStep('resolving account…');
    // Requires the token to carry "Account Settings: Read"; if the token is
    // R2-only this 403s and the caller asks for the account id (one paste).
    const accounts = await cf(token, 'GET', '/accounts').catch(() => null);
    if (!accounts?.length) throw new Error('NEED_ACCOUNT_ID');
    if (accounts.length > 1) throw new Error('NEED_ACCOUNT_ID'); // ambiguous — user picks
    accountId = accounts[0].id;
  }

  onStep('checking bucket…');
  const existing = await cf(token, 'GET', `/accounts/${accountId}/r2/buckets?per_page=100`).catch(() => null);
  const names = (existing?.buckets ?? existing ?? []).map((b) => b.name);
  if (!names.includes(bucket)) {
    onStep(`creating bucket "${bucket}"…`);
    await cf(token, 'POST', `/accounts/${accountId}/r2/buckets`, { name: bucket });
  }

  onStep('enabling public r2.dev domain…');
  const managed = await cf(token, 'PUT', `/accounts/${accountId}/r2/buckets/${bucket}/domains/managed`, { enabled: true });
  const domain = managed?.domain;
  if (!domain) throw new Error('could not enable the r2.dev public domain — enable it in the dashboard');

  return { accountId, bucket, token, publicBase: `https://${domain}` };
}

export async function uploadToR2({ accountId, bucket, token, publicBase }, dataUrl) {
  const ts = new Date().toISOString().replace(/[:.]/g, '-');
  const key = `nanobots-shots/${ts}.png`;
  const bytes = Uint8Array.from(atob(dataUrl.split(',')[1]), (c) => c.charCodeAt(0));
  const res = await fetch(
    `https://api.cloudflare.com/client/v4/accounts/${accountId}/r2/buckets/${bucket}/objects/${encodeURIComponent(key)}`,
    {
      method: 'PUT',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'image/png' },
      body: bytes,
    },
  );
  if (!res.ok) {
    const detail = await res.json().catch(() => ({}));
    throw new Error(`R2 upload → ${res.status}: ${detail.errors?.[0]?.message ?? 'unknown error'}`);
  }
  return `${publicBase.replace(/\/$/, '')}/${key}`;
}

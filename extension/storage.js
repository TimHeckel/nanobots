// Screenshot storage adapters. The issue is always the canonical record;
// this only decides where the PNG bytes live.
//
//  repo (default) — commit into .nanobots/inbox/shots/ via the GitHub contents
//    API. Zero extra config (same PAT), renders for anyone with repo access,
//    so private repos stay private. The loop may prune old shots.
//  r2 — PUT to a Cloudflare R2 bucket via Cloudflare's REST API (plain bearer
//    token, no S3 signing). For repos that don't want binaries in git.
//    NOTE: the object URL is only as private as your bucket's public domain.

function shotKey() {
  const ts = new Date().toISOString().replace(/[:.]/g, '-');
  return `nanobots-shots/${ts}.png`;
}

export async function uploadToRepo({ pat, nwo, branch }, dataUrl, ghPut) {
  const path = `.nanobots/inbox/shots/${shotKey().split('/')[1]}`;
  await ghPut(pat, `/repos/${nwo}/contents/${path}`, {
    message: 'nanobots: screenshot for incoming report',
    content: dataUrl.split(',')[1],
    branch,
  });
  return `https://github.com/${nwo}/blob/${branch}/${encodeURI(path)}?raw=true`;
}

export async function uploadToR2({ accountId, bucket, token, publicBase }, dataUrl) {
  const key = shotKey();
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

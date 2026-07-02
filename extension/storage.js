// Screenshot storage: Cloudflare R2, via Cloudflare's REST API (plain bearer
// token — no S3 signing, no SDK). The issue is the canonical record; the PNG
// lives in the bucket and the issue embeds its public URL. Git stays
// binary-free by design.
//
// NOTE: the object URL is only as private as your bucket's public domain.

export function r2Configured(r2) {
  return Boolean(r2?.accountId && r2?.bucket && r2?.token && r2?.publicBase);
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

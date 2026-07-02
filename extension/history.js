import { getConfig, getFiledIssues, hydrateIssueState } from './gh.js';

const $ = (id) => document.getElementById(id);
const esc = (s) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

(async function boot() {
  const filed = await getFiledIssues();
  if (filed.length === 0) {
    $('empty').hidden = false;
    return;
  }
  $('table').hidden = false;
  $('count').textContent = `${filed.length} report${filed.length === 1 ? '' : 's'} filed from this browser — refreshing live state…`;

  const render = (entries) => {
    $('rows').innerHTML = entries.map((e) => `
      <tr>
        <td><a href="${esc(e.url)}" target="_blank">${esc(e.nwo)}#${e.number}</a><br>${esc(e.title)}</td>
        <td>${e.type === 'bug' ? '🐛 bug' : '💡 feature'}</td>
        <td class="state-${e.state ?? 'open'}">${e.state ?? '…'}${e.comments ? ` · ${e.comments}💬` : ''}
          ${e.labels?.length ? `<div class="labels">${e.labels.map(esc).join(', ')}</div>` : ''}</td>
        <td>${e.page === '(chat)' ? '<span class="dim">via chat</span>' : `<a href="${esc(e.page)}" target="_blank">${esc(new URL(e.page).pathname)}</a>`}</td>
        <td class="dim">${e.filedAt.slice(0, 10)}</td>
      </tr>`).join('');
  };
  render(filed);

  const { pat } = await getConfig();
  if (pat) {
    const live = await hydrateIssueState(pat, filed);
    render(live);
    $('count').textContent = `${filed.length} report${filed.length === 1 ? '' : 's'} filed from this browser · ${live.filter((e) => e.state === 'open').length} still open`;
  }
})();

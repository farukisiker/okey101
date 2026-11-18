import { REASON_CODES, type AdminPhotoItem, type AdminReportItem, type PhotoStatus } from './types';

export function escapeHtml(s: string): string {
  return s.replace(/[&<>"'`]/g, (c) => `&#${c.charCodeAt(0)};`);
}

export const ADMIN_STATUSES: readonly PhotoStatus[] = ['review', 'pending', 'approved', 'rejected'];

/**
 * Security model of the review page:
 * - GET /admin without a valid Bearer header returns 401 + the page shell (no data) with a token field.
 * - The token is kept in sessionStorage only and sent as an Authorization header by fetch(); it is never put in a URL,
 *   cookie or the HTML.
 * - The shell fetches GET /admin again with the header; the server renders the list with every user string escaped,
 *   and the shell swaps in the #list element (parsed with DOMParser: inline scripts never run; CSP blocks them anyway).
 * - Images are fetched with the header and shown through blob: URLs.
 */
function renderReports(reports: AdminReportItem[]): string {
  if (reports.length === 0) return '<p>Açık şikâyet yok.</p>';
  const counts = (o: Record<string, number | undefined>) =>
    Object.entries(o)
      .map(([k, n]) => `${escapeHtml(k)}: ${n}`)
      .join(', ') || '-';
  return reports
    .map((r) => {
      const id = escapeHtml(r.targetAccountId);
      const name = r.displayName === null ? '<i>(isimsiz)</i>' : escapeHtml(r.displayName);
      const ban = r.voiceBannedUntil === null ? 'yok' : escapeHtml(new Date(r.voiceBannedUntil).toISOString());
      return `<li class="item" data-account="${id}">
  <div class="meta"><b>${name}</b><br><code>${id}</code><br>şikâyet: ${r.count} | farklı kişi: ${r.reporters}<br>sebep: ${counts(r.reasons)}<br>yer: ${counts(r.contexts)}<br>son: ${escapeHtml(new Date(r.lastAt).toISOString())} | ses yasağı: ${ban}</div>
  <div class="actions"><button type="button" data-close="${id}">Kapat (yasağı kaldır)</button></div>
</li>`;
    })
    .join('\n');
}

/**
 * `tab: 'reports'` (E2) shows the open reports of the last 7 days grouped by target instead of the photo queue;
 * `reports` null = not signed in.
 */
export function renderAdminPage(opts: {
  nonce: string;
  status: PhotoStatus;
  items: AdminPhotoItem[] | null;
  tab?: 'photos' | 'reports';
  reports?: AdminReportItem[] | null;
}): string {
  const { nonce, status } = opts;
  const onReports = opts.tab === 'reports';
  const items = onReports ? null : opts.items;
  const signedIn = onReports ? (opts.reports ?? null) !== null : items !== null;
  const query = onReports ? '?tab=reports' : `?status=${status}`;
  const tabs =
    ADMIN_STATUSES.map((s) => `<a href="?status=${s}"${!onReports && s === status ? ' aria-current="page"' : ''}>${s}</a>`).join(' ') +
    ` <a href="?tab=reports"${onReports ? ' aria-current="page"' : ''}>Şikâyetler</a>`;
  const reasonOptions = REASON_CODES.map((r) => `<option value="${r}">${r}</option>`).join('');
  const list = onReports
    ? opts.reports
      ? renderReports(opts.reports)
      : '<p>Giriş gerekli.</p>'
    : items === null
      ? '<p>Giriş gerekli.</p>'
      : items.length === 0
        ? '<p>Kuyruk boş.</p>'
        : items
            .map((it) => {
              const id = escapeHtml(it.accountId);
              const name = it.displayName === null ? '<i>(isimsiz)</i>' : escapeHtml(it.displayName);
              const reasons = it.reasons.length ? escapeHtml(it.reasons.join(', ')) : '-';
              const when = escapeHtml(new Date(it.uploadedAt).toISOString());
              return `<li class="item" data-account="${id}">
  <img data-account="${id}" alt="" width="128" height="128">
  <div class="meta"><b>${name}</b><br><code>${id}</code><br>durum: ${escapeHtml(it.status)} | sebep: ${reasons}<br>${when}</div>
  <div class="actions">
    <button type="button" data-decision="approve" data-account="${id}">Onayla</button>
    <select data-reason-for="${id}">${reasonOptions}</select>
    <button type="button" data-decision="reject" data-account="${id}">Reddet</button>
  </div>
</li>`;
            })
            .join('\n');

  return `<!doctype html>
<html lang="tr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="referrer" content="no-referrer">
<title>Kahve foto inceleme</title>
<style nonce="${nonce}">
body{font:16px system-ui,sans-serif;margin:16px;background:#faf7f2;color:#222}
nav a{margin-right:8px}nav a[aria-current]{font-weight:bold}
ul{list-style:none;padding:0}.item{display:flex;gap:12px;align-items:center;border-bottom:1px solid #ddd;padding:8px 0;flex-wrap:wrap}
img{background:#ccc;border-radius:8px;object-fit:cover}button{font-size:16px;padding:6px 12px}
#login[hidden]{display:none}#msg{color:#a00}
</style></head>
<body data-query="${escapeHtml(query)}">
<h1>${onReports ? 'Şikâyetler' : 'Profil fotoğrafı inceleme'}</h1>
<form id="login"${signedIn ? ' hidden' : ''}><label>Admin token <input id="token" type="password" autocomplete="off" required></label> <button>Giriş</button></form>
<p id="msg"></p>
<nav>${tabs} <button type="button" id="logout">Çıkış</button></nav>
<ul id="list">${list}</ul>
<script nonce="${nonce}">
(function () {
  var KEY = 'kahveAdminToken';
  function getT() { try { return sessionStorage.getItem(KEY); } catch (e) { return null; } }
  function setT(v) { try { if (v) sessionStorage.setItem(KEY, v); else sessionStorage.removeItem(KEY); } catch (e) {} }
  var query = document.body.getAttribute('data-query');
  var msg = document.getElementById('msg');
  var login = document.getElementById('login');
  var blobs = [];
  function auth() { return { authorization: 'Bearer ' + getT() }; }
  function showLogin(text) { login.hidden = false; msg.textContent = text || ''; }
  async function loadImages() {
    blobs.forEach(function (u) { URL.revokeObjectURL(u); }); blobs = [];
    var imgs = document.querySelectorAll('#list img[data-account]');
    for (var i = 0; i < imgs.length; i++) {
      var img = imgs[i];
      try {
        var r = await fetch('/admin/v1/photos/' + encodeURIComponent(img.getAttribute('data-account')) + '/image', { headers: auth(), cache: 'no-store' });
        if (!r.ok) continue;
        var u = URL.createObjectURL(await r.blob()); blobs.push(u); img.src = u;
      } catch (e) {}
    }
  }
  async function load() {
    if (!getT()) { showLogin(); return; }
    var r = await fetch('/admin' + query, { headers: auth(), cache: 'no-store' });
    if (r.status === 401) { setT(null); showLogin('Token geçersiz.'); return; }
    var doc = new DOMParser().parseFromString(await r.text(), 'text/html');
    var fresh = doc.getElementById('list');
    if (fresh) document.getElementById('list').replaceWith(document.importNode(fresh, true));
    login.hidden = true; msg.textContent = '';
    loadImages();
  }
  login.addEventListener('submit', function (e) {
    e.preventDefault();
    var input = document.getElementById('token');
    setT(input.value); input.value = ''; load();
  });
  document.getElementById('logout').addEventListener('click', function () { setT(null); location.reload(); });
  document.addEventListener('click', async function (e) {
    var c = e.target.closest && e.target.closest('button[data-close]');
    if (c) {
      c.disabled = true;
      var rc = await fetch('/admin/v1/reports/' + encodeURIComponent(c.getAttribute('data-close')) + '/close', { method: 'POST', headers: auth() });
      if (!rc.ok) msg.textContent = 'Hata: ' + rc.status;
      load();
      return;
    }
    var b = e.target.closest && e.target.closest('button[data-decision]');
    if (!b) return;
    var id = b.getAttribute('data-account');
    var body = { decision: b.getAttribute('data-decision') };
    if (body.decision === 'reject') {
      var sel = document.querySelector('select[data-reason-for="' + CSS.escape(id) + '"]');
      if (sel) body.reason = sel.value;
    }
    b.disabled = true;
    var r = await fetch('/admin/v1/photos/' + encodeURIComponent(id) + '/decision', {
      method: 'POST', headers: Object.assign({ 'content-type': 'application/json' }, auth()), body: JSON.stringify(body)
    });
    if (!r.ok) msg.textContent = 'Hata: ' + r.status;
    load();
  });
  if (login.hidden) loadImages(); else if (getT()) load();
})();
</script>
</body></html>`;
}

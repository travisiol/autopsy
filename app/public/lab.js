// Autopsy : le vrai labo côté page.
// Lecture d'un wallet (n'importe quelle adresse), rapport réel, tiroir de la morgue (choix des corps),
// connexion du wallet (Wallet Standard, sans bibliothèque), signature groupée, flacon qui se remplit en direct.

const CHAIN = 'solana:mainnet';
const VIGIL = 'https://vigil-eight-ecru.vercel.app';
const $ = (s, r = document) => r.querySelector(s);
const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const short = (a) => a.slice(0, 4) + '…' + a.slice(-4);
const sol = (l, d = 3) => (l / 1e9).toFixed(d);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const month = (t) => new Date(t).toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
const safeImg = (u) => (typeof u === 'string' && /^(https:\/\/|data:image\/)/.test(u) ? u : '');
const b64ToBytes = (s) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));
const bytesToB64 = (b) => { let s = ''; for (let i = 0; i < b.length; i += 0x8000) s += String.fromCharCode(...b.subarray(i, i + 0x8000)); return btoa(s); };
const FEE_BPS = 500;
const tick = (b) => (b.symbol ? '$' + b.symbol.replace(/^\$+/, '') : short(b.mint)).slice(0, 14);
const feeOf = (l) => Math.floor((l * FEE_BPS) / 10000);

const CAUSE = {
  NEVER_BONDED: 'Never bonded',
  BUNDLED: 'Bundled launch',
  DEV_DUMPED: 'Dev dumped',
  SERIAL_DEV: 'Serial dev',
  RUGGED: 'Rug (liquidity pulled)',
  BLED_OUT: 'Bled out',
  STILLBORN: 'Stillborn (never traded)',
  DUST: 'Crumbs (worth pennies)',
  EMPTY: 'Empty (sold, rent left behind)',
};
const SHORT = { NEVER_BONDED: 'NEVER BONDED', BUNDLED: 'BUNDLED', DEV_DUMPED: 'DEV DUMPED', SERIAL_DEV: 'SERIAL DEV', RUGGED: 'RUG', BLED_OUT: 'BLED OUT', STILLBORN: 'STILLBORN', DUST: 'CRUMBS', EMPTY: 'EMPTY' };
const TYPE = {
  NEVER_BONDED: 'Curve tourist',
  BUNDLED: 'Bundle magnet',
  DEV_DUMPED: "Dev's favourite",
  SERIAL_DEV: 'Serial victim',
  RUGGED: 'Exit liquidity',
  BLED_OUT: 'Diamond hands',
  STILLBORN: 'Ghost buyer',
  DUST: 'Crumb collector',
  EMPTY: 'Paper hands',
};

// ---------- wallets (Wallet Standard)
const wallets = [];
const reg = { register: (...ws) => { ws.forEach((w) => { if (!wallets.includes(w)) wallets.push(w); }); if (mode === 'wallets') render(); return () => {}; } };
window.addEventListener('wallet-standard:register-wallet', (e) => { try { e.detail(reg); } catch {} });
window.dispatchEvent(new CustomEvent('wallet-standard:app-ready', { detail: reg }));
const usable = () => wallets.filter((w) => w.features && w.features['standard:connect'] && w.features['solana:signTransaction'] && (w.chains || []).some((c) => c.startsWith('solana:')));

let wallet = null, account = null, rep = null, vig = {}, sel = new Set(), busy = false, msg = '', mode = null, afterConnect = null, lastBury = null;
const causeOf = (b) => vig[b.mint] || b.cause;

const api = async (url, body) => {
  const r = await fetch(url, body ? { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) } : { cache: 'no-store' });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(j.error || 'Server error');
  return j;
};

// ---------- styles du tiroir et de l'étiquette d'état
const css = document.createElement('style');
css.textContent = `
.ls-back{position:fixed;inset:0;z-index:80;display:none;align-items:center;justify-content:center;padding:16px;background:rgba(3,8,6,.72);backdrop-filter:blur(6px)}
.ls-back.on{display:flex}
.ls{width:min(620px,100%);max-height:calc(100vh - 32px);display:flex;flex-direction:column;border-radius:14px;overflow:hidden;box-shadow:0 30px 80px rgba(0,0,0,.6);background:#1A2620}
.ls-plate{position:relative;display:flex;align-items:center;gap:14px;padding:16px 20px;background:linear-gradient(180deg,#EEF3EC,#A9B7AD 45%,#5E6E64);color:#1C2A24;border-bottom:2px solid #3E4C44}
.ls-plate b{font:800 15px/1 var(--disp);letter-spacing:.04em}
.ls-plate span{font:700 10px var(--mono);letter-spacing:.2em;opacity:.75}
.ls-plate .scr{width:10px;height:10px;border-radius:50%;background:#6F7F75;box-shadow:inset 0 1px 2px rgba(0,0,0,.5)}
.ls-plate button{margin-left:auto;width:34px;height:34px;border:2px solid #3E4C44;border-radius:50%;background:transparent;color:#1C2A24;font:700 18px/1 var(--mono);cursor:pointer}
.ls-paper{position:relative;display:flex;flex-direction:column;min-height:0;padding:20px 22px 22px;background:var(--paper);color:var(--ink);font-family:var(--tw)}
.ls-paper::before{content:"";position:absolute;left:12px;top:0;bottom:0;border-left:1.5px solid rgba(47,174,74,.22)}
.ls-bar{display:flex;justify-content:space-between;align-items:baseline;gap:10px;padding-bottom:10px;border-bottom:2px solid var(--ink);font-size:13px;letter-spacing:.08em}
.ls-bar button{border:0;background:none;color:var(--marker);font:700 20px var(--hand);cursor:pointer;padding:0 0 0 10px}
.ls-list{overflow:auto;min-height:120px;max-height:46vh;margin:0 -6px;padding:4px 6px;overscroll-behavior:contain}
.ls-b{display:grid;grid-template-columns:22px 30px minmax(0,1fr) auto 62px;align-items:center;gap:10px;padding:8px 0;border-bottom:1px dotted rgba(20,38,29,.35);cursor:pointer}
.ls-b input{position:absolute;opacity:0;pointer-events:none}
.ls-ck{width:20px;height:20px;border:2px solid var(--ink);border-radius:3px;display:grid;place-items:center;font:700 24px/1 var(--hand);color:var(--marker)}
.ls-b input:checked + .ls-ck::after{content:"✓";transform:translate(2px,-3px) rotate(-6deg)}
.ls-b input:focus-visible + .ls-ck{outline:2px solid var(--marker);outline-offset:2px}
.ls-b img,.ls-b .cx{width:30px;height:30px;border-radius:50%;object-fit:cover;background:#C9D6C2;filter:grayscale(1) contrast(1.05)}
.ls-b .nm{min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:15px;font-weight:700}
.ls-b .nm small{font-weight:400;font-size:12px;opacity:.65;margin-left:6px}
.ls-b .cz{font:700 10px var(--mono);letter-spacing:.12em;padding:3px 6px;border:1.5px solid currentColor;border-radius:3px;color:#2E7A3E;white-space:nowrap}
.ls-b .rt{text-align:right;font-size:13px}
.ls-sub{margin:16px 0 4px;padding-top:12px;border-top:2px solid var(--ink);font-size:12px;letter-spacing:.1em}
.ls-sub small{font-size:12px;letter-spacing:0;opacity:.7}
.ls-foot{margin-top:14px;padding-top:12px;border-top:2px dashed rgba(20,38,29,.35)}
.ls-tot{display:flex;justify-content:space-between;font-size:14px;margin-top:4px}
.ls-tot.big{font:800 22px var(--disp);letter-spacing:-.02em;margin-top:8px}
.ls-go{width:100%;margin-top:14px;background:#111;color:#F7F4EA;box-shadow:none}
.ls-go:hover{background:#000}
.ls-go[disabled]{opacity:.5;cursor:default}
.ls-msg{min-height:20px;margin-top:10px;font:700 21px/1.1 var(--hand);color:var(--marker);text-align:center}
.ls-w{display:flex;align-items:center;gap:14px;width:100%;padding:12px 4px;border:0;border-bottom:1px dotted rgba(20,38,29,.35);background:none;color:var(--ink);font:700 17px var(--tw);cursor:pointer;text-align:left}
.ls-w img{width:32px;height:32px;border-radius:8px}
.ls-w span{margin-left:auto;font:700 20px var(--hand);color:var(--marker)}
.ls-w:hover{background:rgba(47,174,74,.08)}
.ls-note{margin:14px 0 0;font-size:13px;opacity:.75}
.ls-alt{display:block;margin:10px auto 0;border:0;background:none;color:var(--marker);font:700 20px var(--hand);cursor:pointer;text-decoration:underline}
.lab-tag{position:fixed;left:50%;bottom:22px;z-index:70;display:none;align-items:center;gap:14px;padding:12px 20px 12px 40px;transform:translateX(-50%) rotate(-1.5deg);background:#F2EFE4;color:#2B2B26;font:700 13px var(--tw);letter-spacing:.08em;border-radius:6px 22px 22px 6px;box-shadow:0 14px 34px rgba(0,0,0,.5);white-space:nowrap}
.lab-tag.on{display:flex}
.lab-tag::before{content:"";position:absolute;left:14px;top:50%;width:12px;height:12px;margin-top:-6px;border-radius:50%;background:#06100D;box-shadow:0 0 0 3px #C9C4B4}
.lab-tag b{font:800 16px var(--disp);letter-spacing:-.02em;color:#111}
.lab-tag a{color:#2E7A3E}
.lab-tag button{border:0;background:none;font:700 16px var(--mono);cursor:pointer;color:#55544b}
#xShare{margin-top:26px}
@media (max-width:600px){.ls-b{grid-template-columns:22px 26px minmax(0,1fr) 56px}.ls-b .cz{display:none}.lab-tag{max-width:calc(100vw - 24px);font-size:11px}}
`;
document.head.appendChild(css);

const back = document.createElement('div');
back.className = 'ls-back';
back.setAttribute('data-lenis-prevent', '');
back.innerHTML = '<div class="ls" role="dialog" aria-modal="true"></div>';
document.body.appendChild(back);
const sheet = back.firstChild;
const tag = document.createElement('div');
tag.className = 'lab-tag';
tag.setAttribute('aria-live', 'polite');
document.body.appendChild(tag);

// une ligne du tiroir (nom, logo, cause : tout ce qui vient du token est échappé)
function row(b) {
  const c = causeOf(b), img = safeImg(b.image);
  return `<label class="ls-b"><input type="checkbox" data-acc="${esc(b.account)}" ${sel.has(b.account) ? 'checked' : ''} ${busy ? 'disabled' : ''}><span class="ls-ck"></span>${img ? `<img src="${esc(img)}" alt="" loading="lazy" referrerpolicy="no-referrer">` : '<svg class="cx" viewBox="0 0 40 40" aria-hidden="true"><use href="#coinx"/></svg>'}<span class="nm">${esc(tick(b))}${b.name ? `<small>${esc(b.name)}</small>` : ''}</span><span class="cz">${SHORT[c]}</span><span class="rt">${sol(b.lamports, 4)}</span></label>`;
}

const plate = (t, s) => `<div class="ls-plate"><i class="scr"></i><div><b>${t}</b><br><span>${s}</span></div><button type="button" data-a="close" aria-label="Close">×</button></div>`;

function render() {
  if (mode === 'wallets') {
    const ws = usable();
    sheet.innerHTML = plate('VISITOR LOG', 'CONNECT TO THE LAB') + `<div class="ls-paper">
      ${ws.length ? ws.map((w, i) => `<button type="button" class="ls-w" data-w="${i}">${safeImg(w.icon) ? `<img src="${esc(safeImg(w.icon))}" alt="">` : ''}${esc(w.name)}<span>sign in →</span></button>`).join('')
        : '<p>No Solana wallet found in this browser. Install Phantom, Solflare or Backpack, then reload the page.</p>'}
      <p class="ls-note">Reading your wallet is free. Nothing moves until you press Bury and sign.</p>
      <div class="ls-msg">${esc(msg)}</div></div>`;
    return;
  }
  if (mode === 'morgue') {
    const bodies = rep ? rep.bodies : [], crumbs = rep ? rep.crumbs : [];
    const picked = [...bodies, ...crumbs].filter((b) => sel.has(b.account));
    const lam = picked.reduce((s, b) => s + b.lamports, 0), fee = feeOf(lam);
    const own = account && rep && account.address === rep.wallet;
    let action;
    if (!picked.length) action = `<button type="button" class="btn ls-go" disabled>Pick at least one body</button>`;
    else if (!account) action = `<button type="button" class="btn ls-go" data-a="connect">Connect wallet to bury</button>`;
    else if (!own) action = `<button type="button" class="btn ls-go" data-a="mine">Autopsy my own wallet</button><p class="ls-note">This report belongs to ${esc(short(rep.wallet))}. Only its owner can bury these bodies.</p>`;
    else action = `<button type="button" class="btn ls-go" data-a="bury" ${busy ? 'disabled' : ''}>${busy ? 'Working…' : `Bury ${picked.length} ${picked.length === 1 ? 'body' : 'bodies'}`}</button>`;
    sheet.innerHTML = plate('MORGUE · DRAWER 03', `CASE #${caseNo()} · ${esc(short(rep.wallet))}`) + `<div class="ls-paper">
      <div class="ls-bar"><span>${picked.length} / ${bodies.length + crumbs.length} SELECTED</span><span><button type="button" data-a="all">all</button><button type="button" data-a="none">none</button></span></div>
      <div class="ls-list">${bodies.map(row).join('') || '<p>No dead tokens in this wallet.</p>'}${crumbs.length ? `<div class="ls-sub">CRUMBS · ${crumbs.length} live token${crumbs.length > 1 ? 's' : ''}, worth less than a cent each<br><small>Not dead, so not ticked. Tick them to get their rent back too.</small></div>${crumbs.map(row).join('')}` : ''}</div>
      <div class="ls-foot">
        <div class="ls-tot"><span>RENT RECOVERED</span><span>${sol(lam)} SOL</span></div>
        <div class="ls-tot"><span>FEE 5%</span><span>−${sol(fee)} SOL</span></div>
        <div class="ls-tot big"><span>YOU GET</span><span>${sol(lam - fee)} SOL</span></div>
        ${action}
        <div class="ls-msg">${esc(msg)}</div>
      </div></div>`;
  }
}

function openSheet(m) { mode = m; msg = ''; render(); back.classList.add('on'); }
function closeSheet() { if (busy) return; back.classList.remove('on'); mode = null; }
back.addEventListener('click', (e) => { if (e.target === back) closeSheet(); });
// un logo de token qui ne charge pas : la pièce morte prend sa place
sheet.addEventListener('error', (e) => {
  const t = e.target;
  if (t.tagName !== 'IMG' || !t.closest('.ls-b')) return;
  t.outerHTML = '<svg class="cx" viewBox="0 0 40 40" aria-hidden="true"><use href="#coinx"/></svg>';
}, true);
document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeSheet(); });
sheet.addEventListener('change', (e) => {
  const a = e.target.dataset && e.target.dataset.acc; if (!a) return;
  if (e.target.checked) sel.add(a); else sel.delete(a);
  const keep = sheet.querySelector('.ls-list').scrollTop; render(); sheet.querySelector('.ls-list').scrollTop = keep;
});
sheet.addEventListener('click', (e) => {
  const t = e.target.closest('button'); if (!t) return;
  const a = t.dataset.a;
  if (a === 'close') return closeSheet();
  if (t.dataset.w) return connect(usable()[Number(t.dataset.w)]);
  if (a === 'all') { [...rep.bodies, ...rep.crumbs].forEach((b) => sel.add(b.account)); return render(); }
  if (a === 'none') { sel.clear(); return render(); }
  if (a === 'connect') return openWallets(() => openSheet('morgue'));
  if (a === 'mine') { closeSheet(); return run(account.address); }
  if (a === 'bury') return bury();
});

// ---------- connexion
function openWallets(then) { afterConnect = then || null; openSheet('wallets'); }
async function connect(w) {
  msg = '';
  try {
    const { accounts } = await w.features['standard:connect'].connect();
    const acc = (accounts || w.accounts || []).find((x) => (x.chains || []).some((c) => c.startsWith('solana:'))) || (accounts || [])[0];
    if (!acc) throw new Error('no account');
    wallet = w; account = acc;
  } catch { msg = 'Connection cancelled.'; render(); return; }
  document.querySelectorAll('header [data-connect], .nav [data-connect]').forEach((b) => (b.textContent = short(account.address)));
  const then = afterConnect; afterConnect = null;
  back.classList.remove('on'); mode = null;
  if (then) then(); else run(account.address);
}

// ---------- l'autopsie
const caseNo = () => String(rep ? rep.bodies.length : 0).padStart(4, '0');
async function run(addr, out) {
  out = out || $('.hero .probe-msg');
  out.textContent = 'Opening the body bag…';
  try {
    rep = await api('/api/autopsy?wallet=' + encodeURIComponent(addr));
    vig = {}; sel = new Set(rep.bodies.map((b) => b.account));
    out.textContent = rep.bodies.length ? `${rep.bodies.length} bodies found. Here is the report.` : 'No dead tokens here. A clean wallet.';
    fillReport(true);
    setTimeout(() => window.__lab.go($('#report')), 400);
    refineCauses(rep.wallet);
  } catch (e) { out.textContent = (e && e.message) || 'The lab could not read this wallet.'; }
}

function stats() {
  const n = {};
  for (const b of rep.bodies) { const c = causeOf(b); n[c] = (n[c] || 0) + 1; }
  const order = Object.entries(n).sort((a, b) => b[1] - a[1]);
  const dead = order.filter(([c]) => c !== 'EMPTY');
  let type = 'Clean hands';
  if (rep.bodies.length >= 5) type = TYPE[(dead.length && dead[0][1] >= 3 ? dead[0] : order[0])[0]];
  const lam = rep.bodies.reduce((s, b) => s + b.lamports, 0);
  const aged = rep.bodies.filter((b) => b.born && b.cause !== 'EMPTY').sort((a, b) => a.born - b.born);
  return { order, type, lam, fee: feeOf(lam), oldest: aged[0] || null, since: rep.bodies.reduce((m, b) => (b.born && b.born < m ? b.born : m), Infinity) };
}

function fillReport(animate, keepShare) {
  const s = stats(), n = rep.bodies.length, top = s.order[0];
  const intro = $('#report .sec-h p');
  if (intro) intro.textContent = `Case opened ${new Date().toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' })}. Every dead token in ${short(rep.wallet)}, tagged.`;
  $('.pp-head span').textContent = `CASE #${caseNo()} · ${n ? 'OPEN' : 'CLEAN'}`;
  const f = document.querySelectorAll('.pp-fields b');
  f[0].textContent = short(rep.wallet);
  f[2].textContent = isFinite(s.since) ? `since ${month(s.since)}` : 'unknown';
  $('#ppCount').textContent = n;
  $('#report ol').innerHTML = s.order.slice(0, 5).map(([c, k], i) => {
    let note = '';
    if (i === 0 && n >= 10) note = k / n > 0.4 ? 'most of them' : 'top killer';
    else if (c === 'RUGGED') note = 'ouch.';
    else if (c === 'BUNDLED') note = 'classic';
    return `<li class="tw-line"><span>${CAUSE[c]}</span><i></i><b>${k}</b>${note ? `<em class="hand note">${note}</em>` : ''}</li>`;
  }).join('') || '<li class="tw-line"><span>No bodies</span><i></i><b>0</b><em class="hand note">clean!</em></li>';
  const w = $('.pp-wound');
  w.querySelector('.tw-line').textContent = 'OLDEST BODY';
  w.querySelector('.hand').textContent = s.oldest ? tick(s.oldest) : '—';
  w.querySelector('em').textContent = s.oldest ? `launched ${month(s.oldest.born)}` : '';
  $('#stamp').innerHTML = `${esc(s.type)}<small>TRADER TYPE</small>`;
  // le reçu
  const r = $('#receipt'), k2 = r.querySelectorAll('.k2'), tots = r.querySelectorAll('.tot span:last-child');
  k2[1].textContent = `CASE #${caseNo()} · ${short(rep.wallet)}`;
  tots[0].textContent = n;
  tots[1].textContent = n ? sol(s.lam / n, 5) : '0';
  tots[2].textContent = `${sol(s.lam)} SOL`;
  tots[3].textContent = `−${sol(s.fee)} SOL`;
  $('#rcSol').textContent = `${sol(s.lam - s.fee, 2)} SOL`;
  r.querySelector('p').textContent = rep.alive.count ? `5% fee, only on the SOL you get back. ${rep.alive.count} live token${rep.alive.count > 1 ? 's' : ''} left untouched.` : '5% fee, only on the SOL you get back.';
  (r.querySelector('.btn') || $('.bury-btn')).textContent = n ? 'Bury them' : 'Nothing to bury';
  if (!keepShare) share(false, n, s.lam - s.fee, s);
  if (animate && window.gsap) {
    // l'animation d'exemple de la maquette est terminée d'un coup : le vrai rapport a la sienne
    const tl = window.__lab.reportTl;
    if (tl) { if (tl.scrollTrigger) tl.scrollTrigger.kill(); tl.progress(1).kill(); window.__lab.reportTl = null; }
    gsap.set('#countRing, #woundRing', { strokeDashoffset: 0 });
    gsap.fromTo('.paper .tw-line, .sheet ol li', { clipPath: 'inset(0 100% 0 0)' }, { clipPath: 'inset(0 0% 0 0)', duration: 0.4, ease: 'steps(16)', stagger: 0.07, delay: 0.9 });
    gsap.fromTo('#ppCount', { scale: 0.4, opacity: 0 }, { scale: 1, opacity: 1, duration: 0.5, ease: 'back.out(3)', delay: 1.1 });
    gsap.fromTo('#stamp', { scale: 2.2, opacity: 0, rotate: -20 }, { scale: 1, opacity: 0.92, rotate: -9, duration: 0.35, ease: 'power4.in', delay: 2 });
  }
}

// le bouton du reçu ouvre le tiroir de la morgue (on passe avant le défilement de la maquette)
($('#receipt .btn') || $('.bury-btn')).addEventListener('click', (e) => {
  if (!rep) return;
  e.preventDefault(); e.stopImmediatePropagation();
  if (rep.bodies.length) openSheet('morgue');
}, true);

// ---------- causes prouvées par le moteur Vigil (bundle, dev en série, dev qui a vendu), en arrière-plan
async function refineCauses(forWallet) {
  const mints = [...new Set(rep.bodies.filter((b) => !['EMPTY', 'DUST', 'STILLBORN'].includes(b.cause)).sort((a, b) => (b.born || 0) - (a.born || 0)).map((b) => b.mint))].slice(0, 12);
  if (!mints.length) return;
  for (let t = 0; t < 6; t++) {
    if (!rep || rep.wallet !== forWallet) return;
    const j = await fetch(`${VIGIL}/api/lens?a=${mints.join(',')}`, { cache: 'no-store' }).then((r) => r.json()).catch(() => null);
    if (!j || !j.results) return;
    let changed = false, pending = false;
    for (const m of mints) {
      const r = j.results[m]; if (!r) continue;
      if (r.pending) { pending = true; continue; }
      const why = (r.reason || '').toLowerCase();
      const c = /serial dev|dev farm/.test(why) ? 'SERIAL_DEV' : /dev sold/.test(why) ? 'DEV_DUMPED' : r.verdict === 'bundled' ? 'BUNDLED' : null;
      if (c && vig[m] !== c) { vig[m] = c; changed = true; }
    }
    if (changed && !lastBury) { fillReport(false); if (mode === 'morgue' && !busy) render(); }
    if (!pending) return;
    await sleep(5000);
  }
}

// ---------- « Bury them »
async function bury() {
  if (busy || !account || !rep) return;
  const accs = rep.bodies.filter((b) => sel.has(b.account)).map((b) => b.account);
  busy = true; msg = 'Preparing the burial…'; render();
  let built;
  try { built = await api('/api/bury', { wallet: account.address, accounts: accs }); }
  catch (e) { busy = false; msg = (e && e.message) || 'The lab could not prepare the burial.'; render(); return; }
  msg = `Sign ${built.txs.length} transaction${built.txs.length > 1 ? 's' : ''} in your wallet.`; render();
  let signed;
  try {
    const inputs = built.txs.map((t) => ({ account, chain: CHAIN, transaction: b64ToBytes(t) }));
    const out = await wallet.features['solana:signTransaction'].signTransaction(...inputs);
    signed = out.map((o) => bytesToB64(o.signedTransaction));
  } catch (e) {
    busy = false;
    msg = /reject|denied|cancel|declined/i.test(String(e && e.message)) ? 'You cancelled. Nothing was buried.' : 'Your wallet could not sign. Nothing was buried.';
    render(); return;
  }
  back.classList.remove('on'); mode = null;
  await live(built, signed);
  busy = false;
}

function setFlask(frac, lamports) {
  if (!$('#bigLevel')) {
    // page v2 : la fiole d'or en plein écran
    $('.bury').classList.add('is-live');
    const k = Math.max(0, Math.min(1, frac));
    if (window.gsap) gsap.to('.goldpot .lvl-live', { clipPath: `inset(${100 - 100 * k}% 0 0 0)`, duration: 1.2, ease: 'power2.out' });
    $('#buryLive').textContent = sol(lamports, 3);
    return;
  }
  const pcs = document.querySelectorAll('.pc');
  const y = 330 - 140 * Math.min(1, frac);
  if (window.gsap) gsap.to('#bigLevel', { attr: { transform: `translate(0,${y})` }, duration: 1.2, ease: 'power2.out' });
  else $('#bigLevel').setAttribute('transform', `translate(0,${y})`);
  pcs.forEach((p, i) => p.setAttribute('opacity', frac > (i + 1) / (pcs.length + 1) ? 1 : 0));
  $('#bigSol').textContent = sol(lamports, 3);
}

function setTag(html, closable) { tag.innerHTML = html + (closable ? '<button type="button" aria-label="Close">×</button>' : ''); tag.classList.add('on'); }
tag.addEventListener('click', (e) => { if (e.target.closest('button')) tag.classList.remove('on'); });

async function live(built, signed) {
  window.__lab.live = true;
  const st = signed.map(() => 'pending');
  const net = built.plan.reduce((s, p) => s + p.lamports - p.fee, 0);
  setFlask(0, 0);
  setTag(`BURYING · <b>0 / ${st.length}</b>`);
  window.__lab.go($('#bury'));
  let got = 0, buried = 0;
  for (let round = 0; round < 90; round++) {
    const idx = st.map((s, i) => (s === 'pending' ? i : -1)).filter((i) => i >= 0);
    if (!idx.length) break;
    try {
      const j = await api('/api/send', { txs: idx.map((i) => signed[i]), lastValidBlockHeight: built.lastValidBlockHeight });
      j.states.forEach((s, k) => (st[idx[k]] = s.state));
    } catch {}
    const done = st.map((s, i) => (s === 'confirmed' ? i : -1)).filter((i) => i >= 0);
    got = done.reduce((s, i) => s + built.plan[i].lamports - built.plan[i].fee, 0);
    buried = done.reduce((s, i) => s + built.plan[i].accounts.length, 0);
    setFlask(net ? got / net : 0, got);
    setTag(`BURYING · <b>${done.length} / ${st.length}</b> · ${sol(got)} SOL back`);
    if (st.every((s) => s !== 'pending')) break;
    await sleep(2000);
  }
  const lost = st.filter((s) => s !== 'confirmed').length;
  lastBury = { buried, got };
  setTag(buried ? `BURIED <b>${buried}</b> · ${sol(got)} SOL back${lost ? ` · ${lost} batch${lost > 1 ? 'es' : ''} failed, try again` : ''}` : 'Nothing was buried. Try again.', true);
  if (buried) share(true, buried, got, stats());
  // nouvelle autopsie : le rapport montre ce qui reste
  try {
    const fresh = await api('/api/autopsy?wallet=' + encodeURIComponent(account.address));
    rep = fresh; vig = {}; sel = new Set(rep.bodies.map((b) => b.account));
    fillReport(false, true);
  } catch {}
}

// ---------- la carte à partager
function share(done, n, lamports, s) {
  const big = document.querySelector('.sc-big') || document.querySelector('.scard .big');
  big.innerHTML = done ? `Buried <span class="glow">${n}</span> bodies.<br>Got <span class="gold">${sol(lamports, 2)} SOL</span> back.` : `Found <span class="glow">${n}</span> bodies.<br><span class="gold">${sol(lamports, 2)} SOL</span> to dig up.`;
  const row = document.querySelectorAll('.sc-row > div').length ? document.querySelectorAll('.sc-row > div') : document.querySelectorAll('.scard .row > div');
  row[0].innerHTML = `Trader type<b>${esc(s.type)}</b>`;
  row[1].innerHTML = `Oldest body<b>${esc(s.oldest ? tick(s.oldest) : '—')}</b>`;
  const foot = document.querySelector('.sticker .foot span');
  if (foot) foot.textContent = `AUTOPSY LAB · CASE #${String(n).padStart(4, '0')}`;
  const text = done
    ? `I just buried ${n} dead memecoins and got ${sol(lamports, 3)} SOL back.\nTrader type: ${s.type}.\nAutopsy your wallet:`
    : `My wallet autopsy: ${n} dead memecoins, ${sol(lamports, 3)} SOL stuck in their graves.\nTrader type: ${s.type}.\nAutopsy yours:`;
  let a = document.getElementById('xShare');
  if (!a) {
    a = document.createElement('a'); a.id = 'xShare'; a.className = 'btn btn-g'; a.target = '_blank'; a.rel = 'noopener';
    a.textContent = 'Post it on X';
    (document.querySelector('.share .wrap > div:last-child') || document.querySelector('.share > div:last-child')).appendChild(a);
  }
  a.href = `https://x.com/intent/post?text=${encodeURIComponent(text)}&url=${encodeURIComponent(location.origin)}`;
}

window.autopsy = { run, connect: () => (account ? openWallets(() => run(account.address)) : openWallets()) };

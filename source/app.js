/* ═══════════════════════════════════════════
   Claude Workshop – BIM Summit 2026
   source/app.js
═══════════════════════════════════════════ */

const sidebar    = document.getElementById('sidebar');
const menuToggle = document.getElementById('menuToggle');
const views      = document.querySelectorAll('.view');
const navBtns    = document.querySelectorAll('.nav-item[data-target]');

/* ── Show a section by id ── */
function showView(targetId) {
  views.forEach(v => {
    v.classList.toggle('hidden', v.id !== targetId);
  });
  navBtns.forEach(btn => {
    btn.classList.toggle('active', btn.dataset.target === targetId);
  });
  window.scrollTo({ top: 0, behavior: 'smooth' });
  sidebar.classList.remove('open');
}

/* ── Sidebar nav buttons (data-target) ── */
navBtns.forEach(btn => {
  btn.addEventListener('click', () => showView(btn.dataset.target));
});

/* ── Inline nav buttons (data-nav) — next/back/start ── */
document.querySelectorAll('[data-nav]').forEach(btn => {
  btn.addEventListener('click', () => showView(btn.dataset.nav));
});

/* ── Mobile hamburger ── */
menuToggle.addEventListener('click', () => sidebar.classList.toggle('open'));

document.addEventListener('click', e => {
  if (
    sidebar.classList.contains('open') &&
    !sidebar.contains(e.target) &&
    e.target !== menuToggle
  ) {
    sidebar.classList.remove('open');
  }
});

/* ── Copy to clipboard ── */
document.querySelectorAll('.copy-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    const block  = document.getElementById(btn.dataset.copy);
    const clone  = block.cloneNode(true);
    clone.querySelectorAll('.copy-btn').forEach(b => b.remove());
    const text = (clone.textContent || '').trim();

    const finish = () => {
      btn.textContent = '✓ Copied!';
      btn.classList.add('copied');
      setTimeout(() => {
        btn.textContent = 'Copy';
        btn.classList.remove('copied');
      }, 2200);
    };

    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(finish).catch(() => fallback(text, finish));
    } else {
      fallback(text, finish);
    }
  });
});

function fallback(text, cb) {
  const ta = document.createElement('textarea');
  ta.value = text;
  ta.style.cssText = 'position:fixed;opacity:0;top:0;left:0;';
  document.body.appendChild(ta);
  ta.focus();
  ta.select();
  try { document.execCommand('copy'); } catch (_) {}
  document.body.removeChild(ta);
  cb();
}

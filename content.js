// content.js v7 - Hover ile yükle
(function () {
  'use strict';

  const processed = new Map();
  let activeIframe = null;
  const queue = [];
  let isProcessing = false;

  // ---- Rastgele bekleme (1-2 sn - hover'da çok uzun beklememek için) ----
  function randomDelay() {
    return 1000 + Math.random() * 1000;
  }

  // ---- Rozet HTML ----
  function makeBadge(type, count, letter) {
    if (!count) return '';
    const styles = {
      degisen:   'background:#E53935;color:#fff;',
      boya:      'background:#1565C0;color:#fff;',
      lokalBoya: 'background:#F9A825;color:#222;text-shadow:none;'
    };
    const titles = {
      degisen:   `${count} değişen parça`,
      boya:      `${count} boyalı parça`,
      lokalBoya: `${count} lokal boyalı parça`
    };
    const label = count > 1 ? `${letter}${count}` : letter;
    return `<span class="shb-dot" style="${styles[type]}" title="${titles[type]}">${label}</span>`;
  }

  // ---- Rozeti fotoğraf hücresine ekle ----
  function injectBadges(tr, result) {
    tr.querySelectorAll('.shb-container').forEach(el => el.remove());
    const { degisen, boya, lokalBoya } = result;

    const container = document.createElement('div');
    container.className = 'shb-container';

    if (!degisen && !boya && !lokalBoya) {
      container.innerHTML = '<span class="shb-dot" style="background:#2E7D32;color:#fff;" title="Hasar kaydı yok">✓</span>';
    } else {
      container.innerHTML =
        makeBadge('degisen',   degisen,   'D') +
        makeBadge('boya',      boya,      'B') +
        makeBadge('lokalBoya', lokalBoya, 'L');
    }

    const td = tr.querySelector('td.searchResultsLargeThumbnail');
    if (td) {
      td.style.position = 'relative';
      td.appendChild(container);
    }
  }

  // ---- Spinner göster ----
  function showSpinner(tr) {
    if (tr.querySelector('.shb-container')) return;
    const td = tr.querySelector('td.searchResultsLargeThumbnail');
    if (!td) return;
    td.style.position = 'relative';
    const s = document.createElement('div');
    s.className = 'shb-container shb-spinner';
    s.innerHTML = '<span class="shb-dot shb-loading" style="background:rgba(0,0,0,0.35);color:#fff;">···</span>';
    td.appendChild(s);
  }

  // ---- iframe ile yükle ----
  function loadViaIframe(href) {
    return new Promise((resolve) => {
      const iframe = document.createElement('iframe');
      iframe.style.cssText = 'position:fixed;top:-9999px;left:-9999px;width:1px;height:1px;opacity:0;pointer-events:none;border:none;';
      iframe.sandbox = 'allow-same-origin allow-scripts';
      activeIframe = iframe;

      let settled = false;
      const finish = (result) => {
        if (settled) return;
        settled = true;
        clearTimeout(tid);
        try { iframe.remove(); } catch(e) {}
        activeIframe = null;
        resolve(result);
      };

      const tid = setTimeout(() => finish(null), 12000);
      iframe.onload = () => {
        try {
          const doc = iframe.contentDocument || iframe.contentWindow?.document;
          finish(parseHasar(doc));
        } catch(e) { finish(null); }
      };
      iframe.onerror = () => finish(null);
      iframe.src = 'https://www.sahibinden.com' + href;
      document.body.appendChild(iframe);
    });
  }

  // ---- Hasar parse ----
  function parseHasar(doc) {
    if (!doc) return null;
    let degisen = 0, boya = 0, lokalBoya = 0, currentType = null;
    doc.querySelectorAll('li').forEach(li => {
      const cls = li.className || '';
      if (cls.includes('changed-new'))                          { currentType = 'degisen';   return; }
      if (cls.includes('local-painted-new'))                     { currentType = 'lokalBoya'; return; }
      if (cls.includes('painted-new') && !cls.includes('local')) { currentType = 'boya';      return; }
      if (cls.includes('pair-title'))                            { currentType = null;         return; }
      if (cls.includes('selected-damage') && currentType) {
        if (currentType === 'degisen')   degisen++;
        if (currentType === 'boya')      boya++;
        if (currentType === 'lokalBoya') lokalBoya++;
      }
    });
    return { degisen, boya, lokalBoya };
  }

  // ---- Kuyruk işleyici ----
  async function runQueue() {
    if (isProcessing) return;
    isProcessing = true;

    while (queue.length > 0) {
      const { tr, href, id } = queue.shift();
      if (!document.body.contains(tr)) continue;

      showSpinner(tr);
      const result = await loadViaIframe(href);

      if (result) {
        processed.set(id, result);
        injectBadges(tr, result);
      } else {
        processed.set(id, 'error');
        tr.querySelectorAll('.shb-spinner').forEach(el => el.remove());
      }

      if (queue.length > 0) {
        await new Promise(r => setTimeout(r, randomDelay()));
      }
    }

    isProcessing = false;
  }

  // ---- Hover timer: 400ms üstünde durulursa yükle ----
  let hoverTimer = null;

  function onMouseEnter(e) {
    const tr = e.currentTarget;
    const id = tr.getAttribute('data-id');
    if (!id || processed.has(id)) return;

    hoverTimer = setTimeout(() => {
      if (!id || processed.has(id)) return;

      const link = tr.querySelector('a[href*="/ilan/"]');
      const href = link?.getAttribute('href');
      if (!href) return;

      // Kuyruğa zaten var mı?
      if (queue.some(q => q.id === id)) return;

      processed.set(id, 'queued');
      queue.unshift({ tr, href, id }); // Öne al (hover edilen önce yüklensin)
      runQueue();
    }, 400); // 400ms bekle, anlık geçişleri ignore et
  }

  function onMouseLeave() {
    clearTimeout(hoverTimer);
    hoverTimer = null;
  }

  // ---- Yeni gelen tr'lere listener ekle ----
  function attachListeners(rows) {
    rows.forEach(tr => {
      if (tr.dataset.shbListened) return;
      tr.dataset.shbListened = '1';
      tr.addEventListener('mouseenter', onMouseEnter);
      tr.addEventListener('mouseleave', onMouseLeave);
    });
  }

  function attachAll() {
    const rows = document.querySelectorAll('tr.searchResultsItem[data-id]');
    attachListeners(rows);
  }

  // ---- Observer (yeni ilanlar yüklenince) ----
  new MutationObserver(() => {
    setTimeout(attachAll, 300);
  }).observe(document.body, { childList: true, subtree: true });

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', attachAll);
  } else {
    attachAll();
  }

})();

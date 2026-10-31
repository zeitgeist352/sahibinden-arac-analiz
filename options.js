(function () {
  'use strict';

  const DEFAULTS = globalThis.SHB_DEFAULTS;
  const PRICE_PREFIX = 'ph_';
  const $ = (id) => document.getElementById(id);

  const toLines = (list) => list.join('\n');
  const fromLines = (text) => Array.from(new Set(
    text.split('\n').map(line => line.trim().toLocaleLowerCase('tr-TR')).filter(Boolean)
  ));

  const flash = (el, message) => {
    el.textContent = message;
    clearTimeout(el.shbTimer);
    el.shbTimer = setTimeout(() => { el.textContent = ''; }, 2500);
  };

  // ---------- Settings ----------
  function fillForm(settings) {
    const s = settings || {};
    $('redFlags').value = toLines(Array.isArray(s.redFlags) ? s.redFlags : DEFAULTS.RED_FLAGS);
    $('greenFlags').value = toLines(Array.isArray(s.greenFlags) ? s.greenFlags : DEFAULTS.GREEN_FLAGS);
    $('marketComparison').checked = typeof s.marketComparison === 'boolean' ? s.marketComparison : DEFAULTS.MARKET_COMPARISON;
  }

  async function loadSettings() {
    const { shbSettings } = await chrome.storage.local.get('shbSettings');
    fillForm(shbSettings);
  }

  async function saveSettings() {
    const shbSettings = {
      redFlags: fromLines($('redFlags').value),
      greenFlags: fromLines($('greenFlags').value),
      marketComparison: $('marketComparison').checked
    };
    await chrome.storage.local.set({ shbSettings });
    fillForm(shbSettings);
    flash($('saveStatus'), 'Kaydedildi ✓ Açık sahibinden sekmeleri yeni ayarları hemen kullanır.');
  }

  async function resetSettings() {
    await chrome.storage.local.remove('shbSettings');
    fillForm(null);
    flash($('saveStatus'), 'Varsayılanlar geri yüklendi ✓');
  }

  // ---------- Price history ----------
  async function getPriceEntries() {
    const all = await chrome.storage.local.get(null);
    return Object.keys(all)
      .filter(key => key.startsWith(PRICE_PREFIX))
      .map(key => ({ id: key.slice(PRICE_PREFIX.length), ...all[key] }));
  }

  async function renderHistoryStats() {
    const entries = await getPriceEntries();
    const changed = entries.filter(e => e.h && e.h.length > 1).length;
    const bytes = await chrome.storage.local.getBytesInUse(null);
    $('historyStats').textContent =
      `${entries.length.toLocaleString('tr-TR')} ilan takip ediliyor · ${changed.toLocaleString('tr-TR')} ilanda fiyat değişimi var · ` +
      `${(bytes / 1024).toLocaleString('tr-TR', { maximumFractionDigits: 0 })} KB`;
  }

  async function exportHistory() {
    const entries = await getPriceEntries();
    const listings = {};
    for (const e of entries) {
      listings[e.id] = {
        lastSeen: new Date(e.ls || 0).toISOString(),
        history: (e.h || []).map(([ts, price]) => ({ date: new Date(ts).toISOString(), price }))
      };
    }
    const blob = new Blob([JSON.stringify({ exportedAt: new Date().toISOString(), listings }, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `sahiden-fiyat-gecmisi-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    flash($('historyStatus'), `${entries.length} ilan dışa aktarıldı ✓`);
  }

  async function clearHistory() {
    const entries = await getPriceEntries();
    if (!entries.length) return flash($('historyStatus'), 'Silinecek kayıt yok.');
    if (!confirm(`${entries.length} ilanın fiyat geçmişi kalıcı olarak silinecek. Emin misiniz?`)) return;
    await chrome.storage.local.remove(entries.map(e => PRICE_PREFIX + e.id));
    await renderHistoryStats();
    flash($('historyStatus'), 'Fiyat geçmişi temizlendi ✓');
  }

  // ---------- Selector health ----------
  async function renderHealth() {
    const { shbHealth = {} } = await chrome.storage.local.get('shbHealth');
    const list = $('healthList');
    list.textContent = '';
    const issues = Object.values(shbHealth).filter(i => i.message);
    if (!issues.length) {
      const li = document.createElement('li');
      li.className = 'ok';
      li.textContent = '✓ Sorun tespit edilmedi.';
      list.appendChild(li);
      return;
    }
    for (const issue of issues.sort((a, b) => (b.ts || 0) - (a.ts || 0))) {
      const li = document.createElement('li');
      li.textContent = `⚠️ ${issue.message}`;
      const meta = document.createElement('small');
      meta.textContent = ` — ${new Date(issue.ts).toLocaleString('tr-TR')}${issue.url ? ` · ${issue.url}` : ''}`;
      li.appendChild(meta);
      list.appendChild(li);
    }
  }

  async function clearHealth() {
    await chrome.storage.local.remove('shbHealth');
    renderHealth();
  }

  // ---------- Wiring ----------
  $('save').addEventListener('click', saveSettings);
  $('reset').addEventListener('click', resetSettings);
  $('export').addEventListener('click', exportHistory);
  $('clear').addEventListener('click', clearHistory);
  $('clearHealth').addEventListener('click', clearHealth);

  chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== 'local') return;
    if (changes.shbHealth) renderHealth();
    if (Object.keys(changes).some(key => key.startsWith(PRICE_PREFIX))) renderHistoryStats();
  });

  loadSettings();
  renderHistoryStats();
  renderHealth();
})();

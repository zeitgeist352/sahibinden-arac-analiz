(function () {
  'use strict';

  // ==========================================
  // 1. CONFIGURATION & CONSTANTS
  // ==========================================
  const DEFAULTS = globalThis.SHB_DEFAULTS || { RED_FLAGS: [], GREEN_FLAGS: [], MARKET_COMPARISON: true };

  const CONFIG = {
    DEBOUNCE_MS: 600,
    OBSERVER_DEBOUNCE_MS: 300,
    CACHE_TTL_MS: 15 * 60 * 1000, // 15 minutes cache TTL
    PRICE_STORAGE_PREFIX: 'ph_',
    PRICE_RETENTION_MS: 180 * 24 * 60 * 60 * 1000, // forget listings not seen for 180 days
    PRICE_MAX_POINTS: 30,
    PRICE_REFRESH_MS: 12 * 60 * 60 * 1000, // rewrite "last seen" at most twice a day
    MARKET_MIN_COMPARABLES: 4,
    MARKET_CHIP_THRESHOLD_PCT: 5,
    HEALTH_DISMISS_MS: 7 * 24 * 60 * 60 * 1000,
    HEALTH_FETCH_MISS_LIMIT: 3,
    // Overridden from the options page (see Settings.load)
    RED_FLAGS: [...DEFAULTS.RED_FLAGS],
    GREEN_FLAGS: [...DEFAULTS.GREEN_FLAGS],
    MARKET_COMPARISON: DEFAULTS.MARKET_COMPARISON,
    SELECTORS: {
      LISTING_ROW: 'tr.searchResultsItem[data-id], .classified-list-item[data-id]',
      LINK: 'a[href*="/ilan/"]',
      ROW_PRICE: 'td.searchResultsPriceValue, .classified-price-container, [class*="price"]',
      ROW_ATTRIBUTE: 'td.searchResultsAttributeValue',
      ROW_MODEL: 'td.searchResultsTagAttributeValue',
      DETAIL_PRICE: '.classified-price-wrapper, .classifiedInfo > h3, .classifiedInfo h3',
      DESCRIPTION: '#classifiedDescription, .classifiedDescription, div[class*="description"]',
      INFO_LIST: '.classifiedInfoList li'
    }
  };

  // ==========================================
  // 2. UTILITIES
  // ==========================================
  const TR_LETTER = 'a-zçğıöşü';
  const TR_MONTHS = ['ocak', 'şubat', 'mart', 'nisan', 'mayıs', 'haziran', 'temmuz', 'ağustos', 'eylül', 'ekim', 'kasım', 'aralık'];

  const Utils = {
    escapeHtml(value) {
      return String(value ?? '').replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
    },

    // Turkish-aware lowercasing so "TRAMERSİZ" and "HASARSIZ" match the same patterns as lowercase text
    normalize(text) {
      return String(text || '').toLocaleLowerCase('tr-TR');
    },

    escapeRegex(str) {
      return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    },

    parseTlPrice(text) {
      const match = String(text || '').match(/(\d{1,3}(?:\.\d{3})+|\d{4,})\s*(?:tl|₺)/i);
      return match ? parseInt(match[1].replace(/\./g, ''), 10) : null;
    },

    formatTl(value) {
      return Number(value).toLocaleString('tr-TR') + ' TL';
    },

    formatDate(ts) {
      return new Date(ts).toLocaleDateString('tr-TR', { day: '2-digit', month: '2-digit', year: 'numeric' });
    },

    // "28 Ekim 2026" -> timestamp
    parseTrDate(text) {
      const match = this.normalize(text).match(/(\d{1,2})\s+([a-zçğıöşü]+)\s+(\d{4})/);
      if (!match) return null;
      const month = TR_MONTHS.indexOf(match[2]);
      if (month < 0) return null;
      return new Date(Number(match[3]), month, Number(match[1])).getTime();
    },

    daysSince(ts) {
      return Math.max(0, Math.floor((Date.now() - ts) / (24 * 60 * 60 * 1000)));
    },

    // textContent loses <br>/<p> boundaries, which the sentence-based tramer parser relies on
    textWithBreaks(el) {
      const clone = el.cloneNode(true);
      clone.querySelectorAll('br').forEach(br => br.replaceWith('\n'));
      clone.querySelectorAll('p, div, li, tr, h1, h2, h3, h4, h5, h6').forEach(node => node.append('\n'));
      return clone.textContent || '';
    },

    listingIdFromUrl(url) {
      const match = String(url || '').match(/(\d{6,})\/detay/);
      return match ? match[1] : null;
    }
  };

  // ==========================================
  // 3. STATE MANAGEMENT & CACHE
  // ==========================================
  const State = {
    cache: new Map(),
    inFlight: new Map(),
    activeHoverTimer: null,
    activePopupEl: null,
    currentHoveredId: null,

    getCached(id) {
      if (!this.cache.has(id)) return null;
      const entry = this.cache.get(id);
      if (Date.now() - entry.timestamp > CONFIG.CACHE_TTL_MS) {
        this.cache.delete(id);
        return null;
      }
      return entry.data;
    },

    setCache(id, data) {
      this.cache.set(id, { timestamp: Date.now(), data });
    }
  };

  // ==========================================
  // 4. LOCAL PRICE HISTORY TRACKER
  // ==========================================
  // Sahibinden does not expose past prices, so every price the user sees (search rows,
  // hover fetches, detail pages) is stored locally and history builds up over time.
  const PriceTracker = {
    queue: Promise.resolve(),

    available() {
      try {
        return typeof chrome !== 'undefined' && Boolean(chrome.storage && chrome.storage.local && chrome.runtime && chrome.runtime.id);
      } catch (e) {
        return false; // extension context invalidated after reload
      }
    },

    // Serialized so row scans and hover fetches never overwrite each other's writes
    enqueue(task) {
      const run = this.queue.then(task, task);
      this.queue = run.catch(() => {});
      return run;
    },

    recordMany(entries) {
      const valid = entries.filter(e => e.id && Number.isFinite(e.price) && e.price > 0);
      if (!valid.length || !this.available()) return Promise.resolve({});

      return this.enqueue(async () => {
        try {
          const keys = valid.map(e => CONFIG.PRICE_STORAGE_PREFIX + e.id);
          const stored = await chrome.storage.local.get(keys);
          const now = Date.now();
          const updates = {};
          const result = {};

          for (const { id, price } of valid) {
            const key = CONFIG.PRICE_STORAGE_PREFIX + id;
            const rec = updates[key] || stored[key] || { h: [], ls: 0 };
            const last = rec.h[rec.h.length - 1];
            const changed = !last || last[1] !== price;
            if (changed) {
              rec.h.push([now, price]);
              if (rec.h.length > CONFIG.PRICE_MAX_POINTS) {
                rec.h = [rec.h[0], ...rec.h.slice(-(CONFIG.PRICE_MAX_POINTS - 1))];
              }
            }
            if (changed || now - rec.ls > CONFIG.PRICE_REFRESH_MS) {
              rec.ls = now;
              updates[key] = rec;
            }
            result[id] = rec.h;
          }

          if (Object.keys(updates).length) await chrome.storage.local.set(updates);
          return result;
        } catch (e) {
          console.warn('[SHB] Price history write failed:', e);
          return {};
        }
      });
    },

    async record(id, price) {
      const result = await this.recordMany([{ id, price }]);
      return result[id] || null;
    },

    async get(id) {
      if (!this.available()) return null;
      try {
        const key = CONFIG.PRICE_STORAGE_PREFIX + id;
        const stored = await chrome.storage.local.get(key);
        return stored[key] ? stored[key].h : null;
      } catch (e) {
        return null;
      }
    },

    summarize(history) {
      if (!Array.isArray(history) || history.length === 0) return null;
      const [firstTs, firstPrice] = history[0];
      const lastPrice = history[history.length - 1][1];
      const diff = lastPrice - firstPrice;
      return {
        firstTs,
        firstPrice,
        lastPrice,
        diff,
        pct: firstPrice ? (diff / firstPrice) * 100 : 0,
        changes: history.length - 1
      };
    },

    // Runs at most once a day; drops listings the user has not seen for PRICE_RETENTION_MS
    prune() {
      if (!this.available()) return;
      this.enqueue(async () => {
        try {
          const { shbLastPrune = 0 } = await chrome.storage.local.get('shbLastPrune');
          const now = Date.now();
          if (now - shbLastPrune < 24 * 60 * 60 * 1000) return;
          const all = await chrome.storage.local.get(null);
          const stale = Object.keys(all).filter(key =>
            key.startsWith(CONFIG.PRICE_STORAGE_PREFIX) && now - (all[key].ls || 0) > CONFIG.PRICE_RETENTION_MS
          );
          if (stale.length) await chrome.storage.local.remove(stale);
          await chrome.storage.local.set({ shbLastPrune: now });
        } catch (e) { /* ignore */ }
      });
    }
  };

  // ==========================================
  // 4b. USER SETTINGS (options page)
  // ==========================================
  const Settings = {
    apply(settings) {
      const s = settings || {};
      CONFIG.RED_FLAGS = Array.isArray(s.redFlags) ? s.redFlags : [...DEFAULTS.RED_FLAGS];
      CONFIG.GREEN_FLAGS = Array.isArray(s.greenFlags) ? s.greenFlags : [...DEFAULTS.GREEN_FLAGS];
      CONFIG.MARKET_COMPARISON = typeof s.marketComparison === 'boolean' ? s.marketComparison : DEFAULTS.MARKET_COMPARISON;
    },

    async load() {
      if (!PriceTracker.available()) return;
      try {
        const { shbSettings } = await chrome.storage.local.get('shbSettings');
        this.apply(shbSettings);
        chrome.storage.onChanged.addListener((changes, area) => {
          if (area !== 'local' || !changes.shbSettings) return;
          this.apply(changes.shbSettings.newValue);
          State.cache.clear(); // flags are baked into cached analyses
          MarketComparator.refresh({ force: true });
        });
      } catch (e) { /* keep defaults */ }
    }
  };

  // ==========================================
  // 4c. MARKET COMPARISON (same search page)
  // ==========================================
  // Compares each row with similar rows on the current results page:
  // same model columns, model year within ±1 and comparable mileage.
  const MarketComparator = {
    stats: new Map(),

    parseRow(row) {
      const priceEl = row.querySelector(CONFIG.SELECTORS.ROW_PRICE);
      const price = priceEl && Utils.parseTlPrice(priceEl.textContent);
      let year = null;
      let km = null;
      row.querySelectorAll(CONFIG.SELECTORS.ROW_ATTRIBUTE).forEach(td => {
        const t = (td.textContent || '').trim();
        if (year === null && /^(?:19[5-9]\d|20[0-3]\d)$/.test(t)) year = Number(t);
        else if (km === null && /^\d{1,3}(?:\.\d{3})*$/.test(t)) km = parseInt(t.replace(/\./g, ''), 10);
      });
      const model = Array.from(row.querySelectorAll(CONFIG.SELECTORS.ROW_MODEL), td => Utils.normalize(td.textContent).trim()).join('|');
      return { id: row.getAttribute('data-id'), price, year, km, model, priceEl };
    },

    isComparable(a, b) {
      if (a.id === b.id || a.model !== b.model || Math.abs(a.year - b.year) > 1) return false;
      if (a.km === null || b.km === null) return true;
      return Math.abs(a.km - b.km) <= Math.max(30000, 0.4 * Math.max(a.km, b.km));
    },

    median(values) {
      const sorted = [...values].sort((x, y) => x - y);
      const mid = Math.floor(sorted.length / 2);
      return sorted.length % 2 ? sorted[mid] : Math.round((sorted[mid - 1] + sorted[mid]) / 2);
    },

    // Pure: items -> Map(id -> { median, count, pct })
    compare(items) {
      const usable = items.filter(i => i.id && i.price && i.year);
      const result = new Map();
      for (const item of usable) {
        const peers = usable.filter(other => this.isComparable(item, other));
        if (peers.length < CONFIG.MARKET_MIN_COMPARABLES) continue;
        const median = this.median(peers.map(p => p.price));
        result.set(item.id, { median, count: peers.length, pct: ((item.price - median) / median) * 100 });
      }
      return result;
    },

    signature: null,

    // Re-runs only when the set of rows/prices changes; adding chips would otherwise
    // retrigger the MutationObserver forever.
    refresh({ force = false } = {}) {
      if (typeof document === 'undefined') return;
      const items = CONFIG.MARKET_COMPARISON
        ? Array.from(document.querySelectorAll(CONFIG.SELECTORS.LISTING_ROW), row => this.parseRow(row))
        : [];
      const signature = `${CONFIG.MARKET_COMPARISON}:` + items.map(i => `${i.id}=${i.price}`).join(',');
      if (!force && signature === this.signature) return;
      this.signature = signature;

      document.querySelectorAll('.shb-market-chip').forEach(chip => chip.remove());
      this.stats = this.compare(items);

      for (const item of items) {
        const stat = this.stats.get(item.id);
        if (!stat || !item.priceEl || Math.abs(stat.pct) < CONFIG.MARKET_CHIP_THRESHOLD_PCT) continue;
        const chip = document.createElement('span');
        chip.className = `shb-market-chip ${stat.pct < 0 ? 'shb-market-below' : 'shb-market-above'}`;
        chip.textContent = `Piyasa ${stat.pct < 0 ? '−' : '+'}%${Math.abs(stat.pct).toFixed(0)}`;
        chip.title = `Bu sayfadaki ${stat.count} benzer ilanın (aynı model, yıl ±1, yakın km) ortanca fiyatı: ${Utils.formatTl(stat.median)}`;
        item.priceEl.appendChild(chip);
      }
    }
  };

  // ==========================================
  // 4d. SELECTOR HEALTH MONITOR
  // ==========================================
  // Sahibinden markup changes make the extension silently return empty results.
  // Each check reports a problem once per page and shows a dismissible banner.
  const HEALTH_MESSAGES = {
    rows: 'Arama sonuç satırları bulunamadı; hover analizi çalışmayabilir.',
    rowPrice: 'Arama sonuçlarında fiyat okunamadı; fiyat geçmişi ve piyasa karşılaştırması çalışmayabilir.',
    detailPrice: 'İlan sayfasında fiyat okunamadı; fiyat geçmişi kaydedilemiyor.',
    detailInfo: 'İlan bilgileri listesi bulunamadı; ağır hasar ve ilan tarihi okunamıyor.',
    fetchInfo: 'Ard arda birkaç ilanda ilan bilgileri okunamadı; analizler eksik olabilir.'
  };

  const HealthMonitor = {
    reported: new Set(),
    fetchMisses: 0,

    async update(mutator) {
      if (!PriceTracker.available()) return null;
      try {
        const { shbHealth = {} } = await chrome.storage.local.get('shbHealth');
        const changed = mutator(shbHealth);
        if (changed) await chrome.storage.local.set({ shbHealth });
        return shbHealth;
      } catch (e) {
        return null;
      }
    },

    async report(issue) {
      if (this.reported.has(issue)) return;
      this.reported.add(issue);
      const message = HEALTH_MESSAGES[issue];
      console.warn('[SHB] Selector health:', issue, message);

      const health = await this.update(h => {
        h[issue] = { ...(h[issue] || {}), message, ts: Date.now(), url: location.pathname };
        return true;
      });
      const dismissedAt = health && health[issue] && health[issue].dismissedAt;
      if (!dismissedAt || Date.now() - dismissedAt > CONFIG.HEALTH_DISMISS_MS) this.showBanner(issue, message);
    },

    ok(issue) {
      if (this.reported.has(issue)) return;
      this.update(h => {
        if (!h[issue] || h[issue].dismissedAt) return false;
        delete h[issue];
        return true;
      });
    },

    showBanner(issue, message) {
      let banner = document.getElementById('shb-health-banner');
      if (!banner) {
        banner = document.createElement('div');
        banner.id = 'shb-health-banner';
        banner.className = 'shb-health-banner';
        document.body.appendChild(banner);
      }
      const item = document.createElement('div');
      item.className = 'shb-health-item';
      item.innerHTML = `<span>⚠️ <strong>Sahiden:</strong> ${Utils.escapeHtml(message)} Sahibinden sayfa yapısı değişmiş olabilir.</span>`;
      const close = document.createElement('button');
      close.type = 'button';
      close.textContent = 'Kapat';
      close.addEventListener('click', () => {
        item.remove();
        if (!banner.children.length) banner.remove();
        this.update(h => {
          h[issue] = { ...(h[issue] || {}), dismissedAt: Date.now() };
          return true;
        });
      });
      item.appendChild(close);
      banner.appendChild(item);
    },

    checkSearchPage(rows) {
      // Many listing links inside a results table but no recognised rows => row selector broke
      const tableLinks = document.querySelectorAll('table a[href*="/ilan/"][href*="/detay"]').length;
      if (rows.length === 0) {
        if (tableLinks >= 10) this.report('rows');
        return;
      }
      this.ok('rows');
      const priced = Array.from(rows).filter(row => {
        const el = row.querySelector(CONFIG.SELECTORS.ROW_PRICE);
        return el && Utils.parseTlPrice(el.textContent);
      }).length;
      if (rows.length >= 5 && priced === 0) this.report('rowPrice');
      else if (priced > 0) this.ok('rowPrice');
    },

    checkDetailPage() {
      if (!Utils.listingIdFromUrl(location.pathname)) return;
      const priceEl = document.querySelector(CONFIG.SELECTORS.DETAIL_PRICE);
      if (priceEl && Utils.parseTlPrice(priceEl.textContent)) this.ok('detailPrice');
      else this.report('detailPrice');
      if (document.querySelector(CONFIG.SELECTORS.INFO_LIST)) this.ok('detailInfo');
      else this.report('detailInfo');
    },

    noteFetched(hasInfo) {
      if (hasInfo) {
        this.fetchMisses = 0;
        this.ok('fetchInfo');
      } else if (++this.fetchMisses >= CONFIG.HEALTH_FETCH_MISS_LIMIT) {
        this.report('fetchInfo');
      }
    }
  };

  // ==========================================
  // 5. DOM PARSING & DATA EXTRACTION MODULE
  // ==========================================
  const DataExtractor = {
    /**
     * Fetches listing page HTML and parses it into a single DOM object
     */
    async fetchAndParse(url) {
      try {
        const fullUrl = url.startsWith('http') ? url : `https://www.sahibinden.com${url}`;
        const response = await fetch(fullUrl, {
          credentials: 'include',
          headers: {
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8'
          }
        });
        if (!response.ok) return { doc: null, status: response.status };

        const htmlText = await response.text();
        const doc = new DOMParser().parseFromString(htmlText, 'text/html');
        return { doc, status: response.status };
      } catch (error) {
        console.warn('[SHB] Fetch error for URL:', url, error);
        return { doc: null, status: 0 };
      }
    },

    /**
     * Extracts vehicle description text from parsed document.
     * Deliberately no whole-page fallback: the page body contains labels such as
     * "Ağır Hasar Kayıtlı" which would trigger false red flags on every listing.
     */
    extractDescriptionText(doc) {
      if (!doc) return '';
      const descEl = doc.querySelector(CONFIG.SELECTORS.DESCRIPTION);
      return descEl ? Utils.textWithBreaks(descEl).trim() : '';
    },

    /**
     * Reads the structured "İlan Bilgileri" list (İlan Tarihi, KM, Ağır Hasar Kayıtlı, Kimden...)
     */
    extractInfoList(doc) {
      const info = {};
      if (!doc) return info;
      doc.querySelectorAll(CONFIG.SELECTORS.INFO_LIST).forEach(li => {
        const labelEl = li.querySelector('strong');
        const valueEl = li.querySelector('span');
        if (!labelEl || !valueEl) return;
        const label = Utils.normalize(labelEl.textContent).replace(/\s+/g, ' ').trim();
        const value = (valueEl.textContent || '').replace(/\s+/g, ' ').trim();
        if (label) info[label] = value;
      });
      return info;
    },

    extractDetailPrice(doc) {
      if (!doc) return null;
      for (const el of doc.querySelectorAll(CONFIG.SELECTORS.DETAIL_PRICE)) {
        const price = Utils.parseTlPrice(el.textContent);
        if (price) return price;
      }
      return null;
    },

    /**
     * Tramer (damage record) extraction.
     * Amounts win over "clean" phrases: "hasarsız ama 12 bin tramer var" is damaged.
     * Bare numbers must sit next to a damage keyword and must not be years, km, etc.
     */
    extractTramerData(descriptionText) {
      const result = (status, message, amount = null, records = []) => ({
        status, message, text: message, amount, hasTramer: status === 'DAMAGED', records
      });

      if (!descriptionText) return result('UNKNOWN', 'Belirtilmemiş / Bulunamadı');

      const text = Utils.normalize(descriptionText);
      const negationRegex = /(?:tramer|hasar)\s*(?:kayd[ıi]\s*)?(?:kesinlikle\s*|hiç\s*|asla\s*)?[:.\-]?\s*(?:yok(?:tur)?|bulunmamaktad[ıi]r|bulunmuyor|s[ıi]f[ıi]r|0(?![\d.,]))|tramersiz|hasars[ıi]z|hasar\s*kay[ıi]ts[ıi]z/g;
      const keywordRegex = /tramer|hasar|kaza(?!s[ıi]z)|çarp/g;
      const priceWordRegex = /fiyat|peşin|kredi|taksit|senet|kapora|takas|pazarl[ıi]k|satış/g;
      const unitAfterRegex = new RegExp(`^(?:km|kilometre|model|y[ıi]l|sene|ay(?![${TR_LETTER}])|taksit|vade|cc|hp|bg|kw|beygir|%|adet|gün|lt|litre|bin\\s*km)`);
      const moneyRegex = new RegExp(`(?<![\\d.,])(\\d{1,3}(?:[.,]\\d{3})+|\\d+(?:[.,]\\d{1,2})?)(?!\\d)(\\s*bin(?![${TR_LETTER}]))?(\\s*(?:tl|₺|lira|try)(?![${TR_LETTER}]))?`, 'g');

      const toAmount = (raw, hasBin) => {
        if (hasBin) return Math.round(parseFloat(raw.replace(',', '.')) * 1000);
        if (/^\d{1,3}(?:[.,]\d{3})+$/.test(raw)) return parseInt(raw.replace(/[.,]/g, ''), 10);
        return parseInt(raw, 10); // "1500,50" -> 1500
      };

      const spans = (regex, line) => Array.from(line.matchAll(regex), m => [m.index, m.index + m[0].length]);
      const distance = ([s, e], [ks, ke]) => Math.max(0, ks - e, s - ke);
      const nearest = (span, list) => list.reduce((min, k) => Math.min(min, distance(span, k)), Infinity);

      const amounts = [];
      const lines = text.split(/\r?\n|[.;!?](?=\s|$)\s*/);

      for (const rawLine of lines) {
        // Remove "tramer yok"-style phrases so their keyword cannot vouch for a nearby number
        const line = rawLine.replace(negationRegex, m => ' '.repeat(m.length));
        const keywords = spans(keywordRegex, line);
        if (!keywords.length) continue;
        const priceWords = spans(priceWordRegex, line);

        for (const m of line.matchAll(moneyRegex)) {
          const span = [m.index, m.index + m[0].length];
          const after = line.slice(span[1]).trimStart();
          if (unitAfterRegex.test(after)) continue;

          const hasBin = Boolean(m[2]);
          const hasCurrency = Boolean(m[3]);
          const value = toAmount(m[1], hasBin);
          if (!Number.isFinite(value)) continue;

          if (!hasBin && !hasCurrency) {
            const isYear = /^\d{4}$/.test(m[1]) && value >= 1950 && value <= 2035;
            if (isYear || value < 1000) continue;
          }

          // Price words ("fiyat 850.000 TL") only claim numbers that follow them
          const kwDist = nearest(span, keywords);
          const priceDist = nearest(span, priceWords.filter(([, end]) => end <= span[0]));
          if (kwDist > 40 || kwDist > priceDist) continue;

          if (value >= 500 && value <= 10000000 && !amounts.includes(value)) amounts.push(value);
        }
      }

      if (amounts.length > 0) {
        const total = amounts.reduce((acc, curr) => acc + curr, 0);
        const records = amounts.map(v => Utils.formatTl(v));
        const msg = records.length > 1 ? `Toplam: ${Utils.formatTl(total)} (${records.length} Kayıt)` : `Tramer Kaydı: ${Utils.formatTl(total)}`;
        return result('DAMAGED', msg, total, records);
      }

      negationRegex.lastIndex = 0;
      if (negationRegex.test(text) || /kazas[ıi]z/.test(text)) {
        return result('CLEAN', 'Tramersiz / Hasar Kaydı Yok', 0);
      }

      if (/tramer|hasar\s*kayd[ıi]|hasarl[ıi]/.test(text)) {
        return result('UNCERTAIN', 'Tramer/Hasar kelimesi geçti, tutar belirsiz.');
      }

      return result('UNKNOWN', 'Belirtilmemiş / Bulunamadı');
    },

    extractTramer(text) {
      return this.extractTramerData(text);
    },

    /**
     * Finds flag terms as word starts ("pert" must not match "ekspertiz") and skips
     * negated mentions such as "ağır hasar kaydı yoktur" or "şase orijinal".
     */
    findTerms(text, terms, { skipNegated }) {
      if (!text) return [];
      const lower = Utils.normalize(text);
      const negatedAfter = /^[^.,;\n]{0,20}?(?:yok|değil|bulunma|olmayan|yoktur|orijinal|sağlam|temiz)/;
      return terms.filter(term => {
        const regex = new RegExp(`(?<![${TR_LETTER}])${Utils.escapeRegex(Utils.normalize(term))}`, 'g');
        for (const m of lower.matchAll(regex)) {
          if (skipNegated && negatedAfter.test(lower.slice(m.index + m[0].length))) continue;
          return true;
        }
        return false;
      });
    },

    extractRedFlags(text) {
      return this.findTerms(text, CONFIG.RED_FLAGS, { skipNegated: true });
    },

    extractGreenFlags(text) {
      return this.findTerms(text, CONFIG.GREEN_FLAGS, { skipNegated: false });
    },

    /**
     * Extracts visual car damage states for each body part from parsed DOM
     */
    extractExpertiseDiagram(doc) {
      const partStates = {
        kaput: 'orijinal',
        tavan: 'orijinal',
        bagaj: 'orijinal',
        solOnCamurluk: 'orijinal',
        solOnKapi: 'orijinal',
        solArkaKapi: 'orijinal',
        solArkaCamurluk: 'orijinal',
        sagOnCamurluk: 'orijinal',
        sagOnKapi: 'orijinal',
        sagArkaKapi: 'orijinal',
        sagArkaCamurluk: 'orijinal',
        onTampon: 'orijinal',
        arkaTampon: 'orijinal'
      };

      let degisen = 0, boya = 0, lokalBoya = 0;
      if (!doc) return { degisen, boya, lokalBoya, partStates, hasExpertise: false };

      const mapPartKey = (textOrCls) => {
        const str = Utils.normalize(textOrCls);
        if (str.includes('kaput')) return 'kaput';
        if (str.includes('tavan')) return 'tavan';
        if (str.includes('bagaj') || str.includes('arka kapak')) return 'bagaj';
        if (str.includes('sol ön çamurluk') || str.includes('sol-on-camurluk')) return 'solOnCamurluk';
        if (str.includes('sol ön kapı') || str.includes('sol-on-kapi')) return 'solOnKapi';
        if (str.includes('sol arka kapı') || str.includes('sol-arka-kapi')) return 'solArkaKapi';
        if (str.includes('sol arka çamurluk') || str.includes('sol-arka-camurluk')) return 'solArkaCamurluk';
        if (str.includes('sağ ön çamurluk') || str.includes('sag-on-camurluk')) return 'sagOnCamurluk';
        if (str.includes('sağ ön kapı') || str.includes('sag-on-kapi')) return 'sagOnKapi';
        if (str.includes('sağ arka kapı') || str.includes('sag-arka-kapi')) return 'sagArkaKapi';
        if (str.includes('sağ arka çamurluk') || str.includes('sag-arka-camurluk')) return 'sagArkaCamurluk';
        if (str.includes('ön tampon') || str.includes('on-tampon')) return 'onTampon';
        if (str.includes('arka tampon') || str.includes('arka-tampon')) return 'arkaTampon';
        return null;
      };

      const mark = (partKey, state) => {
        if (state === 'degisen') degisen++;
        if (state === 'boya') boya++;
        if (state === 'lokalBoya') lokalBoya++;
        if (partKey) partStates[partKey] = state;
      };

      let currentType = null;
      let foundAny = false;

      // Strategy 1: Iterate over standard Sahibinden expertise lists
      doc.querySelectorAll('li').forEach(li => {
        const cls = li.className || '';
        const text = li.textContent || '';

        if (cls.includes('changed-new')) { currentType = 'degisen'; return; }
        if (cls.includes('local-painted-new')) { currentType = 'lokalBoya'; return; }
        if (cls.includes('painted-new') && !cls.includes('local')) { currentType = 'boya'; return; }
        if (cls.includes('pair-title')) { currentType = null; return; }
        if (cls.includes('selected-damage') && currentType) {
          foundAny = true;
          mark(mapPartKey(text) || mapPartKey(cls), currentType);
        }
      });

      // Strategy 2: Check for direct expertise diagram elements or attributes if Strategy 1 found no specific parts
      if (!foundAny) {
        doc.querySelectorAll('[class*="expertise"], [class*="damage"], [class*="report"] [data-part], svg [id*="part"]').forEach(el => {
          const cls = (el.className && typeof el.className === 'string') ? el.className : (el.getAttribute('class') || '');
          const id = el.id || el.getAttribute('data-part') || '';
          const text = el.textContent || '';

          let state = null;
          if (cls.includes('changed') || cls.includes('degisen')) state = 'degisen';
          else if (cls.includes('local') || cls.includes('lokal')) state = 'lokalBoya';
          else if (cls.includes('painted') || cls.includes('boya')) state = 'boya';

          if (state) {
            const partKey = mapPartKey(id) || mapPartKey(cls) || mapPartKey(text);
            if (partKey && partStates[partKey] === 'orijinal') {
              foundAny = true;
              mark(partKey, state);
            }
          }
        });
      }

      return {
        degisen,
        boya,
        lokalBoya,
        partStates,
        hasExpertise: foundAny
      };
    },

    /**
     * Statements in the description that contradict the structured data
     */
    findContradictions({ tramer, greenFlags, expertise, heavyDamage }) {
      const issues = [];
      const has = (flag) => greenFlags.includes(flag);
      if (has('boyasız') && (expertise.boya + expertise.lokalBoya) > 0) {
        issues.push('Açıklamada "boyasız" yazıyor ama ekspertizde boyalı parça var.');
      }
      if (has('değişensiz') && expertise.degisen > 0) {
        issues.push('Açıklamada "değişensiz" yazıyor ama ekspertizde değişen parça var.');
      }
      if (heavyDamage === true && (tramer.status === 'CLEAN' || has('kazasız'))) {
        issues.push('Açıklama temiz diyor ama ilan bilgisinde "Ağır Hasar Kayıtlı: Evet".');
      }
      if (tramer.status === 'DAMAGED' && greenFlags.some(f => /tramer|hasar kay/.test(f))) {
        issues.push('Hem "tramersiz" hem tramer tutarı yazılmış.');
      }
      return issues;
    },

    /**
     * Complete extraction pipeline off a SINGLE parsed document for maximum performance
     */
    async analyzeListing(url, listingId) {
      const { doc, status } = await this.fetchAndParse(url);
      if (!doc) return { error: true, reason: status === 429 ? 'rateLimited' : 'network' };

      const descText = this.extractDescriptionText(doc);
      const info = this.extractInfoList(doc);

      // Neither a description nor the info list: almost certainly a captcha / login wall
      if (!descText && Object.keys(info).length === 0) return { error: true, reason: 'blocked' };
      HealthMonitor.noteFetched(Object.keys(info).length > 0);

      const heavyDamageRaw = info['ağır hasar kayıtlı'];
      const heavyDamage = heavyDamageRaw ? Utils.normalize(heavyDamageRaw).startsWith('evet') : null;

      const tramer = this.extractTramer(descText);
      const redFlags = this.extractRedFlags(descText);
      const greenFlags = this.extractGreenFlags(descText);
      const expertise = this.extractExpertiseDiagram(doc);
      const contradictions = this.findContradictions({ tramer, greenFlags, expertise, heavyDamage });

      const id = listingId || Utils.listingIdFromUrl(url);
      const price = this.extractDetailPrice(doc);
      const priceHistory = id
        ? (price ? await PriceTracker.record(id, price) : await PriceTracker.get(id))
        : null;

      return {
        error: false,
        tramer,
        redFlags,
        greenFlags,
        expertise,
        contradictions,
        heavyDamage,
        priceHistory,
        listingDate: Utils.parseTrDate(info['ilan tarihi'] || ''),
        seller: info['kimden'] || null,
        parts: { degisen: expertise.degisen, boya: expertise.boya, lokalBoya: expertise.lokalBoya },
        hasDescription: descText.length > 0
      };
    }
  };

  // ==========================================
  // 6. RISK SCORING
  // ==========================================
  const RiskScorer = {
    score(data) {
      const exp = data.expertise;
      let score = 15;
      if (data.heavyDamage === true) score += 40;
      if (data.tramer.status === 'DAMAGED') {
        score += 15;
        if (data.tramer.amount >= 50000) score += 10;
        if (data.tramer.amount >= 150000) score += 10;
      } else if (data.tramer.status === 'UNCERTAIN') {
        score += 10;
      }
      score += Math.min(30, exp.degisen * 10);
      score += Math.min(16, exp.boya * 4);
      score += Math.min(6, exp.lokalBoya * 2);
      score += Math.min(24, data.redFlags.length * 8);
      score += Math.min(20, data.contradictions.length * 10);
      if (data.greenFlags.length > 0 && data.contradictions.length === 0) score -= 5;
      return Math.min(100, Math.max(5, score));
    },

    questions(data) {
      const exp = data.expertise;
      const q = [];
      if (data.heavyDamage === true) q.push('Ağır hasarın nedeni ve onarım belgeleri nedir?');
      if (data.tramer.status === 'DAMAGED' || data.tramer.status === 'UNCERTAIN') q.push('Güncel tramer sorgusunu (SBM) paylaşabilir misiniz?');
      if (exp.degisen > 0) q.push('Değişen parçalar neden değişti, orijinal parça mı?');
      if (!exp.hasExpertise) q.push('Ekspertiz raporu var mı, bağımsız ekspertize izin verir misiniz?');
      if (data.contradictions.length > 0) q.push('Açıklama ile ilan bilgilerindeki çelişkinin nedeni nedir?');
      if (data.redFlags.length > 0) q.push('Açıklamadaki riskli ifadelerin nedeni nedir?');
      if (data.greenFlags.length === 0) q.push('Aracın servis kaydı var mı?');
      return q.slice(0, 4);
    }
  };

  // ==========================================
  // 7. PRICE BADGES ON SEARCH ROWS & DETAIL PAGE
  // ==========================================
  const PriceDecorator = {
    chipHtml(summary) {
      const pct = Math.abs(summary.pct).toLocaleString('tr-TR', { maximumFractionDigits: 1 });
      const cls = summary.diff < 0 ? 'shb-price-chip-drop' : 'shb-price-chip-rise';
      return { cls, label: `${summary.diff < 0 ? '↓' : '↑'} %${pct}` };
    },

    decorate(container, history) {
      const summary = PriceTracker.summarize(history);
      if (!container || !summary || summary.diff === 0) return;
      const { cls, label } = this.chipHtml(summary);

      let chip = container.querySelector('.shb-price-chip');
      if (!chip) {
        chip = document.createElement('span');
        container.appendChild(chip);
      }
      chip.className = `shb-price-chip ${cls}`;
      chip.textContent = label;
      chip.title = `İlk görülen: ${Utils.formatTl(summary.firstPrice)} (${Utils.formatDate(summary.firstTs)})\n` +
        `Şimdi: ${Utils.formatTl(summary.lastPrice)} · ${summary.changes} değişiklik (Sahiden yerel kaydı)`;
    },

    async trackRows(rows) {
      const entries = [];
      rows.forEach(row => {
        if (row.dataset.shbPriceTracked) return;
        row.dataset.shbPriceTracked = '1';
        const priceEl = row.querySelector(CONFIG.SELECTORS.ROW_PRICE);
        const price = priceEl && Utils.parseTlPrice(priceEl.textContent);
        if (price) entries.push({ id: row.getAttribute('data-id'), price, priceEl });
      });
      if (!entries.length) return;

      const histories = await PriceTracker.recordMany(entries);
      entries.forEach(({ id, priceEl }) => this.decorate(priceEl, histories[id]));
    },

    async trackDetailPage() {
      const id = Utils.listingIdFromUrl(location.pathname);
      if (!id) return;
      const priceEl = document.querySelector(CONFIG.SELECTORS.DETAIL_PRICE);
      const price = priceEl && Utils.parseTlPrice(priceEl.textContent);
      if (!price) return;
      const history = await PriceTracker.record(id, price);
      this.decorate(priceEl, history);
    }
  };

  // ==========================================
  // 8. POPUP UI/UX MANAGER MODULE
  // ==========================================
  const EXPERTISE_PARTS = [
    { key: 'onTampon', label: 'Ön Tampon', x: 45, y: 8, w: 70, h: 14, rx: 5 },
    { key: 'kaput', label: 'Kaput', x: 45, y: 26, w: 70, h: 48, rx: 4 },
    { key: 'tavan', label: 'Tavan', x: 45, y: 78, w: 70, h: 84, rx: 4 },
    { key: 'bagaj', label: 'Bagaj', x: 45, y: 166, w: 70, h: 46, rx: 4 },
    { key: 'arkaTampon', label: 'Arka Tampon', x: 45, y: 216, w: 70, h: 14, rx: 5 },
    { key: 'solOnCamurluk', label: 'Sol Ön Çamurluk', x: 16, y: 26, w: 25, h: 42, rx: 3 },
    { key: 'solOnKapi', label: 'Sol Ön Kapı', x: 16, y: 72, w: 25, h: 44, rx: 3 },
    { key: 'solArkaKapi', label: 'Sol Arka Kapı', x: 16, y: 120, w: 25, h: 44, rx: 3 },
    { key: 'solArkaCamurluk', label: 'Sol Arka Çamurluk', x: 16, y: 168, w: 25, h: 44, rx: 3 },
    { key: 'sagOnCamurluk', label: 'Sağ Ön Çamurluk', x: 119, y: 26, w: 25, h: 42, rx: 3 },
    { key: 'sagOnKapi', label: 'Sağ Ön Kapı', x: 119, y: 72, w: 25, h: 44, rx: 3 },
    { key: 'sagArkaKapi', label: 'Sağ Arka Kapı', x: 119, y: 120, w: 25, h: 44, rx: 3 },
    { key: 'sagArkaCamurluk', label: 'Sağ Arka Çamurluk', x: 119, y: 168, w: 25, h: 44, rx: 3 }
  ];

  const ERROR_MESSAGES = {
    network: 'İlan detayları alınamadı. Ağ bağlantınızı veya oturumunuzu kontrol edin.',
    rateLimited: 'Sahibinden çok fazla istek algıladı. Biraz bekleyip tekrar deneyin.',
    blocked: 'Sahibinden ilan sayfasını vermedi (robot doğrulaması olabilir). Bir ilanı normal şekilde açıp doğrulamayı geçtikten sonra tekrar deneyin.'
  };

  const PopupManager = {
    getOrCreatePopup() {
      if (State.activePopupEl && document.body.contains(State.activePopupEl)) {
        return State.activePopupEl;
      }
      const popup = document.createElement('div');
      popup.id = 'shb-analysis-popup';
      popup.className = 'shb-popup-glass';
      document.body.appendChild(popup);
      State.activePopupEl = popup;
      return popup;
    },

    positionPopup(targetEl, popupEl) {
      const rect = targetEl.getBoundingClientRect();
      const scrollX = window.pageXOffset || document.documentElement.scrollLeft;
      const scrollY = window.pageYOffset || document.documentElement.scrollTop;
      const viewportWidth = window.innerWidth;
      const viewportHeight = window.innerHeight;

      let top = rect.top + scrollY + 10;
      let left = rect.right + scrollX + 15;

      const popupRect = popupEl.getBoundingClientRect();
      const popupWidth = popupRect.width || 340;
      const popupHeight = popupRect.height || 220;

      if (rect.right + 15 + popupWidth > viewportWidth) {
        left = rect.left + scrollX - popupWidth - 15;
        if (left < scrollX) {
          left = Math.max(10 + scrollX, rect.left + scrollX);
          top = rect.bottom + scrollY + 10;
        }
      }

      if (top - scrollY + popupHeight > viewportHeight - 10) {
        top = Math.max(scrollY + 10, scrollY + viewportHeight - popupHeight - 10);
      }

      popupEl.style.top = `${top}px`;
      popupEl.style.left = `${left}px`;
    },

    show(targetEl, html) {
      const popup = this.getOrCreatePopup();
      popup.style.display = 'block';
      popup.style.opacity = '1';
      popup.innerHTML = html;
      this.positionPopup(targetEl, popup);
    },

    showLoading(targetEl) {
      this.show(targetEl, `
        <div class="shb-popup-header">
          <span class="shb-header-icon">🔍</span>
          <span class="shb-header-title">Sahiden</span>
        </div>
        <div class="shb-popup-body shb-loading-body">
          <div class="shb-spinner-ring"></div>
          <div>
            <div>İlan detayları inceleniyor...</div>
            <div style="font-size:11px;color:#8B949E;margin-top:3px;">Veriler yükleniyor (Tramer, Fiyat Geçmişi & Ekspertiz)...</div>
          </div>
        </div>
      `);
    },

    renderError(targetEl, reason) {
      this.show(targetEl, `
        <div class="shb-popup-header shb-header-error">
          <span class="shb-header-icon">⚠️</span>
          <span class="shb-header-title">Sahiden</span>
        </div>
        <div class="shb-popup-body">
          <div class="shb-error-msg">${ERROR_MESSAGES[reason] || ERROR_MESSAGES.network}</div>
        </div>
      `);
    },

    summaryHtml(data) {
      const riskScore = RiskScorer.score(data);
      let summaryLevel = 'Düşük Risk';
      let summaryClass = 'shb-summary-safe';
      let summaryIcon = '✅';
      let summaryText = 'Görünürde temiz bir profil var; yine de kritik alanları kontrol etmek iyi olur.';
      if (riskScore >= 70) {
        summaryLevel = 'Yüksek Risk';
        summaryClass = 'shb-summary-danger';
        summaryIcon = '⚠️';
        summaryText = 'Bu ilan yüksek dikkat gerektiriyor; hasar, boya ve şüpheli ifadeler birlikte görülüyor.';
      } else if (riskScore >= 40) {
        summaryLevel = 'Orta Risk';
        summaryClass = 'shb-summary-warning';
        summaryIcon = '🔎';
        summaryText = 'Bazı risk işaretleri var. Ayrıntıları teyit etmek mantıklı olur.';
      }

      const questionsHtml = RiskScorer.questions(data).map(q => `<li class="shb-question-item">• ${q}</li>`).join('');
      const contradictionsHtml = data.contradictions.length
        ? `<ul class="shb-contradiction-list">${data.contradictions.map(c => `<li>⚡ ${c}</li>`).join('')}</ul>`
        : '';

      return `
        <div class="shb-section shb-summary-card">
          <div class="shb-section-title">
            <span class="shb-sec-icon">${summaryIcon}</span> Risk Puanı
          </div>
          <div class="shb-summary-top ${summaryClass}">
            <div class="shb-summary-badge">${riskScore}/100</div>
            <div>
              <div class="shb-summary-title">${summaryLevel}</div>
              <div class="shb-summary-text">${summaryText}</div>
            </div>
          </div>
          ${contradictionsHtml}
          ${questionsHtml ? `<div class="shb-summary-subtitle">Sormanız gereken sorular</div><ul class="shb-question-list">${questionsHtml}</ul>` : ''}
        </div>
      `;
    },

    tramerHtml(data) {
      let tramerClass = 'shb-status-neutral';
      let tramerIcon = '🛡️';
      if (data.tramer.status === 'CLEAN') { tramerClass = 'shb-status-clean'; tramerIcon = '✅'; }
      else if (data.tramer.status === 'DAMAGED') { tramerClass = 'shb-status-danger'; }
      else if (data.tramer.status === 'UNCERTAIN') { tramerClass = 'shb-status-warning'; tramerIcon = '⚠️'; }

      const recordsHtml = data.tramer.records.length > 1
        ? `<ul class="shb-tramer-list">${data.tramer.records.map(rec => `<li>• <strong>${rec}</strong></li>`).join('')}</ul>`
        : '';

      let heavyHtml = '';
      if (data.heavyDamage === true) {
        heavyHtml = '<div class="shb-heavy-damage shb-heavy-yes">🚨 Ağır Hasar Kayıtlı: Evet</div>';
      } else if (data.heavyDamage === false) {
        heavyHtml = '<div class="shb-heavy-damage shb-heavy-no">Ağır Hasar Kayıtlı: Hayır</div>';
      }

      return `
        <div class="shb-section">
          <div class="shb-section-title">
            <span class="shb-sec-icon">${tramerIcon}</span> Hasar Kaydı (Tramer)
          </div>
          <div class="shb-section-content ${tramerClass}">
            <span class="shb-tramer-value">${data.tramer.message}</span>
            ${data.tramer.amount ? `<span class="shb-info-badge" title="İlan açıklamasından otomatik olarak ayıklandı">ⓘ</span>` : ''}
          </div>
          ${recordsHtml}
          ${heavyHtml}
        </div>
      `;
    },

    priceHtml(data) {
      const summary = PriceTracker.summarize(data.priceHistory);
      const ageHtml = data.listingDate
        ? `<div class="shb-price-meta">İlan tarihi: ${Utils.formatDate(data.listingDate)} (${Utils.daysSince(data.listingDate)} gün)${data.seller ? ` · ${Utils.escapeHtml(data.seller)}` : ''}</div>`
        : '';

      let bodyHtml;
      if (!summary) {
        bodyHtml = '<div class="shb-price-empty">Fiyat okunamadı.</div>';
      } else if (summary.changes === 0) {
        bodyHtml = `
          <div class="shb-price-empty">
            ${Utils.formatTl(summary.lastPrice)} — ilk kez ${Utils.formatDate(summary.firstTs)} tarihinde görüldü.
            Fiyat değişirse burada gösterilecek.
          </div>`;
      } else {
        const { cls, label } = PriceDecorator.chipHtml(summary);
        const rows = data.priceHistory.slice().reverse().slice(0, 6).map(([ts, price], i, arr) => {
          const prev = arr[i + 1];
          const arrow = !prev ? '' : price < prev[1] ? '<span class="shb-price-down">↓</span>' : '<span class="shb-price-up">↑</span>';
          return `<li><span>${Utils.formatDate(ts)}</span><span>${arrow} ${Utils.formatTl(price)}</span></li>`;
        }).join('');
        bodyHtml = `
          <div class="shb-section-content">
            <span>${Utils.formatTl(summary.lastPrice)}</span>
            <span class="shb-price-chip ${cls}">${label}</span>
          </div>
          <ul class="shb-price-timeline">${rows}</ul>`;
      }

      const market = data.market;
      const marketHtml = market
        ? `<div class="shb-price-meta">Sayfadaki ${market.count} benzer ilanın ortancası: ${Utils.formatTl(market.median)}
            (<span class="${market.pct < 0 ? 'shb-price-down' : 'shb-price-up'}">${market.pct < 0 ? '−' : '+'}%${Math.abs(market.pct).toFixed(0)}</span>)</div>`
        : '';

      return `
        <div class="shb-section">
          <div class="shb-section-title">
            <span class="shb-sec-icon">📈</span> Fiyat Geçmişi
          </div>
          ${bodyHtml}
          ${marketHtml}
          ${ageHtml}
        </div>
      `;
    },

    expertiseHtml(data) {
      const exp = data.expertise;
      if (!exp.hasExpertise) {
        return `
          <div class="shb-section shb-section-expertise">
            <div class="shb-section-title"><span class="shb-sec-icon">🚗</span> Ekspertiz Durumu</div>
            <div class="shb-price-empty">İlanda boya/değişen bilgisi bulunamadı.</div>
          </div>
        `;
      }

      const getPartColor = (state) => {
        if (state === 'degisen') return { fill: 'rgba(255, 123, 114, 0.75)', stroke: '#FF7B72', label: 'Değişen' };
        if (state === 'boya') return { fill: 'rgba(88, 166, 255, 0.75)', stroke: '#58A6FF', label: 'Boyalı' };
        if (state === 'lokalBoya') return { fill: 'rgba(210, 153, 34, 0.75)', stroke: '#D29922', label: 'Lokal Boyalı' };
        return { fill: 'rgba(255, 255, 255, 0.08)', stroke: 'rgba(255, 255, 255, 0.25)', label: 'Orijinal' };
      };

      const rects = EXPERTISE_PARTS.map(p => {
        const c = getPartColor(exp.partStates[p.key]);
        return `<rect x="${p.x}" y="${p.y}" width="${p.w}" height="${p.h}" rx="${p.rx}" fill="${c.fill}" stroke="${c.stroke}" stroke-width="1.5"><title>${p.label}: ${c.label}</title></rect>`;
      }).join('');

      return `
        <div class="shb-section shb-section-expertise">
          <div class="shb-section-title">
            <span class="shb-sec-icon">🚗</span> Ekspertiz Durumu
          </div>
          <div class="shb-diagram-container">
            <svg viewBox="0 0 160 240" class="shb-car-svg" xmlns="http://www.w3.org/2000/svg">
              ${rects}
              <line x1="45" y1="88" x2="115" y2="88" stroke="rgba(255,255,255,0.2)" stroke-width="1" />
              <line x1="45" y1="152" x2="115" y2="152" stroke="rgba(255,255,255,0.2)" stroke-width="1" />
            </svg>

            <div class="shb-diagram-legend">
              <div class="shb-leg-item"><span class="shb-leg-dot shb-dot-degisen"></span>Değişen (${exp.degisen})</div>
              <div class="shb-leg-item"><span class="shb-leg-dot shb-dot-boya"></span>Boya (${exp.boya})</div>
              <div class="shb-leg-item"><span class="shb-leg-dot shb-dot-lokal"></span>Lokal (${exp.lokalBoya})</div>
              <div class="shb-leg-item"><span class="shb-leg-dot shb-dot-orijinal"></span>Orijinal</div>
            </div>
          </div>
        </div>
      `;
    },

    flagsHtml(data) {
      let html = '';
      if (data.redFlags.length > 0) {
        html += `
          <div class="shb-section shb-section-flags">
            <div class="shb-section-title shb-title-danger">
              <span class="shb-sec-icon">⚠️</span> Şüpheli Kelimeler
            </div>
            <ul class="shb-flag-list">
              ${data.redFlags.map(flag => `<li>• <strong class="shb-flag-word">${flag}</strong></li>`).join('')}
            </ul>
          </div>
        `;
      }
      if (data.greenFlags.length > 0) {
        html += `
          <div class="shb-section shb-section-clean">
            <div class="shb-section-title shb-title-clean">
              <span class="shb-sec-icon">✅</span> Olumlu Terimler
            </div>
            <ul class="shb-flag-list">
              ${data.greenFlags.map(flag => `<li>• <strong class="shb-flag-word-green">${flag}</strong></li>`).join('')}
            </ul>
          </div>
        `;
      }
      return html;
    },

    renderData(targetEl, data) {
      if (data.error) {
        this.renderError(targetEl, data.reason);
        return;
      }

      // Market stats depend on the rows currently on the page, so they are read live, not cached
      const id = targetEl.getAttribute('data-id');
      data = { ...data, market: (CONFIG.MARKET_COMPARISON && id && MarketComparator.stats.get(id)) || null };

      this.show(targetEl, `
        <div class="shb-popup-header">
          <span class="shb-header-icon">🤖</span>
          <span class="shb-header-title">Sahiden</span>
        </div>
        <div class="shb-popup-body">
          ${this.summaryHtml(data)}
          ${this.tramerHtml(data)}
          ${this.priceHtml(data)}
          ${this.expertiseHtml(data)}
          ${this.flagsHtml(data)}
        </div>
      `);
    },

    hidePopup() {
      if (State.activePopupEl) {
        State.activePopupEl.style.opacity = '0';
        State.activePopupEl.style.display = 'none';
      }
    }
  };

  // ==========================================
  // 9. HOVER & EVENT CONTROLLER MODULE
  // ==========================================
  const HoverController = {
    // One request per listing even if the user hovers in and out while it loads
    loadListing(id, href) {
      if (!State.inFlight.has(id)) {
        const request = DataExtractor.analyzeListing(href, id)
          .then(result => {
            if (!result.error) State.setCache(id, result);
            return result;
          })
          .finally(() => State.inFlight.delete(id));
        State.inFlight.set(id, request);
      }
      return State.inFlight.get(id);
    },

    onMouseEnter(event) {
      const tr = event.currentTarget;
      const id = tr.getAttribute('data-id');
      if (!id) return;

      State.currentHoveredId = id;
      clearTimeout(State.activeHoverTimer);

      const cachedData = State.getCached(id);
      if (cachedData) {
        PopupManager.renderData(tr, cachedData);
        return;
      }

      State.activeHoverTimer = setTimeout(async () => {
        if (State.currentHoveredId !== id) return;

        const link = tr.querySelector(CONFIG.SELECTORS.LINK);
        const href = link?.getAttribute('href');
        if (!href) return;

        PopupManager.showLoading(tr);
        const analysisResult = await this.loadListing(id, href);

        if (State.currentHoveredId === id) {
          PopupManager.renderData(tr, analysisResult);
          if (!analysisResult.error) PriceDecorator.decorate(tr.querySelector(CONFIG.SELECTORS.ROW_PRICE), analysisResult.priceHistory);
        }
      }, CONFIG.DEBOUNCE_MS);
    },

    onMouseLeave() {
      State.currentHoveredId = null;
      clearTimeout(State.activeHoverTimer);
      State.activeHoverTimer = null;
      PopupManager.hidePopup();
    },

    attachListeners(rows) {
      rows.forEach(tr => {
        if (tr.dataset.shbTooltipAttached) return;
        tr.dataset.shbTooltipAttached = '1';
        tr.addEventListener('mouseenter', (e) => this.onMouseEnter(e));
        tr.addEventListener('mouseleave', (e) => this.onMouseLeave(e));
      });
    },

    init() {
      const attachAll = () => {
        const rows = document.querySelectorAll(CONFIG.SELECTORS.LISTING_ROW);
        this.attachListeners(rows);
        PriceDecorator.trackRows(rows);
        MarketComparator.refresh();
        HealthMonitor.checkSearchPage(rows);
      };

      const start = async () => {
        await Settings.load();
        attachAll();
        PriceDecorator.trackDetailPage();
        HealthMonitor.checkDetailPage();
        PriceTracker.prune();

        let observerTimer = null;
        new MutationObserver(() => {
          clearTimeout(observerTimer);
          observerTimer = setTimeout(attachAll, CONFIG.OBSERVER_DEBOUNCE_MS);
        }).observe(document.body, { childList: true, subtree: true });
      };

      if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', start);
      } else {
        start();
      }
    }
  };

  if (typeof document !== 'undefined' && typeof window !== 'undefined') {
    HoverController.init();
  }

  // Exposed for the Node test suite only (no `module` exists in the browser)
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = { CONFIG, DataExtractor, MarketComparator, PriceTracker, RiskScorer, Settings, Utils };
  }

})();

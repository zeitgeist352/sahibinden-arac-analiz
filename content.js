(function () {
  'use strict';

  // ==========================================
  // 1. CONFIGURATION & CONSTANTS
  // ==========================================
  const CONFIG = {
    DEBOUNCE_MS: 600,
    CACHE_TTL_MS: 15 * 60 * 1000, // 15 minutes cache TTL
    RED_FLAGS: [
      "sigorta şişirmesi",
      "çıtır hasarlı",
      "bel altı",
      "keyfe keder",
      "çekme belgeli",
      "ağır hasar"
    ],
    GREEN_FLAGS: [
      "tramersiz",
      "tramer kaydı yoktur",
      "tramer yoktur",
      "hasar kaydı yoktur",
      "hasar kayıtsız",
      "yetkili servis bakımlı",
      "ilk sahibinden",
      "garantili",
      "kazasız",
      "değişensiz",
      "boyasız"
    ],
    SELECTORS: {
      LISTING_ROW: 'tr.searchResultsItem[data-id], .classified-list-item[data-id]',
      LINK: 'a[href*="/ilan/"]',
      DESCRIPTION: '#classifiedDescription, .classifiedDescription, div[class*="description"]'
    }
  };

  // ==========================================
  // 2. STATE MANAGEMENT & CACHE
  // ==========================================
  const State = {
    cache: new Map(),
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
  // 3. DOM PARSING & DATA EXTRACTION MODULE
  // ==========================================
  const DataExtractor = {
    /**
     * Fetches listing page HTML and parses it into a single DOM object
     */
    async fetchAndParse(url) {
      try {
        const fullUrl = url.startsWith('http') ? url : `https://www.sahibinden.com${url}`;
        const response = await fetch(fullUrl, {
          headers: {
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8'
          }
        });
        if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);

        const htmlText = await response.text();
        const parser = new DOMParser();
        const doc = parser.parseFromString(htmlText, 'text/html');
        return doc;
      } catch (error) {
        console.warn('[SHB] Fetch error for URL:', url, error);
        return null;
      }
    },

    /**
     * Extracts vehicle description text from parsed document
     */
    extractDescriptionText(doc) {
      if (!doc) return '';
      const descEl = doc.querySelector(CONFIG.SELECTORS.DESCRIPTION);
      if (descEl) {
        return descEl.innerText || descEl.textContent || '';
      }
      const bodyText = doc.body ? (doc.body.innerText || doc.body.textContent || '') : '';
      return bodyText;
    },

    /**
     * Extracts Tramer / Damage record information using Regex
     */
    /**
     * Strictly refactored Tramer (Damage Record) extraction function.
     * Follows Zero Tramer Priority, Strict Context Matching, and "Bin" Abbreviation Normalization.
     */
    extractTramerData(descriptionText) {
      if (!descriptionText) {
        return { status: "UNKNOWN", message: "Belirtilmemiş / Bulunamadı", text: "Belirtilmemiş / Bulunamadı", amount: null, hasTramer: false, records: [] };
      }

      // ------------------------------------------------------------------------
      // STEP 1: Negative Check - Highest Priority
      // ------------------------------------------------------------------------
      const negativeRegex = /tramer\s*(?:kayd[ıi]\s*)?(?:kesinlikle\s*|hiç\s*|asla\s*)?[:.\-]?\s*(?:yok(?:tur)?|bulunmamaktad[ıi]r|s[ıi]f[ıi]r)|hasar\s*(?:kayd[ıi]\s*)?(?:kesinlikle\s*|hiç\s*|asla\s*)?[:.\-]?\s*(?:yok(?:tur)?|bulunmamaktad[ıi]r|s[ıi]f[ıi]r)|tramersiz|hasars[ıi]z|hasar\s*kay[ıi]ts[ıi]z|kazas[ıi]z|bedelsiz\s*hasar/i;
      if (negativeRegex.test(descriptionText)) {
        return {
          status: "CLEAN",
          message: "Tramersiz / Hasar Kaydı Yok",
          text: "Tramersiz / Hasar Kaydı Yok",
          amount: 0,
          hasTramer: false,
          records: []
        };
      }

      // ------------------------------------------------------------------------
      // RULE 3 HELPER: Normalization of "bin" abbreviations & numbers
      // ------------------------------------------------------------------------
      const normalizeAmount = (rawNumStr, hasBinWord) => {
        let str = rawNumStr.trim();
        if (hasBinWord) {
          str = str.replace(',', '.');
          const val = parseFloat(str);
          if (isNaN(val)) return 0;
          return Math.round(val * 1000);
        } else {
          const cleanStr = str.replace(/[.,]/g, '');
          const val = parseInt(cleanStr, 10);
          return isNaN(val) ? 0 : val;
        }
      };

      const amounts = [];
      const records = [];

      const addRecord = (numVal) => {
        if (numVal >= 500 && !amounts.includes(numVal)) {
          amounts.push(numVal);
          records.push(numVal.toLocaleString('tr-TR') + ' TL');
        }
      };

      // ------------------------------------------------------------------------
      // STEP 2: Amount Extraction
      // ------------------------------------------------------------------------
      const lines = descriptionText.split(/\r?\n|\.\s+|\;\s+/);
      for (const line of lines) {
        const isDamageContext = /(?:tramer|hasar|çarp(?:ma|ı[şs]ma)|kaza|sorgu|tarihli)/i.test(line);
        if (isDamageContext) {
          const moneyRegex = /(?<!\d)(\d{1,3}(?:[.,]\d{3})*(?:[.,]\d{1,2})?|\d{3,7})\s*(bin)?\s*(?:tl|₺|lira)(?!\d)/gi;
          let match;
          while ((match = moneyRegex.exec(line)) !== null) {
            const val = normalizeAmount(match[1], Boolean(match[2]));
            addRecord(val);
          }

          const binNearKeywordRegex = /(?<!\d)(\d{1,3}(?:[.,]\d{1,2})?)\s*(bin)\s*(?:tramer|hasar)/gi;
          while ((match = binNearKeywordRegex.exec(line)) !== null) {
            const val = normalizeAmount(match[1], true);
            addRecord(val);
          }

          const proximityRegexes = [
            /(?:tramer(?:i|in|de)?|hasar(?: kayd[ıi])?)[\s\S]{0,35}?(?<!\d)(\d{1,3}(?:[.,]\d{3})*(?:[.,]\d{1,2})?|\d{3,7})\s*(bin)?(?!\d)/gi,
            /(?<!\d)(\d{1,3}(?:[.,]\d{3})*(?:[.,]\d{1,2})?|\d{3,7})\s*(bin)?[\s\S]{0,35}?(?:tramer(?:i|in|de)?|hasar(?: kayd[ıi])?)/gi
          ];
          for (const proxRegex of proximityRegexes) {
            while ((match = proxRegex.exec(line)) !== null) {
              const val = normalizeAmount(match[1], Boolean(match[2]));
              addRecord(val);
            }
          }
        }
      }

      if (amounts.length > 0) {
        const totalAmount = amounts.reduce((acc, curr) => acc + curr, 0);
        const totalFormatted = totalAmount.toLocaleString('tr-TR') + ' TL';
        const msg = records.length > 1 ? `Toplam: ${totalFormatted} (${records.length} Kayıt)` : `Tramer Kaydı: ${totalFormatted}`;
        return {
          status: "DAMAGED",
          message: msg,
          text: msg,
          amount: totalAmount,
          hasTramer: true,
          records: records
        };
      }

      // ------------------------------------------------------------------------
      // STEP 3: Fallback - Uncertain Amount
      // ------------------------------------------------------------------------
      if (/(?:tramer|hasar(?: kayd[ıi])?|hasarl[ıi])/i.test(descriptionText)) {
        return {
          status: "UNCERTAIN",
          message: "Tramer/Hasar kelimesi geçti, tutar belirsiz.",
          text: "Tramer/Hasar kelimesi geçti, tutar belirsiz.",
          amount: null,
          hasTramer: false,
          records: []
        };
      }

      return {
        status: "UNKNOWN",
        message: "Belirtilmemiş / Bulunamadı",
        text: "Belirtilmemiş / Bulunamadı",
        amount: null,
        hasTramer: false,
        records: []
      };
    },

    extractTramer(text) {
      return this.extractTramerData(text);
    },

    /**
     * Scans description text for red flag manipulative seller terms
     */
    extractRedFlags(text) {
      if (!text) return [];
      const foundFlags = [];
      const lowerText = text.toLocaleLowerCase('tr-TR');

      for (const flag of CONFIG.RED_FLAGS) {
        const lowerFlag = flag.toLocaleLowerCase('tr-TR');
        if (lowerText.includes(lowerFlag)) {
          foundFlags.push(flag);
        }
      }
      return foundFlags;
    },

    /**
     * Scans description text for green flag positive seller terms
     */
    extractGreenFlags(text) {
      if (!text) return [];
      const foundFlags = [];
      const lowerText = text.toLocaleLowerCase('tr-TR');

      for (const flag of CONFIG.GREEN_FLAGS) {
        const lowerFlag = flag.toLocaleLowerCase('tr-TR');
        if (lowerText.includes(lowerFlag)) {
          foundFlags.push(flag);
        }
      }
      return foundFlags;
    },

    /**
     * Scrapes Price History directly from listing detail page HTML (DOM tables & script tags)
     */
    extractPriceHistory(doc) {
      if (!doc) return { success: false, data: [] };
      const history = [];

      try {
        // Strategy 1: Check embedded JSON or JavaScript variables in <script> tags
        const scripts = doc.querySelectorAll('script');
        for (const script of scripts) {
          const text = script.textContent || '';
          if (text.includes('priceHistory') || text.includes('fiyatGecmisi') || text.includes('price_history') || text.includes('historyList')) {
            const match = text.match(/\[\s*\{[^\]]*?(?:date|tarih|price|fiyat)[^\]]*?\}\s*\]/i);
            if (match && match[0]) {
              try {
                const parsed = JSON.parse(match[0]);
                if (Array.isArray(parsed) && parsed.length > 0) {
                  parsed.forEach(item => {
                    const dateVal = item.date || item.tarih || item.createdDate || '';
                    const priceVal = item.price || item.fiyat || item.amount || 0;
                    if (dateVal && priceVal) {
                      history.push({
                        date: String(dateVal).split('T')[0],
                        price: Number(String(priceVal).replace(/[^0-9]/g, ''))
                      });
                    }
                  });
                  if (history.length > 0) return { success: true, data: history };
                }
              } catch (e) { /* ignore JSON parse errors */ }
            }
          }
        }

        // Strategy 2: Check DOM tables / list items (e.g., price history modals or history tables)
        const rows = doc.querySelectorAll('#priceHistoryModal tr, .price-history-table tr, table[class*="price-history"] tr, .price-history-list li, ul[class*="history"] li');
        rows.forEach(row => {
          const text = row.innerText || row.textContent || '';
          const dateMatch = text.match(/(\d{2}[./-]\d{2}[./-]\d{4}|\d{4}[./-]\d{2}[./-]\d{2})/);
          const priceMatch = text.match(/(\d{1,3}(?:[.,]\d{3})+)\s*(?:TL|₺)?/i);
          if (dateMatch && priceMatch) {
            const dateStr = dateMatch[1];
            const priceVal = Number(priceMatch[1].replace(/[.,]/g, ''));
            if (priceVal > 1000) {
              history.push({ date: dateStr, price: priceVal });
            }
          }
        });

        if (history.length > 0) {
          return { success: true, data: history };
        }
      } catch (err) {
        console.warn('[SHB] Price history DOM scraping error:', err);
      }

      return { success: false, data: [] };
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
        const str = textOrCls.toLocaleLowerCase('tr-TR');
        if (str.includes('kaput') || str.includes('motor kaput')) return 'kaput';
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
        if (str.includes('arka tampon')) return 'arkaTampon';
        return null;
      };

      let currentType = null;
      let foundAny = false;

      // Strategy 1: Iterate over standard Sahibinden expertise lists
      doc.querySelectorAll('li').forEach(li => {
        const cls = li.className || '';
        const text = li.innerText || li.textContent || '';

        if (cls.includes('changed-new')) { currentType = 'degisen'; return; }
        if (cls.includes('local-painted-new')) { currentType = 'lokalBoya'; return; }
        if (cls.includes('painted-new') && !cls.includes('local')) { currentType = 'boya'; return; }
        if (cls.includes('pair-title')) { currentType = null; return; }
        if (cls.includes('selected-damage') && currentType) {
          foundAny = true;
          if (currentType === 'degisen') degisen++;
          if (currentType === 'boya') boya++;
          if (currentType === 'lokalBoya') lokalBoya++;

          const partKey = mapPartKey(text) || mapPartKey(cls);
          if (partKey) {
            partStates[partKey] = currentType;
          }
        }
      });

      // Strategy 2: Check for direct expertise diagram elements or attributes if Strategy 1 found no specific parts
      if (!foundAny) {
        doc.querySelectorAll('[class*="expertise"], [class*="damage"], [class*="report"] [data-part], svg [id*="part"]').forEach(el => {
          const cls = (el.className && typeof el.className === 'string') ? el.className : (el.getAttribute('class') || '');
          const id = el.id || el.getAttribute('data-part') || '';
          const text = el.innerText || el.textContent || '';

          let state = null;
          if (cls.includes('changed') || cls.includes('degisen') || cls.includes('red')) state = 'degisen';
          else if (cls.includes('local') || cls.includes('lokal') || cls.includes('yellow')) state = 'lokalBoya';
          else if (cls.includes('painted') || cls.includes('boya') || cls.includes('blue')) state = 'boya';

          if (state) {
            const partKey = mapPartKey(id) || mapPartKey(cls) || mapPartKey(text);
            if (partKey && partStates[partKey] === 'orijinal') {
              partStates[partKey] = state;
              foundAny = true;
              if (state === 'degisen') degisen++;
              if (state === 'boya') boya++;
              if (state === 'lokalBoya') lokalBoya++;
            }
          }
        });
      }

      return {
        degisen,
        boya,
        lokalBoya,
        partStates,
        hasExpertise: foundAny || (degisen > 0 || boya > 0 || lokalBoya > 0)
      };
    },

    /**
     * Complete extraction pipeline off a SINGLE parsed document for maximum performance
     */
    async analyzeListing(url) {
      const doc = await this.fetchAndParse(url);
      if (!doc) return { error: true };

      const descText = this.extractDescriptionText(doc);
      const tramer = this.extractTramer(descText);
      const redFlags = this.extractRedFlags(descText);
      const greenFlags = this.extractGreenFlags(descText);
      const priceHistory = this.extractPriceHistory(doc);
      const expertise = this.extractExpertiseDiagram(doc);

      return {
        error: false,
        tramer,
        redFlags,
        greenFlags,
        priceHistory,
        expertise,
        parts: { degisen: expertise.degisen, boya: expertise.boya, lokalBoya: expertise.lokalBoya },
        hasDescription: descText.length > 0
      };
    }
  };

  // ==========================================
  // 4. POPUP UI/UX MANAGER MODULE
  // ==========================================
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

    showLoading(targetEl) {
      const popup = this.getOrCreatePopup();
      popup.style.display = 'block';
      popup.style.opacity = '1';
      popup.innerHTML = `
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
      `;
      this.positionPopup(targetEl, popup);
    },

    renderData(targetEl, data) {
      const popup = this.getOrCreatePopup();
      popup.style.display = 'block';
      popup.style.opacity = '1';

      if (data.error) {
        popup.innerHTML = `
          <div class="shb-popup-header shb-header-error">
            <span class="shb-header-icon">⚠️</span>
            <span class="shb-header-title">Sahiden</span>
          </div>
          <div class="shb-popup-body">
            <div class="shb-error-msg">İlan detayları alınamadı. Ağ bağlantınızı veya oturumunuzu kontrol edin.</div>
          </div>
        `;
        this.positionPopup(targetEl, popup);
        return;
      }

      // Section 1: Tramer
      let tramerClass = 'shb-status-neutral';
      let tramerIcon = '🛡️';
      if (data.tramer.status === 'CLEAN' || data.tramer.status === 'clean') { tramerClass = 'shb-status-clean'; tramerIcon = '✅'; }
      else if (data.tramer.status === 'DAMAGED' || data.tramer.status === 'danger') { tramerClass = 'shb-status-danger'; tramerIcon = '🛡️'; }
      else if (data.tramer.status === 'UNCERTAIN' || data.tramer.status === 'warning') { tramerClass = 'shb-status-warning'; tramerIcon = '⚠️'; }

      let tramerRecordsListHtml = '';
      if (data.tramer.records && data.tramer.records.length > 1) {
        const listItems = data.tramer.records.map(rec => `<li>• <strong style="color:#FF7B72;">${rec}</strong></li>`).join('');
        tramerRecordsListHtml = `
          <ul class="shb-tramer-list" style="margin:6px 0 0 4px;padding:0;list-style:none;display:flex;flex-direction:column;gap:3px;font-size:12.5px;color:#E6EDF3;">
            ${listItems}
          </ul>
        `;
      }

      const displayValue = data.tramer.message || data.tramer.text || "Belirtilmemiş";

      const exp = data.expertise || { degisen: 0, boya: 0, lokalBoya: 0, partStates: {}, hasExpertise: false };
      const redFlags = Array.isArray(data.redFlags) ? data.redFlags : [];
      const greenFlags = Array.isArray(data.greenFlags) ? data.greenFlags : [];
      const expertiseCount = (exp.degisen || 0) + (exp.boya || 0) + (exp.lokalBoya || 0);

      let riskScore = 20;
      if (data.tramer.status === 'DAMAGED') riskScore += 35;
      else if (data.tramer.status === 'UNCERTAIN') riskScore += 15;
      riskScore += Math.min(20, expertiseCount * 8);
      riskScore += Math.min(15, redFlags.length * 5);
      if (!data.priceHistory || !data.priceHistory.success) riskScore += 5;
      if (greenFlags.length > 0) riskScore = Math.max(10, riskScore - 8);
      riskScore = Math.min(100, Math.max(10, riskScore));

      let summaryLevel = 'Düşük Risk';
      let summaryClass = 'shb-summary-safe';
      let summaryIcon = '✅';
      if (riskScore >= 70) {
        summaryLevel = 'Yüksek Risk';
        summaryClass = 'shb-summary-danger';
        summaryIcon = '⚠️';
      } else if (riskScore >= 40) {
        summaryLevel = 'Orta Risk';
        summaryClass = 'shb-summary-warning';
        summaryIcon = '🔎';
      }

      const summaryText = riskScore >= 70
        ? 'Bu ilan yüksek dikkat gerektiriyor; hasar, boya ve şüpheli ifadeler birlikte görülüyor.'
        : riskScore >= 40
          ? 'Bazı risk işaretleri var. Ayrıntıları teyit etmek mantıklı olur.'
          : 'Görünürde temiz bir profil var; yine de kritik alanları kontrol etmek iyi olur.';

      const followUpQuestions = [];
      if (data.tramer.status === 'DAMAGED' || data.tramer.status === 'UNCERTAIN') {
        followUpQuestions.push('Hasar raporu veya tramer bilgisi var mı?');
      }
      if (redFlags.length > 0) {
        followUpQuestions.push('Açıklamadaki riskli ifadelerin nedeni nedir?');
      }
      if (greenFlags.length === 0) {
        followUpQuestions.push('Aracın servis kaydı var mı?');
      }

      const summaryQuestionsHtml = followUpQuestions.slice(0, 4).map(q => `<li class="shb-question-item">• ${q}</li>`).join('');

      const tramerHtml = `
        <div class="shb-section">
          <div class="shb-section-title">
            <span class="shb-sec-icon">${tramerIcon}</span> Hasar Kaydı (Tramer)
          </div>
          <div class="shb-section-content ${tramerClass}">
            <span class="shb-tramer-value">${displayValue}</span>
            ${data.tramer.amount ? `<span class="shb-info-badge" title="İlan açıklamasından otomatik olarak ayıklandı">ⓘ</span>` : ''}
          </div>
          ${tramerRecordsListHtml}
        </div>
      `;

      const summaryHtml = `
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
          <div class="shb-summary-subtitle">Sormanız gereken sorular</div>
          <ul class="shb-question-list">${summaryQuestionsHtml}</ul>
        </div>
      `;

      // Section 2: Ekspertiz Durumu (Visual Car Diagram)
      const getPartColor = (state) => {
        if (state === 'degisen') return { fill: 'rgba(255, 123, 114, 0.75)', stroke: '#FF7B72', label: 'Değişen' };
        if (state === 'boya') return { fill: 'rgba(88, 166, 255, 0.75)', stroke: '#58A6FF', label: 'Boyalı' };
        if (state === 'lokalBoya') return { fill: 'rgba(210, 153, 34, 0.75)', stroke: '#D29922', label: 'Lokal Boyalı' };
        return { fill: 'rgba(255, 255, 255, 0.08)', stroke: 'rgba(255, 255, 255, 0.25)', label: 'Orijinal' };
      };

      const ps = exp.partStates || {};
      const kaput = getPartColor(ps.kaput);
      const tavan = getPartColor(ps.tavan);
      const bagaj = getPartColor(ps.bagaj);
      const solOnCam = getPartColor(ps.solOnCamurluk);
      const solOnKap = getPartColor(ps.solOnKapi);
      const solArkaKap = getPartColor(ps.solArkaKapi);
      const solArkaCam = getPartColor(ps.solArkaCamurluk);
      const sagOnCam = getPartColor(ps.sagOnCamurluk);
      const sagOnKap = getPartColor(ps.sagOnKapi);
      const sagArkaKap = getPartColor(ps.sagArkaKapi);
      const sagArkaCam = getPartColor(ps.sagArkaCamurluk);
      const onTampon = getPartColor(ps.onTampon);
      const arkaTampon = getPartColor(ps.arkaTampon);

      const expertiseHtml = `
        <div class="shb-section shb-section-expertise">
          <div class="shb-section-title">
            <span class="shb-sec-icon">🚗</span> Ekspertiz Durumu
          </div>
          <div class="shb-diagram-container">
            <svg viewBox="0 0 160 240" class="shb-car-svg" xmlns="http://www.w3.org/2000/svg">
              <!-- Ön Tampon -->
              <rect x="45" y="8" width="70" height="14" rx="5" fill="${onTampon.fill}" stroke="${onTampon.stroke}" stroke-width="1.5">
                <title>Ön Tampon: ${onTampon.label}</title>
              </rect>
              <!-- Kaput -->
              <rect x="45" y="26" width="70" height="48" rx="4" fill="${kaput.fill}" stroke="${kaput.stroke}" stroke-width="1.5">
                <title>Kaput: ${kaput.label}</title>
              </rect>
              <!-- Tavan -->
              <rect x="45" y="78" width="70" height="84" rx="4" fill="${tavan.fill}" stroke="${tavan.stroke}" stroke-width="1.5">
                <title>Tavan: ${tavan.label}</title>
              </rect>
              <line x1="45" y1="88" x2="115" y2="88" stroke="rgba(255,255,255,0.2)" stroke-width="1" />
              <line x1="45" y1="152" x2="115" y2="152" stroke="rgba(255,255,255,0.2)" stroke-width="1" />
              <!-- Bagaj -->
              <rect x="45" y="166" width="70" height="46" rx="4" fill="${bagaj.fill}" stroke="${bagaj.stroke}" stroke-width="1.5">
                <title>Bagaj: ${bagaj.label}</title>
              </rect>
              <!-- Arka Tampon -->
              <rect x="45" y="216" width="70" height="14" rx="5" fill="${arkaTampon.fill}" stroke="${arkaTampon.stroke}" stroke-width="1.5">
                <title>Arka Tampon: ${arkaTampon.label}</title>
              </rect>

              <!-- Sol Yan -->
              <rect x="16" y="26" width="25" height="42" rx="3" fill="${solOnCam.fill}" stroke="${solOnCam.stroke}" stroke-width="1.5">
                <title>Sol Ön Çamurluk: ${solOnCam.label}</title>
              </rect>
              <rect x="16" y="72" width="25" height="44" rx="3" fill="${solOnKap.fill}" stroke="${solOnKap.stroke}" stroke-width="1.5">
                <title>Sol Ön Kapı: ${solOnKap.label}</title>
              </rect>
              <rect x="16" y="120" width="25" height="44" rx="3" fill="${solArkaKap.fill}" stroke="${solArkaKap.stroke}" stroke-width="1.5">
                <title>Sol Arka Kapı: ${solArkaKap.label}</title>
              </rect>
              <rect x="16" y="168" width="25" height="44" rx="3" fill="${solArkaCam.fill}" stroke="${solArkaCam.stroke}" stroke-width="1.5">
                <title>Sol Arka Çamurluk: ${solArkaCam.label}</title>
              </rect>

              <!-- Sağ Yan -->
              <rect x="119" y="26" width="25" height="42" rx="3" fill="${sagOnCam.fill}" stroke="${sagOnCam.stroke}" stroke-width="1.5">
                <title>Sağ Ön Çamurluk: ${sagOnCam.label}</title>
              </rect>
              <rect x="119" y="72" width="25" height="44" rx="3" fill="${sagOnKap.fill}" stroke="${sagOnKap.stroke}" stroke-width="1.5">
                <title>Sağ Ön Kapı: ${sagOnKap.label}</title>
              </rect>
              <rect x="119" y="120" width="25" height="44" rx="3" fill="${sagArkaKap.fill}" stroke="${sagArkaKap.stroke}" stroke-width="1.5">
                <title>Sağ Arka Kapı: ${sagArkaKap.label}</title>
              </rect>
              <rect x="119" y="168" width="25" height="44" rx="3" fill="${sagArkaCam.fill}" stroke="${sagArkaCam.stroke}" stroke-width="1.5">
                <title>Sağ Arka Çamurluk: ${sagArkaCam.label}</title>
              </rect>
            </svg>

            <div class="shb-diagram-legend">
              <div class="shb-leg-item"><span class="shb-leg-dot shb-dot-degisen"></span>Değişen (${exp.degisen || 0})</div>
              <div class="shb-leg-item"><span class="shb-leg-dot shb-dot-boya"></span>Boya (${exp.boya || 0})</div>
              <div class="shb-leg-item"><span class="shb-leg-dot shb-dot-lokal"></span>Lokal (${exp.lokalBoya || 0})</div>
              <div class="shb-leg-item"><span class="shb-leg-dot shb-dot-orijinal"></span>Orijinal</div>
            </div>
          </div>
        </div>
      `;

      // Section 3: Red Flags
      let redFlagsHtml = '';
      if (data.redFlags && data.redFlags.length > 0) {
        const listItems = data.redFlags.map(flag => `<li>• <strong class="shb-flag-word">${flag}</strong></li>`).join('');
        redFlagsHtml = `
          <div class="shb-section shb-section-flags">
            <div class="shb-section-title shb-title-danger">
              <span class="shb-sec-icon">⚠️</span> Şüpheli Kelimeler
            </div>
            <ul class="shb-flag-list">
              ${listItems}
            </ul>
            <div class="shb-flag-summary">⚠️ Riskli Terimler Tespit Edildi!</div>
          </div>
        `;
      }

      // Section 4: Green Flags
      let greenFlagsHtml = '';
      if (data.greenFlags && data.greenFlags.length > 0) {
        const listItems = data.greenFlags.map(flag => `<li>• <strong class="shb-flag-word-green">${flag}</strong></li>`).join('');
        greenFlagsHtml = `
          <div class="shb-section shb-section-clean">
            <div class="shb-section-title shb-title-clean">
              <span class="shb-sec-icon">✅</span> Olumlu Terimler
            </div>
            <ul class="shb-flag-list">
              ${listItems}
            </ul>
            <div class="shb-flag-summary-green">✅ Hasarsız / Temiz Kayıt Beyan Edildi!</div>
          </div>
        `;
      }

      popup.innerHTML = `
        <div class="shb-popup-header">
          <span class="shb-header-icon">🤖</span>
          <span class="shb-header-title">Sahiden</span>
        </div>
        <div class="shb-popup-body">
          ${tramerHtml}
          ${summaryHtml}
          ${expertiseHtml}
          ${redFlagsHtml}
          ${greenFlagsHtml}
        </div>
      `;

      this.positionPopup(targetEl, popup);
    },

    hidePopup() {
      if (State.activePopupEl) {
        State.activePopupEl.style.opacity = '0';
        State.activePopupEl.style.display = 'none';
      }
    }
  };

  // ==========================================
  // 5. HOVER & EVENT CONTROLLER MODULE
  // ==========================================
  const HoverController = {
    async onMouseEnter(event) {
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

        // All extraction (Tramer, Red/Green Flags, Price History, Visual Diagram) runs off a single DOM parse!
        const analysisResult = await DataExtractor.analyzeListing(href);

        if (State.currentHoveredId === id) {
          if (!analysisResult.error) {
            State.setCache(id, analysisResult);
          }
          PopupManager.renderData(tr, analysisResult);
        } else if (!analysisResult.error) {
          State.setCache(id, analysisResult);
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
      };

      if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', attachAll);
      } else {
        attachAll();
      }

      new MutationObserver(() => {
        setTimeout(attachAll, 300);
      }).observe(document.body, { childList: true, subtree: true });
    }
  };

  HoverController.init();

})();

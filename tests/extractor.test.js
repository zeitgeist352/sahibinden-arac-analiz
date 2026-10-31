// Run with: node --test tests/
const test = require('node:test');
const assert = require('node:assert/strict');
require('../defaults.js');
const { CONFIG, DataExtractor, MarketComparator, PriceTracker, RiskScorer, Settings, Utils } = require('../content.js');

const tramer = (text) => DataExtractor.extractTramerData(text);

test('tramer: clean phrases', () => {
  assert.equal(tramer('Araç tramersizdir, boyasız.').status, 'CLEAN');
  assert.equal(tramer('TRAMERSİZ HASARSIZ').status, 'CLEAN');
  assert.equal(tramer('Hasar kaydı yoktur').status, 'CLEAN');
  assert.equal(tramer('tramer: 0').status, 'CLEAN');
});

test('tramer: amount wins over clean words', () => {
  const r = tramer('Boyasız hasarsız ama 12 bin tramer var');
  assert.equal(r.status, 'DAMAGED');
  assert.equal(r.amount, 12000);
});

test('tramer: currency and "bin" formats', () => {
  assert.equal(tramer('Tramer kaydı 15.500 TL').amount, 15500);
  assert.equal(tramer('tramer 15,5 bin tl').amount, 15500);
  assert.equal(tramer('22.000 TL tramer kaydı mevcut').amount, 22000);
});

test('tramer: multiple records are summed', () => {
  const r = tramer('Tramer kayıtları: 5.000 TL ve 7.250 TL');
  assert.equal(r.amount, 12250);
  assert.equal(r.records.length, 2);
});

test('tramer: years, km and asking price are not damage', () => {
  assert.equal(tramer('Tramer yok, 2018 model').status, 'CLEAN');
  assert.equal(tramer('Hasar kaydı yok 120000 km').status, 'CLEAN');
  assert.equal(tramer('hasar kaydı 120 bin km de yapıldı').amount, null);
  const r = tramer('Tramer 8.000 TL. Fiyat 850.000 TL son');
  assert.equal(r.amount, 8000);
  const r2 = tramer('hasar kaydı 9.000 tl, fiyat 1.250.000 tl');
  assert.equal(r2.amount, 9000);
});

test('tramer: unknown / uncertain', () => {
  assert.equal(tramer('').status, 'UNKNOWN');
  assert.equal(tramer('Temiz araç, bakımları yapıldı').status, 'UNKNOWN');
  assert.equal(tramer('Tramer sorgusu yapılabilir').status, 'UNCERTAIN');
});

test('flags: word starts and negation', () => {
  assert.deepEqual(DataExtractor.extractRedFlags('Ekspertiz raporu mevcut'), []);
  assert.deepEqual(DataExtractor.extractRedFlags('Ağır hasar kaydı yoktur'), []);
  assert.deepEqual(DataExtractor.extractRedFlags('Şase orijinal'), []);
  assert.deepEqual(DataExtractor.extractRedFlags('Araç PERT kayıtlıdır'), ['pert']);
  assert.deepEqual(DataExtractor.extractRedFlags('Çekme belgeli araç'), ['çekme belgeli']);
  assert.deepEqual(DataExtractor.extractGreenFlags('İLK SAHİBİNDEN, BOYASIZ'), ['ilk sahibinden', 'boyasız']);
});

test('contradictions', () => {
  const issues = DataExtractor.findContradictions({
    tramer: { status: 'CLEAN' },
    greenFlags: ['boyasız'],
    expertise: { degisen: 0, boya: 2, lokalBoya: 0 },
    heavyDamage: true
  });
  assert.equal(issues.length, 2);
});

test('utils', () => {
  assert.equal(Utils.parseTlPrice('1.250.000 TL'), 1250000);
  assert.equal(Utils.parseTlPrice('Fiyat yok'), null);
  assert.equal(Utils.listingIdFromUrl('/ilan/vasita-otomobil-bmw-temiz-1234567890/detay'), '1234567890');
  assert.equal(new Date(Utils.parseTrDate('28 Ekim 2026')).getMonth(), 9);
  assert.equal(Utils.escapeHtml('<b>"x"</b>'), '&lt;b&gt;&quot;x&quot;&lt;/b&gt;');
});

test('price summary', () => {
  const s = PriceTracker.summarize([[1, 1000000], [2, 950000], [3, 900000]]);
  assert.equal(s.diff, -100000);
  assert.equal(s.changes, 2);
  assert.equal(Math.round(s.pct), -10);
});

test('risk score stays within bounds', () => {
  const base = {
    tramer: { status: 'DAMAGED', amount: 200000 },
    heavyDamage: true,
    expertise: { degisen: 5, boya: 5, lokalBoya: 5, hasExpertise: true },
    redFlags: ['pert', 'şase', 'podye', 'ağır hasar'],
    greenFlags: [],
    contradictions: ['a', 'b', 'c']
  };
  assert.equal(RiskScorer.score(base), 100);
  const clean = {
    tramer: { status: 'CLEAN', amount: 0 },
    heavyDamage: false,
    expertise: { degisen: 0, boya: 0, lokalBoya: 0, hasExpertise: true },
    redFlags: [],
    greenFlags: ['boyasız'],
    contradictions: []
  };
  assert.equal(RiskScorer.score(clean), 10);
});

test('market: median of comparable rows', () => {
  const row = (id, price, year, km, model = 'corolla') => ({ id, price, year, km, model });
  const items = [
    row('a', 1000000, 2018, 80000),
    row('b', 1100000, 2018, 90000),
    row('c', 1050000, 2019, 70000),
    row('d', 950000, 2017, 100000),
    row('e', 800000, 2018, 85000),
    row('f', 400000, 2010, 250000),            // different year: excluded
    row('g', 2000000, 2018, 80000, 'civic')     // different model: excluded
  ];
  const stats = MarketComparator.compare(items);
  const e = stats.get('e');
  assert.equal(e.count, 4);
  assert.equal(e.median, 1025000);
  assert.ok(e.pct < -20);
  assert.equal(stats.has('f'), false);
  assert.equal(stats.has('g'), false);
});

test('market: far mileage is not comparable', () => {
  const a = { id: 'a', price: 1, year: 2018, km: 20000, model: '' };
  const b = { id: 'b', price: 1, year: 2018, km: 200000, model: '' };
  assert.equal(MarketComparator.isComparable(a, b), false);
  assert.equal(MarketComparator.isComparable(a, { ...b, km: null }), true);
});

test('settings: user flag lists override defaults', () => {
  Settings.apply({ redFlags: ['motor revizyon'], greenFlags: [], marketComparison: false });
  assert.deepEqual(DataExtractor.extractRedFlags('Motor revizyonlu, pert değil'), ['motor revizyon']);
  assert.deepEqual(DataExtractor.extractGreenFlags('boyasız'), []);
  assert.equal(CONFIG.MARKET_COMPARISON, false);
  Settings.apply(null);
  assert.deepEqual(DataExtractor.extractRedFlags('pert kayıtlı'), ['pert']);
  assert.equal(CONFIG.MARKET_COMPARISON, true);
});

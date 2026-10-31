// Default settings shared by content.js and the options page.
// User overrides are stored in chrome.storage.local under "shbSettings".
globalThis.SHB_DEFAULTS = {
  RED_FLAGS: [
    "sigorta şişirmesi",
    "şişirme",
    "çıtır hasar",
    "bel altı",
    "keyfe keder",
    "çekme belgeli",
    "ağır hasar",
    "hasar kayıtlı",
    "pert",
    "şase",
    "podye",
    "sel hasar"
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
  MARKET_COMPARISON: true
};

if (typeof module !== 'undefined' && module.exports) {
  module.exports = globalThis.SHB_DEFAULTS;
}

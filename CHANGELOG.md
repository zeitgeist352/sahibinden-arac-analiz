# Changelog

All notable changes to this project will be documented in this file.

## [1.3.0] - 2026-10-31

### Added
- Market comparison: each search row is compared with the median price of similar rows on the same page (same model columns, year ±1, similar km, ≥4 comparables); shown as a chip and in the popup.
- Options page: editable red/green flag lists, market comparison toggle, price history stats, JSON export and clear, selector health report.
- Selector health monitor: a dismissible banner (hidden for 7 days after closing) when rows, prices or the info list can no longer be read.
- `defaults.js` holds default settings shared by the content script and options page.

### Fixed
- A negation after a comma ("revizyonlu, pert değil") no longer cancels an earlier flag.

## [1.2.0] - 2026-10-31

### Added
- Local price history: every price seen on search pages, hover fetches and detail pages is stored in `chrome.storage.local`; price changes show as ↓/↑ chips next to the price and as a timeline in the popup. Entries not seen for 180 days are pruned.
- "Ağır Hasar Kayıtlı", listing date and seller type read from the listing's info list.
- Contradiction checks (e.g. "boyasız" in the description but painted panels in the expertise).
- New red flags: `pert`, `şase`, `podye`, `sel hasar`, `hasar kayıtlı`, `şişirme`.
- Clear error messages for rate limiting and captcha/verification pages.
- Node test suite (`node --test tests/*.test.js`).

### Fixed
- Tramer amounts now win over "hasarsız/tramersiz" wording; years, km values and asking prices are no longer read as damage amounts.
- Upper-case Turkish text (`TRAMERSİZ`) is matched correctly.
- "Ağır hasar kaydı yoktur" and the page's own "Ağır Hasar Kayıtlı" label no longer trigger the red flag; `pert` no longer matches inside `ekspertiz`.
- The expertise diagram no longer claims all panels are original when the listing has no expertise data.
- Missing price history no longer adds to the risk score.
- Duplicate requests while hovering in and out, and MutationObserver timer floods.

### Removed
- `background.js` and the placeholder `api.ourdomain.com` permission (never called).

## [1.1.0] - 2026-08-04

### Changed
- Replaced the on-image badges with a glassmorphism hover popup on search result rows.
- Listing pages are fetched with the Fetch API and parsed once with `DOMParser` (no more iframes).

### Added
- Tramer amount extraction from the description, including "bin" abbreviations and multi-record totals.
- SVG expertise diagram for 13 body panels.
- Red/green flag detection and a risk score with follow-up questions.

## [1.0.0] - 2026-06-12

### Initial Release
- Sahibinden.com car listings analyzer
- Displays paint/parts changed/local paint information as badges on listings
- Badges appear in the bottom-left corner of listing images
- Three badge types: Paint (B/B2), Changed Parts (D/D3), Local Paint (L)
- Color-coded badges for easy identification
- Debug documentation for troubleshooting

### Features
- Analyzes car listings from Sahibinden.com
- Shows modification status with visual badges
- Works with listing images
- Comprehensive debugging guide included

### Known Limitations
- Shows only modifications marked by listing owner
- Requires proper Chrome extension permissions for Sahibinden.com

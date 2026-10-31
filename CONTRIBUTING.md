# Contributing

Thank you for your interest in contributing to Sahibinden Araç Analiz!

## Getting Started

1. Fork the repository
2. Clone your fork locally
3. Create a feature branch (`git checkout -b feature/AmazingFeature`)
4. Make your changes
5. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
6. Push to the branch (`git push origin feature/AmazingFeature`)
7. Open a Pull Request

## Development

### Loading the Extension for Development

1. Go to `chrome://extensions/`
2. Enable "Developer mode"
3. Click "Load unpacked"
4. Select this project folder

### Running Tests

The extraction logic (tramer parsing, flags, market comparison, settings) has a Node test suite with no dependencies:

```bash
node --test tests/*.test.js
```

Add a test case for every new phrase or edge case you teach the parser.

### Debugging

- Open DevTools on any Sahibinden.com page (F12)
- Check the Console tab for logs prefixed with `[SHB]`
- Use the DOM inspector to verify elements are being targeted correctly
- All selectors live in `CONFIG.SELECTORS` in `content.js`. If Sahibinden changes its markup, the extension shows a warning banner and lists the problem on the options page
- Price history, settings and health reports are stored in `chrome.storage.local`. Inspect them from the options page, or with `chrome.storage.local.get(null)` in the extension's DevTools

## Code Style

- Keep code clean and readable
- Add comments for complex logic
- Run the test suite and test on actual Sahibinden.com listings before submitting
- Escape any text taken from the page (`Utils.escapeHtml`) before putting it into `innerHTML`

## Bug Reports

When reporting bugs, please include:
- Which listings showed the issue
- Console error messages (if any)
- Browser and extension version
- Screenshots if helpful

## Feature Requests

Feel free to open an issue with feature ideas. Please describe:
- The use case
- Expected behavior
- Why it would be useful

---

Thank you for helping improve this project! 🚗

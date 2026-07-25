// background.js - Service worker for Sahibinden Araç Analiz extension
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "fetchPriceHistory" && request.listingId) {
    const endpoint = `https://api.ourdomain.com/v1/price-history?id=${encodeURIComponent(request.listingId)}`;
    
    fetch(endpoint, {
      method: 'GET',
      headers: {
        'Accept': 'application/json'
      }
    })
    .then(async (response) => {
      if (response.status === 404) {
        sendResponse({ success: false, error: "not_found", data: [] });
        return;
      }
      if (!response.ok) {
        throw new Error(`Server returned status: ${response.status}`);
      }
      const json = await response.json();
      sendResponse(json);
    })
    .catch((error) => {
      console.warn('[SHB Background] Fetch price history error:', error);
      sendResponse({ success: false, error: error.message || "Network error", data: [] });
    });

    // Return true to indicate we wish to send a response asynchronously
    return true;
  }
});

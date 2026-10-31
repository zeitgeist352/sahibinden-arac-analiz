# Sahiden - Sahibinden Araç Analiz & Akıllı İlan Asistanı

![Sahiden Extension Banner](https://img.shields.io/badge/Version-1.3.0-58a6ff?style=for-the-badge)
![License](https://img.shields.io/badge/License-MIT-3fb950?style=for-the-badge)
![Platform](https://img.shields.io/badge/Platform-Chrome%20%7C%20Edge%20%7C%20Brave-d29922?style=for-the-badge)

A powerful, next-generation browser extension for **Sahibinden.com** car listings. It replaces legacy thumbnail text with a stunning, AI-powered glassmorphism hover dashboard that dynamically scrapes, parses, and visualizes vital vehicle data without ever needing to click into individual listings.

---

## 🌟 English Overview

**Sahiden** transforms your car shopping experience on Sahibinden.com. By simply hovering your mouse over any vehicle listing card in search results, a sleek, multi-panel popup dashboard appears instantly. Utilizing intelligent DOM scraping, regex-based NLP, and visual diagrams, Sahiden reveals hidden damage records, price manipulation history, body paint/replacement status, and suspicious seller terminology at a glance.

### ✨ Key Features

1. **🛡️ Tramer Extraction**
   - **Amounts First:** A damage amount always wins over clean wording, so `"hasarsız ama 12 bin tramer var"` is reported as 12.000 TL. Only when no amount is found do phrases like `"tramersiz"` or `"hasar kaydı yok"` mark the car as clean.
   - **Proximity & Context Matching:** Numbers are only counted when they sit next to a damage keyword (`"tramer"`, `"hasar"`, `"kaza"`, `"çarpma"`). Model years, kilometres and the asking price (`"fiyat 850.000 TL"`) are ignored.
   - **"Bin" Normalization & Summation:** Correctly interprets text-based Turkish number abbreviations (e.g., converting `"20 bin TL"` to `20.000 TL`) and sums multiple damage records into a consolidated total.
   - **Heavy Damage Record:** Reads the listing's own *"Ağır Hasar Kayıtlı"* field, plus listing date and seller type.
   - **Contradiction Checks:** Warns when the description says `"boyasız"` / `"değişensiz"` but the expertise data shows painted or replaced panels.

2. **🚗 Visual Expertise Scheme (Interactive Vehicle Diagram)**
   - Displays an SVG diagram of 13 major body panels (hood, roof, trunk, doors, fenders, and bumpers).
   - Color-coded status for immediate visual recognition:
     - 🔴 **Replaced:** Replaced body panels.
     - 🔵 **Painted:** Full paint jobs.
     - 🟡 **Local Paint:** Partial/spot painting.
     - ⚪ **Original:** Original factory panels.
   - If the listing has no expertise data, the popup says so instead of showing every panel as original.

3. **⚠️ & ✅ Red and Green Flags (Manipulative & Positive Seller Terms)**
   - **⚠️ Red Flags:** Detects high-risk or manipulative phrases such as `"sigorta şişirmesi"`, `"çıtır hasarlı"`, `"keyfe keder"`, `"bel altı"`, `"ağır hasar"`, `"çekme belgeli"`, `"pert"`, `"şase"`, `"podye"` or `"sel hasar"`. Negated mentions such as `"ağır hasar kaydı yoktur"` are skipped, and terms only match at word starts (`"pert"` does not match `"ekspertiz"`). The lists can be edited on the options page.
   - **✅ Green Flags:** Highlights positive seller declarations like `"yetkili servis bakımlı"`, `"ilk sahibinden"`, `"garantili"`, `"kazasız"`, `"değişensiz"`, and `"boyasız"`.
   - **Clean UI Rendering:** Boxes only appear when relevant terms are detected in the description, keeping the interface uncluttered.

4. **📈 Local Price History**
   - Sahibinden does not publish past prices, so Sahiden records every price you see (search results, hovers, detail pages) in your browser's local storage. Nothing is sent to any server.
   - When a listing's price changes, a ↓/↑ percentage chip appears next to the price and the popup shows the timeline. History therefore starts from the first time you saw a listing.

5. **⚖️ Market Comparison**
   - On search pages each price is compared with the median of similar listings on the same page (same model columns, model year ±1, similar mileage, at least 4 comparables). A "Piyasa −8%" chip appears when the gap is 5% or more; the popup shows the median.

6. **⚙️ Options Page**
   - Edit the red/green flag lists, toggle market comparison, see how many listings are tracked, export the price history as JSON or clear it. Open it via the extension icon → *Options*.

7. **🩺 Page Structure Warnings**
   - If Sahibinden changes its markup and rows, prices or the info list can no longer be read, a dismissible banner appears and the issue is listed on the options page instead of the extension silently showing empty results.


## 🇹🇷 Genel Bakış

**Sahiden**, Sahibinden.com üzerindeki ikinci el araç arama deneyiminizi baştan sona değiştiren yeni nesil bir akıllı eklentidir. İlan arama sonuçlarında herhangi bir araç kartının üzerine imlecinizi getirdiğinizde (hover), arka planda çalışan yapay zeka destekli ayrıştırma motoru devreye girer ve ilan detaylarına tıklamanıza gerek kalmadan araca dair en kritik bilgileri modern bir **Glassmorphism (buzlu cam)** kontrol panelinde sunar.

### ✨ Öne Çıkan Özellikler

1. **🛡️ Hasar Kaydı (Tramer) Analizi ve Tutar Ayrıştırma**
   - **Önce Tutar:** Açıklamada bir hasar tutarı varsa "temiz" ifadelerinin önüne geçer; `"hasarsız ama 12 bin tramer var"` 12.000 TL olarak gösterilir. Tutar yoksa `"tramersiz"`, `"hasar kaydı yoktur"`, `"hasarsız"` gibi ifadeler aracı temiz olarak işaretler.
   - **Akıllı Bağlam ve Yakınlık Analizi:** Sayıları global olarak taramak yerine yalnızca hasar kelimelerinin (`tramer`, `hasar`, `kaza`, `çarpma`) yakınındaki tutarları yakalar. Model yılı, kilometre ve satış fiyatı (`"fiyat 850.000 TL"`) hasar sayılmaz.
   - **"Bin" Kısaltması Normalizasyonu ve Toplam Hesaplama:** Satıcıların sıklıkla kullandığı yazılı kısaltmaları (örn. `"20 bin"`, `"15,5 bin"`) otomatik olarak dönüştürür (`20.000 TL`, `15.500 TL`). Parça parça girilen hasar kayıtlarını toplayarak net tutarı ve kayıt sayısını listeler.
   - **Ağır Hasar Kaydı:** İlanın kendi *"Ağır Hasar Kayıtlı"* alanını, ilan tarihini ve satıcı tipini okur.
   - **Çelişki Kontrolü:** Açıklamada `"boyasız"` / `"değişensiz"` yazıp ekspertizde boyalı veya değişen parça varsa uyarır.

2. **🚗 Görsel Ekspertiz Şeması (İnteraktif Araç Diyagramı)**
   - Aracın 13 temel kaporta parçasını (kaput, tavan, bagaj, ön/arka tampon, çamurluklar ve kapılar) özel bir SVG şeması üzerinde görselleştirir.
   - Renk kodlaması sayesinde aracın kaporta durumunu saniyeler içinde anlayabilirsiniz:
     - 🔴 **Değişen:** Değiştirilmiş parçalar.
     - 🔵 **Boyalı:** Tamamen boyanmış parçalar.
     - 🟡 **Lokal Boyalı:** Kısmi/lokal boya uygulanmış parçalar.
     - ⚪ **Orijinal:** Fabrika çıkışlı orijinal parçalar.
   - İlanda ekspertiz bilgisi yoksa tüm parçaları orijinal göstermek yerine bunu belirtir.

3. **⚠️ Şüpheli Kelimeler & ✅ Olumlu Terimler (Red / Green Flags)**
   - **⚠️ Şüpheli Kelimeler (Red Flags):** Satıcıların hasarı gizlemek veya hafifletmek için kullandığı manipülatif terimleri anında yakalar: `"sigorta şişirmesi"`, `"çıtır hasarlı"`, `"keyfe keder"`, `"bel altı boyalı"`, `"ağır hasar"`, `"çekme belgeli"`, `"şişirme"`, `"pert"`, `"şase"`, `"podye"`, `"sel hasar"`. `"ağır hasar kaydı yoktur"` gibi olumsuz kullanımlar atlanır; terimler kelime başında aranır (`"pert"`, `"ekspertiz"` içinde eşleşmez). Listeler ayarlar sayfasından düzenlenebilir.
   - **✅ Olumlu Terimler (Green Flags):** Satıcının araçla ilgili verdiği güvence beyanlarını ön plana çıkarır: `"yetkili servis bakımlı"`, `"ilk sahibinden"`, `"garantili"`, `"kazasız"`, `"değişensiz"`, `"boyasız"`, `"tramersiz"`.
   - **Dinamik UI Üretimi:** Açıklamada herhangi bir şüpheli veya olumlu kelime yoksa gereksiz boş kutular gösterilmez; arayüz her zaman temiz ve odaklanabilir kalır.

4. **📈 Yerel Fiyat Geçmişi**
   - Sahibinden geçmiş fiyatları yayınlamadığı için Sahiden, gördüğünüz her ilan fiyatını (arama sonuçları, hover, ilan detayı) tarayıcınızın yerel depolamasına kaydeder. Hiçbir veri sunucuya gönderilmez.
   - Fiyat değiştiğinde fiyatın yanında ↓/↑ yüzde etiketi çıkar, popup'ta da tarih tarih fiyat değişimi listelenir. Geçmiş, ilanı ilk gördüğünüz andan itibaren oluşur.

5. **⚖️ Piyasa Karşılaştırması**
   - Arama sayfasında her ilanın fiyatı, aynı sayfadaki benzer ilanların (aynı model, yıl ±1, yakın km, en az 4 ilan) ortanca fiyatıyla karşılaştırılır. Fark %5 veya fazlaysa fiyatın yanında "Piyasa −%8" etiketi çıkar; popup ortanca fiyatı gösterir.

6. **⚙️ Ayarlar Sayfası**
   - Şüpheli/olumlu kelime listelerini düzenleyin, piyasa karşılaştırmasını açıp kapatın, kaç ilanın takip edildiğini görün, fiyat geçmişini JSON olarak dışa aktarın veya temizleyin. Eklenti simgesine sağ tıklayıp *Seçenekler*'i seçin.

7. **🩺 Sayfa Yapısı Uyarısı**
   - Sahibinden sayfa yapısını değiştirir ve satırlar, fiyatlar veya ilan bilgileri okunamazsa eklenti sessizce boş sonuç göstermek yerine kapatılabilir bir uyarı çıkarır; sorun ayarlar sayfasında da listelenir.


## 🛠️ Installation / Kurulum

1. Clone or download this repository to your computer. / *Bu depoyu bilgisayarınıza klonlayın veya zip olarak indirin.*
   ```bash
   git clone https://github.com/zeitgeist352/sahibinden-arac-analiz.git
   ```
2. Open Google Chrome, Microsoft Edge, or Brave and navigate to the extensions page. / *Tarayıcınızı açın ve eklentiler sayfasına gidin:*
   - Chrome / Brave: `chrome://extensions`
   - Microsoft Edge: `edge://extensions`
3. Enable **Developer mode** in the top right corner. / *Sağ üst köşedeki **Geliştirici modu** (Developer mode) anahtarını aktif edin.*
4. Click **Load unpacked** (Paketlenmemiş öğe yükle). / *Sol üstteki **Paketlenmemiş öğe yükle** (Load unpacked) butonuna tıklayın.*
5. Select the project directory (`sahibinden-arac-analiz`). / *İndirdiğiniz proje klasörünü seçin.*

---

## 💻 Architecture & Technical Structure / Teknik Mimari

```text
sahibinden-arac-analiz/
├── manifest.json       # Manifest v3 extension configuration & permissions
├── defaults.js         # Default flag lists/settings shared by content script and options page
├── content.js          # Core engine: DOM parser, regex extraction, price tracker, market comparison, health checks, UI
├── options.html/js/css # Options page: flag lists, price history export/clear, health report
├── styles.css          # Glassmorphism popup, SVG diagram and price chip styling
├── tests/              # Node test suite for the extraction logic
└── icons/              # Extension icons and assets
```

Run the tests / *Testleri çalıştırın:* `node --test tests/*.test.js`


## 📝 License / Lisans

This project is licensed under the **MIT License** - see the [LICENSE](LICENSE) file for details. / *Bu proje **MIT Lisansı** ile lisanslanmıştır.*

---

## 🤝 Contributing / Katkıda Bulunma

Pull requests, feature suggestions, and bug reports are welcome! For major changes, please open an issue first to discuss what you would like to change. / *Katkıda bulunmak, yeni özellikler önermek veya hata bildiriminde bulunmak için "Issue" veya "Pull Request" açmaktan çekinmeyin!*

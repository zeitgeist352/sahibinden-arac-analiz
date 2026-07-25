# Sahiden - Sahibinden Araç Analiz & Akıllı İlan Asistanı

![Sahiden Extension Banner](https://img.shields.io/badge/Version-11.0-58a6ff?style=for-the-badge)
![License](https://img.shields.io/badge/License-MIT-3fb950?style=for-the-badge)
![Platform](https://img.shields.io/badge/Platform-Chrome%20%7C%20Edge%20%7C%20Brave-d29922?style=for-the-badge)

A powerful, next-generation browser extension for **Sahibinden.com** car listings. It replaces legacy thumbnail text with a stunning, AI-powered glassmorphism hover dashboard that dynamically scrapes, parses, and visualizes vital vehicle data without ever needing to click into individual listings.

---

## 🌟 English Overview

**Sahiden** transforms your car shopping experience on Sahibinden.com. By simply hovering your mouse over any vehicle listing card in search results, a sleek, multi-panel popup dashboard appears instantly. Utilizing intelligent DOM scraping, regex-based NLP, and visual diagrams, Sahiden reveals hidden damage records, price manipulation history, body paint/replacement status, and suspicious seller terminology at a glance.

### ✨ Key Features

1. **🛡️ Hasar Kaydı (Tramer) Extraction**
   - **Zero-Tramer Priority Detection:** Instantly identifies clean records (`"tramersiz"`, `"hasar kaydı yok"`, `"bedelsiz"`) and halts further calculation to prevent false alarms.
   - **Proximity & Context Matching:** Uses advanced regex lookarounds strictly bound to damage keywords (`"tramer"`, `"hasar"`, `"çarpma"`) to ignore irrelevant numbers like installment plans or advance payments.
   - **"Bin" Normalization & Summation:** Correctly interprets text-based Turkish number abbreviations (e.g., converting `"20 bin TL"` to `20.000 TL`) and sums multiple damage records into a consolidated total.

2. **🚗 Visual Ekspertiz Şeması (Interactive Vehicle Diagram)**
   - Displays an SVG diagram of 13 major body panels (hood, roof, trunk, doors, fenders, and bumpers).
   - Color-coded status for immediate visual recognition:
     - 🔴 **Değişen (Replaced):** Replaced body panels.
     - 🔵 **Boyalı (Painted):** Full paint jobs.
     - 🟡 **Lokal Boyalı (Local Paint):** Partial/spot painting.
     - ⚪ **Orijinal:** Original factory panels.

3. **📉 İlan Fiyat Geçmişi (Price History Timeline)**
   - Scrapes real-time historical pricing directly from listing detail pages.
   - Renders a clean vertical timeline showing date-stamped price changes.
   - Calculates and highlights price drops (⬇ İndirim) or price hikes (⬆ Artış) automatically.

4. **⚠️ & ✅ Red and Green Flags (Manipulative & Positive Seller Terms)**
   - **⚠️ Red Flags (Şüpheli Kelimeler):** Detects high-risk or manipulative phrases such as `"sigorta şişirmesi"`, `"çıtır hasarlı"`, `"keyfe keder"`, `"bel altı"`, `"ağır hasar"`, or `"çekme belgeli"`.
   - **✅ Green Flags (Olumlu Terimler):** Highlights positive seller declarations like `"yetkili servis bakımlı"`, `"ilk sahibinden"`, `"garantili"`, `"kazasız"`, `"değişensiz"`, and `"boyasız"`.
   - **Clean UI Rendering:** Boxes only appear when relevant terms are detected in the description, keeping the interface uncluttered.

5. **⚡ High-Performance Architecture**
   - **Debounced Hover Engine:** Implements a 600ms debounce timer on mouse enter/leave events to ensure background network requests are only triggered on intentional hovers.
   - **Intelligent Caching:** Caches parsed listing details in memory with a 15-minute Time-To-Live (TTL), eliminating redundant network requests when revisiting cards.
   - **Glassmorphism Design:** Beautiful dark-mode UI styling with backdrop blurs, custom CSS variables, and zero interference with Sahibinden's native layout.

---

## 🇹🇷 Türkçe Genel Bakış

**Sahiden**, Sahibinden.com üzerindeki ikinci el araç arama deneyiminizi baştan sona değiştiren yeni nesil bir akıllı eklentidir. İlan arama sonuçlarında herhangi bir araç kartının üzerine imlecinizi getirdiğinizde (hover), arka planda çalışan yapay zeka destekli ayrıştırma motoru devreye girer ve ilan detaylarına tıklamanıza gerek kalmadan araca dair en kritik bilgileri modern bir **Glassmorphism (buzlu cam)** kontrol panelinde sunar.

### ✨ Öne Çıkan Özellikler

1. **🛡️ Hasar Kaydı (Tramer) Analizi ve Tutar Ayrıştırma**
   - **Öncelikli Hasarsızlık Tespiti:** İlan açıklamasındaki `"tramersiz"`, `"hasar kaydı yoktur"`, `"hasarsız"`, `"bedelsiz"` gibi ifadeleri öncelikli olarak tarar ve taksit veya peşinat tutarlarının yanlışlıkla hasar kaydı olarak algılanmasını önler.
   - **Akıllı Bağlam ve Yakınlık Analizi:** Sayıları global olarak taramak yerine yalnızca hasar kelimelerinin (`tramer`, `hasar`, `kaza`, `sorgu`) etrafındaki (1-4 kelime mesafelerindeki) parasal değerleri yakalar.
   - **"Bin" Kısaltması Normalizasyonu ve Toplam Hesaplama:** Satıcıların sıklıkla kullandığı yazılı kısaltmaları (örn. `"20 bin"`, `"15,5 bin"`) otomatik olarak dönüştürür (`20.000 TL`, `15.500 TL`). Parça parça girilen hasar kayıtlarını toplayarak net tutarı ve kayıt sayısını listeler.

2. **🚗 Görsel Ekspertiz Şeması (İnteraktif Araç Diyagramı)**
   - Aracın 13 temel kaporta parçasını (kaput, tavan, bagaj, ön/arka tampon, çamurluklar ve kapılar) özel bir SVG şeması üzerinde görselleştirir.
   - Renk kodlaması sayesinde aracın kaporta durumunu saniyeler içinde anlayabilirsiniz:
     - 🔴 **Değişen:** Değiştirilmiş parçalar.
     - 🔵 **Boyalı:** Tamamen boyanmış parçalar.
     - 🟡 **Lokal Boyalı:** Kısmi/lokal boya uygulanmış parçalar.
     - ⚪ **Orijinal:** Fabrika çıkışlı orijinal parçalar.

3. **📉 İlan Fiyat Geçmişi Zaman Çizelgesi**
   - İlanın geçmiş fiyat hareketlerini doğrudan ilan detay sayfasından çekerek dikey bir zaman çizelgesi (timeline) halinde sunar.
   - İlk fiyattan son fiyata kadar olan değişimleri hesaplar; **⬇ İndirim**, **⬆ Artış** veya **Fiyat Sabit** rozetleriyle fiyatın yönünü vurgular.

4. **⚠️ Şüpheli Kelimeler & ✅ Olumlu Terimler (Red / Green Flags)**
   - **⚠️ Şüpheli Kelimeler (Red Flags):** Satıcıların hasarı gizlemek veya hafifletmek için kullandığı manipülatif terimleri anında yakalar: `"sigorta şişirmesi"`, `"çıtır hasarlı"`, `"keyfe keder"`, `"bel altı boyalı"`, `"ağır hasar"`, `"çekme belgeli"`, `"şişirme"`.
   - **✅ Olumlu Terimler (Green Flags):** Satıcının araçla ilgili verdiği güvence beyanlarını ön plana çıkarır: `"yetkili servis bakımlı"`, `"ilk sahibinden"`, `"garantili"`, `"kazasız"`, `"değişensiz"`, `"boyasız"`, `"tramersiz"`.
   - **Dinamik UI Üretimi:** Açıklamada herhangi bir şüpheli veya olumlu kelime yoksa gereksiz boş kutular gösterilmez; arayüz her zaman temiz ve odaklanabilir kalır.

5. **⚡ Üstün Performans ve Gelişmiş Mimari**
   - **Debouncing (Gecikmeli Tetikleme):** İmleç kartlar arasında hızlıca dolaşırken gereksiz ağ istekleri yapılmaması için 600ms gecikme koruması uygulanır.
   - **15 Dakikalık Akıllı Ön Bellek (Cache):** Analiz edilen bir ilanın verileri bellekte saklanır; aynı ilanın üzerine tekrar gelindiğinde sıfır gecikme ve sıfır ağ isteğiyle anında gösterilir.
   - **Modern Karanlık Mod Tasarımı:** Göz yormayan estetik renk paleti, mikro animasyonlar ve yüksek kontrastlı tipografi ile Sahibinden arayüzüne kusursuz bütünleşir.

---

## 🛠️ Installation / Kurulum

1. Clone or download this repository to your computer. / *Bu depoyu bilgisayarınıza klonlayın veya zip olarak indirin.*
   ```bash
   git clone https://github.com/yourusername/sahibinden-arac-analiz.git
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
├── background.js       # Service worker for cross-origin background fetch requests
├── content.js          # Core engine: Event listeners, DOM Parser, NLP regex extraction, and UI logic
├── styles.css          # Glassmorphism design system, custom SVG animations, and timeline styling
└── icons/              # Extension icons and assets
```

### Key Modules in `content.js`
- **`State`**: Manages debounce timers, DOM positioning, and the `Map()` based 15-minute data cache.
- **`DataExtractor`**: Orchestrates parsing of `DOMParser` objects, extracting Tramer records, Red/Green flags, part replacement states, and DOM-based price history tables.
- **`PopupManager`**: Dynamically creates, overlays, and animates the floating glassmorphism UI card right next to the user's cursor.

---

## 📝 License / Lisans

This project is licensed under the **MIT License** - see the [LICENSE](LICENSE) file for details. / *Bu proje **MIT Lisansı** ile lisanslanmıştır.*

---

## 🤝 Contributing / Katkıda Bulunma

Pull requests, feature suggestions, and bug reports are welcome! For major changes, please open an issue first to discuss what you would like to change. / *Katkıda bulunmak, yeni özellikler önermek veya hata bildiriminde bulunmak için "Issue" veya "Pull Request" açmaktan çekinmeyin!*

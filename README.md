# Sahiden - Sahibinden Araç Analiz & Akıllı İlan Asistanı

![Sürüm](https://img.shields.io/badge/S%C3%BCr%C3%BCm-1.3.0-58a6ff?style=for-the-badge)
![Lisans](https://img.shields.io/badge/Lisans-MIT-3fb950?style=for-the-badge)
![Platform](https://img.shields.io/badge/Platform-Chrome%20%7C%20Edge%20%7C%20Brave-d29922?style=for-the-badge)

**Sahibinden.com** araç ilanları için geliştirilmiş, yeni nesil bir tarayıcı eklentisi. İlan kartlarındaki klasik küçük metinlerin yerine, ilana tıklamanıza gerek kalmadan aracın kritik bilgilerini toplayan, ayrıştıran ve görselleştiren buzlu cam (glassmorphism) görünümlü bir hover paneli sunar.

---

## 🌟 Genel Bakış

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

3. **⚠️ Şüpheli Kelimeler & ✅ Olumlu Terimler**
   - **⚠️ Şüpheli Kelimeler:** Satıcıların hasarı gizlemek veya hafifletmek için kullandığı manipülatif terimleri anında yakalar: `"sigorta şişirmesi"`, `"çıtır hasarlı"`, `"keyfe keder"`, `"bel altı boyalı"`, `"ağır hasar"`, `"çekme belgeli"`, `"şişirme"`, `"pert"`, `"şase"`, `"podye"`, `"sel hasar"`. `"ağır hasar kaydı yoktur"` gibi olumsuz kullanımlar atlanır; terimler kelime başında aranır (`"pert"`, `"ekspertiz"` içinde eşleşmez). Listeler ayarlar sayfasından düzenlenebilir.
   - **✅ Olumlu Terimler:** Satıcının araçla ilgili verdiği güvence beyanlarını ön plana çıkarır: `"yetkili servis bakımlı"`, `"ilk sahibinden"`, `"garantili"`, `"kazasız"`, `"değişensiz"`, `"boyasız"`, `"tramersiz"`.
   - **Dinamik Arayüz:** Açıklamada herhangi bir şüpheli veya olumlu kelime yoksa gereksiz boş kutular gösterilmez; arayüz her zaman temiz ve odaklanabilir kalır.

4. **📈 Yerel Fiyat Geçmişi**
   - Sahibinden geçmiş fiyatları yayınlamadığı için Sahiden, gördüğünüz her ilan fiyatını (arama sonuçları, hover, ilan detayı) tarayıcınızın yerel depolamasına kaydeder. Hiçbir veri sunucuya gönderilmez.
   - Fiyat değiştiğinde fiyatın yanında ↓/↑ yüzde etiketi çıkar, popup'ta da tarih tarih fiyat değişimi listelenir. Geçmiş, ilanı ilk gördüğünüz andan itibaren oluşur.

5. **⚖️ Piyasa Karşılaştırması**
   - Arama sayfasında her ilanın fiyatı, aynı sayfadaki benzer ilanların (aynı model, yıl ±1, yakın km, en az 4 ilan) ortanca fiyatıyla karşılaştırılır. Fark %5 veya fazlaysa fiyatın yanında "Piyasa −%8" etiketi çıkar; popup ortanca fiyatı gösterir.

6. **⚙️ Ayarlar Sayfası**
   - Şüpheli/olumlu kelime listelerini düzenleyin, piyasa karşılaştırmasını açıp kapatın, kaç ilanın takip edildiğini görün, fiyat geçmişini JSON olarak dışa aktarın veya temizleyin. Eklenti simgesine sağ tıklayıp *Seçenekler*'i seçin.

7. **🩺 Sayfa Yapısı Uyarısı**
   - Sahibinden sayfa yapısını değiştirir ve satırlar, fiyatlar veya ilan bilgileri okunamazsa eklenti sessizce boş sonuç göstermek yerine kapatılabilir bir uyarı çıkarır; sorun ayarlar sayfasında da listelenir.

---

## 🛠️ Kurulum

1. Bu depoyu bilgisayarınıza klonlayın veya zip olarak indirin.
   ```bash
   git clone https://github.com/zeitgeist352/sahibinden-arac-analiz.git
   ```
2. Google Chrome, Microsoft Edge veya Brave tarayıcınızı açın ve eklentiler sayfasına gidin:
   - Chrome / Brave: `chrome://extensions`
   - Microsoft Edge: `edge://extensions`
3. Sağ üst köşedeki **Geliştirici modu** anahtarını etkinleştirin.
4. Sol üstteki **Paketlenmemiş öğe yükle** butonuna tıklayın.
5. İndirdiğiniz proje klasörünü (`sahibinden-arac-analiz`) seçin.

---

## 💻 Teknik Mimari

```text
sahibinden-arac-analiz/
├── manifest.json       # Manifest v3 eklenti yapılandırması ve izinler
├── defaults.js         # İçerik betiği ve ayarlar sayfasının ortak kullandığı varsayılan kelime listeleri/ayarlar
├── content.js          # Ana motor: DOM ayrıştırıcı, regex ile veri çıkarma, fiyat takibi, piyasa karşılaştırması, sağlık kontrolleri, arayüz
├── options.html/js/css # Ayarlar sayfası: kelime listeleri, fiyat geçmişini dışa aktarma/temizleme, sağlık raporu
├── styles.css          # Buzlu cam popup, SVG diyagramı ve fiyat etiketi stilleri
├── tests/              # Veri çıkarma mantığı için Node test paketi
└── icons/              # Eklenti simgeleri ve görseller
```

Testleri çalıştırmak için: `node --test tests/*.test.js`

---

## 📝 Lisans

Bu proje **MIT Lisansı** ile lisanslanmıştır. Ayrıntılar için [LICENSE](LICENSE) dosyasına bakın.

---

## 🤝 Katkıda Bulunma

Pull request'ler, özellik önerileri ve hata bildirimleri memnuniyetle karşılanır! Büyük değişiklikler için lütfen önce ne değiştirmek istediğinizi tartışmak üzere bir issue açın.

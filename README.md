# Sahibinden Araç Analiz

A Chrome extension that analyzes car listings on Sahibinden.com and displays vehicle modification information.

**[Turkish Version - Türkçe Versiyon Aşağıda](#türkçe)**

---

## English

### Overview

This extension displays badges on car listing images indicating paint jobs, replaced parts, and local paint work. Visual badges help you quickly identify vehicle modifications while browsing listings on Sahibinden.com.

### Features

- **Paint Badge** - Indicates original factory paint or repainting
- **Changed Parts Badge** - Shows number or status of replaced parts
- **Local Paint Badge** - Indicates local/partial paint work
- **Visual Indicators** - Color-coded badges for quick identification
- **Non-intrusive** - Badges appear in bottom-left corner of listing images

### Badge Reference

| Badge | Color | Meaning |
|---|---|---|
| `B` or `B2` | 🔵 Blue | Paint job |
| `D` or `D3` | 🔴 Red | Number of replaced parts |
| `L` | 🟡 Yellow | Local paint |

### Installation

1. Clone or download this repository
2. Open Chrome and go to `chrome://extensions`
3. Enable "Developer mode" (top right)
4. Click "Load unpacked"
5. Select the project folder

### Troubleshooting

#### Extension not working?

1. **Check Console**
   - Open Sahibinden.com
   - Press F12 → Console tab
   - Look for logs starting with `[SHB]`

2. **Check DOM Structure**
   - Paste the contents of `debug.js` into Console
   - Check what elements are being found

3. **Verify Permissions**
   - Go to `chrome://extensions`
   - Click "Details" on Sahibinden Araç Analiz
   - Check "Site access" → sahibinden.com has permission

### About Accuracy

This extension only displays modification information that has been explicitly marked by the listing owner. It does not perform any vehicle history verification.

### License

MIT License - See [LICENSE](LICENSE) file

### Contributing

Feel free to submit issues and enhancement requests!

---

## Türkçe

### Genel Bilgi

Bu uzantı, Sahibinden.com üzerindeki araç ilanlarında boya işleri, değişen parçalar ve lokal boya işlerini gösteren rozetleri sunar. Renkli rozetler sayesinde ilanları incelerken araç değişiklikleri hızlıca görebilirsiniz.

### Özellikler

- **Boya Rozeti** - Orijinal veya yenilenen boyayı gösterir
- **Değişen Parça Rozeti** - Değişen parça sayısını veya durumunu gösterir
- **Lokal Boya Rozeti** - Kısmi/lokal boya işini gösterir
- **Görsel Göstergeler** - Hızlı tanımlama için renklendirilmiş rozetler
- **Rahatsız Etmeyen Tasarım** - Rozetler ilan fotoğrafının sol alt köşesinde görünür

### Rozet Referansı

| Rozet | Renk | Anlam |
|---|---|---|
| `B` veya `B2` | 🔵 Mavi | Boya |
| `D` veya `D3` | 🔴 Kırmızı | Değişen parça sayısı |
| `L` | 🟡 Sarı | Lokal boya |

### Kurulum

1. Bu depoyu klonlayın veya indirin
2. Chrome'u açın ve `chrome://extensions` sayfasına gidin
3. "Geliştirici modu" etkinleştirin (sağ üstte)
4. "Paketlenmemiş öğe yükle"ye tıklayın
5. Proje klasörünü seçin

### Sorun Giderme

#### Uzantı çalışmıyorsa?

1. **Console'u Kontrol Edin**
   - Sahibinden.com'u açın
   - F12 tuşuna basın → Console sekmesi
   - `[SHB]` ile başlayan logları arayın

2. **DOM Yapısını Kontrol Edin**
   - `debug.js` dosyasının içeriğini Console'a yapıştırın
   - Hangi elementlerin bulunduğunu kontrol edin

3. **İzinleri Doğrulayın**
   - `chrome://extensions` sayfasına gidin
   - Sahibinden Araç Analiz üzerinde "Detaylar"a tıklayın
   - "Site erişimi" → sahibinden.com için izin verilmiş olduğunu kontrol edin

### Doğruluk Hakkında

Bu uzantı, yalnızca ilan sahibi tarafından açıkça işaretlenmiş değişiklik bilgilerini gösterir. Herhangi bir araç geçmişi doğrulaması yapmaz.

### Lisans

MIT Lisansı - [LICENSE](LICENSE) dosyasına bakın

### Katkıda Bulunma

İstek ve önerileri göndermekten çekinmeyin!

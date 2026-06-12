# Sahibinden Araç Analiz 


## Rozetler

| Rozet | Renk | Anlam |
|---|---|---|
| `D` veya `D3` | 🔴 Kırmızı | Değişen parça sayısı |
| `B` veya `B2` | 🔵 Mavi | Boya |
| `L` | 🟡 Sarı | Lokal boya |

Rozetler ilan fotoğrafının **sol alt köşesinde** çıkar.

---

## Extension çalışmıyorsa — Debug Adımları

### 1. Console'u kontrol edin
- Sahibinden.com'da F12 → Console sekmesi
- `[SHB]` ile başlayan loglar görüyor musunuz?

### 2. DOM yapısını kontrol edin
`debug.js` dosyasının içeriğini Console'a yapıştırıp çalıştırın.
Hangi elementlerin bulunduğunu göreceksiniz.

### 3. Extension izinlerini kontrol edin
`chrome://extensions` → Sahibinden Araç Analiz → **Detaylar**
→ "Site erişimi" → sahibinden.com için izin verilmiş olmalı

---

> Sadece ilan sahibi tarafından işaretlenmiş boya/lokal/değişeni görüntüler

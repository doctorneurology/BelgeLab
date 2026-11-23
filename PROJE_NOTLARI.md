# PROJE NOTLARI — PDF Araçları

> **Her oturumun başında bu dosya okunur. Her aşama bitince güncellenir.**
> Son güncelleme: 2026-11-23 (Oturum 1 başlangıcı)

## 1. Proje nedir?

Tarayıcıda çalışan, **sunucusuz**, GitHub Pages ile yayınlanabilir, **açık kaynak (MIT)** bir PDF araçları sitesi.

- Dosyalar kullanıcının cihazından **asla çıkmaz** (yükleme yok, çerez/izleme yok, dış servis yok).
- Arayüz **Türkçe**; telefonda da rahat kullanılır (mobil öncelikli tasarım).
- Her araç için ayrı bir sayfa + bir ana sayfa.
- Proje sahibi yazılımcı değil: teknik ayrıntılar ona yönetilmez. Konuşma dili **Türkçe ve sade**. Teknik kararları Claude verir; **önemli ve geri dönüşü zor olanlar** (ör. bilgisayara program kurmak, lisans değiştirmek, dosya silmek, GitHub'a yüklemek) kullanıcıya sorulur.

## 2. KURALLAR (değiştirilemez)

- Bilinmeyen PDF şifresini kırma/deneme-yanılma özelliği YOK. Şifre kaldırma yalnızca kullanıcı şifreyi girerse çalışır.
- Başkasının koyduğu filigranı/telif işaretini silen genel bir araç YOK. Filigran ekleme var; yalnızca bu programın eklediği filigran geri alınabilir.
- Düzenlenmiş belgenin "değiştirilmemiş orijinal" gibi görünmesi için iz saklama özelliği YOK.
- Emin olunmayan durumda sessizce bozma; işaretle ve kullanıcıya göster.
- Hiçbir şeyi "çalıştı" diye bildirme; test çalıştırıp sonucu göster.

### Ek çalışma kuralları (Claude için)

- `C:\Users\ASUS\Desktop\ornekler` içindeki PDF'ler **kişisel/özel belgeler** içerir (ör. görev belgesi). Bunlar **asla** depoya (git'e) eklenmez, internete yüklenmez, çıktıları depoya girmez. Test çıktıları `.gitignore` ile dışarıda tutulur.
- Başka bir yerden kod/yazı tipi alınırken lisansı kontrol edilir; lisans dosyası projeye eklenir. AGPL/GPL gibi MIT ile uyumsuz kütüphane **kullanılmaz** (ör. MuPDF.js AGPL olduğu için seçilmedi).
- Kullanıcıya konuşurken: Türkçe, kısa, jargonsuz. Komut verirken adım adım ve kopyalanabilir.

## 3. Teknoloji seçimleri ve lisanslar

| Amaç | Seçim | Lisans |
|---|---|---|
| Derleme / geliştirme sunucusu | Vite (çok sayfalı statik site, göreli yollar) | MIT |
| PDF'i ekrana çizme | pdf.js (`pdfjs-dist`) | Apache-2.0 |
| PDF oluşturma/düzenleme | pdf-lib + `@pdf-lib/fontkit` | MIT |
| Şifre ekleme/kaldırma, onarım (WASM) | qpdf (WASM sürümü) | Apache-2.0 |
| OCR (sonraki oturumlar) | tesseract.js (+ Türkçe dil verisi) | Apache-2.0 |
| Word çıktısı (sonraki oturumlar) | docx | MIT |
| Test (Node tarafında çizim) | Vitest, `@napi-rs/canvas`, pixelmatch, pngjs | MIT |
| Yazı tipleri | Liberation, Carlito, Caladea, Noto | SIL OFL 1.1 / Apache-2.0 |
| Yayın | GitHub Actions → GitHub Pages | — |

Not: Şifre ekleme/kaldırma için pdf-lib yetmez (şifreleme desteği yok), bu yüzden qpdf WASM kullanılır.

## 4. Yazı tipleri

`public/fonts/` altında, her ailenin **lisans dosyasıyla** birlikte:
Liberation Serif/Sans/Mono (Times New Roman / Arial / Courier New ile ölçü uyumlu), Carlito (Calibri ile ölçü uyumlu), Caladea (Cambria ile ölçü uyumlu), Noto Sans / Noto Serif.
**Türkçe karakterler (ğ Ğ ş Ş ı İ ö Ö ü Ü ç Ç) testle doğrulanır** (`npm test` içinde).

## 5. Klasör yapısı (plan)

```
pdf-araclari/
  PROJE_NOTLARI.md   ← bu dosya
  README.md          ← Türkçe, kullanıcı için
  LICENSE            ← MIT
  index.html         ← ana sayfa
  araclar/*.html     ← her araç için ayrı sayfa
  src/               ← ortak kod (arayüz, PDF çekirdeği, araç mantığı)
  public/fonts/      ← yazı tipleri + lisanslar
  tests/             ← birim testleri
  tools/             ← örnek PDF karşılaştırma betiği (render-compare)
  .github/workflows/ ← Pages'e otomatik yayın
```

## 6. Test düzeneği

- `npm test` → her aracın çekirdek mantığı için otomatik testler.
- `npm run ornek-test` → `C:\Users\ASUS\Desktop\ornekler` içindeki PDF'leri açar, sayfaları PNG'ye çizer, araç öncesi/sonrası görüntüleri karşılaştırır, rapor üretir (`ciktilar/` — git dışı).
  Sonraki oturumlarda yazı düzeltme motorunun "bozmadan düzenledi mi?" denetimi için kullanılacak.

## 7. AŞAMA LİSTESİ

### Aşama 0 — Hazırlık (Oturum 1)
- [ ] PROJE_NOTLARI.md yazıldı
- [ ] Ortam (Node.js, Git) hazır
- [ ] Vite iskeleti + kütüphaneler kuruldu
- [ ] Yazı tipleri + lisans dosyaları eklendi, Türkçe karakter testi geçti
- [ ] Örnek PDF render-karşılaştırma betiği hazır ve çalıştırıldı
- [ ] GitHub Actions ile Pages yayını kuruldu
- [ ] README (Türkçe) + MIT LICENSE

### Aşama 1 — Temel araçlar (Oturum 1)
Her araç: ayrı sayfa + çekirdek kod + test (çalıştırıldı, sonuç gösterildi)
- [ ] Ana sayfa
- [ ] PDF birleştir
- [ ] PDF böl
- [ ] Sayfa sil / sırala / döndür / çıkar
- [ ] Sayfa numarası ekle
- [ ] Üst/alt bilgi ekle
- [ ] Filigran ekle (+ kendi eklediğini geri al)
- [ ] Resimden PDF
- [ ] PDF'ten resim
- [ ] Kırp
- [ ] Görünür imza / metin kutusu ekle
- [ ] Form doldur
- [ ] Şifre ekle
- [ ] Şifre kaldır (yalnızca şifre biliniyorsa)

### Aşama 2 — Yazı düzeltme motoru (Oturum 2)
- [ ] (Henüz başlanmadı — bu oturumda YAPILMAZ)

### Aşama 3 — Sonraki fikirler
- [ ] OCR (tesseract.js, Türkçe)
- [ ] PDF → Word (docx)
- [ ] Mobil/erişilebilirlik cilası, performans (büyük dosyalar)

## 8. Oturum günlüğü

- **Oturum 1 (2026-11-23):** Proje başlatıldı. Ortamda Node.js ve Git bulunamadı (kurulum gerekiyor; bkz. aşağıdaki notlar).

## 9. Açık konular / kararlar

- Node.js ve Git bilgisayarda kurulu değil → kullanıcıya sorulup kurulacak.
- Proje klasörü: `C:\Users\ASUS\Desktop\pdf-araclari`.

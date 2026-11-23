# PDF Araçları

Tarayıcıda çalışan, **sunucusuz**, açık kaynaklı (MIT) bir PDF araçları sitesi.
**Dosyalarınız cihazınızdan asla çıkmaz:** yükleme yok, hesap yok, izleme yok. Telefonda da rahat kullanılır, arayüz Türkçedir.

## Neler yapabilir?

| Grup | Araçlar |
|---|---|
| Sayfaları düzenle | PDF birleştir · PDF böl · Sayfa sil · Sayfa sırala · Sayfa döndür · Sayfa çıkar · Kırp · **Yazı düzelt** (sayfa düzeni aynen kalır; metin tabanlı PDF) |
| Belgeye ekle | Sayfa numarası · Üst/alt bilgi · Filigran ekle (ve **kendi eklediğini** geri al) · Görünür imza / metin kutusu · Form doldur |
| Dönüştür | Resimden PDF · PDF'ten resim (PNG/JPEG, ZIP) |
| Şifre | Şifre ekle (AES-256) · Şifre kaldır (**yalnızca şifre biliniyorsa**) |

Türkçe karakterler (ğ ş ı İ ö ü ç) tüm araçlarda sorunsuz çalışır: açık lisanslı, ölçü uyumlu yazı tipleri
(Liberation, Carlito, Caladea, Noto) projeye dahildir.

## İlkeler

- Bilinmeyen PDF şifresini kırma / deneme-yanılma özelliği **yoktur**. Şifre kaldırma yalnızca kullanıcı şifreyi girerse çalışır.
- Başkasının koyduğu filigranı ya da telif işaretini silen genel bir araç **yoktur**. Yalnızca bu sitenin eklediği filigran geri alınabilir.
- Düzenlenen belgenin "değiştirilmemiş orijinal" gibi görünmesi için iz saklanmaz; üretici ve değişiklik tarihi dürüstçe yazılır.
- Emin olunmayan durumda sessizce bozulmaz: belgenin etkilenebilecek özellikleri (form, yer imi, dijital imza…) sonuç ekranında **uyarı** olarak gösterilir.
- Hiçbir şey "çalıştı" diye bildirilmez; her araç için otomatik test vardır (aşağıya bakın).

## Bilgisayarınızda açmak (geliştirme sunucusu)

1. [Node.js](https://nodejs.org) (LTS sürümü) kurulu olmalı.
2. Bu klasörde bir terminal (PowerShell) açın ve sırayla çalıştırın:

```powershell
npm install
npm run dev
```

3. Ekrana yazılan adresi (genellikle `http://localhost:5173`) tarayıcıda açın.

Yayın sürümünü (GitHub'a yüklenecek haliyle) denemek için:

```powershell
npm run build
npm run preview
```

## Testler

```powershell
npm test
```

Her araç için, sayfaları **çizip piksel piksel karşılaştıran** testler çalışır (ör. "filigran ekle → geri al" sonrası sayfa özgünüyle birebir aynı olmalı).

Kendi PDF'lerinizle (gerçek belgelerle) deneme yapmak için:

```powershell
npm run ornek-test                         # varsayılan: Masaüstündeki "ornekler" klasörü
npm run ornek-test -- "D:\baska\klasor"    # başka bir klasör
```

Rapor `ciktilar/ornek-test/rapor.md` dosyasına yazılır. Bu klasör git'e **eklenmez**; kişisel belgeleriniz depoya girmez.

## GitHub Pages'te yayınlamak

1. GitHub'da yeni bir **boş** depo oluşturun (ör. `pdf-araclari`).
2. Bu klasörde:

```powershell
git remote add origin https://github.com/KULLANICI_ADINIZ/pdf-araclari.git
git branch -M main
git push -u origin main
```

3. GitHub'da depo sayfasında **Settings → Pages → Build and deployment → Source: "GitHub Actions"** seçin.
4. `main` dalına her gönderimde `.github/workflows/yayin.yml` testleri çalıştırır, siteyi derler ve yayınlar.
   Adres: `https://KULLANICI_ADINIZ.github.io/pdf-araclari/`

(Site göreli yollar kullandığı için alt klasörde de sorunsuz çalışır.)

## Proje yapısı

```
index.html, <arac>.html   Ana sayfa ve her araç için ayrı sayfa (npm run sayfalar ile üretilir)
src/core/                 PDF çekirdeği (tarayıcıda ve Node'da aynı kod; testler buradan)
src/ui/, src/sayfalar/    Arayüz ve her aracın sayfa betiği
src/araclar.js            Tüm araçların listesi (menü, ana sayfa ve sayfa üretici bunu kullanır)
public/fonts/             Yazı tipleri + lisans dosyaları
tests/                    Otomatik testler
tools/                    Sayfa üretici, örnek PDF testi, çizim karşılaştırma yardımcıları
PROJE_NOTLARI.md          Proje planı, kurallar, aşama listesi (her oturumun başında okunur)
```

## Kullanılan açık kaynak bileşenler

pdf.js (Apache-2.0), pdf-lib (MIT), qpdf WebAssembly (Apache-2.0), yazı tipleri (SIL OFL 1.1) ve diğerleri.
Ayrıntılar: [THIRD_PARTY_LICENSES.md](THIRD_PARTY_LICENSES.md).

## Lisans

[MIT](LICENSE)

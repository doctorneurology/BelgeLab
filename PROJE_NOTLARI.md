# PROJE NOTLARI — PDF Araçları

> **Her oturumun başında bu dosya okunur. Her aşama bitince güncellenir.**
> Son güncelleme: 2026-11-23 (Oturum 2 sonu — yazı düzeltme motoru)

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

- Masaüstündeki `ornekler` klasörü (`%USERPROFILE%\Desktop\ornekler`) içindeki PDF'ler **kişisel/özel belgeler** içerir (ör. görev belgesi). Bunlar **asla** depoya (git'e) eklenmez, internete yüklenmez, çıktıları depoya girmez. Test çıktıları `ciktilar/` altına yazılır ve `.gitignore` ile dışarıda tutulur. Bu belgelerin içeriği sohbette alıntılanmaz.
- Başka bir yerden kod/yazı tipi alınırken lisansı kontrol edilir; lisans dosyası projeye eklenir. AGPL/GPL gibi MIT ile uyumsuz kütüphane **kullanılmaz** (ör. MuPDF.js AGPL olduğu için seçilmedi).
- Kullanıcıya konuşurken: Türkçe, kısa, jargonsuz. Komut verirken adım adım ve kopyalanabilir.
- Git: depo yerel kimliği `PDF Araclari <noreply@pdf-araclari.invalid>` — kullanıcının gerçek e-postası commit'lere **yazılmaz** (GitHub'a yüklenince herkese açık olur).

## 3. Teknoloji seçimleri ve lisanslar

| Amaç | Seçim | Lisans |
|---|---|---|
| Derleme / geliştirme sunucusu | Vite 8 (çok sayfalı statik site, göreli yollar `base: './'`) | MIT |
| PDF'i ekrana çizme | pdf.js (`pdfjs-dist` 6.x) | Apache-2.0 |
| PDF oluşturma/düzenleme | pdf-lib 1.17 + `@pdf-lib/fontkit` | MIT |
| Şifre ekleme/kaldırma (WASM) | qpdf 12.2 WASM (`@neslinesli93/qpdf-wasm`) | Apache-2.0 / ISC |
| OCR (sonraki oturumlar) | tesseract.js 7 (+ Türkçe dil verisi eklenecek) | Apache-2.0 |
| Word çıktısı (sonraki oturumlar) | docx 9 | MIT |
| Test | Vitest, `@napi-rs/canvas`, pixelmatch, pngjs, jszip | MIT/ISC |
| Yazı tipleri | Liberation, Carlito, Caladea, Noto (`public/fonts/`, lisans dosyalarıyla) | SIL OFL 1.1 |
| Yayın | GitHub Actions → GitHub Pages (`.github/workflows/yayin.yml`: test → derle → yayınla) | — |

Ayrıntılı lisans listesi: `THIRD_PARTY_LICENSES.md`.

## 4. Mimari — sonraki oturumlar için bilinmesi gerekenler

**Klasörler**
- `src/core/` → PDF çekirdeği. **Tarayıcıda ve Node'da aynı kod çalışır**; testler doğrudan buraya yazılır. Her fonksiyon `Uint8Array` alır, `{bayt, uyarilar, ...}` döndürür.
- `src/ui/`, `src/sayfalar/<arac>.js` → arayüz. `src/ui/arac.js` ortak çatıdır (dosya seç → ayarlar → çalıştır → sonuç/indir/önizleme/uyarılar). Yeni araç eklemek: `src/araclar.js`'e kayıt + `src/sayfalar/<slug>.js` + `npm run sayfalar` (HTML'i üretir) + test.
- `tools/` → `karsilastir.mjs` (sayfa çiz/karşılaştır yardımcıları), `ornek-test.mjs` (gerçek PDF'lerle test), `ortam-node.mjs` (Node'da pdf.js+canvas+qpdf kurulumu), `sayfalari-uret.mjs`, `pdfjs-varliklari.mjs`.
- `tests/` → Vitest; `tests/yardimci/pdf-uret.js` örnek PDF/resim üreticileri (form dahil).

**Önemli teknik kararlar**
1. **Görünür koordinatlar:** Tüm çizim/ekleme işlemleri sayfanın *ekranda görünen* sol-alt köşesine göre yapılır (`gorunurDonusum` — `/Rotate` ve CropBox hesaba katılır). Döndürülmüş sayfalarda numara/filigran/imza doğru yere gelir (testli).
2. **İşaretli ekleme (`src/core/cizim.js`):** Programın eklediği her içerik kendi içerik akışında, ilk satırı `%PDFARACLARI v1 tur=<tür> id=<kimlik> kaynak=Font:..;ExtGState:..` olan okunabilir bir yorumla saklanır. "Filigranı geri al" yalnızca `tur=filigran` olanları (ve sarmalayıcı q/Q akışlarını, kaynaklarıyla birlikte, yazı tipi/resim nesneleri dahil) siler → sayfa piksel piksel özgününe döner (testli). Başkasının filigranı işaretsizdir, **dokunulmaz** (testli). İşaret gizli değildir; kural gereği iz saklama yok.
3. **Sayfa silme/çıkarma/bölme** sayfaları *yeni belgeye kopyalar* (pdf-lib `removePage` artık nesneleri dosyada bırakır → gizlilik sorunu). Bunun bedeli: form alanları / yer imleri / ekler taşınmaz → sonuçta **uyarı** gösterilir. Döndürme, numara, filigran, imza, form, kırp ise belgeyi yerinde düzenler (diğer özellikler korunur).
4. **Şifre:** pdf-lib şifreleme bilmez → qpdf WASM. `sifreKaldir` önce `--show-encryption` ile girilen şifrenin gerçekten kullanıcı/sahip şifresi olduğunu doğrular (boş kullanıcı şifreli, yalnızca kısıtlamalı belgede rastgele metinle kısıtlama kaldırılamaz — testli). qpdf çıktısı `preRun: FS.init(undefined, stdout, stderr)` ile yakalanır (`print` seçeneği bu derlemede çalışmıyor).
5. **pdf.js:** Node'da `legacy` derleme + `@napi-rs/canvas`; tarayıcıda `src/ui/ortam.js`. Belgeyi `belge.kapat()` ile kapatın (`destroy` yok). pdf.js'in `data` dizisini devralmaması için bayt kopyalanır.
6. **Yazı tipleri:** `src/core/fonts.js`; metindeki karakter yazı tipinde yoksa sessizce kutu çizmek yerine anlaşılır hata verir (`metniDogrula`). Varsayılan yazı tipi Liberation Sans.
7. **Çıktı üreticisi dürüst:** `Producer` = "PDF Araçları (açık kaynak…)" ve ModDate güncel zaman yazılır.
8. **Kırp:** yalnızca CropBox değiştirir → kırpılan içerik dosyada kalır; sonuçta bu **uyarı** olarak gösterilir.
9. **Yazı düzeltme motoru (`src/core/yazi/`, Oturum 2):**
   - `akis.js` içerik akışı okuyucu (her işlecin bayt aralığı saklanır → dokunulmayan komutlar bayt bayt aynı yazılır), matris yardımcıları.
   - `font.js` yazı tipi çözücü: ToUnicode CMap, Encoding/Differences + glif adları, Identity-H (W/DW), standart 14 yazı tipi genişlikleri (`@pdf-lib/standard-fonts`); ad/özelliklerden açık karşılık önerisi (Times→Liberation Serif, Arial/Helvetica→Liberation Sans, Calibri→Carlito, Cambria→Caladea, Courier→Liberation Mono; "Condensed/Neue/Light…" kesimler ölçü uyumlu SAYILMAZ). Tanınmayan yazı tipinde aile, satırların genişliğine en iyi uyan açık yazı tipi ölçülerek seçilir.
   - `analiz.js` (Aşama 1): akışı ve iç içe form nesnelerini grafik durumuyla yorumlar (CTM, Tm/Tlm, Tc/Tw/Tz/Ts/Tr, renk); her glifin görünür koordinatı; satır kurma (üst/alt simge bağlanır, düzenli aralıklı iki yana yaslı satırlar birleşir); hizalama (sol/orta/sağ/iki yana) ve düzenlemede kullanılabilir alan (`sinir`); korumalar: `ustalt` (sayfalar arası aynı yerde tekrar, rakamlar yok sayılır), `logo` (satırın yarısı küçük, tekrar etmeyen bir resmin üstünde), `suslu`, `donuk`, `dikey`, `ozel` (Type3, görünmez/kırpma yazısı), `cozulemedi`. `SINIR` = kabul sınırları (%3 ölçek, kelime sonu 0,3 pt, doğrulama 0,5 pt).
   - `yeniden.js` (Aşama 2-3): her yazı komutu **akıştaki kendi yerinde** değiştirilir (çizim sırası, kırpma, saydamlık, katman, etiket yapısı aynen kalır). Kaldırılan komutun yerine yazı imlecini eski yerine götüren `[n] TJ` konur. Değişmeyen satırlar kelime kelime orijinal x'ine oturtulur, kelime genişliği `Tz` ile en fazla %3 ayarlanır; daha fazlası gerekirse satır orijinal kalır ve raporda "kontrol gerekli" olur. Boşluklar da yerine yazılır (metin seçme/kopyalama bozulmasın). Düzenlenen satır, biçim parçaları (kalın kelime, renk, üst simge) korunarak hizalamaya göre yerleştirilir; sığmazsa uyarı. Değişen form nesnesinin sayfaya özel kopyası çıkarılır (paylaşılan başlık başka sayfalarda değişmez). Sonunda erişilemeyen tüm nesneler silinir (`kullanilmayanlariSil`) → eski yazı dosyada kalmaz. İmzalıysa `/V`, `/Perms`, `SigFlags` kaldırılır (imzasız yeni dosya, uyarı). Programın işaretli akışlarına (`%PDFARACLARI`, ör. filigran) dokunulmaz.
   - `motor.js`: `yaziAnalizEt`, `yaziDuzelt(bayt,{sayfalar,degisiklikler,kilitAcik,esleme})` → `{bayt, rapor, uyarilar}`, `yazilariKaldir`.
   - `dogrulama.js` (Aşama 5): (a) iki belgenin de tüm yazısı kaldırılıp **birebir** (eşiksiz) piksel karşılaştırması, (b) pdf.js metin öğelerinden bağımsız satır kurup başlangıç/bitiş/taban sapması (boşlukla biten öğenin bitişi belirsiz olduğu için o satırda bitiş ölçülmez), (c) üst üste bindirme görüntüsü (kırmızı=eski, camgöbeği=yeni, siyah=ortak). Tarayıcıda da çalışır.
   - Arayüz: `src/sayfalar/yazi-duzelt.js` (sayfaya tıkla-düzelt, değişiklik listesi, yazı tipi eşleme tablosu, üst/alt bilgi kilidi, sığma uyarısı, sayfa raporu, doğrulama + bindirme). 40 sayfadan uzun belgelerde sayfa aralığı seçilir.
   - Testler: `tests/yazi-motoru.test.js` + `tests/yardimci/yazi-pdf.js` (paylaşılan başlık form nesnesi, logo, döndürülmüş yazı, Helvetica, imzalı sürüm).

**Geliştirme ortamı notları (Windows)**
- Node.js 26 ve Git bu oturumda `winget` ile kuruldu (kullanıcı onayıyla). Claude'un PowerShell aracı bazen eski PATH ile açılır; komutların başına şunu koy:
  `$env:Path = [Environment]::GetEnvironmentVariable('Path','Machine') + ';' + [Environment]::GetEnvironmentVariable('Path','User')`
- PowerShell 5.1: `Get-Content -Raw | Set-Content` ile Türkçe dosyaları **düzenleme** (kodlama bozulur); dosya değişikliği için Edit/Write aracını kullan.
- Tarayıcıda deneme: `node node_modules/vite/bin/vite.js preview --port 4173` (önce `npm run build`), sonra tarayıcı panelinde `http://localhost:4173/...`.

## 5. Test düzeneği

- `npm test` → 130 test (14 dosya): her araç için çalıştır → çiz → karşılaştır. Örn. birleştirmede sayfalar kaynak sayfalarla piksel piksel aynı, filigran geri alınca özgün sayfaya dönüyor, döndürülmüş sayfalarda konumlar doğru, yanlış/boş şifre reddediliyor, silinen sayfa içeriği dosyada kalmıyor.
- `npm run ornek-test` → Masaüstündeki `ornekler` klasöründeki PDF'lerle (her dosyadan ilk 5 sayfa) tüm araçları dener, sayfaları çizip karşılaştırır, `ciktilar/ornek-test/rapor.md` üretir (git dışı). **Yazı düzeltme motoru için "bozmadan düzenledi mi?" denetimi bu betikteki `ayniMi` / `karsilastir` mantığıyla yapılacak** (`tools/karsilastir.mjs`: `sayfaPikselleri`, `karsilastir`, `metinCikar`, `doluluk`, `pngKaydet`).
- Son sonuç (Oturum 2): `npm test` → **146/146** geçti (15 dosya; yazı motoru 15 test). `npm run ornek-test` → 9 PDF, **144 kontrol geçti, 0 kaldı**, 9 atlandı ("belgede form alanı yok"). Yazı motoru her belgede 3 kontrol yapar: analiz (çıkan metin pdf.js ile aynı); değişiklik yok → (a) 0 piksel, (b) ≤ 0,5 pt; bir satır düzeltme → yeni yazı yerinde, eski satır yok, (a) 0. Ayrıca `ciktilar/ornek-test/<dosya>/yazi-bindirme-sN.png` (bindirme), `yazi-yeniden.pdf`, `yazi-duzeltilmis.pdf` üretir; sayfa raporu `rapor.md`'de.
- Oturum 1: 130/130 test, 117 örnek kontrol.
- Tarayıcıda (Chrome tabanlı panel) elle denendi ve çalıştı: birleştir (+şifreli dosya şifre akışı), böl, sil, çıkar, sırala, döndür, numara, üst/alt bilgi, filigran ekle, filigran geri al (bulunamadı yolu), resimden PDF, PDF'ten resim (+ZIP), şifre ekle/kaldır, kırp, imza/metin kutusu (sürükleme dahil), form doldur; mobil genişlikte (375px) yatay taşma yok. Konsolda hata yok.

## 6. Bilinen sınırlar / sonraki oturum için fikirler

- Tarayıcıda **gerçek (büyük) örnek PDF'lerle** el testi yapılmadı (35 MB'lık dosya dahil); Node tarafında hepsiyle test edildi. Telefonda gerçek cihaz testi yapılmadı (yalnızca 375px emülasyon).
- Safari/Firefox'ta denenmedi (yalnızca panelin Chromium tabanlı tarayıcısı).
- pdf-lib bakımsız bir kütüphane; sorun çıkarsa maintained fork (`@pdfme/pdf-lib`) düşünülebilir. Yer imi/form korumalı sayfa işlemleri için qpdf (`--pages`) alternatifi değerlendirilebilir.
- Kırp aracı kenarları sürüklemeyi desteklemiyor (kaydırıcılar var). İmza çiziminde basınç/ince çizgi yok.
- Resimden PDF: WebP/GIF/BMP tarayıcıda PNG'ye çevrilir (EXIF yönelimi uygulanır); JPEG EXIF yönelimi çekirdekte işlenir (aynalı yönelimler uyarı verir).
- Büyük dosyalarda ana iş parçacığında çalışıyor (arayüz kısa süre donabilir); Web Worker'a taşımak iyileştirme olabilir.
- Henüz yok: OCR, PDF→Word, **taranmış PDF'te yazı düzeltme** (sonraki oturum).
- Yazı motoru sınırları: ölçü uyumlu karşılığı olmayan yazı tiplerinde satırlar orijinal kalır (%3 kuralı); Type3 / görünmez / kırpma yazısı, dikey (Identity-V) ve Identity-H dışındaki CID kodlamaları korunur; düzenlenen satır dar bir kırpma alanındaysa uzayan yazı kırpılabilir; yeni yazıda çift aralığı (kerning) uygulanmaz (kelime genişliği ölçekle oturtulur); etiketli PDF'te /ActualText varsa düzenlenen satırın erişilebilirlik metni eski kalabilir. Tarayıcıda yalnızca yapay belgeyle elle denendi (masaüstü + 375 px); büyük gerçek belgelerle tarayıcı denemesi yapılmadı. Tarayıcıdaki doğrulama ilk 30 sayfayla sınırlı.

## 7. AŞAMA LİSTESİ

### Aşama 0 — Hazırlık (Oturum 1)
- [x] PROJE_NOTLARI.md yazıldı
- [x] Ortam (Node.js, Git) hazır
- [x] Vite iskeleti + kütüphaneler kuruldu
- [x] Yazı tipleri + lisans dosyaları eklendi, Türkçe karakter testi geçti
- [x] Örnek PDF render-karşılaştırma betiği hazır ve çalıştırıldı
- [x] GitHub Actions ile Pages yayını kuruldu (iş akışı dosyası hazır; GitHub'da deneme **kullanıcı depoyu yükleyince** olacak)
- [x] README (Türkçe) + MIT LICENSE

### Aşama 1 — Temel araçlar (Oturum 1)
Her araç: ayrı sayfa + çekirdek kod + test (çalıştırıldı, sonuç gösterildi)
- [x] Ana sayfa
- [x] PDF birleştir
- [x] PDF böl
- [x] Sayfa sil / sırala / döndür / çıkar
- [x] Sayfa numarası ekle
- [x] Üst/alt bilgi ekle
- [x] Filigran ekle (+ kendi eklediğini geri al)
- [x] Resimden PDF
- [x] PDF'ten resim
- [x] Kırp
- [x] Görünür imza / metin kutusu ekle
- [x] Form doldur
- [x] Şifre ekle
- [x] Şifre kaldır (yalnızca şifre biliniyorsa)

### Aşama 2 — Yazı düzeltme motoru (Oturum 2) — **TAMAM (metin tabanlı PDF'ler)**
Mantık: sayfa orijinal kalır; yalnızca yazı komutları yerinde değiştirilir, tüm yazı aynı konumlara ölçü uyumlu açık yazı tipiyle yeniden yazılır. Paragraf akıtma YOK; her satır kendi başlangıç/taban/boyut/renk değeriyle kalır. Ayrıntı: §4 madde 9.
- [x] 1. Analiz: satır konum/boyut/renk/yazı tipi; üst/alt bilgi; logo, süslü, döndürülmüş/dikey yazı → korumalı
- [x] 2. Yazı kaldırma (form nesneleri dahil; resim/çizim/kırpma/açıklama aynen)
- [x] 3. Yeniden yazma: başlangıç/bitişe oturtma, en fazla %3 `Tz`; fazlası → orijinal + işaret
- [x] 4. Düzenleme ekranı (`yazi-duzelt.html`): tıkla-düzelt, değişiklik listesi, yazı tipi/boyut/renk/kalın/italik, yazı tipi eşleme tablosu, üst/alt bilgi kilitli (açılabilir), sığmazsa uyarı
- [x] 5. Doğrulama: (a) yazısız piksel karşılaştırma, (b) satır sapması, (c) bindirme görüntüsü, (d) sayfa raporu
- [x] 6. İmzalı PDF: uyarı + imzasız yeni dosya
- Sonuç (ilk 5 sayfa, 9 örnek): **9/9 belgede (a) fark 0 piksel, (b) en büyük sapma 0,28 pt** (sınır 0,5 pt). Hiçbir belge kalmadı.
- Dürüst sınırlar (raporda "kontrol gerekli" olarak görünür, satır orijinal kalır): ölçü uyumlu açık karşılığı olmayan yazı tipleri. Örn. "Roles for…" makalesinde gizli adlı AdvTT yazı tipleri → 264 satırın 196'sı orijinal kaldı; Demans kitabında Type3 (çizimle) Roboto yazıları korumalı, Merriweather/Myriad satırlarının 29'u sığmadı; nasr makalesinde Helvetica Neue Condensed tablo satırları (109) orijinal kaldı. Bu satırlar düzenlenirse seçilen yazı tipiyle yazılır (uyarı gösterilir).

### Aşama 3 — Sonraki fikirler
- [ ] OCR (tesseract.js, Türkçe dil verisi)
- [ ] PDF → Word (docx)
- [ ] Mobil/erişilebilirlik cilası, Web Worker, büyük dosya performansı
- [ ] Kırp aracında sürükleyerek ayarlama

## 8. Oturum günlüğü

- **Oturum 2 (2026-11-23):** Yazı düzeltme motoru (Aşama 2, adım 1–6) + `yazi-duzelt` sayfası (18. araç). `@pdf-lib/standard-fonts` doğrudan bağımlılık yapıldı (MIT; zaten pdf-lib ile geliyordu). `src/ui/arac.js` sonucu `ekler` (ek bölümler) alabiliyor. 146 test, 144 örnek kontrol geçti. `.claude/launch.json` (yerel önizleme ayarı, git dışı) yeniden yazıldı: `gelistirme` = `npm run dev`, port 5173.
- **Oturum 1 (2026-11-23):** Proje sıfırdan kuruldu. Node.js + Git kuruldu (winget, kullanıcı onayıyla). Çekirdek + 17 araç sayfası + ana sayfa + hakkında sayfası yazıldı. 130 otomatik test ve 117 gerçek-PDF kontrolü geçti. Tarayıcıda elle denendi. README, MIT, üçüncü taraf lisanslar, Pages iş akışı hazır. GitHub'a **henüz yüklenmedi** (kullanıcı yükleyecek). Commit'ler yerel depoda.

## 9. Açık konular / kararlar

- Depo GitHub'a yüklenip Pages ayarı yapılınca iş akışının ilk çalışması izlenmeli (Actions sekmesi). Orada `npm ci` / test / build adımlarında bir sorun çıkarsa düzeltilecek.
- Kullanıcı GitHub kullanıcı adını/depo adını seçince README'deki `KULLANICI_ADINIZ` yer tutucuları ve (isteğe bağlı) altbilgideki depo bağlantısı güncellenecek.
- Proje klasörü: Masaüstündeki `pdf-araclari` klasörü.

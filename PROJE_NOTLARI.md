# PROJE NOTLARI — BelgeLab (eski adı: PDF Araçları)

> **Her oturumun başında bu dosya okunur. Her aşama bitince güncellenir.**
> Son güncelleme: 2026-11-23 (Oturum 3 sonu — OCR, taranmış belgede düzeltme, PDF→Word, sıkıştırma, gerçek karartma, GitHub hazırlığı)

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
| OCR | tesseract.js 7 + `tesseract.js-core` (WASM) + Türkçe dil verisi (`@tesseract.js-data/tur`, `4.0.0_best_int`, ~2 MB; devDependency, derlemede `public/tesseract/` altına kopyalanır) — hepsi sitenin kendi dosyası, CDN yok | Apache-2.0 (veri paketleyicisi MIT) |
| Word çıktısı | docx 9 (tarayıcıda gerektiğinde `import('docx')` ile yüklenir) | MIT |
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

10. **OCR + taranmış belge + Word + sıkıştırma + karartma (Oturum 3)** — hepsi `src/core/`, Node'da test edilir, tarayıcıda aynı kodla çalışır. Yazı motoruna (`src/core/yazi/`) DOKUNULMADI.
   - `ocr.js`: `ocrOrtamiAyarla({createWorker, secenekler})` (Node: `tools/ortam-node.mjs`, yerel `node_modules` dil verisi; tarayıcı: `src/ui/ortam.js → ocrHazirla()` mutlak URL'lerle `public/tesseract/`). `goruntuOcr`, `sayfaOcr` (sonuç **sayfa noktası**, görünür sol-alt orijin), `pdfOcr` (zaten yazısı olan sayfayı atlar; **görünmez yazı** katmanı = çizim kipi 3, `SayfaCizici.gorunmezMetin`, `%PDFARACLARI … tur=ocr` işaretli → `ocrKatmaniniKaldir`), `ocrKatmanindanCikar` (taranmış düzeltmede eski kelimeleri arama katmanından siler). Okunan yazı ASLA görünür yazı olarak otomatik eklenmez.
   - `sayfa-resim.js`: sayfayı resme çevirip bölgeyi boyama (`sayfayiResmeCevir`), zemin/yazı rengi örnekleme, `sayfaYaziKutulari` (pdf.js yazı parçaları → görünür kutular; dönük yazı için de çalışır).
   - `tarama-duzelt.js` (`bolgeDuzelt`): KULLANICININ seçtiği bölge zemin rengiyle örtülür + gerçek yazı yazılır. İki kip: **örtme** (yerinde; eski görüntü dosyada kalır → uyarı) ve **kalıcı** (düzeltilen sayfalar yeni belgeye yeniden resimlenerek yazılır; eski piksel gitmiş olur). Boyut otomatik: eski metnin genişliğine göre (`eskiMetin`), sığmazsa küçültür ve uyarır.
   - `sayfa-icerik.js` + `pdf-word.js` (`pdfdenWord`): pdf.js `getTextContent` + operatör listesi (resim konumu, CTM takibi, `commonObjs` "g_" önekli resimler) → satır kurma → (iki sütun ayracı) → tablo (hizalı sütun kümeleme) → paragraf/başlık/madde/tire birleştirme → sayfalar arası paragraf birleştirme → docx (`Packer.toArrayBuffer`). `belgeAc(bayt,{ek:{fontExtraProperties:true}})` ile gerçek yazı tipi adı (kalın/italik/serif). Taranmış sayfa → `sayfaOcr` kelimeleri aynı hatta. Tekrarlayan üst/alt bilgi ve sayfa numarası atlanır. Her tahmin `uyarilar`'da bildirilir.
   - `sikistir.js`: yalnızca fotoğraf türü resimler (DCT RGB/gri; Flate RGB/gri ve renk çeşitliliği ≥ %20) yeniden JPEG'e çevrilir/küçültülür (içerik akışındaki `cm/q/Q/Do`'dan gösterilen genişlik → etkin dpi); SMask/Mask/Decode/CMYK/1 bit/grafik resimlere dokunulmaz; kullanılmayan nesneler silinir, küçük resimler atılır; **sonuç büyükse özgün döner**. `render.js`'e ortam kancaları eklendi: `resimCoz`, `tuvaliBayta`, `tuvalOlustur`, `pdfjsOps`.
   - `karart.js`: **gerçek karartma** = karartma içeren sayfalar resme çevrilir, bölgeler resimde boyanır, sayfa YENİ belgeye yazılır (eski içerik akışı/yazı tipi/resim/açıklama hiç taşınmaz); kalan yazı görünmez katman (kesişen/eşleşen parçalar hariç); belge bilgileri boşaltılır; çıktı yeniden okunup doğrulanır (kutu içi yazı, kalan eşleşme). `karartmaAra` (metin / `HAZIR_DESENLER` regex; i/İ/ı duyarsız; kutu tahmini orantılı + 1,5 harf pay; OCR ile arama seçeneği).
   - Arayüz: `src/ui/bolge-secici.js` (fare/dokunma ile bölge çizme, OCR satırı önerileri), `src/ui/hizli-gecis.js` (araçlar arası bağlantı çipleri; yazı düzelt sayfasında "Yardımcı araçlar"), yeni sayfalar `ocr`, `taranmis-duzelt`, `pdf-word`, `sikistir`, `karart` (toplam 23 araç; gruplar "Dönüştür ve küçült", "Gizlilik ve şifre").
   - Dosyalar sayfalar arasında taşınmaz (gizlilik: hiçbir şey saklanmaz); hızlı geçişte kullanıcı dosyayı yeniden seçer.

11. **Ana sayfa ve Excel (Oturum 3, ek):** `index.html` yalnızca iki büyük düğme (`src/ana.js`; `BOLUMLER` → `pdf.html`, `excel.html`; bölüm sayfaları `src/ui/bolum-sayfasi.js`). Excel araçları: `src/core/excel.js` (`excelBirlestir`, `excelAnaliz`, `analizDisaAktar`; kullanıcının kendi "excel html" dosyasından taşındı — CDN YOK, `xlsx@0.18.5` yerel paket, Apache-2.0) + sayfalar `excel-birlestir`, `excel-analiz` (`aracKur` artık `dosya.tur:'excel'` destekler; `ekler` çıktısız da gösterilir). Özgününe eklenenler: dosya SIRASI korunur (eski hâlinde okuma bitiş sırasına göre karışabiliyordu), atlanacak satır sayısı ayarlanır (varsayılan 3/4), analizde başlık satırı otomatik bulunur, tanınmayan/bozuk dosya için uyarı, dosya imzası denetimi (SheetJS bozuk dosyayı metin sanıyordu), XSS'e karşı hücreler `textContent` ile basılır, arama kutusu, `.XLS` büyük/küçük harf. Özgün dosyadaki hatalar: SheetJS adresi yazım hatalıydı (`xlsx.full.min.min.js`, çalışmazdı), favicon `x1='0%2'`, hücre değerleri `innerHTML` ile basılıyordu.

12. **iLovePDF eşleştirmesi (Oturum 4)** — iLovePDF/tr'deki 33 araç tarandı; eksikler eklendi (toplam 39 araç). **Sayfa/dosya SINIRI YOK** (kullanıcı isteği): `arac.js` 150 MB reddi kaldırıldı (300 MB üstü yalnızca bilgi), `yazi-duzelt` sayfa penceresi 40→2000. Yeni çekirdekler (`src/core/`):
   - `pdf-word.js` ikiye bölündü: `pdfYapisi()` (satır/sütun/tablo/paragraf/başlık çözümü, bağlantılar `sayfa-icerik.js`'te yazı parçalarına `url` olarak işlenir) + `pdfdenWord()`; `pdf-markdown.js`, `pdf-excel.js` aynı yapıyı kullanır. Word çıktısında köprüler de var.
   - `pdf-powerpoint.js` (pptxgenjs; yazı motorunun `yaziAnalizEt`/`yazilariKaldir` çıktısıyla: yazısız arka plan resmi + gerçek metin kutuları), `onar.js` (qpdf + pdf-lib yedeği, sonuç çizilerek denetlenir; **sınır:** dosyanın büyük kısmı eksikse kurtarılamaz — qpdf sentetik kuyrukla da çalışmadı, bu yüzden denenmedi/eklenmedi), `pdf-karsilastir.js` (piksel + sözcük LCS), `pdfa.js` (**DENEYSEL**: sayfaları resimleyip XMP pdfaid + sRGB OutputIntent + /ID; kendi ICC profilimiz `srgbIccProfili()`; veraPDF ile SINANMADI → çıktıda her yerde uyarı), `resim-ayikla.js`, `tara.js` (histogram germe, Bradley uyarlanabilir eşik), `sekil.js` (+`SayfaCizici.sekil`: elips/çizgi/ok/serbest; `tur=sekil` işaretli, geri alınır), `form-olustur.js` (AcroForm; Türkçe için gömülü yazı tipi).
   - Belge→PDF için ortak **yerleştirme motoru** `belge-pdf.js` (model: paragraf/tablo/resim/çizgi/sayfaAyari; kelime sarma, iki yana yaslama, tablo, liste, köprü, yazı tipi yedeği Noto): `word-pdf.js` (docx: stiller, numaralandırma, tablo, resim, köprü), `html-pdf.js` (kendi hoşgörülü HTML okuyucusu), `excel-pdf.js`, ayrıca mutlak yerleşimli `powerpoint-pdf.js` (tema renkleri, yer tutucu kalıtımı, grup dönüşümü, otomatik sığdırma). `xml.js` = DOM'suz küçük XML okuyucu; zip için `fflate`.
   - Arayüz: `arac.js` genel dosya türleri (`word`, `sunum`, `html`, `excel`), `bozukOlabilir` (onar), `ctx.dosyaEkle` (kamera); `bolge-secici.js` çizim başlangıç/bitiş noktasını (`bas`,`son`) ve `yeniKutuVerisi` verir. Gruplar: Sayfaları düzenle · Belgeye ekle · İyileştir · PDF'e dönüştür · PDF'ten dönüştür · Güvenlik ve karşılaştırma · Excel.
   - **Bilerek EKLENMEYENLER:** iLovePDF'in yapay zekâ özet/çeviri araçları (dosyayı dış hizmete göndermek gerekir → "dosya cihazdan çıkmaz" ilkesine aykırı), başkalarından e-imza isteme, iş akışları, uygulamalar/abonelik. Kullanıcıya söylendi.

13. **Toplu işlem (Oturum 4, ek):** `aracKur` tek dosya alan her araca otomatik TOPLU KİP verir (`toplu = !coklu && tanim.toplu !== false`): çoklu seçim + "Klasör seç" (webkitdirectory; uygun olmayan dosyalar atlanır), sayı sınırı YOK. Çekirdek `src/core/toplu.js` (`topluIsle`: sıralı işleme, hatalı dosyayı atla, iptal, aynı ad → "(2)", çok çıktı → klasör, ~200 MB'lık ZIP parçaları). `calistir` toplu kipte her dosya için ayrı çağrılır (`{toplu:true}` bayrağı verilir). `toplu:false` olanlar (dosyaya/sayfaya özel arayüz): yazi-duzelt, taranmis-duzelt, isaretle, form-olustur, form-doldur, sayfa-sirala. Karartma toplu kipte: elle çizilen kutular her dosyada aynı sayfa/konuma uygulanır, metin araması her dosyada yeniden yapılır; **hiçbir şey karartılamayan dosya "karartılmış" adıyla VERİLMEZ** (hata sayılır). OCR motoru toplu kipte bir kez açılır (`tanim.topluBitti` ile sonunda kapanır). Word/PowerPoint/Excel→PDF artık `coklu` değil, toplu araç. Performans düzeltmeleri: `boyamaBekle` arka plan sekmesinde donmasın diye zaman aşımıyla yarıştırılır, `birakVer` (MessageChannel) eklendi; tarayıcıda tek ortak pdf.js işçisi (`render.js → ortam.isci`) → 500 dosya ~3 dk (işçi paylaşımı öncesi ~2 kat yavaştı). Test: `tests/toplu.test.js` (1200 sahte dosya, 25 gerçek PDF→Markdown, bozuk dosya, bölme klasörleri, OCR, karartma güvenliği) + tarayıcıda 500 PDF.

**Geliştirme ortamı notları (Windows)**
- Node.js 26 ve Git bu oturumda `winget` ile kuruldu (kullanıcı onayıyla). Claude'un PowerShell aracı bazen eski PATH ile açılır; komutların başına şunu koy:
  `$env:Path = [Environment]::GetEnvironmentVariable('Path','Machine') + ';' + [Environment]::GetEnvironmentVariable('Path','User')`
- PowerShell 5.1: `Get-Content -Raw | Set-Content` ile Türkçe dosyaları **düzenleme** (kodlama bozulur); dosya değişikliği için Edit/Write aracını kullan.
- Tarayıcıda deneme: `node node_modules/vite/bin/vite.js preview --port 4173` (önce `npm run build`), sonra tarayıcı panelinde `http://localhost:4173/...`.

## 5. Test düzeneği

- `npm test` → 130 test (14 dosya): her araç için çalıştır → çiz → karşılaştır. Örn. birleştirmede sayfalar kaynak sayfalarla piksel piksel aynı, filigran geri alınca özgün sayfaya dönüyor, döndürülmüş sayfalarda konumlar doğru, yanlış/boş şifre reddediliyor, silinen sayfa içeriği dosyada kalmıyor.
- `npm run ornek-test` → Masaüstündeki `ornekler` klasöründeki PDF'lerle (her dosyadan ilk 5 sayfa) tüm araçları dener, sayfaları çizip karşılaştırır, `ciktilar/ornek-test/rapor.md` üretir (git dışı). **Yazı düzeltme motoru için "bozmadan düzenledi mi?" denetimi bu betikteki `ayniMi` / `karsilastir` mantığıyla yapılacak** (`tools/karsilastir.mjs`: `sayfaPikselleri`, `karsilastir`, `metinCikar`, `doluluk`, `pngKaydet`).
- Son sonuç (Oturum 2): `npm test` → **146/146** geçti (15 dosya; yazı motoru 15 test). `npm run ornek-test` → 9 PDF, **144 kontrol geçti, 0 kaldı**, 9 atlandı ("belgede form alanı yok"). Yazı motoru her belgede 3 kontrol yapar: analiz (çıkan metin pdf.js ile aynı); değişiklik yok → (a) 0 piksel, (b) ≤ 0,5 pt; bir satır düzeltme → yeni yazı yerinde, eski satır yok, (a) 0. Ayrıca `ciktilar/ornek-test/<dosya>/yazi-bindirme-sN.png` (bindirme), `yazi-yeniden.pdf`, `yazi-duzeltilmis.pdf` üretir; sayfa raporu `rapor.md`'de.
- **Oturum 3 sonucu:** `npm test` → **191/191** geçti (20 dosya; yeni: `ocr`, `tarama-duzelt`, `pdf-word`, `sikistir`, `karart` testleri + 23 araçlık site yapısı). `npm run ornek-test` → 9 PDF, **180 kontrol geçti, 0 kaldı**, 9 atlandı (form yok). Yeni kontroller her belgede: sıkıştır (büyümez, yazı aynı, görüntü farkı ≤ 2,2/255; fotoğraflı belgelerde %21–33 küçüldü, yalnızca yazı/CCITT içerenlerde %0 — beklenen), PDF→Word (yazı kapsamı %91–100), karartma (aranan kelime çıktıda yok, eşleşmeyen sayfalar piksel piksel aynı), OCR (sayfa resme çevrilip okundu; sözcük kapsamı %92–100). Sentetik testlerde Türkçe OCR benzerliği %100, karartılan metin dosyanın hiçbir yerinde (ham bayt/akış/UTF-16/hex/belge bilgisi) yok.
- Oturum 1: 130/130 test, 117 örnek kontrol.
- Tarayıcıda (Chrome tabanlı panel) elle denendi ve çalıştı: birleştir (+şifreli dosya şifre akışı), böl, sil, çıkar, sırala, döndür, numara, üst/alt bilgi, filigran ekle, filigran geri al (bulunamadı yolu), resimden PDF, PDF'ten resim (+ZIP), şifre ekle/kaldır, kırp, imza/metin kutusu (sürükleme dahil), form doldur; mobil genişlikte (375px) yatay taşma yok. Konsolda hata yok.

## 6. Bilinen sınırlar / sonraki oturum için fikirler

- Tarayıcıda **gerçek (büyük) örnek PDF'lerle** el testi yapılmadı (35 MB'lık dosya dahil); Node tarafında hepsiyle test edildi. Telefonda gerçek cihaz testi yapılmadı (yalnızca 375px emülasyon).
- Safari/Firefox'ta denenmedi (yalnızca panelin Chromium tabanlı tarayıcısı).
- pdf-lib bakımsız bir kütüphane; sorun çıkarsa maintained fork (`@pdfme/pdf-lib`) düşünülebilir. Yer imi/form korumalı sayfa işlemleri için qpdf (`--pages`) alternatifi değerlendirilebilir.
- Kırp aracı kenarları sürüklemeyi desteklemiyor (kaydırıcılar var). İmza çiziminde basınç/ince çizgi yok.
- Resimden PDF: WebP/GIF/BMP tarayıcıda PNG'ye çevrilir (EXIF yönelimi uygulanır); JPEG EXIF yönelimi çekirdekte işlenir (aynalı yönelimler uyarı verir).
- Büyük dosyalarda ana iş parçacığında çalışıyor (arayüz kısa süre donabilir); Web Worker'a taşımak iyileştirme olabilir.
- OCR / taranmış düzeltme / PDF→Word / sıkıştırma / karartma Oturum 3'te eklendi; ayrıntılı kullanıcıya dönük sınırlar `README.md` ve `README.en.md` → "Bilinen sınırlar" bölümünde (kaynak o; değişiklik olursa ikisini de güncelle). Önemlileri: OCR yalnızca Türkçe model; taranmış düzeltmede zemin rengi tahmini ve örtme kipinde eski görüntü dosyada kalır; Word çıktısı birebir olmaz (sütun/tablo/tire tahminleri); sıkıştırma yalnızca fotoğraf türü resimlerde, B/W (CCITT/JBIG2) taramalarda kazanç yok; karartma kutuları metin aramasında tahminidir, tireyle bölünmüş sözcük bulunamaz, yer imi/ek/form taşınmaz.
- Tarayıcıda (gerçek tarayıcı panelinde) **elle denendi**: OCR, taranmış düzeltme (OCR satırı önerisi + uygula), PDF→Word, sıkıştırma, karartma (otomatik bul + elle çiz + uygula) ve yazı düzeltme bağlantıları; 375 px'te yatay taşma yok. Safari/Firefox/gerçek telefon HÂLÂ denenmedi. `vite build` başarılı (dist ≈ 35 MB; OCR dosyaları dist/tesseract altında).
- OCR işçisi (worker) isteklerini panelin ağ kaydı göstermiyor; dışarı istek gittiğine dair belirti yok (üç yol da — workerPath, corePath, langPath — yerel verildi), ama canlı sitede ağ sekmesinden bir kez doğrulanmalı.
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

### Aşama 3 — OCR, Word, sıkıştırma, karartma, GitHub hazırlığı (Oturum 3) — **TAMAM**
- [x] OCR (tesseract.js, Türkçe): taranmış PDF → aranabilir (görünmez katman); test: okuma doğruluğu, görünüş aynı, geri alınır, konum
- [x] Taranmış PDF'te yalnızca kullanıcının seçtiği bölgede düzeltme (örtme + yeni yazı); tüm sayfayı otomatik yeniden yazma YOK; sayfa sayfa OCR satırı seçerek kullanıcı onayıyla
- [x] PDF → Word (.docx): paragraf, başlık (yazı boyutundan), resim, madde, basit tablo, iki sütun, tire birleştirme; taranmışta OCR; ekranda "birebir olmaz" uyarısı
- [x] Sıkıştırma (kaliteyi koruyarak) + gerçek karartma (yazı hem görüntüden hem dosyadan silinir; dosyanın her yerinde aranarak test edildi)
- [x] Yazı düzeltme sayfasına yardımcı araç bağlantıları
- [x] GitHub hazırlığı: README (TR + EN), ekran görüntüsü yer tutucuları (`docs/ekran-goruntuleri/`), MIT, `THIRD_PARTY_LICENSES.md` güncel, Pages iş akışı, `docs/GITHUB_YAYIN.md`, "Bilinen sınırlar"

### Aşama 4 — Sonraki fikirler
- [ ] Mobil/erişilebilirlik cilası, Web Worker (OCR zaten kendi işçisinde; ağır sıkıştırma/Word ana iş parçacığında), büyük dosya performansı
- [ ] Kırp aracında sürükleyerek ayarlama
- [ ] OCR: sayfa eğimi/yönü düzeltme; ek diller (İngilizce) isteğe bağlı
- [ ] Karartmada kelime kutularını kesinleştirme (yazı motorundaki glif konumlarından) ve tireyle bölünmüş sözcük araması
- [ ] Sıkıştırmada JBIG2/CCITT siyah-beyaz taramalar için çözüm
- [ ] Gerçek cihaz + Safari/Firefox denemeleri

## 8. Oturum günlüğü

- **Oturum 3 (2026-11-23):** OCR (Türkçe), taranmış belgede bölge düzeltme, PDF→Word, sıkıştırma, gerçek karartma + arayüz sayfaları (5 yeni araç → 23) + yardımcı araç bağlantıları + GitHub hazırlığı (README TR/EN, lisanslar, yer tutucu görseller, yayın rehberi). Yazı motoruna dokunulmadı (yalnızca kullanıldı); `cizim.js`'e `gorunmezMetin`, `render.js`'e ortam kancaları eklendi. `@tesseract.js-data/tur` devDependency. Test sonuçları §5. Kullanıcıya GitHub yükleme adımları anlatıldı; **depo henüz GitHub'a yüklenmedi** (kullanıcı yükleyecek). Geçici betikler (`tools/_*.mjs`) silindi.
- **Oturum 4 (2026-11-24):** Kullanıcı istedi: PDF→Markdown (sayfa/dosya sınırsız) + iLovePDF'teki eksiklerin tamamı. 14 yeni araç eklendi (PDF→Markdown/Excel/PowerPoint/PDF-A, Word/PowerPoint/Excel/HTML→PDF, PDF'e tara, PDF onar, PDF karşılaştır, şekil/vurgu, form oluştur, resim ayıkla); sınırlar kaldırıldı/2000'e çıkarıldı. Yeni bağımlılıklar: `pptxgenjs` (MIT; jszip MIT/GPL ikili → MIT), `fflate` (MIT). Test: 261 birim testi (dosya başına yeni testler), tarayıcıda her yeni sayfa elle denendi; gerçek örnek PDF'lerle md/xlsx/pptx/karşılaştırma duman testi (içerik gösterilmedi).
- **Oturum 3 ek (2026-11-23):** Ana sayfa sadeleştirildi (iki büyük düğme), PDF araçları `pdf.html`'e taşındı, Excel bölümü (`excel.html`: birleştir + hasta başvuru analizi) eklendi; 25 araç. `tests/excel.test.js` (11 test).
- **Oturum 2 (2026-11-23):** Yazı düzeltme motoru (Aşama 2, adım 1–6) + `yazi-duzelt` sayfası (18. araç). `@pdf-lib/standard-fonts` doğrudan bağımlılık yapıldı (MIT; zaten pdf-lib ile geliyordu). `src/ui/arac.js` sonucu `ekler` (ek bölümler) alabiliyor. 146 test, 144 örnek kontrol geçti. `.claude/launch.json` (yerel önizleme ayarı, git dışı) yeniden yazıldı: `gelistirme` = `npm run dev`, port 5173.
- **Oturum 1 (2026-11-23):** Proje sıfırdan kuruldu. Node.js + Git kuruldu (winget, kullanıcı onayıyla). Çekirdek + 17 araç sayfası + ana sayfa + hakkında sayfası yazıldı. 130 otomatik test ve 117 gerçek-PDF kontrolü geçti. Tarayıcıda elle denendi. README, MIT, üçüncü taraf lisanslar, Pages iş akışı hazır. GitHub'a **henüz yüklenmedi** (kullanıcı yükleyecek). Commit'ler yerel depoda.

## 9. Açık konular / kararlar

- Depo GitHub'a yüklenip Pages ayarı yapılınca iş akışının ilk çalışması izlenmeli (Actions sekmesi). Orada `npm ci` / test (OCR testleri Linux'ta ilk kez çalışacak) / build adımlarında bir sorun çıkarsa düzeltilecek. İş akışına `configure-pages` eklendi (Pages kaynağı "GitHub Actions" seçili değilse bu adımda anlaşılır hata verir).
- Kullanıcı GitHub kullanıcı adını/depo adını seçince `README.md` (`KULLANICI_ADINIZ`), `README.en.md` (`YOUR_USERNAME`) ve `docs/GITHUB_YAYIN.md` yer tutucuları ve (isteğe bağlı) altbilgideki depo bağlantısı güncellenecek.
- README'deki ekran görüntüleri yer tutucudur (`docs/ekran-goruntuleri/*.png`); kullanıcı gerçekleriyle aynı adla değiştirecek. Kişisel belge içeren görüntü ASLA konmaz.
- `public/tesseract/` git'e girmez (derlemede üretilir); Türkçe dil verisi `npm ci` ile `@tesseract.js-data/tur` devDependency'sinden gelir — CI'da `npm ci` bunu da kurar.
- Proje klasörü: Masaüstündeki `pdf-araclari` klasörü.

## Oturum 5 — BelgeLab adı, geri düğmesi, kırpma hatası
- Site adı **BelgeLab** oldu (eski: PDF Araçları). Depo/paket adı `pdf-araclari` kasıtlı olarak değişmedi (GitHub adresi bozulmasın). Her araç sayfasında üstte "← Ana sayfaya dön" düğmesi var (`src/ui/kabuk.js`).
- **Yazı düzelt motoru düzeltmesi (kullanıcı izniyle):** bazı PDF'lerde her hücre kendi kırpma alanı (`W n`) içinde yazılıyor; düzenlenmiş satır birleşip ilk hücreye yazılınca kırpılıp görünmez oluyordu (örn. "Konu" satırı). `analiz.js` artık kırpma alanlarını kaydeder, `yeniden.js` yeni metin taşıyorsa o kırpmayı kaldırır. Test: `tests/yazi-kirpma.test.js`.
- Bilinen kozmetik: birleştirilen satırda etiket/iki nokta/değer arasındaki boşluk kaybolabilir ("Konu :Dr."); düzenleme alanına boşluk eklenerek giderilir.
- **Araç arama:** PDF/Excel bölüm sayfalarında arama kutusu (`src/arama.js`, `src/ui/bolum-sayfasi.js`). Yazdıkça tahmin eder (pdftomd → PDF → Markdown; İngilizce ad/kısaltma/eksik harf desteklenir), araç kendiliğinden açılmaz. Yeni araç eklerken `ALIASLAR` içine İngilizce/kısa yazılışlarını eklemeyi unutma. Test: `tests/arama.test.js`.
- **Menü araması:** "☰ Tüm araçlar" panelinin üstünde aynı arama kutusu (`src/ui/kabuk.js`); tüm araçlarda arar, açmaz.
- **Hız (PDF→Markdown/Word/Excel/PowerPoint ortak çözümleyici `pdfYapisi`):** (1) sayfa tek geçişte okunur (`sayfaTumu`, eskiden 2-3 kez); (2) ortak resimler (logo) bir kez PNG'lenir; (3) sayfalar eşzamanlı işlenir (`eszamanliCalistir`); (4) **OCR işçi havuzu** (`ocr.js`, `ocrOnerilenBoyut`: çekirdek/2, en çok 6; bellek ≤4 GB ise 2) — sayfalar aynı anda okunur. Ölçüm (Node, gerçek PDF): yazılı sayfalar 1.7–1.8×, taranmış sayfalar 3.2× hızlı; çıktı eski sürümle BİREBİR aynı (cmp ile doğrulandı). 19 PDF/2612 sayfa denemesinde 521 sayfa taranmış çıktı: asıl yavaşlık OCR'dı. `pdfOcr` aracı da havuzu kullanır.
- **Hafıza (IndexedDB, `src/core/hafiza.js`, sayfa `hafiza.html`):** her çıktı üretilince tarayıcıda saklanır; toplu işlemde HER DOSYA biter bitmez yazılır (sayfa ortada kapanırsa o ana kadarki işler kurtarılır, kayıt "Yarım kaldı" görünür). Yalnızca çıktılar saklanır, dosyalar cihazdan çıkmaz; kullanıcı elle siler (otomatik silme yok). Yer dolarsa uyarı verir. Test: `tests/hafiza.test.js` (bellek içi sahte depo; gerçek IndexedDB tarayıcıda denendi).
- **Oturum 6 — iptal ve hız (tüm dönüştürmeler):**
  - **İptal gerçekten durur** (`src/core/iptal.js`): "⛔ İptal et" artık tek dosyada da var; sayfa döngüleri (`eszamanliCalistir`) her sayfadan önce bakar, OCR işçileri anında kapatılır ve bekleyen okuma iptal sözüyle kesilir (tesseract `terminate` bekleyen işi döndürmüyordu). Toplu işte yarım dosya çıktıya eklenmez, biten dosyalar korunur. Tarayıcıda ölçüm: ~1 sn'de durur, sonra yeniden çalışır.
  - **Asıl yavaşlık resim→PNG idi** (tuval `toBlob` resim başına 0,5–1 sn, ana iş parçacığını tutuyor): `src/core/png.js` hızlı PNG yazıcı (ham piksel → zlib ayrı işçide, kayıpsız, piksel farkı 0; dosya biraz büyük olabilir). Tarayıcı `tuvaliBayta('png')` da bunu kullanır (jpeg değişmedi).
  - **Birden çok PDF okuyucu** (`paralelSayfalar` + `okuyucuSayisi` in `render.js`): her kulvar kendi pdf.js işçisi/belgesiyle çalışır; sayfalar sırayla birleşir. Kullanan: `pdfYapisi` (Word/Markdown/Excel), PDF→resim, PDF→PowerPoint (görseller), PDF/A, resim ayıklama, OCR aracı. OCR işçisi en çok 8 (çekirdek×0.6, bellek ≤4 GB ise 2); OCR çözünürlüğü 250→**200 dpi** (gerçek taramalarda okunan kelime sayısı aynı, ~%35 hızlı; 150 dpi kelime kaybettirdi).
  - Ölçüm (tarayıcı, 16 çekirdek): 229 sayfalık yazılı kitap 13 sn → 3,7 sn; 448 sayfa/24 MB kitap 8,1 sn; 201 sayfa (61 taranmış, 232 resim) 49 sn → 21–24 sn; 60 sayfa PDF→PNG 5,3 sn. PDF→PowerPoint hâlâ yavaş sayılır (40 slayt ≈ 14 sn; yazı motoru analizi + yazısız kopya üretimi seri). Testler: `tests/hiz-iptal.test.js`.
- **Oturum 7 — PDF→PowerPoint hızı (yazı motoruna dokunuldu, kullanıcı izniyle):** `yazi/motor.js` → yeni `yaziCozVeKaldir` (belge bir kez yüklenir, çözümleme bir kez yapılır, yazısız kopyaya YALNIZCA seçili sayfalar konur: 24 MB → 3,5 MB). `analiz.js` → `belgeAnaliz(..., { uyumHesapla:false })` satırların "yeniden yazılabilir mi" denetimini atlar (düzenleme ekranı true bırakır). Çıktı eskisiyle doğrulandı: 12 slaytın XML'i birebir aynı, arka plan görselleri piksel piksel aynı. Node'da 8,3 sn → 4 sn.
- **Gizli darboğaz: requestAnimationFrame.** pdf.js sayfa çizerken her parçada rAF bekler; arka plan sekmesinde/gizli panelde saniyede ~1 kez çalışır → sayfa başına ~1 sn boş bekleme ve sekme değişince donma. `ui/ortam.js` rAF'i MessageChannel'a çevirir (`window.__gercekRaf` ekran boyama beklemek için saklanır, `boyamaBekle` onu kullanır). Tarayıcıda PDF→PowerPoint (40 slayt, 448 sayfalık kitap) 14,4 sn → 5,3 sn.

# Üçüncü taraf bileşenler ve lisansları

Bu projenin kendi kodu **MIT** lisanslıdır (bkz. `LICENSE`). Aşağıdaki bileşenler kendi lisanslarıyla gelir; hepsi MIT ile uyumludur
(AGPL/GPL gibi bulaşıcı lisanslı bileşen **kullanılmaz**).

## Çalışma zamanında siteye giren bileşenler

| Bileşen | Sürüm | Lisans | Ne için |
|---|---|---|---|
| [pdf.js](https://github.com/mozilla/pdf.js) (`pdfjs-dist`) | 6.x | Apache-2.0 | PDF sayfalarını ekrana çizme (önizleme, resme çevirme) |
| [pdf-lib](https://github.com/Hopding/pdf-lib) | 1.17.x | MIT | PDF oluşturma ve düzenleme |
| [@pdf-lib/fontkit](https://github.com/Hopding/fontkit) | 1.1.x | MIT | Yazı tiplerini PDF'e gömme |
| [@pdf-lib/standard-fonts](https://github.com/Hopding/standard-fonts) | 1.0.x | MIT | Standart 14 PDF yazı tipinin genişlik tabloları (yazı düzeltme motoru) |
| [qpdf](https://github.com/qpdf/qpdf) 12.2 (WebAssembly; `@neslinesli93/qpdf-wasm` ile) | 12.2.0 / 0.3.x | Apache-2.0 (qpdf), ISC (WASM paketleyici) | Şifre ekleme / şifre kaldırma |
| [tesseract.js](https://github.com/naptha/tesseract.js) | 7.x | Apache-2.0 | OCR: taranmış sayfadaki yazıyı okuma (Türkçe) |
| [tesseract.js-core](https://github.com/naptha/tesseract.js-core) (Tesseract OCR motorunun WebAssembly derlemesi) | 7.x | Apache-2.0 | OCR motoru (çevrimdışı çalışır) |
| Türkçe OCR dil verisi: Tesseract `tessdata_best` / `tur` (npm: [@tesseract.js-data/tur](https://github.com/naptha/tessdata), `4.0.0_best_int`) | 1.0.0 | Apache-2.0 (veri; paketleyici MIT) | OCR Türkçe model dosyası (~2 MB, siteyle birlikte sunulur; internetten indirilmez) |
| [xlsx (SheetJS)](https://github.com/SheetJS/sheetjs) | 0.18.5 | Apache-2.0 | Excel okuma/yazma (Excel birleştir, hasta başvuru analizi) |
| [docx](https://github.com/dolanmiu/docx) | 9.x | MIT | PDF → Word (.docx) çıktısı |

Yukarıdaki bileşenlerin kendi bağımlılıkları da siteye girer; hepsi **MIT, ISC, BSD, 0BSD, Zlib veya Apache-2.0** lisanslıdır (ör. pako (MIT AND Zlib), idb-keyval ve wasm-feature-detect (Apache-2.0), bmp-js, is-url, zlibjs, regenerator-runtime (MIT)). Üretim bağımlılıkları arasında GPL/AGPL/LGPL **yoktur** (son kontrol: 2026-11-23, `npm ls --omit=dev --all`).

OCR dosyaları (`worker.min.js`, çekirdek, dil verisi) derleme sırasında `public/tesseract/` altına kopyalanır; lisans metinleri aynı klasörde (`LICENSE-*.txt`) bulunur. Tesseract dil verisinin kaynağı: https://github.com/tesseract-ocr/tessdata_best (Apache-2.0).

pdf.js'in yazı tipi/karakter haritası/WASM yardımcı dosyaları (`standard_fonts`, `cmaps`, `wasm`, `iccs`) derleme sırasında
`public/pdfjs/` altına kopyalanır; lisans metinleri (`LICENSE-pdfjs.txt` ve `wasm/LICENSE_*`) yanlarındadır.

## Yazı tipleri (`public/fonts/`)

Hepsi **SIL Open Font License 1.1** altındadır; her ailenin klasöründe lisans metni (`OFL-LICENSE.txt`) bulunur.

| Aile | Kaynak | Ölçü uyumu |
|---|---|---|
| Liberation Sans / Serif / Mono 2.1.5 | https://github.com/liberationfonts/liberation-fonts | Arial / Times New Roman / Courier New |
| Carlito | https://github.com/googlefonts/carlito (Google Fonts deposu) | Calibri |
| Caladea | https://github.com/huertatipografica/Caladea (Google Fonts deposu) | Cambria |
| Noto Sans / Noto Serif | https://github.com/notofonts/notofonts.github.io | — (geniş karakter desteği) |

Yazı tipleri yalnızca PDF'e gömülürken (alt küme olarak) kullanılır; yazı tiplerinin kendisi değiştirilmemiştir.

## Yalnızca geliştirme ve test sırasında kullanılanlar

Vite (MIT), Vitest (MIT), `@napi-rs/canvas` (MIT), pixelmatch (ISC), pngjs (MIT), JSZip (MIT ya da GPL-3.0+ ikili lisans; **MIT** seçeneği kullanılır, yalnızca testlerde).

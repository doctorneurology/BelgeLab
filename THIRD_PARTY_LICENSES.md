# Üçüncü taraf bileşenler ve lisansları

Bu projenin kendi kodu **MIT** lisanslıdır (bkz. `LICENSE`). Aşağıdaki bileşenler kendi lisanslarıyla gelir; hepsi MIT ile uyumludur
(AGPL/GPL gibi bulaşıcı lisanslı bileşen **kullanılmaz**).

## Çalışma zamanında siteye giren bileşenler

| Bileşen | Sürüm | Lisans | Ne için |
|---|---|---|---|
| [pdf.js](https://github.com/mozilla/pdf.js) (`pdfjs-dist`) | 6.x | Apache-2.0 | PDF sayfalarını ekrana çizme (önizleme, resme çevirme) |
| [pdf-lib](https://github.com/Hopding/pdf-lib) | 1.17.x | MIT | PDF oluşturma ve düzenleme |
| [@pdf-lib/fontkit](https://github.com/Hopding/fontkit) | 1.1.x | MIT | Yazı tiplerini PDF'e gömme |
| [qpdf](https://github.com/qpdf/qpdf) 12.2 (WebAssembly; `@neslinesli93/qpdf-wasm` ile) | 12.2.0 / 0.3.x | Apache-2.0 (qpdf), ISC (WASM paketleyici) | Şifre ekleme / şifre kaldırma |
| [tesseract.js](https://github.com/naptha/tesseract.js) | 7.x | Apache-2.0 | OCR (sonraki aşamalarda kullanılacak; henüz arayüzde yok) |
| [docx](https://github.com/dolanmiu/docx) | 9.x | MIT | Word çıktısı (sonraki aşamalarda kullanılacak; henüz arayüzde yok) |

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

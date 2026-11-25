# GenOffice kaynak kodu (vendor) — kaynak ve değişiklik kaydı

- **Kaynak:** https://github.com/genspark-ai/genoffice — commit `a6ff5ffd95cd8502ef3d9ddc2523b65e06253fe4` (2026-11-25)
- **Lisans:** Apache License 2.0 (`LICENSE`, `NOTICE` bu klasörde). Telif: Mainfunc, Inc. Dosyalardaki telif/lisans başlıkları korunmuştur.
- **Neden:** PDF → Word "Düzeni koru" kipi (`src/core/pdf-word-duzen.js`) için `packages/pdf2docx` ve ona gereken paketler.
- **Alınan parçalar:** `pdf2docx`, `docx-engine`, `pptx-engine`, `font-metrics`, `zip-gate`, `agent-core` paketlerinin YALNIZCA `pdf2docx` tarafından gerçekten kullanılan 192 dosyası (derleyici bağımlılık çözümlemesiyle seçildi; testler ve uygulama kabuğu alınmadı).
- **DEĞİŞİKLİK YOK:** Dosyaların içeriğine dokunulmadı. Uyarlama yalnızca sitenin derleme ayarındadır (`vite.config.js`):
  `@genoffice/<paket>` içe aktarmaları bu klasöre yönlendirilir; `node:zlib/fs/os/path/crypto/stream/promises` içe aktarmaları
  `vendor/shim/` altındaki küçük tarayıcı katmanlarına yönlendirilir (yalnızca bu klasördeki dosyalar için).
- **PDFium (WASM):** `@embedpdf/pdfium` paketi (MIT; PDFium BSD-3-Clause). Yalnızca "Düzeni koru" kipi kullanılınca indirilir.
- **Güncelleme:** kaynağı yeniden alıp aynı dosya listesini kopyalayın; `PROVENANCE.md`'deki commit'i güncelleyin; `npm test`'i çalıştırın.

// Kullanıcıya gösterilebilecek (Türkçe, anlaşılır) hata türleri.

export class PdfHatasi extends Error {
  constructor(mesaj, kod = 'HATA') {
    super(mesaj);
    this.name = 'PdfHatasi';
    this.kod = kod;
  }
}

/** PDF şifreli; açmak için şifre gerekir. */
export class SifreliPdfHatasi extends PdfHatasi {
  constructor(mesaj = 'Bu PDF şifreyle korunuyor. Şifreyi biliyorsanız girin.') {
    super(mesaj, 'SIFRELI');
    this.name = 'SifreliPdfHatasi';
  }
}

/** Girilen şifre yanlış. */
export class YanlisSifreHatasi extends PdfHatasi {
  constructor(mesaj = 'Girilen şifre doğru değil.') {
    super(mesaj, 'YANLIS_SIFRE');
    this.name = 'YanlisSifreHatasi';
  }
}

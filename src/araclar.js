// Sitedeki tüm araçların tek listesi. Ana sayfa, menü ve sayfa üretici bunu kullanır.

// Ana sayfadaki iki büyük bölüm
export const BOLUMLER = [
  { id: 'pdf', ad: 'PDF düzenleme', ikon: '📄', sayfa: 'pdf.html', kisa: 'PDF araçları' },
  { id: 'excel', ad: 'Excel düzenleme', ikon: '📊', sayfa: 'excel.html', kisa: 'Excel araçları' },
];

export const GRUPLAR = [
  { id: 'duzenle', ad: 'Sayfaları düzenle', aciklama: 'Birleştir, böl, sil, sırala, döndür, kırp' },
  { id: 'ekle', ad: 'Belgeye ekle', aciklama: 'Numara, bilgi, filigran, imza, form' },
  { id: 'donustur', ad: 'Dönüştür ve küçült', aciklama: 'OCR, Word, resim, sıkıştırma' },
  { id: 'guvenlik', ad: 'Gizlilik ve şifre', aciklama: 'Gerçek karartma, şifre koy ya da (şifreyi biliyorsanız) kaldır' },
  { id: 'excel', ad: 'Excel', aciklama: 'Excel dosyalarını birleştir ve hasta başvuru analizi yap', bolum: 'excel' },
];

export const ARACLAR = [
  { slug: 'birlestir', grup: 'duzenle', ikon: '🧩', ad: 'PDF birleştir', kisa: 'Birkaç PDF dosyasını tek dosyada topla.' },
  { slug: 'bol', grup: 'duzenle', ikon: '✂️', ad: 'PDF böl', kisa: 'Bir PDF’i aralıklara, ya da her sayfayı ayrı dosyaya böl.' },
  { slug: 'sayfa-sil', grup: 'duzenle', ikon: '🗑️', ad: 'Sayfa sil', kisa: 'İstemediğin sayfaları belgeden çıkar.' },
  { slug: 'sayfa-sirala', grup: 'duzenle', ikon: '🔀', ad: 'Sayfa sırala', kisa: 'Sayfaların sırasını değiştir.' },
  { slug: 'sayfa-dondur', grup: 'duzenle', ikon: '🔄', ad: 'Sayfa döndür', kisa: 'Yan ya da ters duran sayfaları düzelt.' },
  { slug: 'sayfa-cikar', grup: 'duzenle', ikon: '📤', ad: 'Sayfa çıkar', kisa: 'Seçtiğin sayfalardan yeni bir PDF yap.' },
  { slug: 'yazi-duzelt', grup: 'duzenle', ikon: '🔤', ad: 'Yazı düzelt', kisa: 'PDF içindeki yazıyı düzelt; sayfa düzeni, logo ve çizgiler olduğu gibi kalır.' },
  { slug: 'taranmis-duzelt', grup: 'duzenle', ikon: '🖋️', ad: 'Taranmış belgede yazı düzelt', kisa: 'Taranmış (resim) PDF’te yalnızca seçtiğin bölgeyi örtüp yeni yazıyı yaz.' },
  { slug: 'kirp', grup: 'duzenle', ikon: '📐', ad: 'Kırp', kisa: 'Sayfa kenarlarındaki boşluğu ya da fazlalığı kes.' },
  { slug: 'sayfa-numarasi', grup: 'ekle', ikon: '🔢', ad: 'Sayfa numarası ekle', kisa: 'Sayfalara numara yaz (1, 2, 3 ya da I, II, III).' },
  { slug: 'ust-alt-bilgi', grup: 'ekle', ikon: '📑', ad: 'Üst / alt bilgi ekle', kisa: 'Sayfa başına ya da sonuna yazı, tarih, dosya adı ekle.' },
  { slug: 'filigran-ekle', grup: 'ekle', ikon: '💧', ad: 'Filigran ekle', kisa: 'Yazı ya da resim filigranı koy.' },
  { slug: 'filigran-geri-al', grup: 'ekle', ikon: '🧽', ad: 'Filigranı geri al', kisa: 'Yalnızca bu sitenin eklediği filigranı kaldır.' },
  { slug: 'imza-metin', grup: 'ekle', ikon: '✍️', ad: 'İmza / metin kutusu ekle', kisa: 'Sayfaya görünür imza, resim ya da yazı kutusu yerleştir.' },
  { slug: 'form-doldur', grup: 'ekle', ikon: '📝', ad: 'Form doldur', kisa: 'PDF içindeki form alanlarını doldur.' },
  { slug: 'resimden-pdf', grup: 'donustur', ikon: '🖼️', ad: 'Resimden PDF', kisa: 'Fotoğraf ve resimleri tek bir PDF yap.' },
  { slug: 'pdften-resim', grup: 'donustur', ikon: '📷', ad: 'PDF’ten resim', kisa: 'PDF sayfalarını PNG ya da JPEG resme çevir.' },
  { slug: 'ocr', grup: 'donustur', ikon: '🔍', ad: 'OCR: taranmış PDF’i aranabilir yap', kisa: 'Taranmış belgedeki yazıyı (Türkçe) oku; görünüşü değişmeden aranabilir ve kopyalanabilir olsun.' },
  { slug: 'pdf-word', grup: 'donustur', ikon: '📄', ad: 'PDF → Word', kisa: 'PDF’i düzenlenebilir Word (.docx) dosyasına çevir. Taranmış belgelerde önce OCR yapılır.' },
  { slug: 'sikistir', grup: 'donustur', ikon: '🗜️', ad: 'PDF sıkıştır', kisa: 'Yazı kalitesini bozmadan dosya boyutunu küçült.' },
  { slug: 'karart', grup: 'guvenlik', ikon: '⬛', ad: 'Karart (gerçek silme)', kisa: 'Gizli bilgiyi hem görüntüden hem dosyadan kalıcı olarak sil.' },
  { slug: 'sifre-ekle', grup: 'guvenlik', ikon: '🔒', ad: 'Şifre ekle', kisa: 'PDF’i açmak için şifre koy.' },
  { slug: 'sifre-kaldir', grup: 'guvenlik', ikon: '🔓', ad: 'Şifre kaldır', kisa: 'Şifresini BİLDİĞİN PDF’ten şifreyi kaldır.' },
  { slug: 'excel-birlestir', grup: 'excel', ikon: '🧮', ad: 'Excel birleştir', kisa: 'Birkaç Excel dosyasını tek dosyada topla (üst bilgi satırları atılır).' },
  { slug: 'excel-analiz', grup: 'excel', ikon: '📈', ad: 'Hasta başvuru analizi', kisa: 'TC, ad soyad ve başvuru no sütunlarını otomatik bul; kişileri say, dosyalar arası çapraz varlığı göster.' },
];

export const grupBolumu = (g) => g.bolum ?? 'pdf';

export const SITE_ADI = 'PDF Araçları';
export const SLOGAN = 'Dosyalarınız cihazınızdan çıkmaz. Her şey tarayıcınızda çalışır.';

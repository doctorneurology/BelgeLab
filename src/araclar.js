// Sitedeki tüm araçların tek listesi. Ana sayfa, menü ve sayfa üretici bunu kullanır.

// Ana sayfadaki iki büyük bölüm
export const BOLUMLER = [
  { id: 'pdf', ad: 'PDF düzenleme', ikon: '📄', sayfa: 'pdf.html', kisa: 'PDF araçları' },
  { id: 'excel', ad: 'Excel düzenleme', ikon: '📊', sayfa: 'excel.html', kisa: 'Excel araçları' },
];

export const GRUPLAR = [
  { id: 'duzenle', ad: 'Sayfaları düzenle', aciklama: 'Birleştir, böl, sil, sırala, döndür, kırp' },
  { id: 'ekle', ad: 'Belgeye ekle', aciklama: 'Numara, bilgi, filigran, imza, form' },
  { id: 'iyilestir', ad: 'İyileştir', aciklama: 'OCR, sıkıştır, onar' },
  { id: 'pdfe', ad: 'PDF’e dönüştür', aciklama: 'Word, PowerPoint, Excel, HTML, resim, tarama' },
  { id: 'pdften', ad: 'PDF’ten dönüştür', aciklama: 'Word, PowerPoint, Excel, Markdown, resim, PDF/A' },
  { id: 'guvenlik', ad: 'Güvenlik ve karşılaştırma', aciklama: 'Gerçek karartma, şifre, PDF karşılaştırma' },
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
  { slug: 'resimden-pdf', grup: 'pdfe', ikon: '🖼️', ad: 'Resimden PDF', kisa: 'Fotoğraf ve resimleri tek bir PDF yap.' },
  { slug: 'pdften-resim', grup: 'pdften', ikon: '📷', ad: 'PDF’ten resim', kisa: 'PDF sayfalarını PNG ya da JPEG resme çevir.' },
  { slug: 'ocr', grup: 'iyilestir', ikon: '🔍', ad: 'OCR: taranmış PDF’i aranabilir yap', kisa: 'Taranmış belgedeki yazıyı (Türkçe) oku; görünüşü değişmeden aranabilir ve kopyalanabilir olsun.' },
  { slug: 'pdf-word', grup: 'pdften', ikon: '📄', ad: 'PDF → Word', kisa: 'PDF’i düzenlenebilir Word (.docx) dosyasına çevir. Taranmış belgelerde önce OCR yapılır.' },
  { slug: 'sikistir', grup: 'iyilestir', ikon: '🗜️', ad: 'PDF sıkıştır', kisa: 'Yazı kalitesini bozmadan dosya boyutunu küçült.' },
  { slug: 'karart', grup: 'guvenlik', ikon: '⬛', ad: 'Karart (gerçek silme)', kisa: 'Gizli bilgiyi hem görüntüden hem dosyadan kalıcı olarak sil.' },
  { slug: 'sifre-ekle', grup: 'guvenlik', ikon: '🔒', ad: 'Şifre ekle', kisa: 'PDF’i açmak için şifre koy.' },
  { slug: 'sifre-kaldir', grup: 'guvenlik', ikon: '🔓', ad: 'Şifre kaldır', kisa: 'Şifresini BİLDİĞİN PDF’ten şifreyi kaldır.' },
  { slug: 'onar', grup: 'iyilestir', ikon: '🛠️', ad: 'PDF onar', kisa: 'Bozuk, açılmayan ya da yarım kalmış PDF’i kurtarmayı dene.' },
  { slug: 'word-pdf', grup: 'pdfe', ikon: '📝', ad: 'Word → PDF', kisa: 'Word (.docx) belgesini PDF’e çevir.' },
  { slug: 'powerpoint-pdf', grup: 'pdfe', ikon: '📽️', ad: 'PowerPoint → PDF', kisa: 'PowerPoint (.pptx) sunumunu PDF’e çevir (her slayt bir sayfa).' },
  { slug: 'excel-pdf', grup: 'pdfe', ikon: '📊', ad: 'Excel → PDF', kisa: 'Excel tablolarını PDF’e çevir; geniş tablolar yatay yerleşir.' },
  { slug: 'html-pdf', grup: 'pdfe', ikon: '🌐', ad: 'HTML → PDF', kisa: 'HTML dosyasını ya da yapıştırdığın HTML’i PDF’e çevir.' },
  { slug: 'tara', grup: 'pdfe', ikon: '📷', ad: 'PDF’e tara', kisa: 'Kamerayla ya da galeriden çektiğin belge fotoğraflarını temiz bir PDF’e çevir.' },
  { slug: 'pdf-powerpoint', grup: 'pdften', ikon: '📽️', ad: 'PDF → PowerPoint', kisa: 'Her PDF sayfasını bir slayt yap (yazılar düzenlenebilir metin kutusu olabilir).' },
  { slug: 'pdf-excel', grup: 'pdften', ikon: '📊', ad: 'PDF → Excel', kisa: 'PDF’teki tabloları Excel’e aktar.' },
  { slug: 'pdf-markdown', grup: 'pdften', ikon: '⬇️', ad: 'PDF → Markdown', kisa: 'PDF’i Markdown’a çevir: başlık, liste, tablo, bağlantı, resim. Sayfa sınırı yok.' },
  { slug: 'pdf-pdfa', grup: 'pdften', ikon: '🗄️', ad: 'PDF → PDF/A (deneysel)', kisa: 'Arşivleme için PDF/A’ya yaklaşan bir sürüm üret ve engelleri denetle.' },
  { slug: 'resim-ayikla', grup: 'pdften', ikon: '🖼️', ad: 'PDF’teki resimleri ayıkla', kisa: 'PDF’e gömülü tüm resimleri PNG dosyası olarak çıkar.' },
  { slug: 'isaretle', grup: 'ekle', ikon: '🖍️', ad: 'Şekil ve vurgu ekle', kisa: 'Dikdörtgen, elips, çizgi, ok ve vurgulayıcı çiz.' },
  { slug: 'form-olustur', grup: 'ekle', ikon: '🧾', ad: 'Doldurulabilir form oluştur', kisa: 'Sayfaya metin kutusu, onay kutusu, seçenek ve açılır liste alanları ekle.' },
  { slug: 'karsilastir', grup: 'guvenlik', ikon: '🔍', ad: 'PDF karşılaştır', kisa: 'İki PDF sürümünü yan yana karşılaştır: değişen yazı ve görüntü.' },
  { slug: 'excel-birlestir', grup: 'excel', ikon: '🧮', ad: 'Excel birleştir', kisa: 'Birkaç Excel dosyasını tek dosyada topla (üst bilgi satırları atılır).' },
  { slug: 'excel-analiz', grup: 'excel', ikon: '📈', ad: 'Hasta başvuru analizi', kisa: 'TC, ad soyad ve başvuru no sütunlarını otomatik bul; kişileri say, dosyalar arası çapraz varlığı göster.' },
];

export const grupBolumu = (g) => g.bolum ?? 'pdf';

export const SITE_ADI = 'BelgeLab';
export const SLOGAN = 'Dosyalarınız cihazınızdan çıkmaz. Her şey tarayıcınızda çalışır.';

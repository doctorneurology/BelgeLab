// Sitedeki tüm araçların tek listesi. Ana sayfa, menü ve sayfa üretici bunu kullanır.

// Ana sayfadaki iki büyük bölüm
export const BOLUMLER = [
  { id: 'pdf', ad: 'PDF düzenleme', ikon: '📄', sayfa: 'pdf.html', kisa: 'PDF araçları' },
  { id: 'excel', ad: 'Excel düzenleme', ikon: '📊', sayfa: 'excel.html', kisa: 'Excel araçları' },
  { id: 'diger', ad: 'Resim ve metin', ikon: '🧰', sayfa: 'diger.html', kisa: 'Markdown/HTML editörü ve resim araçları' },
];

export const GRUPLAR = [
  { id: 'duzenle', ad: 'Sayfaları düzenle', aciklama: 'Birleştir, böl, sil, sırala, döndür, kırp' },
  { id: 'ekle', ad: 'Belgeye ekle', aciklama: 'Numara, bilgi, filigran, imza, form' },
  { id: 'iyilestir', ad: 'İyileştir', aciklama: 'OCR, sıkıştır, onar' },
  { id: 'pdfe', ad: 'PDF’e dönüştür', aciklama: 'Word, PowerPoint, Excel, HTML, resim, tarama' },
  { id: 'pdften', ad: 'PDF’ten dönüştür', aciklama: 'Word, PowerPoint, Excel, Markdown, resim, PDF/A' },
  { id: 'guvenlik', ad: 'Güvenlik ve karşılaştırma', aciklama: 'Gerçek karartma, şifre, PDF karşılaştırma' },
  { id: 'excel', ad: 'Excel', aciklama: 'Birleştir, analiz et, CSV’ye çevir, yinelenenleri sil', bolum: 'excel' },
  { id: 'metin', ad: 'Metin editörü', aciklama: 'Markdown / HTML yaz; PDF, Word, HTML olarak indir', bolum: 'diger' },
  { id: 'resim', ad: 'Resim araçları', aciklama: 'Boyutlandır, sıkıştır, JPG/PNG/WebP dönüştür', bolum: 'diger' },
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
  { slug: 'bos-sayfa', grup: 'duzenle', ikon: '🧹', ad: 'Boş sayfaları sil / böl', kisa: 'Boş sayfaları bul ve sil, ya da boş sayfalardan keserek böl.' },
  { slug: 'yer-imi', grup: 'duzenle', ikon: '🔖', ad: 'Yer imleri (içindekiler)', kisa: 'Yer imlerini gör, düzenle, başlıklardan otomatik üret ya da sil.' },
  { slug: 'sayfa-duzeni', grup: 'duzenle', ikon: '📚', ad: 'Sayfa düzeni (kâğıt başına çok sayfa, kitapçık)', kisa: 'Bir kâğıda 2-16 sayfa, kitapçık sıralaması ya da tek uzun sayfa.' },
  { slug: 'sayfa-boyutu', grup: 'duzenle', ikon: '📏', ad: 'Sayfa boyutu / ölçek', kisa: 'Sayfaları A4, A5, Letter, özel boyuta ya da yüzdeye göre ölçekle.' },
  { slug: 'aciklama-kaldir', grup: 'duzenle', ikon: '🧼', ad: 'Açıklamaları kaldır', kisa: 'Not, vurgu, çizim, bağlantı gibi açıklamaları sil.' },
  { slug: 'resim-kaldir', grup: 'duzenle', ikon: '🚫', ad: 'Resimleri kaldır', kisa: 'Sayfalardaki resimleri sil; yazı kalır, dosya küçülür.' },
  { slug: 'otomatik-adlandir', grup: 'duzenle', ikon: '🏷️', ad: 'Başlığa göre yeniden adlandır', kisa: 'Dosya adını belgenin başlığından üret (toplu işte çok pratik).' },
  { slug: 'formu-duzlestir', grup: 'ekle', ikon: '📋', ad: 'Formu düzleştir', kisa: 'Doldurulmuş form alanlarını sayfaya kalıcı yazı olarak işle.' },
  { slug: 'ust-uste', grup: 'ekle', ikon: '🗂️', ad: 'Üst üste bindir (antetli kâğıt)', kisa: 'Bir PDF’i başka bir PDF’in üstüne ya da arkasına koy.' },
  { slug: 'ustveri', grup: 'guvenlik', ikon: '🕵️', ad: 'Üstveri ve gizli bilgi', kisa: 'Yazar, program, JavaScript, gömülü dosya gibi gizli bilgileri gör ve temizle.' },
  { slug: 'pdf-metin', grup: 'pdften', ikon: '📃', ad: 'PDF → TXT / HTML / EPUB', kisa: 'PDF’i düz metne, web sayfasına ya da e-kitaba çevir. Sayfa sınırı yok.' },
  { slug: 'excel-csv', grup: 'excel', ikon: '🔁', ad: 'CSV ↔ Excel', kisa: 'Excel’i CSV’ye, CSV’yi Excel’e çevir (Türkçe karakter ve ayırıcı uyumlu).' },
  { slug: 'excel-tekrar-sil', grup: 'excel', ikon: '🧽', ad: 'Yinelenenleri sil', kisa: 'Tekrar eden satırları seçtiğin sütunlara göre sil.' },
  { slug: 'markdown-editor', grup: 'metin', ikon: '✍️', ad: 'Markdown / HTML editörü', kisa: 'Canlı önizlemeli editör; PDF, Word ve HTML olarak indir. Taslak otomatik saklanır.' },
  { slug: 'resim-araclari', grup: 'resim', ikon: '🖼️', ad: 'Resim boyutlandır / sıkıştır / dönüştür', kisa: 'JPG, PNG, WebP: boyut, kalite ve biçim değiştir; toplu çalışır.' },
];

export const grupBolumu = (g) => g.bolum ?? 'pdf';

export const SITE_ADI = 'BelgeLab';
export const SLOGAN = 'Dosyalarınız cihazınızdan çıkmaz. Her şey tarayıcınızda çalışır.';

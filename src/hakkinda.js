import { kabukKur } from './ui/kabuk.js';
import { h } from './ui/yardim.js';

const main = kabukKur({ baslik: 'İlkeler ve gizlilik' });
main.classList.add('hakkinda');
main.append(
  h('h1', {}, 'İlkeler ve gizlilik'),
  h('section', { class: 'adim' },
    h('h2', {}, 'Gizlilik'),
    h('ul', {},
      h('li', {}, 'Seçtiğiniz dosyalar hiçbir sunucuya yüklenmez; tüm işlemler tarayıcınızın içinde, cihazınızda yapılır.'),
      h('li', {}, 'Hesap, çerez, reklam ya da izleme yoktur. Yazdığınız şifreler yalnızca işlem sırasında bellekte tutulur.'),
      h('li', {}, 'Site internet bağlantısını yalnızca sayfaları ve araç dosyalarını (yazı tipleri, PDF bileşenleri) indirmek için kullanır; bir kez yüklendikten sonra çoğu araç bağlantısız da çalışır.'))),
  h('section', { class: 'adim' },
    h('h2', {}, 'Yapmadığımız şeyler (ve yapmayacağımız)'),
    h('ul', {},
      h('li', {}, h('b', {}, 'Şifre kırma yok. '), 'Bilinmeyen bir PDF şifresini kırma ya da deneme-yanılma özelliği yoktur. “Şifre kaldır” aracı yalnızca şifreyi siz girerseniz çalışır.'),
      h('li', {}, h('b', {}, 'Başkasının filigranını silme yok. '), 'Filigran eklenebilir; ancak yalnızca bu sitenin eklediği filigran geri alınabilir. Başkasının koyduğu filigran ya da telif işaretini silen genel bir araç yoktur.'),
      h('li', {}, h('b', {}, 'İz saklama yok. '), 'Düzenlenen belge “değiştirilmemiş orijinal” gibi gösterilmeye çalışılmaz: çıktıdaki üretici ve değişiklik tarihi bilgisi dürüstçe yazılır.'),
      h('li', {}, h('b', {}, 'Sessizce bozma yok. '), 'Bir işlem belgenin bir özelliğini (form alanı, yer imi, dijital imza vb.) etkileyebiliyorsa bu, sonuç ekranında uyarı olarak gösterilir.'))),
  h('section', { class: 'adim' },
    h('h2', {}, 'Dikkat edilmesi gerekenler'),
    h('ul', {},
      h('li', {}, '“Kırp” aracı kesilen bölgeyi dosyadan silmez, yalnızca gizler.'),
      h('li', {}, '“İmza ekle” aracı görünür bir imza koyar; bu bir dijital/elektronik imza değildir.'),
      h('li', {}, 'Şifreyi unutursanız belgeyi kimse açamaz. Şifre izinleri (yazdırma, kopyalama) bazı programlarca yok sayılabilir.'))),
  h('section', { class: 'adim' },
    h('h2', {}, 'Açık kaynak'),
    h('p', {}, 'Bu site MIT lisanslıdır. Kaynak kodu serbestçe incelenebilir, kullanılabilir ve geliştirilebilir. Kullanılan üçüncü taraf bileşenler (pdf.js, pdf-lib, qpdf, yazı tipleri) kendi açık lisanslarıyla gelir; ayrıntılar depodaki THIRD_PARTY_LICENSES.md dosyasındadır.')),
  h('p', {}, h('a', { href: 'index.html' }, '← Ana sayfaya dön')));

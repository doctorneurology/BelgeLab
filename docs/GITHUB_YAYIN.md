# GitHub'a yükleme ve yayınlama — çok basit anlatım

Bu rehber, kodlama bilmeyen biri içindir. Her adımı sırayla yapın.
**Önemli:** GitHub'a yüklediğiniz her şey internette **herkese açık** olur (depoyu "Public" yaparsanız). Bu projede kişisel belgeler zaten dışarıda tutuluyor (`ornekler/` ve `ciktilar/` klasörleri yüklenmez).

## 0. Hazırlık (bir kez)

1. [github.com](https://github.com) adresinde ücretsiz hesap açın (yoksa).
2. Bilgisayarda **Git** kurulu olmalı (bu projede zaten kurulu).
3. Kullanıcı adınızı bir yere not edin; aşağıda `KULLANICI_ADINIZ` yerine yazacaksınız.

## 1. GitHub'da boş depo oluşturun

1. GitHub'da sağ üstte **+** → **New repository**.
2. **Repository name:** `pdf-araclari`
3. **Public** seçin (GitHub Pages ücretsiz sürümde herkese açık depo ister).
4. **"Add a README", ".gitignore", "license" kutularını İŞARETLEMEYİN** (depo tamamen boş kalsın; bizde hepsi var).
5. **Create repository** düğmesine basın.

## 2. Bilgisayardaki projeyi gönderin

Masaüstündeki `pdf-araclari` klasöründe bir PowerShell açın (klasörde boş bir yere Shift + sağ tık → "PowerShell penceresini buradan aç") ve sırayla yapıştırın.
(`KULLANICI_ADINIZ` yerine GitHub kullanıcı adınızı yazın.)

```powershell
git remote add origin https://github.com/KULLANICI_ADINIZ/pdf-araclari.git
```

```powershell
git branch -M main
```

```powershell
git push -u origin main
```

İlk seferde GitHub giriş penceresi açılabilir: hesabınızla giriş yapın.

> Not: Bu projedeki commit'lerde sizin gerçek e-postanız yazılı değildir (özellikle böyle ayarlandı); GitHub'a yüklenince herkese açık olacak e-posta gizli kalır.

## 3. Yayını açın (GitHub Pages)

1. GitHub'da deponuzun sayfasında **Settings** (Ayarlar) sekmesine girin.
2. Soldaki menüden **Pages**'e tıklayın.
3. **Build and deployment** bölümünde **Source** kutusundan **GitHub Actions** seçin. (Başka bir şey yapmanız gerekmez.)

## 4. Yayının bitmesini bekleyin

1. Depo sayfasında **Actions** sekmesine girin. "Siteyi GitHub Pages'e yayınla" adlı bir iş çalışıyor olmalı (sarı daire = sürüyor).
2. Yeşil tik ✅ çıkınca bitti (yaklaşık 3–6 dakika). Kırmızı ✗ çıkarsa işe tıklayıp hangi adımda kırmızı olduğunu bana (Claude'a) yapıştırın.
3. Sitenin adresi: `https://KULLANICI_ADINIZ.github.io/pdf-araclari/`

## 5. Adresi README'ye yazın

`README.md` ve `README.en.md` dosyalarındaki `KULLANICI_ADINIZ` / `YOUR_USERNAME` yazılarını kendi kullanıcı adınızla değiştirmesi için bana söylemeniz yeterli.

## Sonradan değişiklik yaparsanız

Her değişiklikten sonra (ben ya da siz) şunlar çalışır; site kendiliğinden güncellenir:

```powershell
git add -A
git commit -m "Ne değiştiğini kısaca yazın"
git push
```

## Ekran görüntüleri

`docs/ekran-goruntuleri/` klasöründeki yer tutucu resimlerin üzerine kendi ekran görüntülerinizi (aynı adla) kaydedin, sonra yukarıdaki üç komutu çalıştırın.

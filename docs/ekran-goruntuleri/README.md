# Ekran görüntüleri için yer

Bu klasördeki `.png` dosyaları şimdilik **yer tutucudur** ("Ekran görüntüsü eklenecek" yazar).
README bu dosyaları adlarıyla gösterir; yani **aynı adla üzerine kaydederseniz** README'de otomatik görünür, başka bir şey değiştirmeniz gerekmez.

| Dosya adı | Hangi sayfa | Önerilen görünüm |
|---|---|---|
| `ana-sayfa.png` | `index.html` | Araç kartlarının göründüğü ana sayfa |
| `ocr.png` | `ocr.html` | Taranmış bir dosya seçilmiş, sonuç ve uyarılar görünüyor |
| `taranmis-duzelt.png` | `taranmis-duzelt.html` | Sayfa üstünde seçilmiş bir bölge + "Yeni yazı" kutusu |
| `pdf-word.png` | `pdf-word.html` | Sonuç ekranı ("Sonuç birebir aynı olmaz" uyarısıyla) |
| `sikistir.png` | `sikistir.html` | "… MB → … KB (%… küçüldü)" sonucu |
| `karart.png` | `karart.html` | Sayfada kırmızı işaretli bölgeler + sonuç |
| `yazi-duzelt.png` | `yazi-duzelt.html` | Satırların işaretli göründüğü düzenleme ekranı |

## Nasıl alınır?

1. Siteyi açın (`npm run dev` ile bilgisayarınızda ya da yayınlanmış adres).
2. **Kişisel olmayan** bir örnek PDF kullanın (ör. kendi yazdığınız boş bir deneme belgesi). Gerçek kişisel/özel belgelerin görüntüsünü **asla** depoya koymayın.
3. Pencereyi yaklaşık 1280×720 boyutunda tutup ekran görüntüsü alın (Windows: `Win + Shift + S`).
4. Dosyayı yukarıdaki tablodaki adla bu klasöre kaydedin (varolanın üzerine yazın).
5. GitHub'a gönderin (`git add docs` → `git commit` → `git push`).

Yer tutucuları yeniden üretmek isterseniz: `node tools/yer-tutucu-uret.mjs --zorla` (gerçek görüntülerinizin **üzerine yazar**, dikkat).

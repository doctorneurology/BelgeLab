// Markdown editörünün çekirdeği: Markdown → HTML / PDF / Word (docx). Hepsi cihazda; marked (MIT) ile ayrıştırılır.
import { marked } from 'marked';
import {
  Document, Packer, Paragraph, TextRun, HeadingLevel, ExternalHyperlink, Table, TableRow, TableCell, WidthType, BorderStyle, AlignmentType,
} from 'docx';
import { htmlPdf } from './html-pdf.js';
import { PdfHatasi } from './hatalar.js';

const kac = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const CSS = 'body{font-family:Georgia,"Times New Roman",serif;line-height:1.6;max-width:46em;margin:2em auto;padding:0 1em;color:#1b1f27}h1,h2,h3,h4,h5,h6{font-family:Arial,Helvetica,sans-serif;line-height:1.25}pre,code{font-family:Consolas,monospace;background:#f3f4f6}pre{padding:.8em;overflow:auto}code{padding:.1em .3em}blockquote{border-left:4px solid #c9ced6;margin:1em 0;padding:.2em 1em;color:#444}table{border-collapse:collapse;margin:1em 0}td,th{border:1px solid #bbb;padding:.3em .6em;vertical-align:top}th{background:#f0f2f5}img{max-width:100%}';

/** Markdown → HTML gövdesi. */
export function markdownHtml(md) {
  return marked.parse(String(md ?? ''), { gfm: true, breaks: false, async: false });
}

/** Markdown → bağımsız HTML belgesi (indirmek için). */
export function markdownHtmlBelgesi(md, baslik = '') {
  const govde = markdownHtml(md);
  const b = baslik || (/^#\s+(.+)$/m.exec(md)?.[1] ?? 'Belge');
  return `<!doctype html>\n<html lang="tr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>${kac(b)}</title><style>${CSS}</style></head><body>\n${govde}\n</body></html>\n`;
}

/** Markdown → PDF (sitenin kendi HTML→PDF motoruyla). */
export async function markdownPdf(md, { ilerleme } = {}) {
  if (!String(md ?? '').trim()) throw new PdfHatasi('Önce biraz metin yazın.');
  const r = await htmlPdf(markdownHtmlBelgesi(md), { ilerleme, baslik: /^#\s+(.+)$/m.exec(md)?.[1] ?? '' });
  return r;
}

// ---- Markdown → Word (docx) -----------------------------------------------------------------------------
const BASLIKLAR = [HeadingLevel.HEADING_1, HeadingLevel.HEADING_2, HeadingLevel.HEADING_3, HeadingLevel.HEADING_4, HeadingLevel.HEADING_5, HeadingLevel.HEADING_6];

function satirIci(tokenlar = [], stil = {}) {
  const sonuc = [];
  for (const t of tokenlar) {
    switch (t.type) {
      case 'strong': sonuc.push(...satirIci(t.tokens, { ...stil, bold: true })); break;
      case 'em': sonuc.push(...satirIci(t.tokens, { ...stil, italics: true })); break;
      case 'del': sonuc.push(...satirIci(t.tokens, { ...stil, strike: true })); break;
      case 'codespan': sonuc.push(new TextRun({ text: t.text, font: 'Consolas', ...stil })); break;
      case 'br': sonuc.push(new TextRun({ break: 1 })); break;
      case 'link': sonuc.push(new ExternalHyperlink({ link: t.href, children: satirIci(t.tokens, { ...stil, style: 'Hyperlink', color: '1155CC', underline: {} }) })); break;
      case 'image': sonuc.push(new TextRun({ text: `[${t.text || 'resim'}]`, italics: true, ...stil })); break;
      case 'escape': case 'text': case 'html':
        if (t.tokens?.length) sonuc.push(...satirIci(t.tokens, stil)); else sonuc.push(new TextRun({ text: String(t.text ?? t.raw ?? '').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'"), ...stil })); break;
      default: if (t.tokens) sonuc.push(...satirIci(t.tokens, stil)); else if (t.text) sonuc.push(new TextRun({ text: t.text, ...stil }));
    }
  }
  return sonuc;
}

function blokCevir(tokenlar, duzey = 0, numara = null) {
  const cikti = [];
  for (const t of tokenlar) {
    if (t.type === 'heading') cikti.push(new Paragraph({ heading: BASLIKLAR[Math.min(5, t.depth - 1)], children: satirIci(t.tokens), spacing: { before: 200, after: 120 } }));
    else if (t.type === 'paragraph') cikti.push(new Paragraph({ children: satirIci(t.tokens), spacing: { after: 120 }, indent: duzey ? { left: 360 * duzey } : undefined }));
    else if (t.type === 'text') cikti.push(new Paragraph({ children: satirIci(t.tokens ?? [t]), indent: duzey ? { left: 360 * duzey } : undefined }));
    else if (t.type === 'code') String(t.text).split('\n').forEach((s) => cikti.push(new Paragraph({ children: [new TextRun({ text: s || ' ', font: 'Consolas', size: 20 })], shading: { fill: 'F3F4F6' } })));
    else if (t.type === 'blockquote') cikti.push(...blokCevir(t.tokens, duzey + 1).map((p) => p));
    else if (t.type === 'hr') cikti.push(new Paragraph({ border: { bottom: { style: BorderStyle.SINGLE, size: 6, color: 'AAAAAA', space: 1 } }, children: [] }));
    else if (t.type === 'list') {
      const ref = t.ordered ? `num-${numara?.sayac ?? 0}` : null;
      t.items.forEach((it) => {
        const ic = it.tokens.filter((x) => x.type !== 'list');
        const alt = it.tokens.filter((x) => x.type === 'list');
        const metin = ic.flatMap((x) => (x.tokens ? x.tokens : [x]));
        cikti.push(new Paragraph({ children: satirIci(metin), ...(t.ordered ? { numbering: { reference: 'siralı', level: Math.min(duzey, 3) } } : { bullet: { level: Math.min(duzey, 3) } }) }));
        alt.forEach((a) => cikti.push(...blokCevir([a], duzey + 1)));
      });
      void ref;
    } else if (t.type === 'table') {
      const kenar = { style: BorderStyle.SINGLE, size: 4, color: 'BBBBBB' };
      const sinirlar = { top: kenar, bottom: kenar, left: kenar, right: kenar };
      const hucre = (h, baslik) => new TableCell({ borders: sinirlar, shading: baslik ? { fill: 'F0F2F5' } : undefined, children: [new Paragraph({ children: satirIci(h.tokens, baslik ? { bold: true } : {}) })] });
      cikti.push(new Table({ width: { size: 100, type: WidthType.PERCENTAGE }, rows: [new TableRow({ children: t.header.map((h) => hucre(h, true)) }), ...t.rows.map((r) => new TableRow({ children: r.map((h) => hucre(h, false)) }))] }));
      cikti.push(new Paragraph({ children: [] }));
    } else if (t.type === 'html') {
      const duz = String(t.text).replace(/<[^>]+>/g, '').trim();
      if (duz) cikti.push(new Paragraph({ children: [new TextRun({ text: duz })] }));
    }
  }
  return cikti;
}

/** Markdown → .docx baytları. */
export async function markdownDocx(md, { baslik = '' } = {}) {
  if (!String(md ?? '').trim()) throw new PdfHatasi('Önce biraz metin yazın.');
  const tokenlar = marked.lexer(String(md), { gfm: true });
  const govde = blokCevir(tokenlar);
  const doc = new Document({
    creator: 'BelgeLab', title: baslik || (/^#\s+(.+)$/m.exec(md)?.[1] ?? 'Belge'),
    numbering: { config: [{ reference: 'siralı', levels: Array.from({ length: 4 }, (_, i) => ({ level: i, format: 'decimal', text: `%${i + 1}.`, alignment: AlignmentType.START, style: { paragraph: { indent: { left: 720 + i * 360, hanging: 360 } } } })) }] },
    sections: [{ children: govde.length ? govde : [new Paragraph({ children: [] })] }],
  });
  return new Uint8Array(await Packer.toArrayBuffer(doc));
}

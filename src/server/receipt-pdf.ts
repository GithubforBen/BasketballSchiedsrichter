import 'server-only';
import { PDFDocument, rgb, StandardFonts, type PDFFont, type PDFImage, type PDFPage } from 'pdf-lib';
import { CLUB } from '@/config/club';
import type { ReceiptColumn, ReceiptView } from '@/domain/receipt';
import { RECEIPT_LOGO_BASE64, RECEIPT_LOGO_SIZE } from './receipt-logo';

/**
 * Die Quittung als PDF: eine A4-Seite je Spiel, Standardschrift Helvetica.
 * Helvetica kennt WinAnsi (ä, ö, ü, ß, €); alles darueber hinaus wird vor dem
 * Zeichnen auf ein aehnliches Zeichen abgebildet, sonst wirft pdf-lib.
 */

const PAGE = { width: 595.28, height: 841.89 } as const;
const MARGIN = 50;
const INK = rgb(0.1, 0.1, 0.1);
const LINE = rgb(0.55, 0.55, 0.55);

/** Zeichen ausserhalb von WinAnsi, die einen guten ASCII-Ersatz haben. */
const FALLBACK: Record<string, string> = {
  ł: 'l',
  Ł: 'L',
  đ: 'd',
  Đ: 'D',
  ø: 'o',
  Ø: 'O',
  ħ: 'h',
  ı: 'i',
  ð: 'd',
  Ð: 'D',
  þ: 'th',
  Þ: 'Th',
  '‑': '-',
  '−': '-',
};

/** Ersetzt Zeichen, die die Schrift nicht kennt; unbekannte werden zu `?`. */
export const toWinAnsi = (text: string, font: PDFFont): string => {
  const supported = new Set(font.getCharacterSet());
  let out = '';
  for (const ch of text.normalize('NFC')) {
    const code = ch.codePointAt(0) ?? 0;
    if (supported.has(code)) {
      out += ch;
      continue;
    }
    const mapped = FALLBACK[ch];
    if (mapped) {
      out += mapped;
      continue;
    }
    const base = ch.normalize('NFD').replace(/[̀-ͯ]/g, '');
    out += [...base].every((c) => supported.has(c.codePointAt(0) ?? 0)) && base ? base : '?';
  }
  return out;
};

const dateFormat = new Intl.DateTimeFormat('de-DE', {
  timeZone: CLUB.timeZone,
  weekday: 'long',
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
});

interface Ctx {
  page: PDFPage;
  font: PDFFont;
  bold: PDFFont;
}

const text = (
  { page, font, bold }: Ctx,
  value: string,
  x: number,
  y: number,
  opts: { size?: number; bold?: boolean; align?: 'left' | 'right'; maxWidth?: number } = {},
) => {
  const f = opts.bold ? bold : font;
  const fitted =
    opts.maxWidth == null
      ? { text: toWinAnsi(value, f), size: opts.size ?? 10 }
      : fitText(value, f, opts.maxWidth, opts.size ?? 10);
  const safe = fitted.text;
  const size = fitted.size;
  const width = f.widthOfTextAtSize(safe, size);
  page.drawText(safe, { x: opts.align === 'right' ? x - width : x, y, size, font: f, color: INK });
};

/**
 * Passt einen Text in eine Zellbreite: erst die Schrift bis `minSize` verkleinern,
 * dann mit Auslassungspunkten kuerzen. Gibt Text (WinAnsi) und Groesse zurueck.
 */
export const fitText = (
  value: string,
  font: PDFFont,
  maxWidth: number,
  size = 10,
  minSize = 7,
): { text: string; size: number } => {
  const safe = toWinAnsi(value, font);
  let s = size;
  while (s > minSize && font.widthOfTextAtSize(safe, s) > maxWidth) s -= 0.5;
  if (font.widthOfTextAtSize(safe, s) <= maxWidth) return { text: safe, size: s };
  const chars = [...safe];
  while (chars.length > 0 && font.widthOfTextAtSize(`${chars.join('')}...`, s) > maxWidth) chars.pop();
  return { text: `${chars.join('').trimEnd()}...`, size: s };
};

const hline = (page: PDFPage, y: number, x1 = MARGIN, x2 = PAGE.width - MARGIN) =>
  page.drawLine({ start: { x: x1, y }, end: { x: x2, y }, thickness: 0.6, color: LINE });

const euro = (v: string | null): string => (v == null ? '' : `${v} €`);

/** Zeilen der Tabelle: Beschriftung und Wert je Spalte. */
const rowsOf = (c: ReceiptColumn): string[] => [
  c.name ?? '',
  c.km == null ? '' : `${c.km} km`,
  euro(c.travel),
  euro(c.fee),
  euro(c.perDiem),
  c.other == null ? '' : `${c.otherLabel ? `${c.otherLabel}  ` : ''}${euro(c.other)}`,
  euro(c.total),
];

/** Breite einer Wertespalte: rechtsbuendig, links der Beschriftung und der Nachbarspalte fern. */
const COL_WIDTH = 190;

const LABELS = ['Schiedsrichter/in', 'Fahrstrecke', 'Fahrtkosten', 'Gebühren', 'Tagegeld', 'Sonstiges', 'Summe'];

const drawView = (doc: PDFDocument, view: ReceiptView, fonts: { font: PDFFont; bold: PDFFont }, logo: PDFImage) => {
  const page = doc.addPage([PAGE.width, PAGE.height]);
  const ctx: Ctx = { page, ...fonts };
  const right = PAGE.width - MARGIN;

  page.drawImage(logo, {
    x: MARGIN,
    y: PAGE.height - MARGIN - RECEIPT_LOGO_SIZE.height,
    width: RECEIPT_LOGO_SIZE.width,
    height: RECEIPT_LOGO_SIZE.height,
  });
  text(ctx, 'Quittung', right, PAGE.height - MARGIN - 18, { size: 22, bold: true, align: 'right' });
  text(ctx, 'über Schiedsrichtergebühren', right, PAGE.height - MARGIN - 38, {
    size: 12,
    align: 'right',
  });

  let y = PAGE.height - MARGIN - RECEIPT_LOGO_SIZE.height - 36;
  const g = view.game;
  const info: [string, string][] = [
    ['Liga', g.leagueLabel],
    ['Spiel', `${g.home} – ${g.away}`],
    ['Termin', dateFormat.format(g.kickoff)],
    ['Halle', g.venue],
  ];
  for (const [label, value] of info) {
    text(ctx, label, MARGIN, y, { size: 10, bold: true });
    text(ctx, value, MARGIN + 70, y, { size: 11 });
    y -= 20;
  }

  y -= 16;
  const colRight = [MARGIN + 300, right] as const;
  const rowH = 26;
  const rows = [rowsOf(view.columns[0]), rowsOf(view.columns[1])];
  hline(page, y + rowH - 8);
  LABELS.forEach((label, i) => {
    const isTotal = i === LABELS.length - 1;
    text(ctx, label, MARGIN, y, { size: 10, bold: isTotal || i === 0 });
    text(ctx, rows[0]?.[i] ?? '', colRight[0], y, {
      size: 10,
      bold: isTotal || i === 0,
      align: 'right',
      maxWidth: COL_WIDTH,
    });
    text(ctx, rows[1]?.[i] ?? '', colRight[1], y, {
      size: 10,
      bold: isTotal || i === 0,
      align: 'right',
      maxWidth: COL_WIDTH,
    });
    hline(page, y - 9);
    y -= rowH;
  });

  y -= 6;
  text(ctx, 'Gesamtsumme', MARGIN, y, { size: 12, bold: true });
  text(ctx, euro(view.overallTotal), right, y, { size: 12, bold: true, align: 'right' });
  hline(page, y - 9);

  // Ort, Datum und Unterschriften bleiben fuer die Handschrift frei.
  y -= 90;
  text(ctx, 'Ort, Datum', MARGIN, y - 12, { size: 8 });
  hline(page, y, MARGIN, MARGIN + 200);
  text(ctx, 'Unterschrift Empfänger/in', MARGIN + 250, y - 12, { size: 8 });
  hline(page, y, MARGIN + 250, right);
  y -= 70;
  text(ctx, 'Unterschrift Verein', MARGIN + 250, y - 12, { size: 8 });
  hline(page, y, MARGIN + 250, right);
};

/** Rendert je Ansicht eine Seite; die Reihenfolge der Ansichten bleibt erhalten. */
export const renderReceiptsPdf = async (views: readonly ReceiptView[]): Promise<Uint8Array> => {
  const doc = await PDFDocument.create();
  doc.setTitle('Quittung über Schiedsrichtergebühren');
  doc.setProducer(CLUB.appName);
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  const logo = await doc.embedPng(Buffer.from(RECEIPT_LOGO_BASE64, 'base64'));
  for (const view of views) drawView(doc, view, { font, bold }, logo);
  return doc.save();
};

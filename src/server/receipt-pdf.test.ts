import { PDFDocument, StandardFonts } from 'pdf-lib';
import { describe, expect, it } from 'vitest';
import { buildReceiptView, type ReceiptView } from '@/domain/receipt';
import { fitText, renderReceiptsPdf } from './receipt-pdf';

const view = (home = 'Heim', away = 'Gast'): ReceiptView =>
  buildReceiptView(
    {
      leagueLabel: 'U16',
      home,
      away,
      kickoff: new Date('2026-10-10T12:00:00Z'),
      venue: 'Sporthalle, Größe ß',
    },
    [
      {
        name: 'Jörg Müller',
        expenses: {
          travelMode: 'alone',
          km: 42,
          perDiemCents: 500,
          otherCents: 250,
          otherLabel: 'Parkgebühr',
        },
      },
      null,
    ],
    { soloCents: 30, sharedCents: 32 },
    2000,
  );

describe('renderReceiptsPdf', () => {
  it('beginnt mit dem PDF-Kopf', async () => {
    const bytes = await renderReceiptsPdf([view()]);

    expect(Buffer.from(bytes.slice(0, 5)).toString('latin1')).toBe('%PDF-');
  });

  it('legt je Ansicht eine A4-Seite an', async () => {
    const bytes = await renderReceiptsPdf([view(), view('A', 'B'), view('C', 'D')]);

    const doc = await PDFDocument.load(bytes);
    expect(doc.getPageCount()).toBe(3);
    const { width, height } = doc.getPage(0).getSize();
    expect(Math.round(width)).toBe(595);
    expect(Math.round(height)).toBe(842);
  });

  it('verarbeitet Zeichen ausserhalb von WinAnsi wie das polnische ł', async () => {
    const bytes = await renderReceiptsPdf([view('Łódź Wołów', 'Gdańsk')]);

    expect((await PDFDocument.load(bytes)).getPageCount()).toBe(1);
  });
});

describe('fitText', () => {
  it('haelt lange Texte innerhalb der Zellbreite', async () => {
    const doc = await PDFDocument.create();
    const font = await doc.embedFont(StandardFonts.Helvetica);
    const long = 'Sonstiges-Beschriftung mit vierzig Zeichen  12,50 €';
    const name = 'Maximilian Alexander Friedrich Wilhelm von und zu Hohenzollern-Sigmaringen-Hechingen';

    for (const t of [long, name]) {
      const fitted = fitText(t, font, 190);
      expect(font.widthOfTextAtSize(fitted.text, fitted.size)).toBeLessThanOrEqual(190);
      expect(fitted.size).toBeGreaterThanOrEqual(7);
    }
    expect(fitText(name, font, 190).text.endsWith('...')).toBe(true);
    expect(fitText('Kurz', font, 190)).toEqual({ text: 'Kurz', size: 10 });
  });
});

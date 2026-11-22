import { PDFDocument } from 'pdf-lib';
import { describe, expect, it } from 'vitest';
import { buildReceiptView, type ReceiptView } from '@/domain/receipt';
import { renderReceiptsPdf } from './receipt-pdf';

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

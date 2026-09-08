'use client';

import { useMemo, useState } from 'react';
import { Button, Field, Note, Tag } from '@/components/primitives';
import { CSV_COLUMNS, dedupe, parseCsv } from '@/domain/csv';
import { localToUtc } from '@/domain/time';

/**
 * CSV-Import mit einer Vorschau, die mitlaeuft.
 *
 * Sie lief frueher auf dem Server und las die Datei aus der Adresszeile. Wer
 * ins Feld tippte, aenderte die Adresse nicht — die Vorschau zeigte deshalb
 * dauerhaft das Beispiel und niemals die eigene Datei. Der Hinweis "nach dem
 * Bearbeiten neu laden" stand da, aber es gab nichts, was neu geladen haette.
 *
 * Jetzt rechnet sie im Browser, bei jedem Tastendruck. Das Einlesen und die
 * Duplikaterkennung sind reine Funktionen aus `@/domain` und laufen hier
 * genauso wie auf dem Server; der Import selbst bleibt eine Server-Aktion, die
 * dieselben Funktionen noch einmal anwendet. Was die Vorschau zeigt, ist
 * daher das, was entsteht — und nicht bloss eine Schaetzung davon.
 *
 * Der Bestand kommt als abgezaehlte Schluessel vom Server: nur damit laesst
 * sich sagen, was es schon gibt, ohne die ganze Spieltabelle zu uebertragen.
 */

export interface CsvImportProps {
  /** Die Server-Aktion, die den Import ausfuehrt. */
  action: (formData: FormData) => Promise<void>;
  /** Ligen des Vereins — eine Zeile mit unbekannter Klasse ist unbrauchbar. */
  knownLeagues: readonly string[];
  /** Vorhandene Spiele als `[Schluessel, Anzahl]`. */
  existing: readonly (readonly [string, number])[];
  /** Zeitzone des Vereins, fuer die Umrechnung des Anpfiffs. */
  timeZone: string;
  initialText: string;
}

export const CsvImport = ({
  action,
  knownLeagues,
  existing,
  timeZone,
  initialText,
}: CsvImportProps) => {
  const [text, setText] = useState(initialText);

  const preview = useMemo(() => {
    const parsed = parseCsv(text, knownLeagues);
    const counts = new Map(existing.map(([key, count]) => [key, count]));
    const split = dedupe(parsed.valid, (local) => localToUtc(local, timeZone), counts);
    return { ...parsed, ...split };
  }, [text, knownLeagues, existing, timeZone]);

  return (
    <div className="split">
      <form action={action}>
        <Field label="CSV einfügen" htmlFor="csv">
          <textarea
            id="csv"
            name="csv"
            className="input input-mono"
            rows={10}
            value={text}
            onChange={(event) => setText(event.target.value)}
            style={{ width: '100%' }}
          />
        </Field>
        <Note>
          Spalten: {CSV_COLUMNS.join('; ')}. Semikolon getrennt, erste Zeile Kopfzeile. Die Liga
          darf das Kürzel des Verbands sein — aus „XU14Bz“ wird U14, was keine Altersklasse
          nennt, gilt als Senioren. Spiele, die es schon gibt, werden übersprungen; steht
          dieselbe Paarung zweimal in der Datei, entstehen auch zwei Spiele.
        </Note>
        <Button type="submit" variant="primary">
          Importieren
        </Button>
      </form>

      <aside>
        <h2 className="kicker">Vorschau</h2>
        {preview.fileProblem ? (
          <p className="form-error">{preview.fileProblem}</p>
        ) : (
          <>
            <div className="row" style={{ margin: 'var(--space-3) 0' }}>
              <Tag tone="accent">{preview.fresh.length} neu</Tag>
              <Tag tone="neutral">{preview.duplicates.length} schon da</Tag>
              <Tag tone="outline">{preview.invalid.length} unbrauchbar</Tag>
            </div>
            <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
              {preview.fresh.map((row) => (
                <li key={`neu-${row.line}`} className="csv-preview-row">
                  <div style={{ fontSize: '13px' }}>
                    {row.home} — {row.away}
                  </div>
                  <div className="text-muted" style={{ fontSize: '11px' }}>
                    {row.date} · {row.time} · {row.leagueLabel} ({row.league}) · {row.venue}
                  </div>
                </li>
              ))}
              {preview.invalid.map((row) => (
                <li key={`fehler-${row.line}`} className="csv-preview-row csv-preview-row-bad">
                  Zeile {row.line}: {row.problem}
                </li>
              ))}
            </ul>
          </>
        )}
        <p className="text-muted" style={{ fontSize: '11px', marginTop: 'var(--space-3)' }}>
          Die Vorschau rechnet mit, während du tippst.
        </p>
      </aside>
    </div>
  );
};

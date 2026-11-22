import { Button, Field, Input } from '@/components/primitives';
import type { TravelMode } from '@/domain/receipt';
import type { ExpenseInput } from '@/server/expenses';

/**
 * Fahrt und Kosten eines Schiedsrichters an einem Spiel.
 *
 * Ein einspaltiges Formular, Felder in voller Breite, damit es am Handy ohne
 * Seitwaertsschieben funktioniert. Die Server-Aktion, die versteckten Ids und
 * die Startwerte kommen von aussen: der Kalender speichert die eigenen Werte,
 * die Admin-Ansicht die eines Schiedsrichters des Spiels.
 *
 * Geldbetraege stehen im Formular als Text ("12,50") und werden mit
 * `parseExpenseForm` in Cent umgerechnet — das macht die jeweilige Aktion.
 */

export const EXPENSE_FIELDS = {
  game: 'spiel',
  referee: 'schiedsrichter',
  travelMode: 'fahrtart',
  km: 'km',
  perDiem: 'tagegeld',
  other: 'sonstiges',
  otherLabel: 'sonstigesText',
} as const;

const TRAVEL_OPTIONS: readonly { value: TravelMode; label: string }[] = [
  { value: 'alone', label: 'Allein gefahren' },
  { value: 'with_passenger', label: 'Mit Mitfahrer gefahren' },
  { value: 'rode_along', label: 'Mitgefahren' },
];

const isTravelMode = (value: string): value is TravelMode =>
  TRAVEL_OPTIONS.some((option) => option.value === value);

const NUMBER = /^\d+(?:[.,]\d{1,2})?$/;

const text = (formData: FormData, key: string): string => {
  const value = formData.get(key);
  return typeof value === 'string' ? value.trim() : '';
};

/** "12,50" oder "12.5" -> Zahl; leer -> null; sonst `undefined`. */
const decimal = (raw: string): number | null | undefined => {
  if (raw === '') return null;
  if (!NUMBER.test(raw)) return undefined;
  return Number(raw.replace(',', '.'));
};

export type ParsedExpenses =
  | { readonly ok: true; readonly input: ExpenseInput }
  | { readonly ok: false; readonly message: string };

/** Liest die Formularfelder; die Wertegrenzen prueft `saveExpenses`. */
export const parseExpenseForm = (formData: FormData): ParsedExpenses => {
  const mode = text(formData, EXPENSE_FIELDS.travelMode);
  if (mode !== '' && !isTravelMode(mode)) {
    return { ok: false, message: 'Bitte eine Fahrtart wählen.' };
  }

  const km = decimal(text(formData, EXPENSE_FIELDS.km));
  if (km === undefined) return { ok: false, message: 'Die Kilometer bitte als Zahl angeben.' };

  const perDiem = decimal(text(formData, EXPENSE_FIELDS.perDiem));
  if (perDiem === undefined) {
    return { ok: false, message: 'Das Tagegeld bitte als Betrag in Euro angeben.' };
  }

  const other = decimal(text(formData, EXPENSE_FIELDS.other));
  if (other === undefined) {
    return { ok: false, message: 'Sonstiges bitte als Betrag in Euro angeben.' };
  }

  const label = text(formData, EXPENSE_FIELDS.otherLabel);
  return {
    ok: true,
    input: {
      travelMode: mode === '' ? null : mode,
      km,
      perDiemCents: perDiem === null ? null : Math.round(perDiem * 100),
      otherCents: other === null ? null : Math.round(other * 100),
      otherLabel: label === '' ? null : label,
    },
  };
};

const euro = (cents: number | null | undefined): string =>
  cents === null || cents === undefined ? '' : (cents / 100).toFixed(2).replace('.', ',');

const kmText = (km: number | null | undefined): string =>
  km === null || km === undefined ? '' : String(km).replace('.', ',');

export interface ExpenseFormProps {
  action: (formData: FormData) => Promise<void>;
  gameId: string;
  /** Nur wo die Aktion den Schiedsrichter nicht selbst kennt (Admin-Ansicht). */
  refereeId?: string;
  /** Gespeicherte Werte; `null`/fehlend heisst: noch nichts erfasst. */
  initial?: ExpenseInput | null;
  /** Macht Feld-Ids eindeutig, wenn mehrere Formulare auf einer Seite stehen. */
  idPrefix: string;
  submitLabel?: string;
}

export const ExpenseForm = ({
  action,
  gameId,
  refereeId,
  initial,
  idPrefix,
  submitLabel = 'Speichern',
}: ExpenseFormProps) => {
  const id = (name: string) => `${idPrefix}-${name}`;
  const full = { width: '100%' } as const;
  return (
    <form action={action} className="stack expense-form" style={{ gap: 'var(--space-3)', maxWidth: '420px' }}>
      <input type="hidden" name={EXPENSE_FIELDS.game} value={gameId} />
      {refereeId ? <input type="hidden" name={EXPENSE_FIELDS.referee} value={refereeId} /> : null}

      <Field label="Anreise" htmlFor={id('fahrtart')}>
        <select
          id={id('fahrtart')}
          name={EXPENSE_FIELDS.travelMode}
          className="input"
          style={full}
          defaultValue={initial?.travelMode ?? ''}
        >
          <option value="">Keine Angabe</option>
          {TRAVEL_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </Field>
      <Field label="Kilometer (Hin- und Rückfahrt)" htmlFor={id('km')}>
        <Input
          id={id('km')}
          name={EXPENSE_FIELDS.km}
          inputMode="numeric"
          pattern="[0-9]*"
          autoComplete="off"
          style={full}
          defaultValue={kmText(initial?.km)}
        />
      </Field>
      <Field label="Tagegeld in Euro" htmlFor={id('tagegeld')}>
        <Input
          id={id('tagegeld')}
          name={EXPENSE_FIELDS.perDiem}
          inputMode="decimal"
          autoComplete="off"
          style={full}
          defaultValue={euro(initial?.perDiemCents)}
        />
      </Field>
      <Field label="Sonstiges in Euro" htmlFor={id('sonstiges')}>
        <Input
          id={id('sonstiges')}
          name={EXPENSE_FIELDS.other}
          inputMode="decimal"
          autoComplete="off"
          style={full}
          defaultValue={euro(initial?.otherCents)}
        />
      </Field>
      <Field label="Bezeichnung für Sonstiges (optional)" htmlFor={id('sonstigesText')}>
        <Input
          id={id('sonstigesText')}
          name={EXPENSE_FIELDS.otherLabel}
          maxLength={40}
          autoComplete="off"
          style={full}
          defaultValue={initial?.otherLabel ?? ''}
        />
      </Field>
      <div className="row">
        <Button type="submit" variant="secondary">
          {submitLabel}
        </Button>
      </div>
    </form>
  );
};

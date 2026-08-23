'use client';

import { useState } from 'react';
import { Button } from '@/components/primitives';
import { describeHours } from '@/domain/time';

/**
 * Der Regler fuer einen eigenen Erinnerungszeitpunkt.
 *
 * Der Wert wird waehrend des Ziehens als Text mitgefuehrt — „36 Stunden“ sagt
 * mehr als eine Zahl auf einer Skala. Ohne JavaScript bleibt der Regler ein
 * gewoehnliches Formularfeld und laesst sich trotzdem abschicken.
 */

export interface ReminderSliderProps {
  min: number;
  max: number;
  initial: number;
  disabled: boolean;
  disabledLabel: string;
  action: (formData: FormData) => Promise<void>;
}

export const ReminderSlider = ({
  min,
  max,
  initial,
  disabled,
  disabledLabel,
  action,
}: ReminderSliderProps) => {
  const [hours, setHours] = useState(initial);

  return (
    <form action={action}>
      <div className="row" style={{ alignItems: 'baseline', marginTop: 'var(--space-3)' }}>
        <output
          htmlFor="erinnerung-stunden"
          style={{ fontFamily: 'var(--font-heading)', fontWeight: 800, fontSize: '24px' }}
        >
          {describeHours(hours)}
        </output>
        <span className="text-muted" style={{ fontSize: '12px' }}>
          vor Anpfiff
        </span>
      </div>

      <input
        id="erinnerung-stunden"
        name="stunden"
        type="range"
        min={min}
        max={max}
        step={1}
        value={hours}
        onChange={(event) => setHours(Number.parseInt(event.target.value, 10))}
        aria-label="Vorlauf in Stunden"
        style={{ width: '100%', marginTop: 'var(--space-3)', accentColor: 'var(--color-accent)' }}
      />
      <div
        className="row text-muted"
        style={{ justifyContent: 'space-between', fontSize: '11px' }}
      >
        <span>{describeHours(min)}</span>
        <span>{describeHours(max)}</span>
      </div>

      <Button type="submit" variant="primary" disabled={disabled}>
        {disabled ? disabledLabel : 'Zeitpunkt hinzufügen'}
      </Button>
    </form>
  );
};

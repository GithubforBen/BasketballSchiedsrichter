'use client';

import { useId, useState } from 'react';
import { Field, Input } from '@/components/primitives';

/**
 * Ein Passwortfeld, das man sich ansehen kann.
 *
 * Ohne den Schalter tippt man ein Passwort blind. Beim Start-Passwort ist das
 * besonders laestig: es steht auf einem Zettel oder in einer Nachricht, wird
 * abgetippt und stimmt dann nicht — ohne dass zu sehen waere, woran es lag.
 * Auch am Handy, wo die Tastatur oft daneben trifft, ist das der Unterschied
 * zwischen einem zweiten Versuch und dem Anruf beim Admin.
 *
 * Sichtbar ist das Passwort nur, solange jemand es ausdruecklich sehen will:
 * der Schalter faellt bei jedem Seitenaufruf auf "verborgen" zurueck.
 */

export interface PasswordFieldProps {
  label: string;
  name: string;
  autoComplete: 'current-password' | 'new-password';
  hint?: string | undefined;
  required?: boolean;
  autoFocus?: boolean;
}

export const PasswordField = ({
  label,
  name,
  autoComplete,
  hint,
  required = true,
  autoFocus = false,
}: PasswordFieldProps) => {
  const id = useId();
  const [shown, setShown] = useState(false);

  return (
    <Field label={label} htmlFor={id} hint={hint}>
      <div className="password-field">
        <Input
          id={id}
          name={name}
          type={shown ? 'text' : 'password'}
          autoComplete={autoComplete}
          required={required}
          autoFocus={autoFocus}
          style={{ minHeight: '46px' }}
        />
        {/*
          `type="button"`, sonst schickt der Schalter das Formular ab — ein
          Klick auf "Anzeigen" waere dann ein Anmeldeversuch mit halbem
          Passwort und zaehlte gegen die Sperre.
        */}
        <button
          type="button"
          className="password-toggle"
          onClick={() => setShown((on) => !on)}
          aria-pressed={shown}
        >
          {shown ? 'Verbergen' : 'Anzeigen'}
        </button>
      </div>
    </Field>
  );
};

import type { ButtonHTMLAttributes, HTMLAttributes, InputHTMLAttributes, ReactNode } from 'react';
import type { StatusView } from '@/domain/status';

/**
 * Die Bausteine des Design-Systems als React-Komponenten.
 *
 * Sie bringen keine eigenen Farben oder Abstaende mit — sie setzen nur die
 * Klassen aus "modernist.css" und "app.css". Wer hier einen Hex-Wert oder eine
 * rohe Pixelangabe sieht, hat einen Fehler gefunden.
 */

const classes = (...parts: readonly (string | false | undefined)[]): string =>
  parts.filter(Boolean).join(' ');

export type ButtonVariant = 'primary' | 'secondary' | 'ghost';

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  /** Volle Breite, Label bleibt linksbuendig. */
  block?: boolean;
}

export const Button = ({
  variant = 'secondary',
  block = false,
  className,
  type = 'button',
  ...rest
}: ButtonProps) => (
  <button
    type={type}
    className={classes('btn', `btn-${variant}`, block && 'btn-block', className)}
    {...rest}
  />
);

export type TagTone = 'accent' | 'neutral' | 'outline';

export interface TagProps extends HTMLAttributes<HTMLSpanElement> {
  tone?: TagTone;
}

export const Tag = ({ tone = 'neutral', className, ...rest }: TagProps) => (
  <span className={classes('tag', `tag-${tone}`, className)} {...rest} />
);

export interface FieldProps {
  label: string;
  htmlFor: string;
  children: ReactNode;
  hint?: string | undefined;
  className?: string | undefined;
}

export const Field = ({ label, htmlFor, children, hint, className }: FieldProps) => (
  <div className={classes('field', className)}>
    <label htmlFor={htmlFor}>{label}</label>
    {children}
    {hint ? (
      <div className="text-muted" style={{ fontSize: '11px', marginTop: 'var(--space-1)' }}>
        {hint}
      </div>
    ) : null}
  </div>
);

export const Input = ({ className, ...rest }: InputHTMLAttributes<HTMLInputElement>) => (
  <input className={classes('input', className)} {...rest} />
);

/** Die Statusampel. Farbe kommt immer aus der Custom Property des Zustands. */
/* Punkt im vollen Ton, Schrift im lesbaren — siehe StatusView. */
export const Status = ({ view }: { view: StatusView }) => (
  <span className="status" style={{ color: view.textColorVar }}>
    <span className="status-dot" style={{ background: view.colorVar }} aria-hidden="true" />
    {view.label}
  </span>
);

export interface InitialsProps {
  /** Kuerzel der Person, oder null fuer einen freien Platz. */
  initials: string | null;
  size?: number;
  /** Wird vorgelesen, wenn das Kuerzel allein nicht verstaendlich ist. */
  label?: string;
}

export const Initials = ({ initials, size = 24, label }: InitialsProps) => (
  <span
    className={classes('initials', initials === null && 'initials-vacant')}
    style={{ width: `${size}px`, height: `${size}px`, fontSize: `${Math.round(size * 0.42)}px` }}
  >
    <span aria-hidden="true">{initials ?? '—'}</span>
    <span className="visually-hidden">{label ?? (initials ?? 'frei')}</span>
  </span>
);

export interface ToggleProps {
  checked: boolean;
  onToggle?: () => void;
  label: string;
  description?: string;
  disabled?: boolean;
  /** Grund, warum der Schalter feststeht — wird statt einer Sperre erklaert. */
  lockedReason?: string;
}

export const Toggle = ({
  checked,
  onToggle,
  label,
  description,
  disabled = false,
  lockedReason,
}: ToggleProps) => (
  <div className="row" style={{ alignItems: 'flex-start', gap: 'var(--space-4)' }}>
    <button
      type="button"
      className="toggle"
      role="switch"
      aria-checked={checked}
      aria-pressed={checked}
      aria-label={label}
      disabled={disabled}
      title={disabled ? lockedReason : undefined}
      onClick={onToggle}
    >
      <span className="toggle-knob" aria-hidden="true" />
    </button>
    <div style={{ flex: 1 }}>
      <div style={{ fontFamily: 'var(--font-heading)', fontWeight: 800, fontSize: '16px' }}>
        {label}
      </div>
      {description ? (
        <div className="text-muted" style={{ fontSize: '13px' }}>
          {description}
        </div>
      ) : null}
      {disabled && lockedReason ? (
        <div className="text-muted" style={{ fontSize: '12px' }}>
          {lockedReason}
        </div>
      ) : null}
    </div>
  </div>
);

export const Hr = () => <hr className="hr" />;

export const Note = ({
  children,
  accent = false,
}: {
  children: ReactNode;
  accent?: boolean;
}) => <div className={classes('note', accent && 'note-accent')}>{children}</div>;

export const Panel = ({ children, ...rest }: HTMLAttributes<HTMLDivElement>) => (
  <div className="panel" {...rest}>
    {children}
  </div>
);

/** Tabellen scrollen im eigenen Kasten, damit die Seite nie waagerecht laeuft. */
export const TableWrap = ({ children }: { children: ReactNode }) => (
  <div className="scroll-x">
    <table className="table">{children}</table>
  </div>
);

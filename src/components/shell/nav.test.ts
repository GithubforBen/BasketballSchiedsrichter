import { describe, expect, it } from 'vitest';
import { isCurrent, tabTargets, type NavTarget } from './nav';

describe('Markierung der Navigation', () => {
  it('markiert den genauen Pfad', () => {
    expect(isCurrent('/spiele', '/spiele')).toBe(true);
  });

  it('markiert auch Unterseiten', () => {
    expect(isCurrent('/spiele/g1', '/spiele')).toBe(true);
  });

  it('verwechselt keine Praefixe', () => {
    expect(isCurrent('/spieletage', '/spiele')).toBe(false);
  });

  it('markiert die Startseite nur bei sich selbst', () => {
    expect(isCurrent('/', '/')).toBe(true);
    expect(isCurrent('/spiele', '/')).toBe(false);
  });
});

describe('Tab-Leiste am Handy', () => {
  const target = (n: number): NavTarget => ({
    href: '/',
    label: `Ziel ${n}`,
    short: `Z${n}`,
  });

  it('nimmt die Hauptnavigation, solange sie hineinpasst', () => {
    const nav = [target(1), target(2)];
    expect(tabTargets(nav)).toEqual(nav);
  });

  it('meldet eine zu lange Navigation ohne eigene Auswahl', () => {
    const nav = [target(1), target(2), target(3), target(4), target(5)];
    expect(() => tabTargets(nav)).toThrow(/hoechstens 4/);
  });

  it('nimmt die uebergebene Auswahl', () => {
    const nav = [target(1), target(2), target(3), target(4), target(5)];
    const tabs = [target(1), target(5)];
    expect(tabTargets(nav, tabs)).toEqual(tabs);
  });
});

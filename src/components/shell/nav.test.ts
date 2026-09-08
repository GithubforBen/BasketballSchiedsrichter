import { describe, expect, it } from 'vitest';
import { isCurrent, navItems, tabTargets, type NavGroup, type NavTarget } from './nav';

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

  const group = (...items: NavTarget[]): NavGroup => ({ label: null, items });

  it('nimmt die Hauptnavigation, solange sie hineinpasst', () => {
    const nav = [group(target(1), target(2))];
    expect(tabTargets(nav)).toEqual([target(1), target(2)]);
  });

  it('zaehlt ueber alle Gruppen hinweg, nicht je Gruppe', () => {
    // Zwei Gruppen zu dreien passen einzeln, zusammen aber nicht.
    const nav = [group(target(1), target(2), target(3)), group(target(4), target(5), target(6))];
    expect(() => tabTargets(nav)).toThrow(/hoechstens 4/);
  });

  it('nimmt die uebergebene Auswahl', () => {
    const nav = [group(target(1), target(2), target(3), target(4), target(5))];
    const tabs = [target(1), target(5)];
    expect(tabTargets(nav, tabs)).toEqual(tabs);
  });
});

describe('Ziele einer gruppierten Navigation', () => {
  it('reiht die Gruppen der Reihe nach aneinander', () => {
    const a: NavTarget = { href: '/', label: 'A', short: 'A' };
    const b: NavTarget = { href: '/spiele', label: 'B', short: 'B' };
    expect(
      navItems([
        { label: null, items: [a] },
        { label: 'Mein Bereich', items: [b] },
      ]),
    ).toEqual([a, b]);
  });
});

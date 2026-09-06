import { describe, expect, it } from 'vitest';
import { compareLeagues, leagueDisplay } from './league';

const order = (...ids: string[]) =>
  ids.map((id) => ({ id })).sort(compareLeagues).map((entry) => entry.id);

describe('Reihenfolge der Ligen', () => {
  it('ordnet die Jugend aufsteigend nach Alter', () => {
    expect(order('U16', 'U10', 'U14', 'U12')).toEqual(['U10', 'U12', 'U14', 'U16']);
  });

  it('stellt die Erwachsenen ans Ende', () => {
    // "Senioren" kam im Verein zuerst, U10 und U12 spaeter dazu — nach
    // Platzziffer standen sie deshalb dahinter.
    expect(order('Senioren', 'U18', 'U10')).toEqual(['U10', 'U18', 'Senioren']);
  });

  it('vergleicht die Zahl und nicht die Zeichen', () => {
    // Alphabetisch stuende "U9" hinter "U18" und "U100" davor.
    expect(order('U18', 'U9', 'U100')).toEqual(['U9', 'U18', 'U100']);
  });

  it('ordnet mehrere Erwachsenenligen untereinander alphabetisch', () => {
    expect(order('Senioren', 'Herren', 'U14')).toEqual(['U14', 'Herren', 'Senioren']);
  });
});

describe('Was am Spiel steht', () => {
  it('zeigt das Kürzel des Verbands, wenn es eines gibt', () => {
    expect(leagueDisplay({ leagueId: 'U14', leagueLabel: 'XU14Bz' })).toBe('XU14Bz');
  });

  it('nimmt die Liga, wenn das Spiel von Hand angelegt wurde', () => {
    expect(leagueDisplay({ leagueId: 'U14', leagueLabel: '' })).toBe('U14');
    expect(leagueDisplay({ leagueId: 'Senioren', leagueLabel: '   ' })).toBe('Senioren');
  });
});

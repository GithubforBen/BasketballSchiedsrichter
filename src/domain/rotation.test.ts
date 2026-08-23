import { describe, expect, it } from 'vitest';
import { makeReferee, NOW, settings } from './__fixtures__/build';
import { notificationOrder, rotationWindowStart, type RotationCandidate } from './rotation';

const candidates: RotationCandidate[] = [
  { referee: makeReferee({ id: 'r-nb', name: 'Nele Baumann' }), countInWindow: 4 },
  { referee: makeReferee({ id: 'r-jk', name: 'Jonas Keller' }), countInWindow: 1 },
  { referee: makeReferee({ id: 'r-ms', name: 'Marco Silva' }), countInWindow: 2 },
];

describe('Regel 19 — Rotation steuert nur die Anschreib-Reihenfolge', () => {
  it('schreibt die Wenig-Pfeifer zuerst an', () => {
    const order = notificationOrder(candidates, settings({ rotation: true }));
    expect(order.map((r) => r.id)).toEqual(['r-jk', 'r-ms', 'r-nb']);
  });

  it('laesst die Reihenfolge unveraendert, wenn die Rotation aus ist', () => {
    const order = notificationOrder(candidates, settings({ rotation: false }));
    expect(order.map((r) => r.id)).toEqual(['r-nb', 'r-jk', 'r-ms']);
  });

  it('schliesst niemanden aus — alle bleiben in der Liste', () => {
    for (const rotation of [true, false]) {
      expect(notificationOrder(candidates, settings({ rotation }))).toHaveLength(
        candidates.length,
      );
    }
  });

  it('loest Gleichstand reproduzierbar auf', () => {
    const tie: RotationCandidate[] = [
      { referee: makeReferee({ id: 'b', name: 'Bea' }), countInWindow: 3 },
      { referee: makeReferee({ id: 'a', name: 'Ada' }), countInWindow: 3 },
    ];
    expect(notificationOrder(tie, settings()).map((r) => r.id)).toEqual(['a', 'b']);
  });

  it('waehlt den Zaehlzeitraum nach der Einstellung', () => {
    expect(rotationWindowStart(NOW, 'week')).toEqual(new Date('2026-07-25T12:00:00Z'));
    expect(rotationWindowStart(NOW, 'month')).toEqual(new Date('2026-07-02T12:00:00Z'));
    expect(rotationWindowStart(NOW, 'season').getTime()).toBeLessThan(
      rotationWindowStart(NOW, 'month').getTime(),
    );
  });
});

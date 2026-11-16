---
type: Decision
title: "Öffentlicher Spielplan ohne Login, nur mit Kürzeln"
description: "Der Spielplan ist ohne Anmeldung öffentlich und indexierbar; Personen erscheinen dort ausschließlich als Kürzel."
status: draft
decision: accepted
generated: { by: claude-code/claude-opus-5-5, at: 2026-11-16T12:16:37+01:00 }
sources:
  - id: plan-entscheidungen
    resource: ../../PLAN.md
  - id: visibility
    resource: ../../src/domain/visibility.ts
---

# Decision

Der Spielplan ist ohne Login öffentlich sichtbar und darf von Suchmaschinen indexiert werden. Personen erscheinen dort nur als Kürzel.

# Why

Eltern, Trainer und Schiedsrichter sollen ohne Konto sehen, ob ein Spiel besetzt ist. Das Kürzel reicht im Verein zum Erkennen und gibt nach außen nichts preis.

# Rejected alternatives

Keine dokumentiert.

# Related

- [Sichtbarkeit](/domain/sichtbarkeit.md)

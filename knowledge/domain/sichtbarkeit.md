---
type: Business Rule
title: "Sichtbarkeit: ohne Login nur Kürzel"
description: "Ohne Login sind nur Kürzel sichtbar — auch nicht in JSON oder HTML-Attributen; Stammdaten ändert nur der Admin, das Profilbild die Person."
status: draft
generated: { by: claude-code/claude-opus-5-5, at: 2026-11-16T12:16:39+01:00 }
sources:
  - id: plan-regeln
    resource: ../../PLAN.md
  - id: visibility
    resource: ../../src/domain/visibility.ts
---

# Rule

Regeln 29–30:

- Ohne Login ist ausschließlich das **Kürzel** sichtbar — kein Name, keine Telefonnummer, kein Profilbild. Das gilt auch für ausgelieferte JSON-Daten und HTML-Attribute, nicht nur für die Anzeige.
- Name, Kürzel und Telefonnummer ändert ausschließlich der Admin. Das Profilbild ändert die Person selbst.

# Why

Der Spielplan ist öffentlich und indexierbar; was im Quelltext steht, ist veröffentlicht. Stammdaten sind Vereinsdaten und werden zentral gepflegt.

# Related

- [Öffentliche Ansicht](/decisions/oeffentliche-ansicht-ohne-login.md)
- [Verarbeitete Daten](/architecture/verarbeitete-daten.md)

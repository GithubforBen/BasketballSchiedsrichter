---
type: Decision
title: Plain CSS auf den Modernist-Tokens, kein Tailwind
description: Gestylt wird mit normalem CSS auf Basis der Tokens des Modernist-Designsystems; Tailwind wird nicht verwendet.
status: draft
decision: accepted
generated: { by: claude-code/claude-opus-5-5, at: 2026-11-16T12:16:35+01:00 }
sources:
  - id: plan-entscheidungen
    resource: ../../PLAN.md
  - id: design-system
    resource: ../../design/_ds/modernist-11ee9c05-7e12-42a8-8930-b005628d2360/readme.md
---

# Decision

Die Oberfläche ist in normalem CSS geschrieben (`src/styles/`). Grundlage sind die Farb-, Schrift- und Abstands-Tokens des Modernist-Designsystems aus `design/_ds/…`. Tailwind kommt nicht zum Einsatz.

# Why

Das Mockup und das Designsystem liefern bereits fertige Tokens und Komponenten-Styles. Sie direkt als CSS-Variablen zu übernehmen, hält Mockup und App deckungsgleich, ohne eine zweite Styling-Sprache einzuführen.

# Rejected alternatives

- Tailwind — in `PLAN.md` ausdrücklich ausgeschlossen.

# Related

- [Modernist-Designsystem](/references/modernist-design-system.md)
- [Statusfarben](/domain/statusfarben.md)

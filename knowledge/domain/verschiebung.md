---
type: Business Rule
title: Verschiebung eines Spiels
description: "Wird ein Spiel verlegt, bekommen Schiedsrichter und Ersatz den neuen Termin mit Absage-Option; eine Absage startet sofort die Nachrück-Kaskade."
status: draft
generated: { by: claude-code/claude-opus-5-5, at: 2026-11-16T12:16:38+01:00 }
sources:
  - id: plan-regeln
    resource: ../../PLAN.md
  - id: relocation
    resource: ../../src/domain/relocation.ts
---

# Rule

Regeln 17–18:

- Verschiebt der Admin ein Spiel, bekommen alle auf Schiedsrichter- **und** Ersatzplätzen den neuen Termin, mit der Möglichkeit abzusagen.
- Eine Absage öffnet den Platz sofort wieder und stößt die Nachrück-Kaskade an.

# Why

Wer für Samstag zugesagt hat, hat nicht automatisch für Sonntag zugesagt. Statt die Zusage stillschweigend mitzunehmen, wird gefragt — und wer nicht kann, ist ohne Umweg über den Admin raus.

# Related

- [Ausfall und Nachrücken](/domain/ausfall-und-nachruecken.md)

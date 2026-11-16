---
type: Business Rule
title: Faire Rotation beim Anschreiben und schaltbare Admin-Meldungen
description: Die Rotation bestimmt nur die Reihenfolge der Benachrichtigung, nicht wer sich eintragen darf; Admin-Meldungen sind einzeln schaltbar.
status: draft
generated: { by: claude-code/claude-opus-5-5, at: 2026-11-16T12:16:38+01:00 }
sources:
  - id: plan-regeln
    resource: ../../PLAN.md
  - id: rotation
    resource: ../../src/domain/rotation.ts
  - id: alerts
    resource: ../../src/domain/alerts.ts
---

# Rule

Regeln 19–20:

- „Faire Rotation" steuert **nur die Reihenfolge beim Anschreiben**: wer im gewählten Zeitraum (Woche, Monat, Saison) am wenigsten gepfiffen hat, wird zuerst benachrichtigt, alle anderen zeitversetzt. Eintragen bleibt für alle gleichzeitig offen.
- Admin-Meldungen sind einzeln schaltbar: Spiel ohne zwei Schiris, Pflichtbestätigung 24 h offen, Ersatz fehlt, Austragung/Absage, tägliche Zusammenfassung, nach CSV-Import.

# Why

Wer selten pfeift, soll eine Chance bekommen, ohne dass „wer zuerst kommt" ausgehebelt wird. Admins bekommen nur die Meldungen, mit denen sie etwas anfangen.

# Related

- [Besetzung](/domain/besetzung.md)
- [Tagesbilanz für Admins](/domain/tagesbilanz-admins.md)

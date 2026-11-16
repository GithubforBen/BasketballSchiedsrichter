---
type: Business Rule
title: "Persönliche Erinnerungen vor dem Spiel"
description: "Jeder wählt Erinnerungen zwischen 1 und 168 Stunden vor Anpfiff; ab der 4. kommt ein Kostenhinweis, höchstens 10 pro Person."
status: draft
generated: { by: claude-code/claude-opus-5-5, at: 2026-11-16T12:16:38+01:00 }
sources:
  - id: plan-regeln
    resource: ../../PLAN.md
  - id: reminders
    resource: ../../src/domain/reminders.ts
---

# Rule

Regeln 21–24:

- Erinnerungen sind frei wählbar zwischen **1 Stunde** und **168 Stunden** (7 Tage) vor Anpfiff.
- Ab der **4.** Erinnerung fragt die App nach: „Jede Nachricht kostet den Verein Geld".
- Höchstens **10** Erinnerungen pro Person; das Limit ist einstellbar.
- Die Pflichtbestätigung kommt immer zusätzlich und zählt nicht mit.

# Why

Erinnerungen sind persönlicher Komfort und kosten pro Stück Geld. Die Rückfrage und das Limit halten das im Rahmen, ohne die Wahl wegzunehmen.

# Related

- [Nachrichten sparsam](/domain/nachrichten-sparsamkeit.md)
- [Pflichtbestätigung](/domain/pflichtbestaetigung.md)

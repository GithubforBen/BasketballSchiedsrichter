---
type: Business Rule
title: "Besetzung: zwei Schiris, zwei Ersatz, wer zuerst kommt"
description: "Pro Spiel zwei gleichwertige Schiedsrichter- und zwei Ersatzplätze, strikt der Reihe nach, sofort verbindlich, max. ein Spiel pro Tag."
status: draft
generated: { by: claude-code/claude-opus-5-5, at: 2026-11-16T12:09:22+01:00 }
sources:
  - id: plan-regeln
    resource: ../../PLAN.md
  - id: rules
    resource: ../../src/domain/rules.ts
---

# Rule

Regeln 1–6 aus `PLAN.md`:

- Pro Spiel gibt es zwei **gleichwertige** Schiedsrichterplätze und zwei Ersatzplätze.
- Vergeben wird strikt der Reihe nach: Schiri 1 → Schiri 2 → Ersatz 1 → Ersatz 2. Nur der jeweils erste freie Platz ist belegbar.
- Eintragen ist sofort verbindlich, wer zuerst kommt, hat den Platz. Bei gleichzeitigen Zugriffen gewinnt genau einer (Transaktion plus Unique-Constraint auf `(game_id, slot_index)`).
- Eintragen nur mit Qualifikation für die Liga **und** ausreichender Lizenz.
- Niemand belegt zwei Plätze desselben Spiels.
- Höchstens ein Spiel pro Tag und Person, Ersatzplätze zählen mit. Der Admin kann das je Spiel freigeben; vereinsweit ist es abschaltbar (`one_game_per_day`).

# Why

Keine Wunschlisten und kein Einteilen durch einen Admin: wer Zeit hat, trägt sich ein, und das gilt. Die feste Reihenfolge macht für alle sichtbar, was fehlt. Die Tagesgrenze verteilt die Spiele auf mehr Leute und verhindert, dass jemand zwei Hallen gleichzeitig zusagt.

# Related

- [Qualifikation und Lizenz](/domain/qualifikation-und-lizenz.md)
- [Lizenzen](/domain/lizenzen.md)
- [Platz](/domain/platz.md)

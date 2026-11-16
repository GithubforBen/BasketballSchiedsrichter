---
type: Term
title: Platz
description: "Einer der vier Plätze eines Spiels: Schiri 1, Schiri 2, Ersatz 1, Ersatz 2 (slot_index 0–3)."
status: draft
generated: { by: claude-code/claude-opus-5-5, at: 2026-11-16T12:16:40+01:00 }
sources:
  - id: slots
    resource: ../../src/domain/slots.ts
---

# Meaning

Ein Spiel hat vier Plätze: Schiri 1 und Schiri 2 (Schiedsrichterplätze, gleichwertig) und Ersatz 1 und Ersatz 2. Im Code `Slot` mit `slot_index` 0–3; `slotKind` unterscheidet `referee` und `substitute`.

# Not to be confused with

- Einsatz: ein Platz wird erst zum Einsatz, wenn er zum Anpfiff ein Schiedsrichterplatz ist.

# Related

- [Besetzung](/domain/besetzung.md)

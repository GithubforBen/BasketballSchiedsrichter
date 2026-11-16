---
type: Business Rule
title: "Lizenzen E, D und C: die höhere deckt die niedrigere"
description: Jedes Spiel verlangt eine Lizenz (Standard E); C deckt D und E, D deckt E. Ohne Lizenz keine Eintragung, sehen darf man trotzdem alles.
status: draft
generated: { by: claude-code/claude-opus-5-5, at: 2026-11-16T12:16:40+01:00 }
sources:
  - id: plan-regeln
    resource: ../../PLAN.md
  - id: license
    resource: ../../src/domain/license.ts
---

# Rule

Regeln 51–53, im heutigen Stand mit drei Stufen:

- Jedes Spiel verlangt eine Lizenz: **E** (Einstieg), **D** oder **C** (höchste). Ohne Angabe gilt E. Der Admin setzt sie im Spielformular oder über die freiwillige siebte CSV-Spalte `Lizenz`.
- Jedes Konto trägt eine Lizenz — oder keine. Die höhere deckt die niedrigeren: C darf C, D und E pfeifen, D darf D und E, E nur E.
- Wer keine Lizenz hat, kann sich in **kein** Spiel eintragen, auch nicht in eines seiner Liga.
- Die Lizenz beschränkt das Eintragen, nicht das Sehen. Eine Ausschreibung für ein Spiel, für das die Lizenz nicht reicht, bekommt man nicht.

Ursprünglich gab es nur E und D; die Stufe C kam später dazu. Bei der Migration am 2026-11-16 bestätigt und in `PLAN.md` nachgezogen.

# Why

Die Lizenz sagt, welche Spiele jemand überhaupt pfeifen darf. Eine Nachricht an jemanden, der sich danach nicht eintragen darf, kostet Geld und stiftet Verwirrung.

# Related

- [Qualifikation und Lizenz](/domain/qualifikation-und-lizenz.md)
- [Besetzung](/domain/besetzung.md)

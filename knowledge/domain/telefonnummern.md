---
type: Business Rule
title: "Telefonnummern: jede Schreibweise rein, eine heraus"
description: "Telefonnummern werden in jeder üblichen Schreibweise angenommen, als E.164 gespeichert und national mit führender Null angezeigt."
status: draft
generated: { by: claude-code/claude-opus-5-5, at: 2026-11-16T12:16:39+01:00 }
sources:
  - id: plan-regeln
    resource: ../../PLAN.md
  - id: phone
    resource: ../../src/domain/phone.ts
---

# Rule

Regeln 42–43:

- Die Eingabe akzeptiert jede übliche Schreibweise (`+49 151 …`, `0049 151 …`, `0151/23456789`, mit Leerzeichen, Klammern oder Bindestrichen); daraus wird immer dieselbe Nummer.
- Angezeigt wird national mit führender Null: `0151 23456789`.
- Gespeichert wird E.164 (`+4915123456789`).

# Why

Die Telefonnummer ist die Login-Kennung und muss deshalb eindeutig sein, egal wie sie getippt wird. Der Nachrichtenversand darf kein Format raten.

# Related

- [Anmeldung mit Passwort](/domain/passwort-anmeldung.md)

---
type: Business Rule
title: "Notzugang für ausgesperrte Admins"
description: Sperrt sich ein Admin aus, erzeugt ein Befehl auf dem Server einen langen Einmal-Token; gespeichert wird nur sein Hash, er ist widerrufbar.
status: draft
generated: { by: claude-code/claude-opus-5-5, at: 2026-11-16T12:16:39+01:00 }
sources:
  - id: plan-regeln
    resource: ../../PLAN.md
  - id: cli
    resource: ../../src/cli/notzugang.ts
---

# Rule

Regel 41:

- Sperrt sich ein Admin aus, erzeugt ein Befehl auf dem Server (`npm run notzugang -- --neu …`) für genau diesen Admin einen sehr langen Token.
- Der Token wird **einmal** angezeigt; gespeichert wird nur sein Hash.
- Er gilt einmal, ist einzeln widerrufbar und steht im Prüfprotokoll.

# Why

Bewusst auf der Kommandozeile und nicht im Adminbereich: wer den Adminbereich erreicht, braucht keinen Notzugang, und ein Knopf dafür wäre ein Weg, ein übernommenes Adminkonto dauerhaft festzusetzen.

# Related

- [Anmeldung mit Passwort](/domain/passwort-anmeldung.md)
- [Betriebsskripte](/architecture/cli.md)

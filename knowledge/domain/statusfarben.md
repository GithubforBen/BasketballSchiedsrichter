---
type: Business Rule
title: Statusfarben eines Spiels
description: "Ein Spiel ist rot (offen/Schiri fehlt) unter zwei Schiris, gelb (Ersatz fehlt) mit zwei Schiris und gelb, grün (besetzt) mit allen vier Plätzen."
status: draft
generated: { by: claude-code/claude-opus-5-5, at: 2026-11-16T12:16:40+01:00 }
sources:
  - id: plan-regeln
    resource: ../../PLAN.md
  - id: status
    resource: ../../src/domain/status.ts
---

# Rule

| Zustand | Bedingung | Farbe |
| --- | --- | --- |
| `offen` / `Schiri fehlt` | weniger als 2 Schiedsrichter | Akzentfarbe `#ec3013` |
| `Ersatz fehlt` | 2 Schiedsrichter, weniger als 2 Ersatz | `#c58a00` |
| `besetzt` | alle 4 Plätze belegt | `#1f7a4d` |

Die Farben liegen als CSS-Variablen `--status-open`, `--status-substitute-missing` und `--status-filled` in `src/styles/app.css`.

# Why

Die Ampel ist die schnellste Antwort auf „muss ich mich kümmern?" — im öffentlichen Spielplan wie in der Admin-Übersicht.

# Related

- [Besetzung](/domain/besetzung.md)

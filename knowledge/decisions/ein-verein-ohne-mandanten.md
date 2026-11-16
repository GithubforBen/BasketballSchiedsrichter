---
type: Decision
title: "Ein Verein, keine Mandantenfähigkeit"
description: Schiriplan bedient genau einen Verein; dessen Angaben stehen in einer Konfigurationsdatei, das Schema kennt keine club_id.
status: draft
decision: accepted
generated: { by: claude-code/claude-opus-5-5, at: 2026-11-16T12:16:36+01:00 }
sources:
  - id: plan-entscheidungen
    resource: ../../PLAN.md
  - id: club
    resource: ../../src/config/club.ts
---

# Decision

Die Anwendung gehört genau einem Verein. Vereinsdaten stehen in `src/config/club.ts` und `src/config/legal.ts`, nicht in der Datenbank; das Schema hat keine `club_id`, und die Einstellungen sind eine einzelne Zeile.

# Why

Gebaut für die Basketball-Jugendabteilung eines Vereins. Mandantenfähigkeit hätte jede Abfrage und jede Regel um einen Filter erweitert, ohne dass es einen zweiten Verein gibt.

# Rejected alternatives

Keine dokumentiert.

# Related

- [Ligen](/decisions/ligen-vorbelegt.md)

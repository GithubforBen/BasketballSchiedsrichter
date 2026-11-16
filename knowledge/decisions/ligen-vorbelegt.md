---
type: Decision
title: Ligen sind vorbelegt und vom Admin pflegbar
description: Beim Einrichten sind die Ligen U10, U12, U14, U16, U18 und Senioren angelegt; der Admin kann sie anlegen, umbenennen und deaktivieren.
status: draft
decision: accepted
generated: { by: claude-code/claude-opus-5-5, at: 2026-11-16T12:16:37+01:00 }
sources:
  - id: plan-entscheidungen
    resource: ../../PLAN.md
  - id: club
    resource: ../../src/config/club.ts
---

# Decision

Beim Einrichten stehen die Ligen U10, U12, U14, U16, U18 und Senioren bereit (`INITIAL_LEAGUES` in `src/config/club.ts`). Der Admin legt in den Einstellungen weitere an, benennt sie um oder deaktiviert sie.

Die erste Annahme in `PLAN.md` lautete U14 / U16 / U18 / Erwachsene / Senioren. Bei der Migration am 2026-11-16 auf den Stand im Code korrigiert.

# Why

Die Altersklassen des Vereins sind bekannt; ein leerer Start hätte den ersten Admin zu Pflichtarbeit gezwungen. Weil sich Klassen und Bezeichnungen ändern, bleiben sie trotzdem pflegbar.

# Rejected alternatives

Keine dokumentiert.

# Related

- [Qualifikation und Lizenz](/domain/qualifikation-und-lizenz.md)

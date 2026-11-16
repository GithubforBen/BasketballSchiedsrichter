---
type: Interface
title: CSV-Import und -Export des Spielplans
description: "Import: Datum;Zeit;Liga;Heim;Gast;Ort plus freiwillige Lizenz-Spalte. Export: dieselben sieben Spalten plus die Kürzel der vier Plätze."
status: draft
stale_after: 2027-02-14T12:16:42+01:00
generated: { by: claude-code/claude-opus-5-5, at: 2026-11-16T12:16:42+01:00 }
sources:
  - id: csv
    resource: ../../src/domain/csv.ts
  - id: csv-export
    resource: ../../src/domain/csv-export.ts
---

# Contract summary

- **Import**: Semikolon-getrennt, Kopfzeile, Spalten `Datum;Zeit;Liga;Heim;Gast;Ort`, optional als siebte `Lizenz` (leer = E). Duplikate werden über `(Datum, Zeit, Heim, Gast)` erkannt.
- **Export**: die ersten sieben Spalten Zeichen für Zeichen wie beim Import, dahinter die vier Plätze als Kürzel. Eine exportierte Datei lässt sich wieder einlesen.

# Consumers

Admins (Spiele anlegen, `/api/export`); Spielpläne des Verbands.

# Related

- [Lizenzen](/domain/lizenzen.md)
- [Kürzel](/domain/kuerzel.md)

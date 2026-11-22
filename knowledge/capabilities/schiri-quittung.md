---
type: Capability
title: Schiri-Quittung
description: "Jeder Schiri exportiert die Vereinsquittung über Schiedsrichtergebühren als PDF, vorausgefüllt mit Spiel, beiden Schiris und Beträgen."
status: draft
generated: { by: claude-code/claude-sonnet-5-5, at: 2026-11-22T14:16:26+01:00 }
sources:
  - id: design
    resource: ../../openspec/changes/schiri-quittung/design.md
  - id: receipt
    resource: ../../src/domain/receipt.ts
  - id: expenses
    resource: ../../src/server/expenses.ts
---

# Why

Der Verein stellt Schiedsrichtergebühren per Quittung ab (Vorlage 2015, bisher Excel). Jeder Schiri soll sie selbst exportieren können, ohne sie von Hand zu tippen.

# What

- Pro Spiel gibt es eine Quittung als PDF mit Liga, Heim gegen Gast, Datum, Halle und den Namen beider Schiris (Platz 1 und 2). Beide können dieselbe Quittung laden.
- Beträge: Fahrtkosten, Spielgebühr, Tagegeld, Sonstiges (mit kurzem Text bis 40 Zeichen) und Summen je Schiri und insgesamt. Leere Werte zählen als 0 und bleiben im PDF leer, Ort, Datum und Unterschriften auch.
- Jeder Schiri erfasst Fahrtart, Kilometer, Tagegeld und Sonstiges auf dem eigenen Einsatz ("Fahrt & Kosten" im Kalender); Admins dürfen das ebenfalls, in der Spielbearbeitung.
- "Quittungen für Zeitraum" im Profil liefert ein Sammel-PDF mit einer Seite je Spiel, Standard ist der letzte volle Monat.
- Abgesagte Spiele und Ersatzplätze bekommen keine Quittung; hat ein Spiel nur einen Schiri, bleibt die zweite Spalte leer.

Beträge und Regeln: [Fahrtkosten und Spielgebühren](/domain/fahrtkosten-und-gebuehren.md). Technik: [Quittung als PDF mit pdf-lib](/decisions/quittung-pdf-mit-pdf-lib.md).

# Offen

Die neuen Daten fehlen noch im Datenauszug und in der Datenschutzerklärung: [Quittungsdaten in Auskunft und Datenschutzerklärung](/commitments/quittungsdaten-auskunft-datenschutz.md). Ein Admin-Export für alle Schiris und eine Spielnummer auf der Quittung stehen im Backlog: [Admin-Export](/backlog/admin-export-schiri-quittungen.md), [Spielnummer](/backlog/spielnummer-fuer-quittung.md).

# Related

- [Datenbank-Schema](/architecture/datenbank.md)
- [Verarbeitete Daten](/architecture/verarbeitete-daten.md)

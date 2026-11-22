---
type: Business Rule
title: "Fahrtkosten und Spielgebühren"
description: "Fahrtkosten 0,30 €/km allein, 0,32 €/km mit Mitfahrer, mitgefahren 0 €; Gebühr je Liga; es gelten Satz und Gebühr zum Anpfiff."
status: draft
generated: { by: claude-code/claude-sonnet-5-5, at: 2026-11-22T14:16:27+01:00 }
sources:
  - id: receipt
    resource: ../../src/domain/receipt.ts
  - id: rates
    resource: ../../src/server/receipt-rates.ts
  - id: expenses
    resource: ../../src/server/expenses.ts
---

# Rule

- Fahrtkosten je Schiri: allein gefahren 0,30 €/km, mit Mitfahrer 0,32 €/km, mitgefahren 0 €. Der Schiri wählt die Fahrtart und trägt die Kilometer ein (ganzzahlig, 0 bis 2000).
- Die beiden Kilometersätze pflegen Admins in den Einstellungen; ohne gespeicherten Satz gelten 30 und 32 Cent.
- Die Spielgebühr gilt je Liga, ein Admin pflegt sie. Tagegeld und Sonstiges (optionaler Text bis 40 Zeichen) trägt der Schiri als Betrag ein.
- Es gelten Satz und Gebühr zum Anpfiff des Spiels. Spätere Änderungen verändern alte Quittungen nicht. Die erste Gebühr einer Liga gilt auch für frühere Spiele.
- Summen zählen alles zusammen; ein leerer Wert zählt als 0. Geld wird in ganzen Cent gespeichert und gerechnet.
- Eintragen und ändern dürfen der Schiri selbst und Admins, jederzeit, auch nach dem Spiel.

# Why

Die Quittung soll auch Monate später dieselben Beträge zeigen. Deshalb sind Sätze und Gebühren ein Verlauf mit "gilt ab" statt eines einzelnen Wertes (Tabellen `km_rates`, `league_fees`, siehe [Datenbank-Schema](/architecture/datenbank.md)). Die Kilometer liegen am Einsatz des jeweiligen Schiris, damit beide Werte auf der gemeinsamen Quittung erscheinen. Die Berechnung steckt als reine Funktion in `src/domain/receipt.ts`, die Auflösung der Sätze in `src/server/receipt-rates.ts`.

# Related

- [Schiri-Quittung](/capabilities/schiri-quittung.md)
- [Quittung als PDF mit pdf-lib](/decisions/quittung-pdf-mit-pdf-lib.md)

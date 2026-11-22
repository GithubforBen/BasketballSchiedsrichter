---
type: Decision
title: Quittung als PDF mit pdf-lib
description: "Quittung als serverseitiges PDF mit pdf-lib statt Druckansicht im Browser oder Ausfüllen der alten Excel-PDF."
status: draft
decision: accepted
change: 2026-11-22-schiri-quittung
generated: { by: claude-code/claude-sonnet-5-5, at: 2026-11-22T14:16:27+01:00 }
sources:
  - id: design
    resource: ../../openspec/changes/archive/2026-11-22-schiri-quittung/design.md
  - id: pdf
    resource: ../../src/server/receipt-pdf.ts
---

# Decision

Die Quittung entsteht auf dem Server als PDF mit `pdf-lib` (`src/server/receipt-pdf.ts`), eine A4-Seite je Spiel, Aufbau nach der Vorlage 2015. Kopf mit dem Vereinslogo "SC Bergstrasse Basketball", Standardschrift Helvetica, Logo als Base64-Konstante im Code. Die Daten kommen aus einer reinen Funktion (`ReceiptView`), so lassen sich Beträge ohne PDF und PDF ohne Datenbank testen. Zwei Download-Routen liefern eine Quittung bzw. das Sammel-PDF.

# Why

Auf dem Handy ist "Druckansicht als PDF speichern" umständlich; der Schiri soll direkt eine Datei bekommen. Helvetica deckt ä, ö, ü, ß und € ab, daher keine Schrift einbetten; nicht darstellbare Zeichen in Teamnamen werden auf ASCII abgebildet. Das Logo als Konstante vermeidet Dateizugriffe, die im Docker-Standalone-Build fragil sind.

# Rejected alternatives

- Druckansicht im Browser: vom Nutzer abgelehnt, siehe oben.
- Die alte PDF ausfüllen: die Vorlage ist eine Excel-Umwandlung ohne Formularfelder, das Logo sitzt falsch.

# Related

- [Schiri-Quittung](/capabilities/schiri-quittung.md)
- [Fahrtkosten und Spielgebühren](/domain/fahrtkosten-und-gebuehren.md)
- [Next.js mit App Router](/decisions/framework-nextjs.md)

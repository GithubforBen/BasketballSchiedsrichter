---
type: Business Rule
title: "Pflichtbestätigung vor dem Spiel"
description: "Schiedsrichter (nicht Ersatz) bestätigen ihren Einsatz vorab; ohne Antwort nach 24 Stunden folgen Erinnerung und Meldung an die Admins."
status: draft
generated: { by: claude-code/claude-opus-5-5, at: 2026-11-16T12:16:37+01:00 }
sources:
  - id: plan-regeln
    resource: ../../PLAN.md
  - id: confirmation
    resource: ../../src/domain/confirmation.ts
---

# Rule

Regeln 10–12:

- Vor dem Spiel bekommt jeder auf einem **Schiedsrichterplatz** eine Bitte um Bestätigung („Ja, habe ich gelesen und mache es"). Der Vorlauf ist wählbar: 24, 48, 72 oder 96 Stunden vor Anpfiff, Standard 72.
- Bleibt die Antwort **24 Stunden** aus, kommt eine zweite Erinnerung an die Person **und** eine Meldung an alle Admins.
- Ersatzplätze brauchen keine Bestätigung.
- Bestätigt wird über einen eindeutigen Antwortlink, siehe [Nachrichten-Wortlaut](/domain/nachrichten-wortlaut.md).

# Why

Eintragungen liegen oft Wochen zurück. Die Bestätigung holt die Zusage kurz vor dem Spiel ins Bewusstsein und gibt den Admins rechtzeitig ein Signal, wenn jemand nicht reagiert.

# Related

- [Pflichtbestätigung (Begriff)](/domain/pflichtbestaetigung-begriff.md)
- [Persönliche Erinnerungen](/domain/persoenliche-erinnerungen.md)

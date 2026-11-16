---
type: Interface
title: "Kalenderdatei der eigenen Einsätze (ICS)"
description: Eigener Einsatzplan als iCalendar-Datei zum Import; stabile UIDs, keine eigenen Erinnerungen (VALARM).
status: draft
stale_after: 2027-02-14T12:16:42+01:00
generated: { by: claude-code/claude-opus-5-5, at: 2026-11-16T12:16:42+01:00 }
sources:
  - id: ics
    resource: ../../src/domain/ics.ts
---

# Contract summary

iCalendar (RFC 5545) mit den eigenen Einsätzen. Importiert, nicht abonniert; ein erneuter Download trägt dieselben `UID`s, damit Kalender aktualisieren statt doppeln. Bewusst ohne `VALARM`, weil die App selbst erinnert.

# Consumers

Google und Apple Kalender der Schiedsrichter.

# Related

- [Persönliche Erinnerungen](/domain/persoenliche-erinnerungen.md)

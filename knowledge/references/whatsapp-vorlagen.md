---
type: Reference
title: "WhatsApp-Vorlagen und Metas Regeln dafür"
description: "Die zwölf Vorlagen von Schiriplan, wann welche rausgeht, ihre Kategorien und was Meta bei Vorlagen und dynamischen Knöpfen verlangt."
status: draft
generated: { by: claude-code/claude-opus-5-5, at: 2026-11-16T12:16:43+01:00 }
sources:
  - id: whatsapp-vorlagen
    resource: ../../docs/whatsapp-vorlagen.md
  - id: templates
    resource: ../../src/notifications/templates.ts
stale_after: 2027-05-16T12:00:00+02:00
---

# Summary

Außerhalb des 24-Stunden-Fensters erlaubt Meta nur freigegebene Vorlagen; für einen Verein heißt das: jede Nachricht ist eine Vorlage. Eine freigegebene Vorlage ist nur noch ersetzbar bzw. geht nach einer Änderung erneut in die Prüfung.

**Kategorien**: UTILITY (fast alles, günstigste), AUTHENTICATION (nur `schiriplan_anmeldung`, fester Aufbau), MARKETING (wird nicht verwendet, teuerste). `schiriplan_platz_frei` trägt ein Umkategorisierungs-Risiko.

**Die zwölf Vorlagen**: `schiriplan_anmeldung` (nur bei `LOGIN_MAGIC_LINK=an`), `_einsatz_steht` (Quittung), `_bestaetigung_erbeten`, `_bestaetigung_offen`, `_nachruecken`, `_platz_frei`, `_platz_frei_admin`, `_termin_geaendert` (Verschiebung), `_spiel_abgesagt`, `_erinnerung` (persönliche Erinnerung), `_meldung` und `_tagesuebersicht` (nur Admins).

**Dynamische Knöpfe**: genau eine Variable je Knopf und nur am Ende der Adresse — deshalb steht der Antwort-Token im Pfad. Beispielwerte müssen glaubwürdig sein, „test" wird abgelehnt.

Wortlaut, Beispielwerte und Anleitung im Detail: `docs/whatsapp-vorlagen.md`.

# Related

- [WhatsApp-Vorlagen anlegen](/runbooks/whatsapp-vorlagen-anlegen.md)
- [Nachrichten-Wortlaut](/domain/nachrichten-wortlaut.md)

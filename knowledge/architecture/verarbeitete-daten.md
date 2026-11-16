---
type: Data Flow
title: Verarbeitete personenbezogene Daten und ihre Wege
description: "Welche Tabelle welche personenbezogenen Daten hält, wie lange, und wer außerhalb des Vereins etwas bekommt (Meta, Cloudflare, SMTP)."
status: draft
generated: { by: claude-code/claude-opus-5-5, at: 2026-11-16T12:16:42+01:00 }
sources:
  - id: verarbeitete-daten
    resource: ../../docs/verarbeitete-daten.md
  - id: schema
    resource: ../../src/db/schema.ts
---

# Flow

Das vollständige Verzeichnis (Art. 30 DSGVO) steht in `docs/verarbeitete-daten.md` und wird zusammen mit `src/db/schema.ts` geändert. Kurzfassung:

| Tabelle | Personenbezug | Aufbewahrung |
| --- | --- | --- |
| `referees` | Stammdaten (Name, Vorname, Kürzel, Telefon, Lizenz, Passwort-Hash) | solange das Konto besteht |
| `qualifications`, `assignments`, `promotion_offers`, `admin_recovery_tokens` | mittelbar | solange das Konto besteht |
| `login_tokens` | mittelbar | 7 Tage |
| `notification_outbox` | Wortlaut und Anrede | 90 Tage |
| `audit_log` | mittelbar | 400 Tage |
| `rate_limits` | Telefonnummer / IP | 2 Tage |
| `games`, `leagues`, `settings` | keiner | dauerhaft |

Beim Löschen eines Kontos räumen die Fremdschlüssel alles ab (`ON DELETE CASCADE`); im Prüfprotokoll bleibt der Vorgang ohne Personenbezug (`SET NULL`).

Nach außen: Meta bekommt Telefonnummer und Nachrichteninhalt (bei `NOTIFICATION_CHANNEL=whatsapp`), Cloudflare IP und Verbindungsdaten bei jedem Aufruf, ein SMTP-Anbieter nur beim E-Mail-Kanal.

# Related

- [Datenschutzerklärung](/references/datenschutzerklaerung.md)
- [Sichtbarkeit](/domain/sichtbarkeit.md)

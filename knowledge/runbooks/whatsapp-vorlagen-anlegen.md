---
type: Runbook
title: "WhatsApp-Vorlagen bei Meta anlegen und prüfen"
description: Vorlagen bei Meta unter den exakten Namen anlegen, Bestand abgleichen, kaputte Knopf-Adressen reparieren und alle Vorlagen testen.
status: draft
stale_after: 2027-02-14T12:16:42+01:00
generated: { by: claude-code/claude-opus-5-5, at: 2026-11-16T12:16:42+01:00 }
sources:
  - id: whatsapp-vorlagen
    resource: ../../docs/whatsapp-vorlagen.md
  - id: todo
    resource: ../../TODO.md
---

# When to use

Wenn eine Vorlage neu dazukommt, bei Meta fehlt (Fehler 132001 „template name does not exist") oder ein Antwortknopf ins Leere führt.

# Steps

1. Wortlaut, Kategorie, Beispielwerte und Knopf je Vorlage aus `docs/whatsapp-vorlagen.md` nehmen. Name und Sprache `de` müssen exakt stimmen (`TEMPLATE_LANGUAGE` in `src/notifications/templates.ts`).
2. Bestand abgleichen und fehlende anlegen (ohne `--anlegen` ein Trockenlauf; die WABA-ID steht im WhatsApp Manager unter Kontoinformationen):
   `set -a; . ./.env; set +a`
   `npx tsx --tsconfig tsconfig.skripte.json src/cli/vorlagen-anlegen.ts <waba-id> [--anlegen]`
3. Knopf-Adressen prüfen: `src/cli/vorlagen-reparieren.ts <waba-id>` (mit `--reparieren` reicht es die Korrektur ein). Typischer Fehler: `{{1}}` als Text **und** als Variable in der Adresse.
4. Testversand je Vorlage an eine eigene Nummer: `src/cli/vorlagen-test.ts <telefon>`. Geht bewusst nicht durch die Outbox.

# Verify

Der Testversand meldet 12 von 12 zugestellt und keinen Fehler 132000 (falsche Anzahl Werte).

# Related

- [WhatsApp-Vorlagen](/references/whatsapp-vorlagen.md)
- [Betriebsskripte](/architecture/cli.md)

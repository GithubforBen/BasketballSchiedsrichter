# Offene Punkte

Stand: 16. November 2026. Die abgeschlossenen Meilensteine stehen in `PLAN.md`, das Wissen zu
Regeln und Entscheidungen in `knowledge/`.

Erledigt seit dem 7. September und deshalb hier entfernt (Verlauf in git):

- Cloudflare-Tunnel — läuft auf dem eigenen Server (`tunnel`-Dienst in `docker-compose.yml`).
- Zeitgeber — der `cron`-Dienst in `docker-compose.yml` ruft alle fünf Minuten `POST /api/cron`
  im internen Netz auf und kommt nach einem Neustart von selbst wieder hoch.
- `PUBLIC_BASE_URL` — hängt nicht mehr an der LAN-Adresse eines Test-Laptops.
- Vorlagen-Test und Nachrichten-Protokoll.

## 1. Zwei WhatsApp-Vorlagen — bei Meta freigegeben?

Ungeklärt. Am 7. September fehlten drei Vorlagen bei Meta (Code 132001, „template name does not
exist in de"). Zwei davon verschickt der Code weiterhin:

| Vorlage | Wann | Folge, wenn sie fehlt |
| --- | --- | --- |
| `schiriplan_termin_geaendert` | Admin verschiebt ein Spiel (`src/server/admin/games.ts`) | Eine Verschiebung erreicht niemanden. |
| `schiriplan_erinnerung` | jede persönliche Erinnerung (`src/domain/scheduler.ts`) | Regel 21 fällt aus. |

Die dritte, `schiriplan_anmeldung`, wird nur gebraucht, wenn `LOGIN_MAGIC_LINK=an` gesetzt wird.

Prüfen mit dem Testversand, danach fehlende anlegen (ohne `--anlegen` ein Trockenlauf; die
WABA-ID steht im WhatsApp Manager unter Kontoinformationen):

```
set -a; . ./.env; set +a
npx tsx --tsconfig tsconfig.skripte.json src/cli/vorlagen-test.ts <eigene Telefonnummer>
npx tsx --tsconfig tsconfig.skripte.json src/cli/vorlagen-anlegen.ts <waba-id> [--anlegen]
```

Wortlaut und Kategorie jeder Vorlage: `docs/whatsapp-vorlagen.md`. Der Code fordert alle
Vorlagen in der Sprache `de` an (`TEMPLATE_LANGUAGE` in `src/notifications/templates.ts`); sind
sie bei Meta als `de_DE` angelegt, findet die Cloud API sie nicht.

Wissen dazu: `knowledge/backlog/whatsapp-vorlagen-bei-meta-pruefen.md`.

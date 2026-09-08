# Offene Punkte

Stand: 7. September 2026. Was aus dem laufenden Test noch aussteht — die
abgeschlossenen Meilensteine stehen in `PLAN.md`.

## 1. Cloudflare-Tunnel läuft nicht — Port 7844 ist im Netz gesperrt

`cloudflared` läuft als Prozess, hat aber **null Verbindungen zur Cloudflare-Edge**
(`/ready` meldet dauerhaft `{"status":503,"readyConnections":0}`). Beide Wege sind dicht:

```
UDP Connectivity  region1.v2.argotunnel.com  FAIL  QUIC connection failed
TCP Connectivity  region1.v2.argotunnel.com  FAIL  HTTP/2 connection is blocked
ERR TLS handshake with edge error: read tcp 172.29.161.134:39750->198.41.192.77:7844: i/o timeout
```

Der TCP-Verbindungsaufbau gelingt noch — deshalb meldet ein `nc -z` fälschlich Erfolg —,
aber der TLS-Handshake läuft in eine Zeitüberschreitung: das Netz verwirft die Nutzdaten auf
Port 7844 stillschweigend. `--protocol http2` ändert nichts, der Weg ist derselbe Port.
Getestet gegen zwei verschiedene Edge-Adressen, beide Regionen.

**Das liegt nicht an der Konfiguration des Tunnels.** Der Token ist gültig, die Cloudflare-API
ist erreichbar, die DNS-Auflösung geht durch. Es ist das WLAN (`172.29.161.134`, Gateway
`172.29.255.254`) — vermutlich ein Gast- oder Mobilfunknetz, das alles außer 80/443 filtert.

Wege weiter, in dieser Reihenfolge:

1. **Anderes Netz** — Handy-Hotspot oder ein WLAN ohne Portfilter. Danach kommt der Tunnel
   ohne weitere Änderung hoch.
2. **Ohne Tunnel testen** — hängt das Handy im selben WLAN, genügt `http://172.29.161.134:3000`.
   Das läuft jetzt schon.
3. **Lokale Firewall ausschließen** — `sudo ufw status` und `sudo nft list ruleset`. Konnte ich
   ohne Passwort nicht prüfen; die Symptome sprechen aber für das Netz, nicht für den Rechner.

## 2. Drei WhatsApp-Vorlagen fehlen bei Meta

Vollstaendiger Vorlagen-Test am 7.9.: **9 von 12 zugestellt, 3 abgelehnt** mit Code 132001
("template name does not exist in de").

| Vorlage | Nachrichtenart | Folge |
| --- | --- | --- |
| `schiriplan_termin_geaendert` | `relocation` (verlegt) | Eine Verschiebung erreicht niemanden. |
| `schiriplan_erinnerung` | `personal-reminder` | Regel 21 faellt aus, keine Erinnerung vor Anpfiff. |
| `schiriplan_anmeldung` | `login` | **Niemand kann sich per WhatsApp anmelden** — der Code kommt nicht an. |

`schiriplan_anmeldung` ist der dringendste der drei: ohne ihn ist der Zugang zur Anwendung
ueber WhatsApp zu. Sie ist die einzige AUTHENTICATION-Vorlage und traegt nur den Code, keinen
Link.

Der Code fordert alle Vorlagen in der Sprache `de` an (`TEMPLATE_LANGUAGE` in
`src/notifications/templates.ts:41`). Sind sie bei Meta als `de_DE` angelegt, findet die Cloud
API sie nicht — das ist die wahrscheinlichste Ursache, weil die anderen neun unter demselben
Kuerzel durchgehen. Wortlaut und Kategorie jeder Vorlage stehen in `docs/whatsapp-vorlagen.md`.

Diese neun sind geprueft und funktionieren:

`schiriplan_einsatz_steht` · `schiriplan_bestaetigung_erbeten` ·
`schiriplan_bestaetigung_offen` · `schiriplan_nachruecken` · `schiriplan_platz_frei` ·
`schiriplan_platz_frei_admin` · `schiriplan_meldung` · `schiriplan_tagesuebersicht` ·
`schiriplan_spiel_abgesagt`

## 3. Die drei fehlenden Vorlagen anlegen — fehlt nur die WABA-ID

`src/cli/vorlagen-anlegen.ts` liest den Bestand bei Meta
(`GET /{waba-id}/message_templates`), schreibt ihn nach `docs/whatsapp-vorlagen.json` und legt
danach genau die drei fehlenden an. Ohne `--anlegen` ist es ein Trockenlauf und schickt nichts:

```
set -a; . ./.env; set +a
npx tsx --tsconfig tsconfig.skripte.json src/cli/vorlagen-anlegen.ts <waba-id>
npx tsx --tsconfig tsconfig.skripte.json src/cli/vorlagen-anlegen.ts <waba-id> --anlegen
```

Der Trockenlauf ist die Vorgabe, weil eine freigegebene Vorlage bei Meta nicht mehr aenderbar
ist, sondern nur ersetzbar.

**Es fehlt allein die WABA-ID.** Aus dem Token ist sie nicht zu ermitteln:
`whatsapp_business_account` gibt es als Feld auf der Telefonnummer in keiner API-Version
(v17 bis v23 geprueft), und `me/businesses`, `assigned_whatsapp_business_accounts` sowie
`assigned_business_asset_groups` liefern fuer einen System-User `{"data":[]}`. Sie steht im
WhatsApp Manager unter Kontoinformationen.

Die Knopf-Adressen erfindet das Skript nicht: es liest den Domainnamen aus einer bereits
freigegebenen Vorlage, damit die neuen auf dieselbe Adresse zeigen wie die neun alten.
Deshalb haengt dieser Punkt **nicht** am Tunnel aus Punkt 1.

## 3b. Vorlagen-Test — erledigt

`src/cli/vorlagen-test.ts` schickt je eine Nachricht pro Vorlage:

```
set -a; . ./.env; set +a
npx tsx --tsconfig tsconfig.skripte.json src/cli/vorlagen-test.ts +4915226693501
```

**Kein einziger Fehler 132000** — die Werte-Anzahl stimmt bei allen neun freigegebenen Vorlagen
mit dem Code ueberein. Nach dem Anlegen der drei fehlenden noch einmal laufen lassen; dann
muessen zwoelf von zwoelf durchgehen.

## 3c. Nachrichten-Protokoll — gebaut, füllt sich ab dem nächsten Versand

Jede Nachricht wird beim Versand im Wortlaut festgehalten (Migration 0010, drei neue Spalten an
`notification_outbox`). Zu sehen unter **Verwaltung → Nachrichten-Protokoll** (`/nachrichten`,
nur für Admins).

Die zehn Zeilen, die vor dieser Änderung verschickt wurden, tragen **keinen** Text — der war
damals nirgends gespeichert und lässt sich nicht nachträglich gewinnen. Sie stehen mit dem
Hinweis „kein Text festgehalten" in der Liste. Ab dem nächsten Versand ist der Wortlaut da.

Die zwölf Nachrichten des Vorlagen-Tests (Punkt 3b) tauchen **nicht** auf: `vorlagen-test.ts`
geht absichtlich direkt an den Kanal und nicht durch die Outbox — es prüft die Vorlagen, es
soll keine Spuren im Betrieb hinterlassen.

## 4. Zeitgeber läuft nur, solange die Sitzung lebt

Die Outbox wird ausschließlich von `POST /api/cron` geleert
(`src/app/api/cron/route.ts`). Ohne Aufrufer bleiben Nachrichten liegen — genau das war der
Grund, warum am 6./7.9. sieben Nachrichten unversandt mit `attempts = 0` warteten.

Zurzeit ruft ein Hintergrundskript den Endpunkt **jede Minute** auf. Es endet mit der Sitzung.
Für dauerhaft: ein systemd-User-Timer mit demselben `curl`-Aufruf.

## 5. `PUBLIC_BASE_URL` hängt am Netz

Die Adresse in `.env` muss auf die **aktuelle** LAN-Adresse zeigen, sonst gehen die Links in
den Nachrichten ins Leere. Sie wechselt mit dem Netz (`192.168.0.104` am 6.9.,
`172.29.161.134` am 7.9.). Prüfen mit `ip route get 1.1.1.1`.

Solange die Basisadresse `http://` ist, sind die Sitzungs-Cookies nicht `secure`.

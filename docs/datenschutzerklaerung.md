# Datenschutzerklärung (Muster)

> **Entwurf — vor dem Echtbetrieb juristisch prüfen lassen.**
>
> Dieser Text beschreibt, was SCHIRIPLAN tatsächlich tut: er ist aus dem Code
> abgeleitet (Schema, `src/server/aufbewahrung.ts`, `src/notifications/channel.ts`,
> `src/server/auskunft.ts`) und nicht aus einer Vorlage abgeschrieben. Er ersetzt
> aber keine Rechtsberatung. Nach der Prüfung `reviewed` in `src/config/legal.ts`
> auf `true` setzen — dann verschwindet der Entwurfshinweis auch in der App.
>
> Die vollständige Liste der verarbeiteten Felder steht in
> [`verarbeitete-daten.md`](verarbeitete-daten.md).

Die Angaben zum Verein — Anschrift, Vertretung, E-Mail, Registergericht,
Aufsichtsbehörde und Kontakt für Betroffenenrechte — stehen in
`src/config/legal.ts` und erscheinen von dort auf der Seite `/impressum`.

**Noch auszufüllen** — überall dort, wo `AUSFÜLLEN:` steht. Offen ist zurzeit
nur der Anbieter des Servers (Abschnitt 6).

---

## 1. Verantwortlicher

Verantwortlich für die Verarbeitung personenbezogener Daten in dieser Anwendung ist:

Schulsportclub Bergstraße e.V., Abteilung Basketball
Pfungstädter Str. 6
64404 Bickenbach

Vertreten durch:
Michael Dieter (1. Vorsitzender)
Matthias Karch (2. Vorsitzender)
E-Mail: info@sc-bergstrasse.net
Registergericht: Amtsgericht Darmstadt, VR 1774
Inhaltlich Verantwortliche gemäß § 18 Abs. 2 MStV: Linda Schnorrenberger

Eine eigene Datenschutzbeauftragte ist nicht bestellt; die Voraussetzungen des
§ 38 BDSG liegen nicht vor. Anfragen zum Datenschutz nimmt der Vorstand
entgegen.

## 2. Wozu es diese Anwendung gibt

Die Anwendung dient ausschließlich der vereinsinternen Organisation und Planung von Schiedsrichtereinsätzen.

Über die Anwendung werden insbesondere Schiedsrichter für Spiele eingeteilt, Einsätze verwaltet und Erinnerungen bzw. organisatorische Nachrichten an Schiedsrichter und Administratoren versendet.

Die Anwendung wird ausschließlich für die interne Vereinsorganisation verwendet und nicht öffentlich angeboten oder an andere Vereine weitergegeben.

## 3. Welche Daten wir verarbeiten

Rechtsgrundlage ist insbesondere Art. 6 Abs. 1 lit. f DSGVO (berechtigtes Interesse).

Das berechtigte Interesse des Vereins besteht darin, den Spielbetrieb zu organisieren, Schiedsrichter einzuteilen, die Durchführung der Spiele sicherzustellen und die hierfür erforderliche Kommunikation mit den Schiedsrichtern zu ermöglichen.

### 3.1 Stammdaten

Name, Vorname, Kürzel, Telefonnummer, Schiedsrichter-Lizenz (E, D oder C),
Qualifikationen für einzelne Ligen, Rolle (Schiedsrichter oder Admin) sowie der
Zustand des Kontos (aktiv oder stillgelegt).

- **Zweck:** Besetzung der Spiele, Kontaktaufnahme, Abrechnung der Einsätze.
- **Rechtsgrundlage:** Art. 6 Abs. 1 lit. b DSGVO — die Verarbeitung erfolgt zur
  Durchführung des Mitgliedschaftsverhältnisses.

### 3.2 Einsatzdaten

Zusätzlich werden im Zusammenhang mit den Schiedsrichtereinsätzen folgende Daten verarbeitet:

Eintragungen auf Schiedsrichter- und Ersatzplätze, Zeitpunkt der Eintragung,
Bestätigungen, Rückmeldungen zu verlegten Spielen, Name des eingeteilten Schiedsrichters, Heim- und Gastmannschaft, Datum und Uhrzeit des Spiels, Spielort, Liga, Zuordnung des Schiedsrichters zum jeweiligen Spiel

- **Zweck:** Planung der Besetzung, Nachweis der geleisteten Einsätze.
- **Rechtsgrundlage:** Art. 6 Abs. 1 lit. b DSGVO.

### 3.3 Anmeldung und Kontosicherheit

Gespeichert werden: das Passwort ausschließlich als Hash (scrypt, mit einem
Zufallssalz je Konto — das Passwort selbst wird nie gespeichert und lässt sich
aus dem Hash nicht zurückrechnen), der Zeitpunkt der letzten eigenen
Passwortsetzung, die Frist des Start-Passworts, ein Zähler zum Zurückrufen
offener Sitzungen sowie die Anmeldeversuche.

Zum Schutz vor missbräuchlichem Durchprobieren werden Zähler geführt. Diese
Zähler enthalten die Telefonnummer beziehungsweise die IP-Adresse des
Anmeldeversuchs.

- **Zweck:** Zugangsschutz, Abwehr von Angriffen auf Konten.
- **Rechtsgrundlage:** Art. 6 Abs. 1 lit. f DSGVO — berechtigtes Interesse an
  einem sicheren Zugang. Ohne diese Begrenzung ließe sich das aus dem Namen
  gebildete Start-Passwort durchprobieren.

### 3.4 Nachrichten

Jede versandte Nachricht wird mit Empfänger, Art, Kanal, Zeitpunkt, Zustand und
**Wortlaut** gespeichert.

- **Zweck:** Nachweis, was wann an wen hinausging — damit sich der Einwand „ich
  habe nie eine Nachricht bekommen“ beantworten lässt; außerdem verhindert der
  gespeicherte Zustand, dass dieselbe Nachricht doppelt verschickt wird.
- **Rechtsgrundlage:** Art. 6 Abs. 1 lit. b und lit. f DSGVO.

### 3.5 Protokoll der Verwaltungsvorgänge

Änderungen, die ein Admin vornimmt — Konto angelegt, Passwort zurückgesetzt,
Person eingeteilt, Spiel verlegt oder abgesagt —, werden mit handelnder Person,
betroffener Person, Vorgang und Zeitpunkt festgehalten. Das Protokoll enthält
**niemals** Passwörter.

- **Zweck:** Nachvollziehbarkeit innerhalb einer Saison.
- **Rechtsgrundlage:** Art. 6 Abs. 1 lit. f DSGVO.

## 4. Was öffentlich sichtbar ist

Der Spielplan ist ohne Anmeldung abrufbar. Von den eingeteilten Personen
erscheint dort **ausschließlich das Kürzel** — kein Name, kein Vorname, keine
Telefonnummer, keine Lizenz.

Das ist keine Frage der Anzeige, sondern der Auslieferung: Daten, die ohne
Anmeldung nicht sichtbar sein sollen, verlassen den Server auch nicht. Sie
stecken nicht versteckt im ausgelieferten HTML.

Name und weitere Angaben sind erst nach der Anmeldung sichtbar, und auch dann
nur innerhalb der Abteilung.

## 5. Nachrichtenversand über WhatsApp

Nachrichten werden über die WhatsApp Cloud API der **Meta Platforms Ireland
Limited**, Merrion Road, Dublin 4, D04 X2K5, Irland, versandt.

Dabei werden die **Telefonnummer** der Empfängerin oder des Empfängers und der
**Inhalt der Nachricht** an Meta übermittelt. Ohne die Telefonnummer ist keine
Nachricht zustellbar. Meta kann personenbezogene Daten auch außerhalb der
Europäischen Union verarbeiten; Meta stützt solche Übermittlungen nach eigenen
Angaben auf Standardvertragsklauseln beziehungsweise das EU-US Data Privacy
Framework.

- **Rechtsgrundlage:** Art. 6 Abs. 1 lit. b DSGVO für die zur Planung
  erforderlichen Nachrichten.
- **Widerspruch:** Wer keine Nachrichten über WhatsApp erhalten möchte, sagt
  einem Admin der Abteilung Bescheid. Der Spielplan und alle Funktionen der
  Anwendung bleiben auch ohne Nachrichten vollständig nutzbar; Termine sind dann
  selbst im Kalender nachzusehen.

## 6. Hosting und Auslieferung

Die Anwendung läuft auf einem Server unter der Verantwortung des Vereins. Der
Zugriff aus dem Internet erfolgt über einen Tunnel der **Cloudflare, Inc.**,
101 Townsend St., San Francisco, CA 94107, USA, beziehungsweise der Cloudflare
Germany GmbH.

Cloudflare verarbeitet dabei die IP-Adresse der Besucherin oder des Besuchers
und die technischen Daten des Verbindungsaufbaus. Die Anwendung selbst wertet
die IP-Adresse ausschließlich zur Begrenzung von Anmeldeversuchen aus
(siehe 3.3) und schreibt keine Zugriffsprotokolle mit IP-Adressen.

- **Rechtsgrundlage:** Art. 6 Abs. 1 lit. f DSGVO — berechtigtes Interesse an
  einem erreichbaren und gegen Überlastung geschützten Betrieb.

AUSFÜLLEN: Anbieter des Servers (Hoster) benennen und Auftragsverarbeitungs-
verträge nach Art. 28 DSGVO mit Hoster und Cloudflare schließen.

## 7. Cookies

Gesetzt wird ein einziges Cookie:

| Name                 | Zweck                        | Laufzeit |
| -------------------- | ---------------------------- | -------- |
| `schiriplan_session` | Hält die Anmeldung aufrecht  | 30 Tage  |

Das Cookie ist technisch notwendig; ohne es wäre eine Anmeldung nicht möglich.
Es ist signiert und lässt sich nicht fälschen, ist für Skripte im Browser nicht
lesbar (`HttpOnly`) und wird nicht an fremde Seiten mitgeschickt
(`SameSite=Lax`). Es enthält die Kennung des Kontos, die Rolle und einen
Gültigkeitsstand — keinen Namen und keine Telefonnummer.

Eine Einwilligung ist dafür nicht erforderlich (§ 25 Abs. 2 Nr. 2 TDDDG). Ein
Cookie-Banner gibt es deshalb nicht.

## 8. Keine Analyse, keine Werbung, keine externen Inhalte

Beim Aufruf der Seiten werden **keine** Daten an Dritte übermittelt:

- keine Analyse- oder Statistikwerkzeuge,
- keine Werbenetzwerke,
- keine externen Schriftdienste — Schriften liegen auf diesem Server,
- keine eingebetteten Karten, Videos oder sozialen Schaltflächen,
- keine Profilbildung, kein automatisiertes Entscheiden im Sinne des Art. 22
  DSGVO.

## 9. Wie lange wir Daten aufbewahren

| Daten                                        | Aufbewahrung             |
| -------------------------------------------- | ------------------------ |
| Anmeldelinks und -codes                      | 7 Tage                   |
| Zähler zum Schutz vor Missbrauch (mit IP)    | 2 Tage                   |
| Versandte Nachrichten samt Wortlaut          | 90 Tage                  |
| Protokoll der Admin-Änderungen               | 400 Tage (eine Saison)   |
| Stammdaten, Eintragungen, Einsatzzahlen      | solange das Konto besteht |

Die Fristen werden von einem regelmäßigen Lauf durchgesetzt.

Wird ein Konto gelöscht, verschwinden alle zugehörigen Daten vollständig, auch
die vergangenen Einsätze und damit die Einsatzstatistik dieser Person. Wer
lediglich aufhört, dessen Zahlen aber erhalten bleiben sollen, wird stattdessen
**stillgelegt**.

## 10. Empfänger

Innerhalb des Vereins haben Zugriff:

- **Admins der Abteilung** — auf alle Daten, soweit für die Planung erforderlich.
- **Angemeldete Schiedsrichterinnen und Schiedsrichter** — auf Namen und Kürzel
  der übrigen Eingeteilten sowie auf die eigenen Daten vollständig.
- **Nicht angemeldete Besucher** — ausschließlich auf Kürzel (siehe 4.).

Außerhalb des Vereins: die unter 5. und 6. genannten Dienstleister. Eine
Weitergabe zu anderen Zwecken, insbesondere ein Verkauf von Daten, findet nicht
statt.

## 11. Deine Rechte

- **Auskunft (Art. 15 DSGVO):** Angemeldet lädst du unter „Profil &
  Erinnerungen“ jederzeit selbst einen vollständigen Auszug aller zu dir
  gespeicherten Daten herunter — auch der technischen Einträge. Dafür musst du
  niemanden fragen.
- **Berichtigung (Art. 16 DSGVO):** Name, Kürzel, Telefonnummer, Lizenz und
  Qualifikationen ändert ein Admin der Abteilung.
- **Löschung (Art. 17 DSGVO):** Auf Wunsch wird das Konto samt allen Daten
  entfernt.
- **Einschränkung der Verarbeitung (Art. 18 DSGVO).**
- **Datenübertragbarkeit (Art. 20 DSGVO):** Der Auszug unter „Profil &
  Erinnerungen“ dient zugleich diesem Zweck.
- **Widerspruch (Art. 21 DSGVO):** Gegen Verarbeitungen, die auf Art. 6 Abs. 1
  lit. f DSGVO gestützt sind, kannst du jederzeit Widerspruch einlegen.

Anfragen richtest du an den Vorstand; die Kontaktdaten stehen unter 1.

## 12. Beschwerderecht

Unabhängig davon steht dir ein Beschwerderecht bei einer Aufsichtsbehörde für
den Datenschutz zu (Art. 77 DSGVO).

Zuständige Aufsichtsbehörde: Der Hessische Beauftragte für Datenschutz und
Informationsfreiheit, Postfach 3163, 65021 Wiesbaden.

## 13. Datensicherheit

Der Verein trifft angemessene technische und organisatorische Maßnahmen, um die personenbezogenen Daten vor Verlust, Zerstörung, Manipulation sowie vor unberechtigtem Zugriff zu schützen.

Der Zugang zur Anwendung ist auf berechtigte Benutzer beschränkt und erfolgt über persönliche Benutzerkonten.

Die Anforderungen an die Sicherheit der Verarbeitung richten sich insbesondere nach Art. 32 DSGVO.

## 14. Keine öffentliche Plattform

Die Anwendung ist ausschließlich für die interne Organisation des Vereins bestimmt. Sie bietet insbesondere keine öffentliche Kommentarfunktion, Chatfunktion oder Möglichkeit zur Veröffentlichung eigener Inhalte.

Die Anwendung ist daher nach der derzeitigen Einordnung keine öffentliche Online-Plattform im Sinne des Digital Services Act (DSA).

## 15. Änderungen dieser Erklärung

Diese Erklärung wird angepasst, sobald sich die Verarbeitung ändert. Maßgeblich
ist die jeweils in der Anwendung veröffentlichte Fassung.

## 16. Kontakt

Bei Fragen zur Verarbeitung personenbezogener Daten oder zur Wahrnehmung der Betroffenenrechte kann sich die betroffene Person an den Verantwortlichen wenden:

Linda Schnorrenberger
medienwart.bb.scb@gmail.com

Stand: 09.09.2026

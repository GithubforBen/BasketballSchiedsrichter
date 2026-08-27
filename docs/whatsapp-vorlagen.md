# WhatsApp-Vorlagen bei Meta anlegen

Diese Datei ist die Vorlage für die Vorlagen: welche Sie anlegen müssen, mit welchem Text, in
welcher Kategorie, wann und an wen sie rausgehen — und was der Code dafür noch braucht.

> **Zuerst das Unangenehme:** Der Kanal in `src/notifications/channel.ts` verschickt heute
> **freien Text** (`type: 'text'`). Das funktioniert nur innerhalb des 24-Stunden-Fensters,
> also nur, wenn die Person in den letzten 24 Stunden selbst an die Vereinsnummer geschrieben
> hat. Bei einer Erinnerung um 7 Uhr für ein Spiel um 10:30 ist das praktisch nie der Fall.
> **Ohne Vorlagen-Versand im Code nützen die freigegebenen Vorlagen nichts.** Siehe unten,
> Abschnitt „Was der Code noch braucht".

---

## Warum überhaupt Vorlagen

Meta unterscheidet zwei Fälle:

| Fall | Was erlaubt ist |
| --- | --- |
| Die Person hat **in den letzten 24 Stunden** an Ihre Nummer geschrieben | beliebiger freier Text |
| Sonst — also fast immer | **nur** eine vorab freigegebene Vorlage |

Für Schiriplan heißt das: **jede** Nachricht braucht eine Vorlage. Das Fenster steht bei einem
Verein so gut wie nie offen.

## Kategorien — und warum sie Geld kosten

Beim Anlegen wählen Sie eine Kategorie. Sie entscheidet über den Preis und über die Strenge der
Prüfung:

- **UTILITY** — Nachrichten zu einem Vorgang, den die Person kennt und erwartet: Bestätigung,
  Erinnerung, Terminänderung. Das ist bei Schiriplan fast alles. Günstigste Kategorie.
- **AUTHENTICATION** — Einmal-Codes. Genau eine Vorlage: die Anmeldung. Fester, nicht frei
  formulierbarer Aufbau.
- **MARKETING** — alles Werbliche oder Einladende. Teuerste Kategorie, strengste Prüfung.

Die genauen Preise hängen vom Land ab und ändern sich; sehen Sie vor der Freigabe in die
aktuelle Preisliste von Meta. Der Kostenzähler der Anwendung (Regel 33) zählt Nachrichten, nicht
Euro — die Umrechnung machen Sie anhand der Kategorie.

> **Ein Risiko vorweg:** `schiriplan_platz_frei` („für dieses Spiel fehlt noch jemand") ist die
> einzige Vorlage, die Meta als MARKETING einstufen könnte — sie fordert zu etwas auf, statt über
> etwas zu informieren. Reichen Sie sie als UTILITY ein. Wird sie umkategorisiert, wird sie
> teurer, aber sie funktioniert weiter. Formulieren Sie sie **nicht** um in Richtung „Mach mit!",
> das erhöht die Wahrscheinlichkeit nur.

---

## Wann welche Vorlage rausgeht

Zwei Dinge lösen eine Nachricht aus: eine **Handlung in der Anwendung** (jemand trägt sich ein,
ein Admin verlegt ein Spiel) oder der **Zeitplan-Lauf** (eine Frist ist erreicht). Die Spalte
„Ausgelöst durch" sagt, welches von beidem.

| Vorlage | Wann | An wen | Ausgelöst durch |
| --- | --- | --- | --- |
| 1 `schiriplan_anmeldung` | jemand fordert einen Zugang an | die Person selbst | Handlung, sofort |
| 2 `schiriplan_einsatz_steht` | jemand hat sich gerade eingetragen | dieselbe Person | Handlung |
| 3 `schiriplan_bestaetigung_erbeten` | 72 Stunden vor Anpfiff (einstellbar) | Schiedsrichter 1 und 2 | Zeitplan |
| 4 `schiriplan_bestaetigung_offen` | 24 Stunden später ohne Antwort | dieselbe Person | Zeitplan |
| 5 `schiriplan_nachruecken` | ein Schiedsrichter-Platz ist frei geworden | ein Ersatz, einer nach dem anderen | Zeitplan |
| 6 `schiriplan_platz_frei` | kein Ersatz mehr zu fragen; danach 14, 7, 3 und 1 Tag vorher | **alle** Qualifizierten | Zeitplan |
| 7 `schiriplan_termin_geaendert` | ein Admin ändert Anpfiff oder Ort | alle Eingetragenen | Handlung |
| 8 `schiriplan_spiel_abgesagt` | ein Admin sagt das Spiel ab | alle Eingetragenen | Handlung |
| 9 `schiriplan_erinnerung` | zu den Vorlaufzeiten aus dem Profil | die eingetragene Person | Zeitplan |
| 10 `schiriplan_meldung` | eine Pflichtbestätigung ist überfällig | alle aktiven Admins | Zeitplan |
| 11 `schiriplan_tagesuebersicht` | ab 18 Uhr, einmal am Tag | alle aktiven Admins | Zeitplan |

Nur Vorlage 6 geht an mehrere Personen gleichzeitig. Sie bestimmt damit die Kosten fast allein
(Regel 33) — alle anderen sind eine Nachricht an eine Person, Vorlage 10 und 11 an die Handvoll
Admins.

## Wie eine Nachricht rausgeht

Jede Nachricht nimmt denselben Weg, unabhängig von der Vorlage. Einen zweiten Weg nach draußen
gibt es nicht.

1. **Anlegen.** Der Vorgang (oder der Zeitplan) legt eine Zeile in der Outbox an — mit Empfänger,
   Art und einem **Idempotenzschlüssel**. Der Schlüssel steht in jedem Vorlagen-Abschnitt unten.
2. **Zustellen.** Der Zeitplan ruft `POST /api/cron` mit `Authorization: Bearer $CRON_SECRET` auf,
   arbeitet die fälligen Zeilen ab und schickt sie über den eingestellten Kanal
   (`NOTIFICATION_CHANNEL`: `dev`, `email` oder `whatsapp`). `GET` auf denselben Pfad ist der
   Trockenlauf: er zeigt, was fällig wäre, und verschickt nichts.
3. **Wiederholen.** Ein fehlgeschlagener Versand wird nach 1, 5, 25 und 120 Minuten erneut
   versucht, höchstens fünfmal. Dauerhafte Fehler — falsche Nummer, abgelehnte Vorlage — werden
   sofort aufgegeben, weil jeder weitere Versuch nur Geld kostet.
4. **Grenzen.** Höchstens 200 Nachrichten je Lauf und 1000 Einheiten je Kalendertag. Ist die
   Grenze erreicht, bleibt der Rest liegen und geht beim nächsten Lauf raus.

Drei Dinge folgen daraus für den Betrieb:

- **Der Zeitplan darf beliebig oft laufen.** Ein Lauf ohne Fälliges tut nichts, und ein doppelter
  Lauf erzeugt dieselben Schlüssel — die Outbox nimmt sie kein zweites Mal an. Jede Minute ist
  unschädlich, alle fünf Minuten reicht.
- **Läuft der Zeitplan nicht, geht nichts raus.** Erinnerungen, Bestätigungen und Nachrück-Anfragen
  hängen alle daran; auch die Nachrichten aus einer Handlung warten auf den nächsten Lauf. Einzige
  Ausnahme ist die Anmeldung (Vorlage 1), die sofort zugestellt wird.
- **Was unter `/dev/outbox` steht, geht genau so raus.** Derselbe Code erzeugt Vorschau und
  Versandtext; einen zweiten Weg, auf dem ein anderer Text entstehen könnte, gibt es nicht.

## Die elf Vorlagen

Alle in Sprache **Deutsch (`de`)**. Die Namen sind so gewählt, wie der Code sie später erwartet:
Kleinbuchstaben, Ziffern, Unterstriche — Meta lässt nichts anderes zu.

Ersetzen Sie `https://schiriplan.example.org` überall durch Ihre echte Adresse (dieselbe, die in
`PUBLIC_BASE_URL` steht).

---

### 1 · `schiriplan_anmeldung` — AUTHENTICATION

Die einzige Vorlage dieser Kategorie und die einzige mit festem Aufbau: Sie können den Text
nicht frei schreiben, sondern klicken die Bausteine an.

**Wann:** Sobald jemand auf der Anmeldeseite seine Telefonnummer einträgt. Diese Vorlage ist die
einzige, die nicht auf den nächsten Zeitplan-Lauf wartet — sie wird sofort zugestellt, weil
jemand vor dem Bildschirm steht und auf den Code wartet.

**An wen:** an die Person selbst, und nur, wenn die Nummer hinterlegt und das Konto aktiv ist.
Sonst geht gar nichts raus; die Seite antwortet trotzdem gleich („Wenn … hinterlegt ist, ist die
Nachricht unterwegs"), damit sie keine Nummern verrät.

**Wie oft:** höchstens dreimal je Nummer und zwanzigmal je Anschluss in einer Viertelstunde. Der
Code gilt 15 Minuten und nur ein einziges Mal.

**Variablen:** `{{1}}` der sechsstellige Code.

**Im Code:** `src/server/auth/login.ts`, Art `login`, Schlüssel `login:<Token-Id>`.

- **Codeübermittlung:** „Kopieren-Button" (nicht „Automatisches Ausfüllen" — das gibt es nur für
  Android-Apps, nicht für eine Webseite)
- **Sicherheitshinweis hinzufügen:** ja
- **Gültigkeitsdauer anzeigen:** ja, **15 Minuten**

Ergibt sinngemäß: *„{{1}} ist dein Verifizierungscode. Aus Sicherheitsgründen solltest du diesen
Code nicht weitergeben. Der Code läuft in 15 Minuten ab."*

> **Folge für die Anmeldung:** In eine AUTHENTICATION-Vorlage passt **kein Magic-Link**, nur der
> Code. Über WhatsApp bekommt man also künftig den sechsstelligen Code, nicht den Link. Das ist
> kein Problem — die Anmeldeseite kann beides, der Code-Weg ist seit M2 gebaut und getestet.
> Über E-Mail geht weiterhin beides.

#### Kein App-Paketname nötig

Fragt Meta beim Anlegen nach einem **Paketnamen** (`package_name`) und einem **Signaturhash**,
dann ist die falsche Codeübermittlung ausgewählt. Diese beiden Angaben verlangt Meta
ausschließlich für **One-Tap Autofill** und **Zero-Tap** — beides setzt eine native
**Android-App** voraus, die den Code direkt entgegennimmt. Schiriplan ist eine Webseite; es gibt
keine App, also auch keinen Paketnamen.

Wählen Sie stattdessen den **Kopieren-Button**. Der braucht weder Paketnamen noch Signaturhash:
die Person tippt auf „Kopieren", wechselt in den Browser und fügt den Code auf der Anmeldeseite
ein — genau der Ablauf, den die Anwendung seit M2 kann.

Erfinden Sie auf keinen Fall einen Paketnamen, nur um das Feld zu füllen. One-Tap verlangt
zusätzlich einen Handschlag zwischen App und WhatsApp, der höchstens zehn Minuten zurückliegen
darf. Der schlüge hier immer fehl; WhatsApp ersetzt den Knopf dann stillschweigend durch einen
Kopieren-Button — Sie hätten also denselben Ablauf, nur mit einer falschen Angabe in der
Vorlage und einem Grund mehr, abgelehnt zu werden.

Die zehn UTILITY-Vorlagen fragen ohnehin nie nach einem Paketnamen.

---

### 2 · `schiriplan_einsatz_steht` — UTILITY

**Wann:** In dem Moment, in dem sich jemand in einen Platz einträgt (Regel 31). Es ist die
Quittung für die eigene Handlung, keine Nachfrage — deshalb kommt sie auch für Ersatzplätze.

**An wen:** nur an die Person, die sich gerade eingetragen hat.

**Variablen:** `{{1}}` Name · `{{2}}` Platz (Schiedsrichter 1/2, Ersatz 1/2) · `{{3}}` Spiel ·
`{{4}}` Ort.

**Im Code:** `src/server/assignments.ts` → `assignmentIntent`, Art `assignment`, Schlüssel
`assignment:<Spiel>:<Person>:<Platz>`. Sie wird in derselben Transaktion angelegt wie die
Eintragung und mit dem nächsten Lauf zugestellt.

**Text:**
```
Hallo {{1}},

du stehst als {{2}} für:
{{3}}
Ort: {{4}}

Rechtzeitig vor Anpfiff bitten wir dich noch um eine Bestätigung.
```

**Beispielwerte:** `Jonas Keller` · `Schiedsrichter 1` ·
`Sa 29.08.2026, 10:30 Uhr · U14 · BG Nordstadt gegen TV Ostheim` · `Sporthalle Nordstadt, Feld 2`

**Button:** Website-Link, Text `Zum Kalender`, URL `https://schiriplan.example.org/kalender`

---

### 3 · `schiriplan_bestaetigung_erbeten` — UTILITY

**Wann:** wenn der eingestellte Vorlauf für die Pflichtbestätigung erreicht ist — Standard
**72 Stunden** vor Anpfiff, in den Vereinseinstellungen änderbar (Regel 10). Wer sich erst
innerhalb dieses Vorlaufs einträgt, bekommt sie beim nächsten Lauf nach seiner Eintragung; die
Nachfassfrist läuft dann ab diesem Zeitpunkt und nicht ab dem Vorlauf.

**An wen:** an die Eingetragenen auf **Schiedsrichter 1 und 2**, solange sie nicht bestätigt haben.
Ersatz bestätigt nicht (Regel 12). Abgesagte Spiele und Spiele nach Anpfiff sind ausgenommen.

**Wie oft:** einmal je Person und Spiel.

**Variablen:** `{{1}}` Name · `{{2}}` Spiel · `{{3}}` Ort · `{{4}}` Vorlauf in Worten
(„in 3 Tagen").

**Im Code:** `dueConfirmations` in `src/domain/scheduler.ts`, Art `confirmation-request`,
Schlüssel `confirmation:<Spiel>:<Person>:initial`.

**Text:**
```
Hallo {{1}},

bitte bestätige kurz, dass du pfeifst:
{{2}}
Ort: {{3}}
Anpfiff {{4}}.

Tippe unten, um zu bestätigen.
```

**Beispielwerte:** `Jonas Keller` ·
`Sa 29.08.2026, 10:30 Uhr · U14 · BG Nordstadt gegen TV Ostheim` · `Sporthalle Nordstadt, Feld 2` ·
`in 3 Tagen`

**Button:** Website-Link, Text `Jetzt bestätigen`, URL `https://schiriplan.example.org/kalender`

---

### 4 · `schiriplan_bestaetigung_offen` — UTILITY

**Wann:** wenn die Nachfassfrist seit der Anfrage verstrichen ist, ohne dass eine Bestätigung kam
— Standard **24 Stunden** (Regel 11). Zeitgleich geht Vorlage 10 an die Admins.

**An wen:** an dieselbe Person wie Vorlage 3.

**Wie oft:** einmal. Danach wird nicht weiter nachgefasst — bleibt es dabei, ist es ein Fall für
die Admins und nicht für eine dritte Nachricht.

**Variablen:** wie Vorlage 3.

**Im Code:** Art `confirmation-follow-up`, Schlüssel `confirmation:<Spiel>:<Person>:follow-up`.

**Text:**
```
Hallo {{1}},

wir haben noch keine Rückmeldung von dir zu:
{{2}}
Ort: {{3}}
Anpfiff {{4}}.

Bitte melde dich kurz — sonst müssen wir den Platz neu besetzen.
```

**Beispielwerte:** wie oben

**Button:** Website-Link, Text `Jetzt bestätigen`, URL `https://schiriplan.example.org/kalender`

---

### 5 · `schiriplan_nachruecken` — UTILITY

**Wann:** sobald ein Schiedsrichter-Platz frei wird — jemand trägt sich aus oder ein Admin wirft
ihn heraus — und noch ein Ersatz eingetragen ist (Regeln 13-14). Der nächste Lauf fragt Ersatz 1.
Ersatz 2 wird erst gefragt, wenn Ersatz 1 abgelehnt hat oder seine Frist verstrichen ist:
**nie beide gleichzeitig**, sonst könnten beide zusagen.

**Antwortfrist:** Standard **12 Stunden**, einstellbar. Rückt der Anpfiff näher, wird sie
automatisch auf ein Drittel der Restzeit gekürzt — bei 12 Stunden Standard greift das ab
36 Stunden Restzeit.

**An wen:** an genau einen Ersatz.

**Variablen:** `{{1}}` Name · `{{2}}` der frei gewordene Platz · `{{3}}` Spiel · `{{4}}` Ort ·
`{{5}}` Vorlauf bis Anpfiff · `{{6}}` Antwortfrist mit Datum und Uhrzeit.

**Im Code:** `planPromotions` in `src/domain/scheduler.ts`, angelegt in `openOffer`
(`src/server/scheduler.ts`), Art `promotion-offer`, Schlüssel `promotion:<Anfrage-Id>`. Der
Schlüssel hängt an der Anfrage und nicht an Spiel und Platz — sonst bliebe eine zweite
Nachrück-Runde für dieselbe Person stumm.

**Text:**
```
Hallo {{1}},

du stehst als Ersatz, und {{2}} ist frei geworden:
{{3}}
Ort: {{4}}
Anpfiff {{5}}.

Bitte antworte bis {{6}}. Ohne Antwort fragen wir den nächsten Ersatz.
```

**Beispielwerte:** `Tim Faber` · `Schiedsrichter 1` ·
`Sa 29.08.2026, 10:30 Uhr · U14 · BG Nordstadt gegen TV Ostheim` · `Sporthalle Nordstadt, Feld 2` ·
`in 2 Tagen` · `Do 27.08.2026, 18:00 Uhr`

**Button:** Website-Link, Text `Antworten`, URL `https://schiriplan.example.org/kalender`

---

### 6 · `schiriplan_platz_frei` — UTILITY *(Umkategorisierungs-Risiko, siehe oben)*

**Wann:** wenn die Nachrück-Kaskade nichts mehr anzubieten hat — kein Ersatz eingetragen, oder
alle haben abgelehnt beziehungsweise ihre Frist verstreichen lassen (Regel 15). Danach wiederholt
sich die Ausschreibung **14, 7, 3 und 1 Tag** vor Anpfiff, jede Stufe höchstens einmal (Regel 32).
Fällt ein Lauf aus, wird nur die zuletzt erreichte Stufe nachgeholt und nicht jede verpasste.

**An wen:** an **alle** für die Liga qualifizierten Personen, die nicht schon in diesem Spiel
stehen — in Rotationsreihenfolge (Regel 19). Das ist die einzige Vorlage, die viele Nachrichten
auf einmal auslöst; rechnen Sie sie bei den Kosten gesondert.

**Abschaltbar:** Die Wiederholungen hängen am Schalter „automatische Nachfrage". Die **erste**
Ausschreibung geht immer raus — ohne sie erführe niemand von der Lücke.

**Variablen:** `{{1}}` Name · `{{2}}` Spiel · `{{3}}` Ort · `{{4}}` Vorlauf bis Anpfiff.

**Im Code:** `openSlotAnnouncement` in `src/domain/scheduler.ts`, Art `open-slot-announcement`,
Schlüssel `open-slot:<Spiel>:<Vakanz-Zähler>:<Stufe>`. Der Vakanz-Zähler steigt, sobald ein Platz
erneut frei wird — sonst sähe die zweite Ausschreibung desselben Spiels wie eine Doppelung aus.

**Text:**
```
Hallo {{1}},

für dieses Spiel fehlt noch jemand:
{{2}}
Ort: {{3}}
Anpfiff {{4}}.

Wer sich zuerst einträgt, bekommt den Platz.
```

**Beispielwerte:** `Jonas Keller` ·
`Sa 29.08.2026, 10:30 Uhr · U14 · BG Nordstadt gegen TV Ostheim` · `Sporthalle Nordstadt, Feld 2` ·
`in 5 Tagen`

**Button:** Website-Link, Text `Offene Spiele`, URL `https://schiriplan.example.org/spiele`

---

### 7 · `schiriplan_termin_geaendert` — UTILITY

**Wann:** sobald ein Admin Anpfiff oder Ort eines Spiels speichert (Regel 17). Sie wird in
derselben Transaktion angelegt wie die Änderung.

**An wen:** an alle Eingetragenen, Ersatzleute eingeschlossen.

**Variablen:** `{{1}}` Name · `{{2}}` Spiel mit dem **neuen** Termin · `{{3}}` Ort · `{{4}}` der
bisherige Termin samt bisherigem Ort.

**Im Code:** `src/server/admin/games.ts` → `relocationIntent`, Art `relocation`, Schlüssel
`relocation:<Spiel>:<Änderungszähler>`. Jede weitere Verlegung ist eine neue Nachricht.

**Text:**
```
Hallo {{1}},

dieses Spiel wurde verlegt:
{{2}}
Ort: {{3}}
Bisher: {{4}}

Passt der neue Termin? Wenn nicht, gib den Platz bitte gleich frei.
```

**Beispielwerte:** `Jonas Keller` ·
`Sa 05.09.2026, 10:30 Uhr · U14 · BG Nordstadt gegen TV Ostheim` · `Sporthalle Nordstadt, Feld 2` ·
`Sa 29.08.2026, 10:30 Uhr, Sporthalle Nordstadt, Feld 2`

**Button:** Website-Link, Text `Antworten`, URL `https://schiriplan.example.org/kalender`

---

### 8 · `schiriplan_spiel_abgesagt` — UTILITY

Eigene Vorlage, weil der Text sich inhaltlich unterscheidet: hier gibt es nichts zu entscheiden.

**Wann:** wenn ein Admin das Spiel absagt.

**An wen:** an alle Eingetragenen, Ersatzleute eingeschlossen.

**Variablen:** `{{1}}` Name · `{{2}}` Spiel · `{{3}}` Ort.

**Im Code:** dieselbe Art `relocation` wie Vorlage 7 — unterschieden wird am Zustand des Spiels
(`cancelled`). Beim Umstieg auf Vorlagen muss diese eine Art also auf **zwei** Vorlagennamen
aufgeteilt werden; siehe „Was der Code noch braucht".

**Text:**
```
Hallo {{1}},

dieses Spiel fällt aus:
{{2}}
Ort: {{3}}

Du musst nichts weiter tun.
```

**Beispielwerte:** `Jonas Keller` ·
`Sa 29.08.2026, 10:30 Uhr · U14 · BG Nordstadt gegen TV Ostheim` · `Sporthalle Nordstadt, Feld 2`

**Button:** keiner

---

### 9 · `schiriplan_erinnerung` — UTILITY

**Wann:** zu den Vorlaufzeiten, die jede Person in ihrem Profil einstellt (Regel 21) — etwa
7 Tage, 1 Tag und 3 Stunden vor Anpfiff. Zwei Einschränkungen:

- Eine verpasste Erinnerung wird **bis zu 6 Stunden** nachgeholt, danach nicht mehr. Ein „7 Tage
  vor Anpfiff", das sechs Tage zu spät ankommt, ist schlicht falsch und kostet trotzdem.
- Liegt der Zeitpunkt vor der eigenen Eintragung, entfällt die Erinnerung. Wer sich zwei Stunden
  vorher einträgt, bekommt kein „7 Tage vorher" mehr.

**An wen:** an jede eingetragene Person, auch auf Ersatzplätzen. Abgesagte Spiele und Spiele nach
Anpfiff sind ausgenommen.

**Variablen:** `{{1}}` Name · `{{2}}` Vorlauf in Worten („1 Tag") · `{{3}}` Spiel · `{{4}}` Ort.

**Im Code:** `duePersonalReminders` in `src/domain/scheduler.ts`, Art `personal-reminder`,
Schlüssel `reminder:<Spiel>:<Person>:<Stunden>`.

**Text:**
```
Hallo {{1}},

Erinnerung: {{2}} vor Anpfiff.
{{3}}
Ort: {{4}}

Bis dann!
```

**Beispielwerte:** `Jonas Keller` · `1 Tag` ·
`Sa 29.08.2026, 10:30 Uhr · U14 · BG Nordstadt gegen TV Ostheim` · `Sporthalle Nordstadt, Feld 2`

**Button:** Website-Link, Text `Zum Kalender`, URL `https://schiriplan.example.org/kalender`

---

### 10 · `schiriplan_meldung` — UTILITY *(nur an Admins)*

**Wann:** heute genau ein Anlass — eine Pflichtbestätigung ist überfällig (Regel 11), zeitgleich
mit Vorlage 4. Der Schalter „Bestätigung überfällig" in den Meldungseinstellungen schaltet sie ab.
Die übrigen Meldungsarten (unbesetztes Spiel, fehlender Ersatz) stehen nur in der Übersicht und
lösen keine Nachricht aus.

**An wen:** an alle aktiven Admins — eine Nachricht je Admin.

**Wie oft:** einmal je offener Bestätigung. Zwei offene Bestätigungen desselben Spiels ergeben
zwei Meldungen, nicht eine.

**Variablen:** `{{1}}` Name des Admins · `{{2}}` Spiel · `{{3}}` was los ist.

**Im Code:** `dueConfirmationAlerts` in `src/domain/scheduler.ts`, Art `admin-alert`, Schlüssel
`admin-alert:confirmation-overdue:<Spiel>:<Person>`.

> Der Code schreibt heute **einen** Satz, der Spiel und Anlass zusammen nennt. Die Vorlage trennt
> beides in `{{2}}` und `{{3}}` — beim Umbau ist der Satz entsprechend zu zerlegen.

**Text:**
```
Hallo {{1}},

es gibt eine Meldung zu einem Spiel:
{{2}}

{{3}}
Bitte in der Spielübersicht nachsehen.
```

**Beispielwerte:** `Nele Baumann` ·
`Sa 29.08.2026, 10:30 Uhr · U14 · BG Nordstadt gegen TV Ostheim` ·
`Jonas Keller hat die Pflichtbestätigung seit 24 Stunden nicht beantwortet.`

**Button:** Website-Link, Text `Meldungen`, URL `https://schiriplan.example.org/meldungen`

---

### 11 · `schiriplan_tagesuebersicht` — UTILITY *(nur an Admins)*

**Wann:** ab **18 Uhr Vereinszeit**, einmal je Kalendertag, und nur wenn mindestens ein kommendes
Spiel einen offenen Schiedsrichter-Platz oder eine ausstehende Bestätigung hat (Regel 20). Der
Schlüssel trägt das Datum in Vereinszeit, nicht die Laufzeit des Zeitplans: ein zweiter Lauf am
selben Abend schickt nichts nach. Abschaltbar über den Schalter „Tageszusammenfassung".

**An wen:** an alle aktiven Admins.

**Variablen:** `{{1}}` Name des Admins · `{{2}}` Anzahl der Spiele · `{{3}}` die Liste, eine
Zeile je Spiel.

**Im Code:** `dueDigest` in `src/domain/scheduler.ts`, Art `daily-digest`, Schlüssel
`digest:<Kalendertag>`.

> **Zwei Fallstricke bei dieser Vorlage.** Meta erlaubt in Variablenwerten **keine
> Zeilenumbrüche** — `{{3}}` muss beim Versand zu einer Zeile verbunden werden, etwa mit „ · ".
> Und bei genau einem Spiel steht in der Vorlage „1 Spiele brauchen Aufmerksamkeit". Wenn Sie das
> stört, legen Sie eine zweite Vorlage für den Einzelfall an; der Code unterscheidet die beiden
> Fälle heute schon.

**Text:**
```
Hallo {{1}},

{{2}} Spiele brauchen Aufmerksamkeit:
{{3}}

Die vollständige Liste steht in der Spielübersicht.
```

**Beispielwerte:** `Nele Baumann` · `2` ·
`BG Nordstadt gegen TV Ostheim (U14): Schiedsrichter 1 offen.`

**Button:** Website-Link, Text `Übersicht`, URL `https://schiriplan.example.org/uebersicht`

---

## So legen Sie eine Vorlage an

1. **business.facebook.com** → WhatsApp Manager → **Nachrichtenvorlagen** → *Vorlage erstellen*
2. Kategorie wählen (siehe oben), Name eintragen, Sprache **Deutsch**
3. Text einfügen. Variablen als `{{1}}`, `{{2}}` … **fortlaufend ab 1, ohne Lücken**
4. **Beispielwerte ausfüllen** — ohne sie lehnt Meta ab. Nehmen Sie die oben angegebenen
5. Button hinzufügen, wo angegeben
6. Absenden. Die Freigabe dauert meist Minuten, gelegentlich bis 24 Stunden

### Woran Vorlagen scheitern

- **Variable am Anfang oder Ende des Textes.** Deshalb endet oben jede Vorlage mit einem Satz.
- **Zwei Variablen direkt hintereinander** (`{{1}} {{2}}` ohne Text dazwischen).
- **Fehlende oder unglaubwürdige Beispielwerte.** „Test" oder „xxx" wird abgelehnt.
- **Falsche Kategorie.** Etwas Einladendes als UTILITY einzureichen führt zur Umkategorisierung,
  nicht zur Ablehnung — es wird dann nur teurer.
- **Mehr als 1024 Zeichen** im Textteil. Alle Vorlagen oben liegen weit darunter.

### Wenn Sie es lieber per API machen

Elf Vorlagen von Hand anzuklicken ist mühsam und fehleranfällig. Meta nimmt sie auch über die
Graph-API entgegen (`POST /{waba-id}/message_templates`). Sagen Sie Bescheid, wenn Sie ein
Skript dafür möchten — dann liegen die Vorlagen im Repo neben ihren Texten und lassen sich
wiederholbar einspielen.

---

## Was der Code noch braucht

Die Anwendung erzeugt heute fertigen Fließtext und schickt ihn als `type: 'text'`. Für Vorlagen
braucht Meta stattdessen **Bausteine statt Text**:

```jsonc
{
  "messaging_product": "whatsapp",
  "to": "4915123456789",
  "type": "template",
  "template": {
    "name": "schiriplan_erinnerung",
    "language": { "code": "de" },
    "components": [
      {
        "type": "body",
        "parameters": [
          { "type": "text", "text": "Jonas Keller" },
          { "type": "text", "text": "1 Tag" },
          { "type": "text", "text": "Sa 29.08.2026, 10:30 Uhr · U14 · BG Nordstadt gegen TV Ostheim" },
          { "type": "text", "text": "Sporthalle Nordstadt, Feld 2" }
        ]
      }
    ]
  }
}
```

Konkret fehlen fünf Dinge:

1. **Je Nachrichtenart ein Vorlagenname und eine Parameterliste.** Die Texte in
   `src/notifications/templates.ts` müssen die Bestandteile einzeln herausgeben, nicht nur den
   fertigen Fließtext. Der E-Mail- und der Dev-Kanal setzen sie weiterhin zum Fließtext zusammen
   — die Texte oben und die in der Anwendung bleiben also dieselben.
2. **`channel.ts` muss `type: 'template'` schicken**, wenn eine Vorlage hinterlegt ist.
3. **Die Anmeldung über WhatsApp verschickt nur noch den Code**, nicht den Link (siehe Vorlage 1).
4. **Die Art `relocation` muss sich auf zwei Vorlagen aufteilen** — `schiriplan_termin_geaendert`
   und `schiriplan_spiel_abgesagt`. Der Code unterscheidet die beiden Fälle schon am Zustand des
   Spiels; der Vorlagenname muss dieser Unterscheidung folgen. Die Zuordnung ist also nicht
   überall eine Art zu einer Vorlage.
5. **Parameterwerte müssen einzeilig sein.** Meta lässt in Variablenwerten keine Zeilenumbrüche,
   Tabulatoren oder längeren Leerraum zu. Betroffen ist die Liste in der Tagesübersicht
   (Vorlage 11); sie muss zu einer Zeile verbunden werden.

Das ist ein überschaubarer, aber echter Umbau mit eigenen Tests. Er steht bewusst noch nicht im
Code: solange keine Vorlage freigegeben ist, könnte man ihn gegen nichts prüfen.

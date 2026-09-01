# WhatsApp-Vorlagen bei Meta anlegen

Diese Datei ist die Vorlage für die Vorlagen: welche Sie anlegen müssen, mit welchem Text, in
welcher Kategorie, wann und an wen sie rausgehen — und was der Code dafür noch braucht.

> **Der Code ist so weit.** `src/notifications/channel.ts` verschickt inzwischen
> `type: 'template'`: jede Nachricht steht in `src/notifications/templates.ts` als
> Vorlagentext mit `{{1}}`, `{{2}}` … und einer Liste ihrer Werte, und daraus entsteht
> beides — der Vorlagen-Aufruf für WhatsApp und der Fließtext für E-Mail, Entwicklung und
> die Vorschau unter `/dev/outbox`. **Was jetzt noch fehlt, sind die Freigaben bei Meta.**
> Legen Sie die Vorlagen unter genau den Namen an, die unten stehen — der Code ruft sie so
> auf. Siehe unten, Abschnitt „Was der Code tut".

---

## Vier Regeln, die für alle Vorlagen gelten

Sie stehen vor den einzelnen Vorlagen, weil sie den Wortlaut jeder einzelnen bestimmen — und
weil eine Vorlage, die dagegen verstößt, nach der Freigabe bei Meta nicht mehr änderbar ist,
sondern nur noch ersetzbar.

1. **Datum, Uhrzeit und Vorlauf stehen immer beide drin** (Regel 44). „Sa 29.08.2026, 10:30 Uhr"
   sagt, welches Spiel gemeint ist; „Anpfiff in 3 Tagen" sagt, wie eilig es ist. Keins von beiden
   darf fehlen — sonst muss der Empfänger nachschlagen oder nachrechnen. Das gilt auch für jede
   einzelne Zeile der Tagesübersicht (Vorlage 11).
2. **Keine Vorlage stellt einen Nachfolger in Aussicht** (Regel 45). Kein „sonst müssen wir den
   Platz neu besetzen", kein „ohne Antwort fragen wir den nächsten Ersatz". Wer liest, dass sich
   ohnehin ein Ersatz findet, sagt eher ab als zu. Was ohne Antwort passiert, ist Sache der
   Anwendung und gehört nicht in den Text.
3. **Wer antworten soll, bekommt einen eindeutigen Link** (Regel 46). Siehe den nächsten
   Abschnitt.
4. **Angesprochen wird mit dem Vornamen.** „Hallo Jonas", nicht „Hallo Jonas Keller" — eine
   Nachricht an einen Menschen, kein Serienbrief. Der Vorname ist ein eigenes Feld im Konto und
   wird nicht aus dem Namen geraten: bei „Anna-Lena Müller" träfe das erste Wort zu, bei „von
   der Heide Tim" nicht. Der Admin pflegt ihn in der Schiedsrichter-Verwaltung; beim Anlegen
   steht das erste Wort des Namens als Vorschlag darin. **Alle Beispielwerte unten nennen
   deshalb nur den Vornamen** — ein Beispielwert mit vollem Namen würde Meta nicht stören, aber
   die Vorlage sähe dann anders aus als die Nachricht, die tatsächlich rausgeht.

## Dynamische Links — eine Adresse je Nachricht

Ein Knopf auf `…/kalender` führt in eine Liste. Wer dort das falsche Spiel antippt, bestätigt das
falsche Spiel — und die Anwendung kann hinterher nicht sagen, auf welche Bitte hin bestätigt
wurde. Jede Vorlage, die eine Antwort erwartet, trägt deshalb ihre **eigene** Adresse:

```
https://schiriplan.example.org/antwort/<Token>
```

Im Token stecken, signiert mit dem Serverschlüssel (HMAC-SHA256):

| Angabe | Wozu |
| --- | --- |
| Vorgang | `confirm`, `promotion` oder `relocation` — ein Bestätigungslink kann keine Absage auslösen |
| Spiel | genau dieses Spiel, kein anderes |
| Person | genau diese Person |
| Schlüssel der Nachricht | macht die Nachfassnachricht von der ersten Bitte unterscheidbar; bei einer Nachrück-Anfrage ist es deren Id |
| Ablauf | der Anpfiff; danach führt der Link nur noch zu einer Erklärung |

Die Seite dahinter zeigt Spiel, Datum, Vorlauf und Platz, fragt genau eine Frage und beantwortet
sie **nur auf Knopfdruck** — ein Aufruf der Adresse allein ändert nichts, damit eine
Linkvorschau nichts auslöst. Wer denselben Link ein zweites Mal öffnet, liest „Dieses Spiel hast
du bereits bestätigt". Eine Anmeldung braucht es dafür nicht: die Nachricht kommt aufs Telefon,
und eine Bestätigung soll nicht an einem vergessenen Passwort scheitern. Der Token öffnet dafür
auch nichts weiter als diese eine Frage.

### Was Meta dazu verlangt

Der URL-Knopf einer Vorlage ist entweder **statisch** oder **dynamisch**. Dynamisch heißt: die
Adresse endet auf eine Variable, deren Wert beim Versand mitgegeben wird. Dabei gilt:

- **genau eine Variable je Knopf**, und
- **nur am Ende der Adresse** — ein `{{1}}` mittendrin nimmt Meta nicht an.

Deshalb steht der Token im **Pfad** und nicht in einem Abfrageparameter. Beim Anlegen tragen Sie
als Adresse

```
https://schiriplan.example.org/antwort/{{1}}
```

ein und als Beispielwert einen erfundenen, aber realistisch aussehenden Token (ein langer
Buchstaben-Ziffern-Text mit einem Punkt darin, siehe die Beispielwerte unten). Beim Versand
setzt der Code den echten Token als Wert dieser einen Variablen ein.

> **Der Beispielwert muss glaubwürdig sein.** „xxx" oder „test" führt zur Ablehnung — das gilt
> für den URL-Knopf genauso wie für den Text.

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
| 2 `schiriplan_einsatz_steht` | jemand hat sich gerade eingetragen — **abschaltbar** | dieselbe Person | Handlung |
| 3 `schiriplan_bestaetigung_erbeten` | 72 Stunden vor Anpfiff (einstellbar) | Schiedsrichter 1 und 2 | Zeitplan |
| 4 `schiriplan_bestaetigung_offen` | 24 Stunden später ohne Antwort | dieselbe Person | Zeitplan |
| 5 `schiriplan_nachruecken` | ein Schiedsrichter-Platz ist frei geworden | ein Ersatz, einer nach dem anderen | Zeitplan |
| 6 `schiriplan_platz_frei` | kein Ersatz mehr zu fragen; danach 14, 7, 3 und 1 Tag vorher | **alle** Qualifizierten mit passender Lizenz — nur bei Einstellung „alle" | Zeitplan |
| 6b `schiriplan_platz_frei_admin` | ab 18 Uhr, **einmal am Tag**, solange irgendwo eine Lücke ist | nur die aktiven Admins — bei Einstellung „nur Admins" | Zeitplan |
| 7 `schiriplan_termin_geaendert` | ein Admin ändert Anpfiff oder Ort | alle Eingetragenen | Handlung |
| 8 `schiriplan_spiel_abgesagt` | ein Admin sagt das Spiel ab | alle Eingetragenen | Handlung |
| 9 `schiriplan_erinnerung` | zu den Vorlaufzeiten aus dem Profil | die eingetragene Person | Zeitplan |
| 10 `schiriplan_meldung` | eine Pflichtbestätigung ist überfällig | alle aktiven Admins | Zeitplan |
| 11 `schiriplan_tagesuebersicht` | ab 18 Uhr, einmal am Tag | jeder aktive Admin, der sie nicht abgeschaltet hat — je Admin mit eigenem Zeitraum | Zeitplan |

Nur Vorlage 6 geht an mehrere Personen gleichzeitig. Sie bestimmt damit die Kosten fast allein
(Regel 33) — alle anderen sind eine Nachricht an eine Person, Vorlage 6b, 10 und 11 an die
Handvoll Admins.

**Vorlage 6b ist keine Nachricht je Spiel.** Zehn Lücken ergaben früher zehn gleichlautende
Aufrufe an dieselben Admins. Sie ist jetzt eine **Tagesbilanz**: wie viele Spiele eine Lücke
haben, bei wie vielen gar kein Schiedsrichter steht und wie eilig der nächste Fall ist — einmal
am Abend, gleich viele Lücken wie wenige.

**Zwei Vorlagen schaltet der Adminbereich** unter *Einstellungen* (Regel 47):

| Schalter | Vorlage | Werte |
| --- | --- | --- |
| Quittung nach dem Eintragen | 2 | an / aus |
| Offene Plätze ausschreiben an | 6 / 6b | alle Qualifizierten / nur die Admins / aus |

Steht die Ausschreibung auf **aus**, geht weder 6 noch 6b raus — die Lücke steht dann nur in der
Übersicht und in den Meldungen an die Admins. Der Schalter *Automatische Nachfrage* steuert davon
unabhängig nur die **Wiederholungen** 14, 7, 3 und 1 Tag vor Anpfiff.

Legen Sie eine Vorlage trotzdem an, auch wenn ihr Schalter heute aus steht: die Freigabe dauert
bis zu 24 Stunden, und ein Schalter, der ins Leere greift, fällt erst auf, wenn er gebraucht
wird.

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

## Die zwölf Vorlagen

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

Die elf UTILITY-Vorlagen fragen ohnehin nie nach einem Paketnamen.

---

### 2 · `schiriplan_einsatz_steht` — UTILITY

**Wann:** In dem Moment, in dem sich jemand in einen Platz einträgt (Regel 31). Es ist die
Quittung für die eigene Handlung, keine Nachfrage — deshalb kommt sie auch für Ersatzplätze.

**Abschaltbar:** ja, ganz. *Einstellungen → Nachrichten an Schiedsrichter → Quittung nach dem
Eintragen*. Steht der Schalter aus, entsteht gar keine Outbox-Zeile; die Eintragung selbst bleibt
davon unberührt und wird auf dem Bildschirm ohnehin quittiert. Ein Verein mit knappem
Nachrichtenbudget spart damit je Eintragung eine Nachricht (Regel 33).

**An wen:** nur an die Person, die sich gerade eingetragen hat.

**Variablen:** `{{1}}` Vorname · `{{2}}` Platz (Schiedsrichter 1/2, Ersatz 1/2) · `{{3}}` Spiel ·
`{{4}}` Ort · `{{5}}` Vorlauf bis Anpfiff.

**Im Code:** `src/server/assignments.ts` → `assignmentIntent`, Art `assignment`, Schlüssel
`assignment:<Spiel>:<Person>:<Platz>`. Sie wird in derselben Transaktion angelegt wie die
Eintragung und mit dem nächsten Lauf zugestellt.

**Text:**
```
Hallo {{1}},

du stehst als {{2}} für das Spiel:
{{3}}
Ort: {{4}}
Anpfiff {{5}}.

Vielen Dank für Deinen Einsatz!
```

> **Was hier bewusst *nicht* mehr steht.** Frühere Fassungen endeten mit „Rechtzeitig vor
> Anpfiff bitten wir dich noch um eine Bestätigung." Das hat mehr verwirrt als geholfen: die
> Bitte kommt ohnehin als eigene Nachricht (Vorlage 3), und wer sie hier schon liest, hält die
> Quittung fälschlich für sie und wundert sich später über die zweite Nachricht.

**Beispielwerte:** `Jonas` · `Schiedsrichter 1` ·
`Sa 29.08.2026, 10:30 Uhr · U14 · BG Nordstadt gegen TV Ostheim` · `Sporthalle Nordstadt, Feld 2` ·
`in 6 Tagen`

**Button:** Website-Link, Text `Zum Kalender`, URL `https://schiriplan.example.org/kalender`
(statisch — diese Nachricht erwartet keine Antwort)

---

### 3 · `schiriplan_bestaetigung_erbeten` — UTILITY

**Wann:** wenn der eingestellte Vorlauf für die Pflichtbestätigung erreicht ist — Standard
**72 Stunden** vor Anpfiff, in den Vereinseinstellungen änderbar (Regel 10). Wer sich erst
innerhalb dieses Vorlaufs einträgt, bekommt sie beim nächsten Lauf nach seiner Eintragung; die
Nachfassfrist läuft dann ab diesem Zeitpunkt und nicht ab dem Vorlauf.

**An wen:** an die Eingetragenen auf **Schiedsrichter 1 und 2**, solange sie nicht bestätigt haben.
Ersatz bestätigt nicht (Regel 12). Abgesagte Spiele und Spiele nach Anpfiff sind ausgenommen.

**Wie oft:** einmal je Person und Spiel.

**Variablen:** `{{1}}` Vorname · `{{2}}` Spiel · `{{3}}` Ort · `{{4}}` Vorlauf in Worten
(„in 3 Tagen").

**Im Code:** `dueConfirmations` in `src/domain/scheduler.ts`, Art `confirmation-request`,
Schlüssel `confirmation:<Spiel>:<Person>:initial`.

**Text:**
```
Hallo {{1}},

bitte bestätige kurz, dass du an Deinen Einsatz denkst:
{{2}}
Ort: {{3}}
Anpfiff {{4}}.

Tippe unten, um zu bestätigen.
```

**Beispielwerte:** `Jonas` ·
`Sa 29.08.2026, 10:30 Uhr · U14 · BG Nordstadt gegen TV Ostheim` · `Sporthalle Nordstadt, Feld 2` ·
`in 3 Tagen`

**Button:** Website-Link, Text `Jetzt bestätigen`, **dynamische** URL
`https://schiriplan.example.org/antwort/{{1}}`

**Beispielwert des Knopfes:** `eyJrIjoiY29uZmlybSIsImciOiJnLTIwMjYtMDgtMjkiLCJyIjoici1qayJ9.Qm9YV3pKc0RmMkg0ZQ`

Der Knopf führt auf den eindeutigen Antwortlink **dieser** Nachricht: er bestätigt genau dieses
Spiel und keins der anderen, die dieselbe Person am selben Wochenende pfeift.

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

Bitte gib uns kurz Bescheid, dass du an Deinen Einsatz denkst — ein Tippen genügt.
```

> **Was hier bewusst *nicht* steht.** Frühere Fassungen endeten mit „sonst müssen wir den Platz
> neu besetzen". Genau dieser Satz lädt zur Absage ein: wer liest, dass sich ohnehin ein Ersatz
> findet, entscheidet sich eher dagegen. Regel 45 verbietet den Hinweis auf einen Nachfolger in
> **allen** Vorlagen — betroffen waren diese hier und Vorlage 5.

**Beispielwerte:** wie oben

**Button:** Website-Link, Text `Jetzt bestätigen`, **dynamische** URL
`https://schiriplan.example.org/antwort/{{1}}`, Beispielwert wie bei Vorlage 3. Der Token ist ein
anderer als bei Vorlage 3 — er trägt den Schlüssel *dieser* Nachricht, damit im Prüfprotokoll
steht, auf welche der beiden Bitten hin bestätigt wurde.

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

**Variablen:** `{{1}}` Vorname · `{{2}}` der frei gewordene Platz · `{{3}}` Spiel · `{{4}}` Ort ·
`{{5}}` Vorlauf bis Anpfiff · `{{6}}` Antwortfrist mit Datum und Uhrzeit.

**Im Code:** `planPromotions` in `src/domain/scheduler.ts`, angelegt in `openOffer`
(`src/server/scheduler.ts`), Art `promotion-offer`, Schlüssel `promotion:<Anfrage-Id>`. Der
Schlüssel hängt an der Anfrage und nicht an Spiel und Platz — sonst bliebe eine zweite
Nachrück-Runde für dieselbe Person stumm.

**Text:**
```
Hallo {{1}},

du bist als Ersatz eingetragen, und {{2}} ist frei geworden:
{{3}}
Ort: {{4}}
Anpfiff {{5}}.

Bitte sage bis {{6}} zu oder ab.
```

> Auch hier steht **nicht** mehr „ohne Antwort fragen wir den nächsten Ersatz" (Regel 45). Die
> Frist sagt bereits alles, was der Empfänger für seine Entscheidung braucht.

**Beispielwerte:** `Tim` · `Schiedsrichter 1` ·
`Sa 29.08.2026, 10:30 Uhr · U14 · BG Nordstadt gegen TV Ostheim` · `Sporthalle Nordstadt, Feld 2` ·
`in 2 Tagen` · `Do 27.08.2026, 18:00 Uhr`

**Button:** Website-Link, Text `Zu oder Absagen`, **dynamische** URL
`https://schiriplan.example.org/antwort/{{1}}`

Der Knopf nennt beide Antworten, weil hinter ihm beide stehen — wer nur „Antworten" liest,
vermutet dahinter ein Formular. Der Token hängt hier an der **Id der Anfrage**. Wird dieselbe Person später erneut gefragt, ist
das eine neue Anfrage mit eigener Adresse — die alte kann die neue Frage nicht beantworten. Auf
der Seite stehen beide Antworten zur Wahl: *Ja, ich rücke nach* und *Nein, diesmal nicht*. Ein
„Ja" trägt die Person auf den Schiedsrichter-Platz um und stellt die Pflichtbestätigung neu
(Regel 16); ein „Nein" gibt die Kaskade an den nächsten Ersatz weiter.

---

### 6 · `schiriplan_platz_frei` — UTILITY *(Umkategorisierungs-Risiko, siehe oben)*

**Wann:** wenn die Nachrück-Kaskade nichts mehr anzubieten hat — kein Ersatz eingetragen, oder
alle haben abgelehnt beziehungsweise ihre Frist verstreichen lassen (Regel 15). Danach wiederholt
sich die Ausschreibung **14, 7, 3 und 1 Tag** vor Anpfiff, jede Stufe höchstens einmal (Regel 32).
Fällt ein Lauf aus, wird nur die zuletzt erreichte Stufe nachgeholt und nicht jede verpasste.

**An wen:** an **alle** Personen, die für die Liga qualifiziert sind, die nötige Lizenz haben
und nicht schon in diesem Spiel stehen — in Rotationsreihenfolge (Regel 19). Wem die Lizenz
fehlt, bekommt sie nicht: eine Ausschreibung an jemanden, der sich anschließend nicht eintragen
darf, kostet Geld und stiftet nur Verwirrung. Das ist die einzige Vorlage, die viele Nachrichten
auf einmal auslöst; rechnen Sie sie bei den Kosten gesondert.

**Abschaltbar:** vollständig, in drei Stufen (Regel 47) — *Einstellungen → Nachrichten an
Schiedsrichter → Offene Plätze ausschreiben an*:

| Einstellung | Wirkung |
| --- | --- |
| **alle Qualifizierten** | wie bisher: diese Vorlage an alle Qualifizierten in Rotationsreihenfolge |
| **nur die Admins** | statt dieser Vorlage geht **6b** einmal am Abend an die aktiven Admins — als Bilanz aller Lücken, nicht als Nachricht je Spiel |
| **aus** | gar keine Ausschreibung; die Lücke steht nur in der Übersicht und in den Meldungen |

Der Schalter „automatische Nachfrage" steuert davon unabhängig nur die **Wiederholungen** 14, 7,
3 und 1 Tag vor Anpfiff. Früher ging die erste Ausschreibung in jedem Fall raus, weil sonst
niemand von der Lücke erfahren hätte; mit „nur Admins" gibt es dafür jetzt einen leiseren Weg —
und mit „aus" eine bewusste Entscheidung des Vereins.

**Variablen:** `{{1}}` Vorname · `{{2}}` Spiel · `{{3}}` Ort · `{{4}}` Vorlauf bis Anpfiff.

**Im Code:** `openSlotAnnouncement` in `src/domain/scheduler.ts`, Art `open-slot-announcement`,
Schlüssel `open-slot:<Spiel>:<Vakanz-Zähler>:<Stufe>`. Der Vakanz-Zähler steigt, sobald ein Platz
erneut frei wird — sonst sähe die zweite Ausschreibung desselben Spiels wie eine Doppelung aus.

**Text:**
```
Hallo {{1}},

für dieses Spiel fehlt uns noch ein Schiedsrichter:
{{2}}
Ort: {{3}}
Anpfiff {{4}}.

Bitte, schau nochmal, ob du das Spiel vielleicht übernehmen kannst.
```

**Beispielwerte:** `Jonas` ·
`Sa 29.08.2026, 10:30 Uhr · U14 · BG Nordstadt gegen TV Ostheim` · `Sporthalle Nordstadt, Feld 2` ·
`in 5 Tagen`

**Button:** Website-Link, Text `Offene Spiele`, URL `https://schiriplan.example.org/spiele`
(statisch — hier trägt sich jemand ein, es wird nichts beantwortet)

---

### 6b · `schiriplan_platz_frei_admin` — UTILITY *(nur an Admins)*

Dieselbe Sache, anderer Leserkreis — und deshalb ein ganz anderer Zuschnitt. Die
Qualifizierten hören von **einem** Spiel, das sie übernehmen könnten. Die Admins hören von
**allen**: sie besetzen nicht selbst, sie sorgen dafür, dass besetzt wird. Zehn Lücken ergaben
früher zehn gleichlautende Aufrufe an dieselben drei Leute; jetzt ist es eine Bilanz.

**Wann:** ab **18 Uhr Vereinszeit**, einmal je Kalendertag, solange irgendein künftiges Spiel
eine Lücke hat — und nur bei der Einstellung „nur die Admins". Der Schlüssel trägt das Datum in
Vereinszeit: ein zweiter Lauf am selben Abend schickt nichts nach.

Anders als Vorlage 6 hängt sie **nicht** an der Nachrück-Kaskade und nicht am Schalter
„automatische Nachfrage": sie meldet den Stand, nicht ein Ereignis. Wer sie nicht will, stellt
die Ausschreibung auf „alle Qualifizierten" oder auf „aus".

**An wen:** an alle aktiven Admins. Qualifikation und Lizenz spielen keine Rolle.

**Variablen:** `{{1}}` Vorname des Admins · `{{2}}` Anzahl der Spiele mit mindestens einem
offenen Schiedsrichter-Platz · `{{3}}` Anzahl der Spiele, bei denen **beide**
Schiedsrichter-Plätze offen sind · `{{4}}` Zeit bis zum Anpfiff des nächsten Spiels mit Lücke.

Drei Dinge zur Zählweise, weil sie die Zahlen bestimmen:

- **Gezählt wird über alle künftigen Spiele der Saison**, nicht über den Planungshorizont von
  60 Tagen. „Diese Saison" soll auch diese Saison heißen.
- **Ersatzplätze zählen nicht mit.** Ein fehlender Ersatz ist kein Loch im Spielplan, sondern
  ein fehlendes Polster.
- **`{{3}}` ist eine Teilmenge von `{{2}}`.** Ein Spiel ohne jeden Schiedsrichter hat auch
  mindestens einen offenen Platz und steht in beiden Zahlen.

**Im Code:** `dueAdminOpenSlots` in `src/domain/scheduler.ts`, Art `admin-open-slots`, Schlüssel
`open-slots-admin:<Kalendertag>`. Die Zahlen kommen aus `loadOpenSlots`
(`src/server/scheduler.ts`), das über den ganzen künftigen Spielplan zählt.

**Text:**
```
Hallo {{1}},

diese Saison fehlen noch für {{2}} Spiele Schiedsrichter.

{{3}} Spiele haben noch gar keinen Schiedsrichter.

Das nächste Spiel mit Lücke startet in {{4}}.

Bitte, kümmere dich darum, dass die Spiele besetzt werden.
```

**Beispielwerte:** `Nele` · `7` · `2` · `3 Tagen`

> **Achtung beim Beispielwert von `{{4}}`.** Das „in" steht schon im Vorlagentext; der Wert
> trägt nur die Dauer — `3 Tagen`, nicht `in 3 Tagen`. Sonst steht in der Nachricht „startet in
> in 3 Tagen".

**Button:** Website-Link, Text `Übersicht`, URL `https://schiriplan.example.org/uebersicht`

---

### 7 · `schiriplan_termin_geaendert` — UTILITY

**Wann:** sobald ein Admin Anpfiff oder Ort eines Spiels speichert (Regel 17). Sie wird in
derselben Transaktion angelegt wie die Änderung.

**An wen:** an alle Eingetragenen, Ersatzleute eingeschlossen.

**Variablen:** `{{1}}` Vorname · `{{2}}` der **bisherige** Termin samt Liga und Mannschaften ·
`{{3}}` der **bisherige** Ort · `{{4}}` der **neue** Termin · `{{5}}` der **neue** Ort ·
`{{6}}` Vorlauf bis zum neuen Anpfiff.

Die Reihenfolge ist Absicht: zuerst das Spiel, das der Leser kennt — mit dem Termin, den er
sich notiert hat —, dann die Änderung. Umgekehrt müsste er erst suchen, welches seiner Spiele
gemeint ist. `{{2}}` trägt deshalb Liga und Mannschaften mit, `{{4}}` nicht mehr: der neue
Termin steht daneben und braucht sie nicht zu wiederholen.

**Im Code:** `src/server/admin/games.ts` → `relocationIntent`, Art `relocation`, Schlüssel
`relocation:<Spiel>:<Änderungszähler>`. Jede weitere Verlegung ist eine neue Nachricht. Der
alte Termin und der alte Ort stehen im Inhalt der Outbox-Zeile; der neue wird beim Versand
frisch gelesen, damit eine zweite Verlegung vor der Zustellung nicht den falschen Termin nennt.

**Text:**
```
Hallo {{1}},

du bist als Schiedsrichter für dieses Spiel eingetragen:
{{2}}
Ort: {{3}}

Das Spiel wurde verlegt:

Neue Zeit: {{4}}

Neuer Ort: {{5}}.
Anpfiff {{6}}.

Passt der neue Termin?
Bitte sag zu oder ab.
```

**Beispielwerte:** `Jonas` ·
`Sa 29.08.2026, 10:30 Uhr · U14 · BG Nordstadt gegen TV Ostheim` · `Sporthalle Nordstadt, Feld 2` ·
`Sa 05.09.2026, 10:30 Uhr` · `Zeppelinhalle` · `in 9 Tagen`

**Button:** Website-Link, Text `Zu oder Absagen`, **dynamische** URL
`https://schiriplan.example.org/antwort/{{1}}`

Auf der Seite stehen *Ich bleibe dabei* und *Ich sage ab*. Der Token trägt den Änderungszähler:
wird dasselbe Spiel ein zweites Mal verlegt, ist die alte Adresse für die neue Frage nicht mehr
zuständig — sie zeigt dann den aktuellen Stand.

---

### 8 · `schiriplan_spiel_abgesagt` — UTILITY

Eigene Vorlage, weil der Text sich inhaltlich unterscheidet: hier gibt es nichts zu entscheiden.

**Wann:** wenn ein Admin das Spiel absagt.

**An wen:** an alle Eingetragenen, Ersatzleute eingeschlossen.

**Variablen:** `{{1}}` Vorname · `{{2}}` Spiel · `{{3}}` Ort.

Der Vorlauf fehlt hier als einzige Ausnahme von Regel 44 — und nur er: das **Datum** steht in
`{{2}}` wie überall. „In 3 Tagen" wäre bei einem Spiel, das ausfällt, eine Dringlichkeit, die es
nicht mehr gibt.

**Im Code:** dieselbe Art `relocation` wie Vorlage 7 — unterschieden wird am **frisch gelesenen**
Zustand des Spiels (`cancelled`). Der Code wählt daran den Vorlagennamen; wird ein verlegtes
Spiel vor der Zustellung doch abgesagt, geht die Absage raus und nicht der neue Termin.

**Text:**
```
Hallo {{1}},

dieses Spiel fällt aus:
{{2}}
Ort: {{3}}

Du musst nichts weiter tun.
```

**Beispielwerte:** `Jonas` ·
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

**Variablen:** `{{1}}` Vorname · `{{2}}` Vorlauf in Worten („1 Tag") · `{{3}}` Spiel · `{{4}}` Ort ·
`{{5}}` verbleibende Zeit bis Anpfiff.

`{{2}}` und `{{5}}` sehen ähnlich aus und sind es nicht: `{{2}}` ist die **eingestellte**
Vorlaufzeit aus dem Profil („1 Tag vor Anpfiff"), `{{5}}` die **tatsächlich** verbleibende Zeit
(„in 22 Stunden"). Sie fallen auseinander, sobald ein Lauf ausfällt und die Erinnerung
nachgeholt wird.

**Im Code:** `duePersonalReminders` in `src/domain/scheduler.ts`, Art `personal-reminder`,
Schlüssel `reminder:<Spiel>:<Person>:<Stunden>`.

**Text:**
```
Hallo {{1}},

Erinnerung: {{2}} vor Anpfiff.
{{3}}
Ort: {{4}}
Anpfiff {{5}}.

Bis dann!
```

**Beispielwerte:** `Jonas` · `1 Tag` ·
`Sa 29.08.2026, 10:30 Uhr · U14 · BG Nordstadt gegen TV Ostheim` · `Sporthalle Nordstadt, Feld 2` ·
`in 22 Stunden`

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

**Variablen:** `{{1}}` Vorname des Admins · `{{2}}` Spiel · `{{3}}` was los ist.

**Im Code:** `dueConfirmationAlerts` in `src/domain/scheduler.ts`, Art `admin-alert`, Schlüssel
`admin-alert:confirmation-overdue:<Spiel>:<Person>`. Der Inhalt der Outbox-Zeile trägt nur noch
den **Anlass**; das Spiel steht in `{{2}}` und wird beim Versand frisch gelesen — ein beim
Anlegen eingebauter Termin wäre nach einer Verlegung falsch.

**Text:**
```
Hallo {{1}},

es gibt eine Meldung zu einem Spiel:
{{2}}

{{3}}

Bitte in der Spielübersicht nachsehen und das Problem lösen.
```

**Beispielwerte:** `Nele` ·
`Sa 29.08.2026, 10:30 Uhr · U14 · BG Nordstadt gegen TV Ostheim` ·
`Jonas hat die Pflichtbestätigung seit 24 Stunden nicht beantwortet.`

Datum und Vorlauf (Regel 44) stehen in `{{2}}` — der Admin soll aus der Meldung allein
entscheiden können, ob es eilt, und `{{3}}` muss sie deshalb nicht wiederholen.

**Button:** Website-Link, Text `Meldungen`, URL `https://schiriplan.example.org/meldungen`

---

### 11 · `schiriplan_tagesuebersicht` — UTILITY *(nur an Admins)*

**Wann:** ab **18 Uhr Vereinszeit**, einmal je Kalendertag, und nur wenn mindestens ein kommendes
Spiel **im eingestellten Zeitraum** einen offenen Schiedsrichter-Platz oder eine ausstehende
Bestätigung hat (Regel 20). Der Schlüssel trägt das Datum in Vereinszeit, nicht die Laufzeit des
Zeitplans: ein zweiter Lauf am selben Abend schickt nichts nach.

**Zwei Schalter, und sie liegen an verschiedenen Stellen:**

| Schalter | Wo | Wirkung |
| --- | --- | --- |
| Tageszusammenfassung | *Einstellungen* (vereinsweit) | schaltet sie für **alle** Admins ab |
| Tagesübersicht an mich schicken | *Profil* (je Admin) | schaltet sie nur für **diesen** Admin ab |
| Zeitraum in Wochen | *Profil* (je Admin) | wie weit sie vorausschaut, Standard **4 Wochen** |

**An wen:** an jeden aktiven Admin, der sie nicht abgeschaltet hat — **eine Nachricht je Admin**,
und der Inhalt kann sich unterscheiden. Wer vier Wochen eingestellt hat, sieht ein Spiel in zehn
Tagen; wer eine Woche eingestellt hat, nicht. Ohne Zeitraum stünde am Saisonanfang der halbe
Spielplan in der Nachricht und niemand läse sie zu Ende.

**Variablen:** `{{1}}` Vorname des Admins · `{{2}}` Anzahl der Spiele · `{{3}}` die Liste, eine
Zeile je Spiel.

**Jede Zeile in `{{3}}` nennt Datum, Uhrzeit und Vorlauf** (Regel 44) und danach erst, was fehlt:

```
Sa 29.08.2026, 10:30 Uhr (in 3 Tagen) · BG Nordstadt gegen TV Ostheim (U14): Schiedsrichter 1 offen.
```

Ohne das Datum müsste der Admin nachschlagen, welcher Samstag „in 3 Tagen" ist; ohne den Vorlauf
müsste er nachrechnen, wie eilig es ist. Beides gehört in dieselbe Zeile, weil eine
Zusammenfassung genau dafür da ist: entscheiden, ohne die Übersicht zu öffnen.

**Im Code:** `dueDigest` in `src/domain/scheduler.ts`, Art `daily-digest`, Schlüssel
`digest:<Kalendertag>`. Der Schlüssel ist zusammen mit dem Empfänger eindeutig — deshalb genügt
er, obwohl jeder Admin seine eigene Zeile in der Outbox bekommt. Zeitraum und Schalter stehen in
`referees.digest_weeks` und `referees.digest_enabled`.

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

**Beispielwerte:** `Nele` · `2` ·
`Sa 29.08.2026, 10:30 Uhr (in 3 Tagen) · BG Nordstadt gegen TV Ostheim (U14): Schiedsrichter 1 offen. · So 30.08.2026, 12:00 Uhr (in 4 Tagen) · TSV Süd gegen BG Nordstadt (U16): 1x Bestätigung ausstehend.`

**Button:** Website-Link, Text `Übersicht`, URL `https://schiriplan.example.org/uebersicht`

---

## So legen Sie eine Vorlage an

1. **business.facebook.com** → WhatsApp Manager → **Nachrichtenvorlagen** → *Vorlage erstellen*
2. Kategorie wählen (siehe oben), Name eintragen, Sprache **Deutsch**
3. Text einfügen. Variablen als `{{1}}`, `{{2}}` … **fortlaufend ab 1, ohne Lücken**
4. **Beispielwerte ausfüllen** — ohne sie lehnt Meta ab. Nehmen Sie die oben angegebenen
5. Button hinzufügen, wo angegeben. Steht dort **dynamische URL**, wählen Sie beim Knopf den Typ
   „Dynamisch", tragen die Adresse mit `{{1}}` am **Ende** ein und füllen den Beispielwert mit
   einem glaubwürdigen Token
6. Absenden. Die Freigabe dauert meist Minuten, gelegentlich bis 24 Stunden

### Woran Vorlagen scheitern

- **Variable am Anfang oder Ende des Textes.** Deshalb endet oben jede Vorlage mit einem Satz.
- **Zwei Variablen direkt hintereinander** (`{{1}} {{2}}` ohne Text dazwischen).
- **Fehlende oder unglaubwürdige Beispielwerte.** „Test" oder „xxx" wird abgelehnt.
- **Falsche Kategorie.** Etwas Einladendes als UTILITY einzureichen führt zur Umkategorisierung,
  nicht zur Ablehnung — es wird dann nur teurer.
- **Mehr als 1024 Zeichen** im Textteil. Alle Vorlagen oben liegen weit darunter.
- **Mehr als eine Variable im URL-Knopf oder eine Variable mitten in der Adresse.** Meta erlaubt
  genau eine, und nur am Ende — deshalb steht der Antwort-Token im Pfad.

### Wenn Sie es lieber per API machen

Zwölf Vorlagen von Hand anzuklicken ist mühsam und fehleranfällig. Meta nimmt sie auch über die
Graph-API entgegen (`POST /{waba-id}/message_templates`). Sagen Sie Bescheid, wenn Sie ein
Skript dafür möchten — dann liegen die Vorlagen im Repo neben ihren Texten und lassen sich
wiederholbar einspielen.

---

## Was der Code tut

Die Anwendung schickt die Vorlagen bereits. Jede Nachricht steht in
`src/notifications/templates.ts` als **Vorlagentext mit `{{1}}`, `{{2}}` …** und einer Liste
ihrer Werte; daraus entsteht beides — der Vorlagen-Aufruf für WhatsApp und, durch Einsetzen
derselben Werte in denselben Text, der Fließtext für E-Mail, Entwicklung und die Vorschau unter
`/dev/outbox`. Es gibt genau eine Quelle für den Wortlaut, also können Vorschau und Versand
nicht auseinanderlaufen.

Der Rumpf, den `src/notifications/channel.ts` an die Cloud API schickt:

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
          { "type": "text", "text": "Jonas" },
          { "type": "text", "text": "1 Tag" },
          { "type": "text", "text": "Sa 29.08.2026, 10:30 Uhr · U14 · BG Nordstadt gegen TV Ostheim" },
          { "type": "text", "text": "Sporthalle Nordstadt, Feld 2" },
          { "type": "text", "text": "in 22 Stunden" }
        ]
      }
    ]
  }
}
```

Sechs Dinge, die dabei zu wissen sind:

1. **Die Namen sind fest verdrahtet.** Legen Sie die Vorlagen bei Meta unter genau den Namen an,
   die oben in den Überschriften stehen. Ein Tippfehler im Namen führt zu einer abgelehnten
   Nachricht (Code 132001), und die Outbox gibt sie sofort auf, statt sie zu wiederholen — das
   ist Absicht, ein zweiter Versuch würde nur erneut kosten.
2. **Zwei Arten teilen sich auf je zwei Vorlagen.** `relocation` wird zu
   `schiriplan_termin_geaendert` oder `schiriplan_spiel_abgesagt`, je nach **frisch gelesenem**
   Zustand des Spiels. Die Ausschreibung ist dagegen in zwei Arten getrennt:
   `open-slot-announcement` (Vorlage 6, an die Qualifizierten, je Spiel) und `admin-open-slots`
   (Vorlage 6b, an die Admins, als Tagesbilanz) — sie haben verschiedene Auslöser und
   verschiedene Inhalte.
3. **Der Antwort-Token geht als Knopf-Parameter mit.** Er entsteht beim Versand in
   `src/server/outbox.ts` über `answerClaimsFor` und `issueAnswerToken` und wird als eigene
   Komponente angehängt:

   ```jsonc
   {
     "type": "button",
     "sub_type": "url",
     "index": "0",
     "parameters": [{ "type": "text", "text": "<Token>" }]
   }
   ```

   Betroffen sind die Vorlagen 3, 4, 5 und 7 — genau die, die eine Antwort erwarten. Fehlt der
   Token (das Spiel ist verschwunden oder abgesagt), entfällt die Komponente und der Fließtext
   verweist auf den Kalender.
4. **Parameterwerte sind einzeilig.** Meta lässt in einem Variablenwert keine Zeilenumbrüche,
   Tabulatoren oder längeren Leerraum zu. Der Code räumt jeden Wert vorher auf; die Liste der
   Tagesübersicht wird dabei mit „ · " zu einer Zeile verbunden.
5. **Über WhatsApp geht bei der Anmeldung nur der Code**, nicht der Link — in eine
   AUTHENTICATION-Vorlage passt keiner. Über E-Mail geht weiterhin beides.
6. **Ohne Vorlage bleibt der Fließtext.** Er ist kein Ersatz, sondern der Fall „im
   24-Stunden-Fenster". Außerhalb lehnt Meta ihn ab, und der Fehler ist dauerhaft — die
   Nachricht wird nicht wiederholt.

### Wenn eine Vorlage abgelehnt wird

Die Outbox gibt bei den Codes 132000, 132001, 132007, 132012 und 132015 sofort auf und schreibt
den Grund in `notification_outbox.last_error`. Unter `/dev/outbox` steht er lesbar daneben. Die
häufigsten Ursachen: Name falsch geschrieben, Vorlage noch nicht freigegeben, oder die Zahl der
Parameter im Code passt nicht zu der in der freigegebenen Vorlage. Das Letzte fällt erst beim
Versand auf — vergleichen Sie deshalb beim Anlegen die Variablenzahl mit der Liste oben.

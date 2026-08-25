# WhatsApp-Vorlagen bei Meta anlegen

Diese Datei ist die Vorlage für die Vorlagen: welche Sie anlegen müssen, mit welchem Text, in
welcher Kategorie — und was der Code dafür noch braucht.

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

## Die elf Vorlagen

Alle in Sprache **Deutsch (`de`)**. Die Namen sind so gewählt, wie der Code sie später erwartet:
Kleinbuchstaben, Ziffern, Unterstriche — Meta lässt nichts anderes zu.

Ersetzen Sie `https://schiriplan.example.org` überall durch Ihre echte Adresse (dieselbe, die in
`PUBLIC_BASE_URL` steht).

---

### 1 · `schiriplan_anmeldung` — AUTHENTICATION

Die einzige Vorlage dieser Kategorie und die einzige mit festem Aufbau: Sie können den Text
nicht frei schreiben, sondern klicken die Bausteine an.

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

Konkret fehlen drei Dinge:

1. **Je Nachrichtenart ein Vorlagenname und eine Parameterliste.** Die Texte in
   `src/notifications/templates.ts` müssen die Bestandteile einzeln herausgeben, nicht nur den
   fertigen Fließtext. Der E-Mail- und der Dev-Kanal setzen sie weiterhin zum Fließtext zusammen
   — die Texte oben und die in der Anwendung bleiben also dieselben.
2. **`channel.ts` muss `type: 'template'` schicken**, wenn eine Vorlage hinterlegt ist.
3. **Die Anmeldung über WhatsApp verschickt nur noch den Code**, nicht den Link (siehe Vorlage 1).

Das ist ein überschaubarer, aber echter Umbau mit eigenen Tests. Er steht bewusst noch nicht im
Code: solange keine Vorlage freigegeben ist, könnte man ihn gegen nichts prüfen.

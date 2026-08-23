# Briefing-Historie aus Claude Design

Rohmaterial aus der Design-Session, aus der `Schiri-Planer Mockup.dc.html` entstanden ist.
Hier steht der ursprüngliche Auftrag **und** die Änderungswünsche, die ihn danach überschrieben
haben. Bei Widerspruch gilt: **Änderungswunsch schlägt Erst-Briefing**, und das gebaute Mockup
schlägt beides.

Die ausgewertete, entscheidungsreife Fassung steht in [`../PLAN.md`](../PLAN.md) —
insbesondere Abschnitt 2 (Regeln) und Abschnitt 6 (was gestrichen wurde).

---

## 1. Erst-Briefing

> Auftrag: Interaktives Mockup – Schiedsrichter-Planungs-App (Basketballverein)
>
> Bitte ein interaktives Mockup erstellen, sowohl für Desktop-Website als auch für Mobile
> (App-artiges Layout, responsive), damit man das dem Verein zeigen und über das Design
> diskutieren kann. Kein funktionierendes Backend nötig – reines UI/UX-Mockup zum Durchklicken.
>
> **Kontext:** Web-App (mit mobiler Nutzung) für die Schiedsrichterplanung eines
> Basketball-Jugendvereins. Ziel: Spiele/Termine mit Ort und Uhrzeit werden eingetragen,
> verfügbare Schiedsrichter können sich dafür bewerben oder sich für Tage sperren, und die App
> verteilt die Spiele möglichst fair und automatisch.
>
> **Rollen:** Schiedsrichter (Nutzer), Admin (Vereinsverwaltung)
>
> **1. Login** — Eingabe der Telefonnummer · Login-Link per WhatsApp (Magic Link, kein Passwort) ·
> Accounts werden ausschließlich vom Admin angelegt, keine Selbstregistrierung
>
> **2. Spielverwaltung (Admin)** — Spiele anlegen mit Datum, Uhrzeit, Ort, Altersklasse ·
> Übersicht pro Spiel: beworben / gesperrt / keine Reaktion · Zuteilungsmodus einstellbar ·
> Knopf „Erinnerung an Schiedsrichter senden" · Knopf „Notruf-Erinnerung" für Spiele ohne
> Schiedsrichter
>
> **3. Schiedsrichter-Bereich** — Swipe-Interface: rechts bewerben, links Tag sperren ·
> Standard-Verfügbarkeit als Wochenplan · Kalender/Verlauf · Statistik der gepfiffenen Spiele
> pro Monat (relevant wegen Bezahlung pro Spiel) · Profil mit Avatar, Name, Telefonnummer
>
> **4. Automatische Zuteilung, im Admin konfigurierbar** — Max. 1 Spiel pro Tag (ein/aus) ·
> Faire Rotation, wer länger nichts hatte wird bevorzugt (ein/aus, mit Zeitraum) ·
> Qualifikation/Altersklasse wird immer berücksichtigt (Pflicht, nicht abschaltbar)
>
> **5. Swipe-Bestätigung, im Admin konfigurierbar** — Bewerbung teilt entweder sofort verbindlich
> zu (First-Come-First-Served) oder zählt nur als Bewerbung, die System oder Admin bestätigt.
> Beide Zustände zeigen: „Zugeteilt ✅" vs. „Beworben, wartet auf Bestätigung ⏳"
>
> **6. Qualifikationssystem** — Feste Kategorien · Admin weist sie per Auswahl zu · nur passend
> Qualifizierte können sich bewerben
>
> **7. Notifications** — WhatsApp: Login-Link, Erinnerungen, Zuteilungsbenachrichtigung
> „Das Spiel gehört dir"
>
> **Hinweis:** Klare, konsistente Statusfarben — grün = zugeteilt, gelb/orange = beworben/wartet,
> rot = gesperrt/offen ohne Schiedsrichter. Das ist für Admin und Schiedsrichter gleichermaßen
> die zentrale Information.

**Umfang, in der Session festgelegt:** alle 9 Screens, Mobile + Desktop · Board **und**
klickbarer Prototyp · Mobile im iPhone-Rahmen · Wischgeste echt bedienbar · Sprache Deutsch.

---

## 2. Änderungswünsche nach dem ersten Entwurf

Diese Liste hat das Erst-Briefing an vielen Stellen überschrieben.

**Streichungen**
- Standard-Verfügbarkeit rausnehmen
- Immer First come first served — damit entfallen der zweite Zuteilungsmodus und der Zustand
  „beworben, wartet auf Bestätigung"

**Umdeutung der Wischgeste**
- Tagesansicht pro Spieltag mit allen Spielen; Wischen wechselt den **Spieltag**, nicht mehr
  bewerben/sperren

**Neue Funktionen**
- Spiele per CSV-Import anlegen; Spiele bearbeiten und verschieben
- Öffentliches Dashboard ohne Login: kommende Spiele mit Schiedsrichter-Kürzeln; Name und
  Profilbild bleiben hinter dem Kürzel verborgen und werden erst nach Login sichtbar
- Zwei Ersatz-Schiedsrichter pro Spiel eintragbar
- Admin-Ansicht für unbesetzte Spiele
- Zusätzliche Erinnerungen im Zeitraum 7 Tage bis 1 Stunde vor dem Spiel, Zeitpunkt frei wählbar
- Admins können Leute aus Spielen rauswerfen
- Rotations-Zeitraum als Schalter, nur sichtbar wenn das Feature an ist
- Pflichtbenachrichtigung 72 h vor dem Spiel (vom Admin einstellbar) mit Bestätigungsknopf
  „Ja, habe ich gelesen und mache es". Ohne Bestätigung innerhalb von 24 h: erneute Erinnerung
  und Nachricht an die Admins
- Viele Benachrichtigungen an den Admin, mit allen Infos zu unbesetzten Spielen
- Ligen: U14, U16, U18, Erwachsene, Senioren
- Zwei gleichwertige Schiedsrichter pro Spiel
- Verschobenes Spiel: Schiedsrichter erhält Benachrichtigung mit Absage-Option, der Ersatz genauso
- Ranking, das die eigene Position zeigt, z. B. „#5 der meist gepfiffenen Spiele"
- Nach dem Login standardmäßig die nächsten Spiele zeigen (Kalender & Verlauf); merken, was
  zuletzt offen war, und das gegebenenfalls zuerst öffnen
- Öffentliche Ansicht im Menü nach oben
- Ab der 4. Benachrichtigung (inklusive) Hinweis: „Du hast schon N Benachrichtigungen, jede
  kostet Geld — wirklich eine neue hinzufügen?"
- Hard-Limit bei 10 Benachrichtigungen
- Bearbeitung der Telefonnummer nur durch Admins
- Statistik in Kalender & Verlauf klarstellen: Ersatz-Spiele zählen nicht
- Kürzel nicht veränderbar, Einstellung nur durch Admins
- Übersicht klar sichtbar nach Spieltagen trennen
- Impressum und Datenschutzerklärung vorbereiten
- Hilfeseite mit Regularien, Name: „Regeln"
- Option, sich bis zu 3 Wochen im Voraus doch noch auszutragen — von Admins überschreibbar
- Option, Ersatz für das Spiel anzufordern

---

## 3. Was daraus offen blieb

Diese Punkte waren aus Briefing und Mockup nicht eindeutig und wurden in der ersten
Implementierungs-Session geklärt. Die Antworten stehen in `../PLAN.md`, Abschnitt 1 und 2.

- Wer erfasst, dass ein Ersatz tatsächlich im Einsatz war (Regel 27)
- Was „Faire Rotation" technisch bewirkt (Regel 19)
- Was mit dem Ersatz passiert, wenn ein Schiedsrichter absagt (Regeln 13–16)
- Wie hart „Max. 1 Spiel pro Tag" greift (Regel 6)

# Term

* [Ausschreibung](ausschreibung.md) - Nachricht über einen offenen Platz an alle Qualifizierten (oder nur die Admins) — die teuerste Nachrichtenart.
* [Ersatz](ersatz.md) - Wer auf Ersatz 1 oder 2 steht: bereit nachzurücken, braucht keine Bestätigung und zählt nicht als Einsatz.
* [Kürzel](kuerzel.md) - Die Initialen einer Person (z. B. NB) — das Einzige, was der öffentliche Spielplan und der CSV-Export von ihr zeigen.
* [Nachrücken](nachruecken.md) - Ein Ersatz übernimmt einen frei gewordenen Schiedsrichterplatz, nach Anfrage mit Frist (promotion offer).
* [Outbox](outbox.md) - Die Warteschlange, durch die jede Nachricht geht: idempotent je Schlüssel und Empfänger, mit Wortlaut-Protokoll.
* [Pflichtbestätigung](pflichtbestaetigung-begriff.md) - Die vorab verlangte Zusage eines Schiedsrichters, dass er das Spiel pfeift; nur für Schiedsrichterplätze.
* [Platz](platz.md) - Einer der vier Plätze eines Spiels: Schiri 1, Schiri 2, Ersatz 1, Ersatz 2 (slot_index 0–3).
* [Qualifikation und Lizenz](qualifikation-und-lizenz.md) - Qualifikation: für welche Liga jemand eingeteilt werden darf. Lizenz: welche Spielstufe jemand pfeifen darf. Beides muss passen.
* [Vorlauf](vorlauf.md) - Die Zeit bis zum Anpfiff, in Nachrichten als „Anpfiff in 3 Tagen"; auch der Abstand einer Erinnerung zum Anpfiff.

# Business Rule

* [Anmeldung mit Passwort: Start-Passwort, Wechselzwang, nur Hashes](passwort-anmeldung.md) - Login mit Telefonnummer und Passwort; ein Start-Passwort aus dem Namen gilt 14 Tage und muss gewechselt werden; gespeichert wird nur ein scrypt-Hash.
* [Ausfall und Nachrück-Kaskade](ausfall-und-nachruecken.md) - Sagt ein Schiri ab, werden Ersatz 1, dann Ersatz 2 mit Frist gefragt; dann wird ausgeschrieben. Frist 12 h, kurz vor Anpfiff ein Drittel der Restzeit.
* [Besetzung: zwei Schiris, zwei Ersatz, wer zuerst kommt](besetzung.md) - Pro Spiel zwei gleichwertige Schiedsrichter- und zwei Ersatzplätze, strikt der Reihe nach, sofort verbindlich, max. ein Spiel pro Tag.
* [Faire Rotation beim Anschreiben und schaltbare Admin-Meldungen](rotation-und-admin-meldungen.md) - Die Rotation bestimmt nur die Reihenfolge der Benachrichtigung, nicht wer sich eintragen darf; Admin-Meldungen sind einzeln schaltbar.
* [Fristen für Austragen und Ersatz anfordern](fristen.md) - Selbst austragen geht bis 3 Wochen vor Anpfiff, Ersatz anfordern bis 3 Tage davor; beide Fristen sind einstellbar, der Admin kann je Spiel freigeben.
* [Lizenzen E, D und C: die höhere deckt die niedrigere](lizenzen.md) - Jedes Spiel verlangt eine Lizenz (Standard E); C deckt D und E, D deckt E. Ohne Lizenz keine Eintragung, sehen darf man trotzdem alles.
* [Nachrichten kosten Geld: Sparsamkeit ist ein Produktziel](nachrichten-sparsamkeit.md) - Jede Nachricht kostet den Verein Geld; neue Auslöser brauchen eine Begründung. Quittung und Ausschreibung sind im Adminbereich schaltbar.
* [Notzugang für ausgesperrte Admins](notzugang.md) - Sperrt sich ein Admin aus, erzeugt ein Befehl auf dem Server einen langen Einmal-Token; gespeichert wird nur sein Hash, er ist widerrufbar.
* [Offene Plätze als Tagesbilanz an die Admins](tagesbilanz-admins.md) - Bei Ausschreibung nur an Admins kommt abends eine Bilanz statt Einzelnachrichten; jeder Admin stellt Zeitraum (Standard 4 Wochen) und Empfang selbst ein.
* [Persönliche Erinnerungen vor dem Spiel](persoenliche-erinnerungen.md) - Jeder wählt Erinnerungen zwischen 1 und 168 Stunden vor Anpfiff; ab der 4. kommt ein Kostenhinweis, höchstens 10 pro Person.
* [Pflichtbestätigung vor dem Spiel](pflichtbestaetigung.md) - Schiedsrichter (nicht Ersatz) bestätigen ihren Einsatz vorab; ohne Antwort nach 24 Stunden folgen Erinnerung und Meldung an die Admins.
* [Sichtbarkeit: ohne Login nur Kürzel](sichtbarkeit.md) - Ohne Login sind nur Kürzel sichtbar — auch nicht in JSON oder HTML-Attributen; Stammdaten ändert nur der Admin, das Profilbild die Person.
* [Statistik: gezählt wird, wer zum Anpfiff auf dem Schiedsrichterplatz steht](statistik.md) - Abrechnungsrelevant zählt nur ein Einsatz auf Schiri 1 oder 2 zum Anpfiff; das Ranking zeigt nur die eigene Person mit Namen und Zahl.
* [Statusfarben eines Spiels](statusfarben.md) - Ein Spiel ist rot (offen/Schiri fehlt) unter zwei Schiris, gelb (Ersatz fehlt) mit zwei Schiris und gelb, grün (besetzt) mit allen vier Plätzen.
* [Telefonnummern: jede Schreibweise rein, eine heraus](telefonnummern.md) - Telefonnummern werden in jeder üblichen Schreibweise angenommen, als E.164 gespeichert und national mit führender Null angezeigt.
* [Verschiebung eines Spiels](verschiebung.md) - Wird ein Spiel verlegt, bekommen Schiedsrichter und Ersatz den neuen Termin mit Absage-Option; eine Absage startet sofort die Nachrück-Kaskade.
* [Wortlaut jeder Nachricht: Datum und Vorlauf, kein Nachfolger, eigener Link, Vorname](nachrichten-wortlaut.md) - Jede Nachricht nennt Datum, Uhrzeit und Vorlauf, stellt keinen Nachfolger in Aussicht, antwortet über einen eigenen Link und spricht mit Vornamen an.

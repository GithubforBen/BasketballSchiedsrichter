# Decision

* [Anmeldung mit Telefonnummer und Passwort statt Link per WhatsApp](anmeldung-mit-passwort.md) - Angemeldet wird mit Telefonnummer und Passwort. Der Login per Link ist gebaut, aber abgeschaltet, weil jeder Link eine WhatsApp-Nachricht kostet.
* [Betrieb auf dem eigenen Server, nach außen nur über Cloudflare Tunnel](hosting-heimserver-cloudflare-tunnel.md) - Schiriplan läuft per Docker Compose auf einem eigenen Server im Heimnetz; öffentlich erreichbar nur über einen Cloudflare Tunnel, ohne offenen Port.
* [Der erste Admin entsteht per Befehl auf dem Server](erster-admin-per-befehl.md) - Weil Konten ausschließlich Admins anlegen, entsteht der erste Admin über npm run seed:admin, nicht über die Oberfläche.
* [Deutsch fest, keine Übersetzungsebene](deutsch-ohne-i18n.md) - Die Oberfläche ist fest deutsch (<html lang="de">), ohne i18n-Ebene; UI-Texte sind deutsch, Code-Bezeichner englisch.
* [Ein Verein, keine Mandantenfähigkeit](ein-verein-ohne-mandanten.md) - Schiriplan bedient genau einen Verein; dessen Angaben stehen in einer Konfigurationsdatei, das Schema kennt keine club_id.
* [Ligen sind vorbelegt und vom Admin pflegbar](ligen-vorbelegt.md) - Beim Einrichten sind die Ligen U10, U12, U14, U16, U18 und Senioren angelegt; der Admin kann sie anlegen, umbenennen und deaktivieren.
* [Nachrichten über die WhatsApp Cloud API, E-Mail als abschaltbarer Kanal](whatsapp-mit-email-kanal.md) - Nachrichten gehen über die WhatsApp Cloud API von Meta; ein E-Mail-Kanal für Test und Übergang ist per NOTIFICATION_CHANNEL umschaltbar.
* [Next.js mit App Router, React und strengem TypeScript](framework-nextjs.md) - Die App ist eine Next.js-Anwendung (App Router) mit React und TypeScript im strict-Modus — ein Projekt für Oberfläche und Server.
* [Plain CSS auf den Modernist-Tokens, kein Tailwind](styling-plain-css-modernist.md) - Gestylt wird mit normalem CSS auf Basis der Tokens des Modernist-Designsystems; Tailwind wird nicht verwendet.
* [PostgreSQL mit Drizzle als ORM](datenbank-postgres-drizzle.md) - Daten liegen in PostgreSQL; Schema und Abfragen laufen über Drizzle ORM, Migrationen liegen in drizzle/.
* [Tests: Vitest für Regeln, echtes Postgres für Integration, Playwright auf Desktop und Handy](teststrategie.md) - Die Regel-Engine wird mit Vitest getestet, Serverpfade gegen ein echtes Postgres, die Oberfläche mit Playwright auf Desktop und Mobil.
* [Öffentlicher Spielplan ohne Login, nur mit Kürzeln](oeffentliche-ansicht-ohne-login.md) - Der Spielplan ist ohne Anmeldung öffentlich und indexierbar; Personen erscheinen dort ausschließlich als Kürzel.

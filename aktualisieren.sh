#!/usr/bin/env bash
#
# Schiriplan auf den neuesten Stand bringen.
#
# Das Skript sichert zuerst die Datenbank und holt erst danach den neuen Stand.
# Die Reihenfolge ist der ganze Punkt: ein Update kann das Schema veraendern,
# und eine Migration, die eine Spalte loescht, laesst sich nicht zurueckdrehen.
# Ohne gepruefte Sicherung wird deshalb nichts gezogen.
#
#   ./aktualisieren.sh              sichern, ziehen, bauen, Schema, neu starten
#   ./aktualisieren.sh --erzwingen  dasselbe, auch wenn es nichts Neues gibt
#                                   (etwa nach einem `git pull` von Hand)
#
# Der Ablauf:
#
#   1. pruefen, ob es etwas Neues gibt — sonst ist hier Schluss
#   2. Datenbank nach ./sicherungen/vor-update-<Zeit>.sql.gz sichern und die
#      Datei pruefen
#   3. den neuen Stand holen (nur vorwaerts, kein Merge)
#   4. Abbild bauen — die alte Anwendung laeuft derweil weiter
#   5. Anwendung anhalten, Schema einspielen, alles neu starten
#
# Geht nach Schritt 2 etwas schief, nennt das Skript die Sicherung und den
# alten Stand und sagt, wie man zurueckkommt. Von selbst dreht es nichts
# zurueck: wer mitten in einem halben Update steht, soll entscheiden und nicht
# zusehen.
#
set -Eeuo pipefail

# ─────────────────────────────────────────────────────────────────────────────
# Ausgabe
# ─────────────────────────────────────────────────────────────────────────────

if [[ -t 1 ]]; then
  ROT=$'\e[31m'; GRUEN=$'\e[32m'; GELB=$'\e[33m'; BLAU=$'\e[36m'; FETT=$'\e[1m'; AUS=$'\e[0m'
else
  ROT=''; GRUEN=''; GELB=''; BLAU=''; FETT=''; AUS=''
fi

schritt() { printf '\n%s▸ %s%s\n' "$FETT$BLAU" "$*" "$AUS"; }
info()    { printf '  %s\n' "$*"; }
gut()     { printf '  %s✓%s %s\n' "$GRUEN" "$AUS" "$*"; }
warnung() { printf '  %s!%s %s\n' "$GELB" "$AUS" "$*"; }
fehler()  { printf '\n%sFehler:%s %s\n\n' "$ROT$FETT" "$AUS" "$*" >&2; exit 1; }

# Zwischendatei fuer die Migration, siehe einspielen().
UEBERGANG=docker-compose.aktualisierung.yml
# Fuer den Hinweis beim Verlassen: alter Stand und Pfad der Sicherung.
ALT=''
SICHERUNG=''

# ─────────────────────────────────────────────────────────────────────────────
# Bausteine
# ─────────────────────────────────────────────────────────────────────────────

# Ein Wert aus der .env. Anfuehrungszeichen drumherum fallen weg.
env_wert() {
  local wert
  wert=$(sed -n "s/^$1=//p" .env | head -n1)
  wert=${wert%\"}; wert=${wert#\"}
  wert=${wert%\'}; wert=${wert#\'}
  printf '%s' "$wert"
}

datenbank_bereit() {
  local versuch
  for versuch in {1..60}; do
    if docker compose exec -T db pg_isready -U schiriplan >/dev/null 2>&1; then return 0; fi
    sleep 1
  done
  fehler "Die Datenbank ist nicht hochgekommen. 'docker compose logs db' sagt mehr."
}

vorbedingungen() {
  [[ -f docker-compose.yml && -f package.json ]] ||
    fehler "Dieses Skript gehoert in das Schiriplan-Verzeichnis (neben docker-compose.yml)."
  [[ ${EUID:-$(id -u)} -ne 0 ]] || fehler "Bitte nicht als root ausfuehren."
  [[ -f .env ]] ||
    fehler "Es gibt keine .env — der Verbund ist hier noch nicht eingerichtet. Dafuer ist ./einrichten.sh da."

  local werkzeug
  for werkzeug in git docker node npm gzip; do
    command -v "$werkzeug" >/dev/null 2>&1 || fehler "$werkzeug fehlt. ./einrichten.sh installiert, was gebraucht wird."
  done
  docker compose version >/dev/null 2>&1 || fehler "Docker bringt kein Compose-Plugin mit."
  docker info >/dev/null 2>&1 || fehler "Docker ist nicht erreichbar. Laeuft der Dienst, und bist du in der Gruppe docker?"
  [[ -n $(env_wert POSTGRES_PASSWORD) ]] || fehler "In der .env fehlt POSTGRES_PASSWORD."
}

# Schreibt die Sicherung und gibt ihren Pfad in SICHERUNG zurueck.
#
# Geschrieben wird ueber den Dienst "backup" und nicht vom Rechner aus: er hat
# das Passwort und das Verzeichnis ./sicherungen schon, und das Verzeichnis
# gehoert root, sobald Docker es einmal angelegt hat — von hier aus liesse sich
# dort gar nichts ablegen.
#
# Erst in eine Datei, dann packen: in einer Pipe verschluckte gzip einen Abbruch
# von pg_dump, und uebrig bliebe eine gueltige, aber halbe Sicherung.
sichern() {
  schritt "Datenbank sichern"
  docker compose up -d db >/dev/null
  datenbank_bereit

  mkdir -p sicherungen
  local name
  name="vor-update-$(date +%Y-%m-%d-%H%M%S).sql.gz"
  SICHERUNG="sicherungen/$name"

  docker compose run --rm --no-deps -T -e ZIEL="/sicherungen/$name" backup sh -c '
    set -eu
    pg_dump -h db -U schiriplan schiriplan > /tmp/sicherung.sql
    gzip -c /tmp/sicherung.sql > "$ZIEL.teil"
    mv "$ZIEL.teil" "$ZIEL"
  ' >/dev/null || fehler "Die Sicherung ist fehlgeschlagen. Es wurde nichts veraendert."

  # Eine Sicherung, die niemand geprueft hat, ist eine Hoffnung. Die letzte
  # Zeile eines vollstaendigen Abzugs ist immer dieselbe.
  [[ -s $SICHERUNG ]] || fehler "Die Sicherung $SICHERUNG ist leer. Es wurde nichts veraendert."
  gzip -t "$SICHERUNG" 2>/dev/null ||
    fehler "Die Sicherung $SICHERUNG laesst sich nicht entpacken. Es wurde nichts veraendert."
  gzip -dc "$SICHERUNG" | tail -n 5 | grep -q 'PostgreSQL database dump complete' ||
    fehler "Die Sicherung $SICHERUNG ist unvollstaendig. Es wurde nichts veraendert."

  gut "$SICHERUNG ($(du -h "$SICHERUNG" | cut -f1)), vollstaendig und lesbar"
}

# Was zu tun ist, wenn nach der Sicherung etwas scheitert.
zurueck_hinweis() {
  local alt=$1 sicherung=$2
  cat >&2 <<ENDE

  ${ROT}${FETT}Das Update ist nicht durchgelaufen.${AUS}

  Sicherung:    $sicherung
  Alter Stand:  $alt

  Bis zum Schritt "Schema einspielen" laeuft die bisherige Anwendung weiter.
  Danach ist sie angehalten, bis einer der beiden Wege unten gegangen ist.

  Zurueck zum alten Stand:

    git reset --hard $alt
    docker compose build && docker compose up -d

  Nur falls das Schema schon veraendert wurde (der Schritt "Schema einspielen"
  hat begonnen), zusaetzlich die Sicherung zurueckspielen:

    docker compose stop app cron
    docker compose exec -T db psql -U schiriplan -d schiriplan -c \\
      'DROP SCHEMA public CASCADE; DROP SCHEMA IF EXISTS drizzle CASCADE; CREATE SCHEMA public;'
    gunzip -c $sicherung | docker compose exec -T db psql -U schiriplan -d schiriplan
    docker compose up -d

ENDE
}

# ─────────────────────────────────────────────────────────────────────────────
# Teil 1: pruefen, sichern, holen
# ─────────────────────────────────────────────────────────────────────────────

vorbereiten() {
  local erzwingen=$1

  schritt "Vorbedingungen pruefen"
  vorbedingungen

  local zweig
  zweig=$(git rev-parse --abbrev-ref HEAD)
  git rev-parse --abbrev-ref '@{u}' >/dev/null 2>&1 ||
    fehler "Der Zweig $zweig folgt keinem Zweig auf dem Server (git branch --set-upstream-to=origin/$zweig)."

  # Eigene Aenderungen an versionierten Dateien wuerden beim Holen im Weg
  # stehen — oder, schlimmer, still mit in das neue Abbild wandern.
  [[ -z $(git status --porcelain --untracked-files=no) ]] ||
    fehler "Es gibt eigene Aenderungen an versionierten Dateien ('git status' zeigt sie). Erst sichern oder verwerfen."
  gut "Zweig $zweig, keine eigenen Aenderungen"

  schritt "Nach Neuem sehen"
  git fetch --quiet
  local alt neu
  alt=$(git rev-parse HEAD)
  neu=$(git rev-parse '@{u}')

  if [[ $alt == "$neu" ]]; then
    if (( ! erzwingen )); then
      gut "Schon auf dem neuesten Stand (${alt:0:7}). Nichts zu tun."
      info "Trotzdem sichern, bauen und neu starten: ./aktualisieren.sh --erzwingen"
      exit 0
    fi
    warnung "Nichts Neues — wegen --erzwingen geht es trotzdem weiter."
  else
    git merge-base --is-ancestor HEAD '@{u}' ||
      fehler "Der Stand hier und der auf dem Server sind auseinandergelaufen. Das loest dieses Skript nicht — bitte von Hand ansehen."
    info "$(git rev-list --count "HEAD..@{u}") neue Aenderung(en):"
    git log --format='    %h %s' "HEAD..@{u}" | head -n 20
  fi

  sichern

  if [[ $alt != "$neu" ]]; then
    schritt "Neuen Stand holen"
    # Genau das, was oben gezeigt wurde — nicht, was inzwischen dazugekommen ist.
    git merge --ff-only --quiet "$neu"
    gut "${alt:0:7} → ${neu:0:7}"
  fi

  # Weiter mit dem Skript aus dem *neuen* Stand: aendert ein Update den Ablauf
  # selbst, soll schon dieser Lauf danach handeln.
  exec bash ./aktualisieren.sh --weiter "$alt" "$SICHERUNG"
}

# ─────────────────────────────────────────────────────────────────────────────
# Teil 2: bauen, Schema, neu starten
# ─────────────────────────────────────────────────────────────────────────────

einspielen() {
  local alt=$1 sicherung=$2
  # Beim Verlassen aufraeumen — und, wenn es kein gutes Ende war, sagen, wie
  # man zurueckkommt. Am Ausgang und nicht am Fehler aufgehaengt: `fehler`
  # beendet das Skript selbst, und auch dann soll der Hinweis dastehen.
  ALT=$alt
  trap 'status=$?; rm -f "$UEBERGANG"; (( status == 0 )) || zurueck_hinweis "$ALT" "$SICHERUNG"' EXIT
  SICHERUNG=$sicherung

  schritt "Abhaengigkeiten auf dem Rechner"
  # Gebraucht fuer die Migration, die vom Rechner aus laeuft.
  if [[ ! -d node_modules ]] || ! git diff --quiet "$alt" HEAD -- package-lock.json; then
    info "npm ci laeuft."
    npm ci
    gut "Abhaengigkeiten installiert"
  else
    gut "unveraendert — uebersprungen"
  fi

  schritt "Abbild bauen"
  info "Die bisherige Anwendung laeuft derweil weiter."
  docker compose build
  gut "Abbild gebaut"

  schritt "Schema einspielen"
  # Ab hier steht die Anwendung: alter Code soll nicht auf ein neues Schema
  # treffen, und der Zeitgeber soll in der Zwischenzeit nichts verschicken.
  docker compose stop app cron >/dev/null 2>&1 || true

  # Die Datenbank ist im Verbund absichtlich ohne veroeffentlichten Port. Fuer
  # die Migration wird sie kurz auf die Rueckschleife herausgereicht — nicht ins
  # Netz. Danach faellt die Zusatzdatei weg, und der Verbund startet ohne sie.
  cat > "$UEBERGANG" <<'YML'
# Nur waehrend einer Aktualisierung. Reicht die Datenbank auf die Rueckschleife
# heraus, damit die Migration vom Rechner aus laufen kann.
services:
  db:
    ports:
      - '127.0.0.1:55432:5432'
YML
  # Mit -f zieht Compose die oertliche Ergaenzung nicht mehr von selbst hinzu.
  local dateien=(-f docker-compose.yml)
  [[ -f docker-compose.override.yml ]] && dateien+=(-f docker-compose.override.yml)
  docker compose "${dateien[@]}" -f "$UEBERGANG" up -d db >/dev/null
  datenbank_bereit

  DATABASE_URL="postgres://schiriplan:$(env_wert POSTGRES_PASSWORD)@127.0.0.1:55432/schiriplan" \
    npm run --silent db:migrate
  gut "Schema eingespielt"

  schritt "Verbund starten"
  rm -f "$UEBERGANG"
  # Ohne die Zusatzdatei: die Datenbank ist danach wieder nur im Compose-Netz.
  docker compose up -d
  gut "Alle Dienste gestartet"

  info "Auf die Anwendung warten"
  # Gefragt wird die Anwendung selbst, unter dem Namen ihres Containers — dort
  # lauscht sie in jedem Fall, gleich wie der Healthcheck des Abbilds steht.
  local gesund=0 versuch
  for versuch in {1..60}; do
    if docker compose exec -T app sh -c \
      'wget -q -O /dev/null "http://$(hostname):3000/api/gesundheit"' >/dev/null 2>&1; then
      gesund=1
      break
    fi
    sleep 2
  done

  printf '\n%s── Fertig ─────────────────────────────────────────────────%s\n\n' "$FETT$GRUEN" "$AUS"
  if (( gesund )); then
    gut "Die Anwendung antwortet und erreicht die Datenbank."
  else
    warnung "Die Anwendung antwortet noch nicht. 'docker compose logs -f app' sagt, woran es liegt."
  fi
  docker compose ps

  cat <<ENDE

  Stand:      ${alt:0:7} → $(git rev-parse --short HEAD)
  Sicherung:  $sicherung

  Die Sicherung enthaelt Namen und Telefonnummern. Sie bleibt liegen, bis du
  sie loeschst — die taegliche Aufraeumung fasst nur die Tagesstaende an.

ENDE
  (( gesund )) || exit 1
}

# ─────────────────────────────────────────────────────────────────────────────
# Einstieg
# ─────────────────────────────────────────────────────────────────────────────

# Alles steckt in Funktionen und der Aufruf steht in der letzten Zeile: Bash
# liest ein Skript stueckweise, und dieses hier tauscht sich mitten im Lauf
# selbst aus. So ist es vollstaendig eingelesen, bevor irgendetwas passiert.
haupt() {
  cd "$(dirname "${BASH_SOURCE[0]}")"
  (( BASH_VERSINFO[0] >= 4 )) || fehler "Es wird Bash 4 oder neuer gebraucht."

  case ${1:-} in
    '')          vorbereiten 0 ;;
    --erzwingen) vorbereiten 1 ;;
    --weiter)
      # Intern: der zweite Teil, aufgerufen aus dem frisch geholten Stand.
      [[ $# -eq 3 ]] || fehler "--weiter ruft das Skript selbst auf, nicht von Hand."
      einspielen "$2" "$3" ;;
    -h|--hilfe|--help)
      sed -n '2,/^set -/p' "$(basename "${BASH_SOURCE[0]}")" | sed '$d' | sed 's/^# \{0,1\}//' ;;
    *) fehler "Unbekannte Angabe: $1 (siehe ./aktualisieren.sh --hilfe)" ;;
  esac
}

haupt "$@"; exit

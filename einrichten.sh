#!/usr/bin/env bash
#
# Schiriplan auf einem frischen Server einrichten.
#
# Das Skript nimmt einen leeren Rechner und macht daraus einen laufenden
# Verbund: es installiert, was fehlt, fragt die Angaben ab, die niemand raten
# kann, laesst sie am Ende noch einmal pruefen und aendern, schreibt die .env,
# spielt das Schema ein und startet alles.
#
# Es ist absichtlich wiederholbar. Wer es ein zweites Mal aufruft, bekommt die
# vorhandenen Werte als Vorgabe und kann einzelne aendern, ohne alles neu
# einzutippen. Eine bestehende .env wird vorher zur Seite gelegt.
#
#   ./einrichten.sh
#
set -euo pipefail

# ─────────────────────────────────────────────────────────────────────────────
# Ausgabe
# ─────────────────────────────────────────────────────────────────────────────

# Farben nur, wenn wirklich ein Terminal dranhaengt — in einer Protokolldatei
# waeren die Steuerzeichen nur Muell.
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

# ─────────────────────────────────────────────────────────────────────────────
# Vorbedingungen
# ─────────────────────────────────────────────────────────────────────────────

cd "$(dirname "${BASH_SOURCE[0]}")"

[[ -f docker-compose.yml && -f package.json ]] ||
  fehler "Dieses Skript gehoert in das Schiriplan-Verzeichnis (neben docker-compose.yml)."

[[ ${EUID:-$(id -u)} -ne 0 ]] ||
  fehler "Bitte nicht als root ausfuehren. Das Skript ruft sudo auf, wo es noetig ist."

# Bash 4 wegen der assoziativen Arrays weiter unten.
(( BASH_VERSINFO[0] >= 4 )) || fehler "Es wird Bash 4 oder neuer gebraucht."

APT=0
command -v apt-get >/dev/null 2>&1 && APT=1

# Nur einmal nach dem Passwort fragen, nicht bei jedem einzelnen Aufruf.
sudo_bereit() {
  sudo -n true 2>/dev/null && return 0
  info "Fuer die Installation wird sudo gebraucht."
  sudo -v
}

paketliste_aktualisiert=0
apt_installieren() {
  (( APT )) || fehler "Nur apt-basierte Systeme werden unterstuetzt. Bitte $* von Hand installieren."
  sudo_bereit
  if (( ! paketliste_aktualisiert )); then
    sudo apt-get update -qq
    paketliste_aktualisiert=1
  fi
  sudo apt-get install -y -qq "$@"
}

schritt "Vorbedingungen pruefen"

for werkzeug in curl openssl; do
  if command -v "$werkzeug" >/dev/null 2>&1; then
    gut "$werkzeug vorhanden"
  else
    info "$werkzeug fehlt — wird installiert"
    apt_installieren "$werkzeug" ca-certificates
    gut "$werkzeug installiert"
  fi
done

# ── Docker ───────────────────────────────────────────────────────────────────
#
# Ueber das Paketverzeichnis von Docker und nicht ueber ein Skript aus dem Netz:
# der Schluessel wird abgelegt, die Quelle daran gebunden, und ein spaeteres
# "apt upgrade" nimmt Aktualisierungen mit.
docker_installieren() {
  apt_installieren ca-certificates curl gnupg
  sudo install -m 0755 -d /etc/apt/keyrings
  local quelle="https://download.docker.com/linux/$(. /etc/os-release && echo "$ID")"
  curl -fsSL "$quelle/gpg" | sudo gpg --batch --yes --dearmor -o /etc/apt/keyrings/docker.gpg
  sudo chmod a+r /etc/apt/keyrings/docker.gpg
  echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] \
$quelle $(. /etc/os-release && echo "${VERSION_CODENAME:-$UBUNTU_CODENAME}") stable" |
    sudo tee /etc/apt/sources.list.d/docker.list >/dev/null
  paketliste_aktualisiert=0
  apt_installieren docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
  sudo systemctl enable --now docker
}

if command -v docker >/dev/null 2>&1 && docker compose version >/dev/null 2>&1; then
  gut "Docker mit Compose-Plugin vorhanden"
else
  info "Docker fehlt oder bringt kein Compose-Plugin mit — wird installiert"
  docker_installieren
  gut "Docker installiert"
fi

# Ohne Gruppenmitgliedschaft laeuft jeder docker-Aufruf in ein
# Berechtigungsproblem — und zwar erst mitten im Skript.
if ! docker info >/dev/null 2>&1; then
  if id -nG "$USER" | tr ' ' '\n' | grep -qx docker; then
    fehler "Docker ist nicht erreichbar, obwohl du in der Gruppe bist. Neu anmelden und noch einmal versuchen."
  fi
  warnung "$USER ist nicht in der Gruppe docker."
  read -rp "  Jetzt hinzufuegen? [j/N] " antwort
  if [[ ${antwort,,} == j* ]]; then
    sudo_bereit
    sudo usermod -aG docker "$USER"
    fehler "Hinzugefuegt. Bitte einmal ab- und wieder anmelden, dann dieses Skript erneut aufrufen."
  fi
  fehler "Ohne Zugriff auf Docker geht es nicht weiter."
fi

# ── Node ─────────────────────────────────────────────────────────────────────
#
# Gebraucht fuer die Kommandozeilen-Skripte auf dem Rechner selbst: Schema
# einspielen, den ersten Admin anlegen, Notzugaenge ausstellen. Die Anwendung
# selbst laeuft im Container und braucht das hier nicht.
node_installieren() {
  apt_installieren ca-certificates curl gnupg
  sudo install -m 0755 -d /etc/apt/keyrings
  curl -fsSL https://deb.nodesource.com/gpgkey/nodesource-repo.gpg.key |
    sudo gpg --batch --yes --dearmor -o /etc/apt/keyrings/nodesource.gpg
  sudo chmod a+r /etc/apt/keyrings/nodesource.gpg
  echo "deb [signed-by=/etc/apt/keyrings/nodesource.gpg] https://deb.nodesource.com/node_22.x nodistro main" |
    sudo tee /etc/apt/sources.list.d/nodesource.list >/dev/null
  paketliste_aktualisiert=0
  apt_installieren nodejs
}

if command -v node >/dev/null 2>&1 && (( $(node -p 'process.versions.node.split(".")[0]') >= 22 )); then
  gut "Node $(node -v) vorhanden"
else
  info "Node 22 oder neuer fehlt — wird installiert"
  node_installieren
  gut "Node $(node -v) installiert"
fi

# ─────────────────────────────────────────────────────────────────────────────
# Angaben sammeln
# ─────────────────────────────────────────────────────────────────────────────

declare -A WERT LABEL HILFE GEHEIM

setze_vorgabe() { [[ -n ${WERT[$1]:-} ]] || WERT[$1]=$2; }

# Bestehende .env als Vorgabe lesen. Nur bekannte Schluessel, und ohne die Datei
# auszufuehren — ein `source` machte aus einer verunglueckten Zeile einen Befehl.
if [[ -f .env ]]; then
  schritt "Bestehende .env gefunden"
  #
  # Von Hand geteilt und nicht mit `IFS='=' read`: `read` verschluckt ein
  # Trennzeichen am Zeilenende. Ein mit `openssl rand -base64` erzeugtes
  # Geheimnis endet fast immer auf "=", und genau dieses Zeichen fiele weg.
  # Der gekuerzte CRON_SECRET faellt nirgends auf — der Zeitgeber bekaeme
  # stillschweigend 401 und die Erinnerungen blieben aus.
  #
  while IFS= read -r zeile; do
    schluessel=${zeile%%=*}
    [[ $schluessel =~ ^[A-Z_]+$ ]] || continue
    rest=${zeile#*=}
    rest=${rest%\"}; rest=${rest#\"}
    WERT[$schluessel]=$rest
  done < <(grep -E '^[A-Z_]+=' .env || true)
  gut "Vorhandene Werte werden als Vorgabe angeboten"
fi

LABEL[PUBLIC_BASE_URL]='Oeffentliche Adresse'
HILFE[PUBLIC_BASE_URL]='Die Adresse, unter der der Tunnel die App veroeffentlicht, z. B. https://schiriplan.verein.de'

LABEL[CLOUDFLARE_TUNNEL_TOKEN]='Cloudflare-Tunnel-Token'
HILFE[CLOUDFLARE_TUNNEL_TOKEN]='Aus dem Cloudflare-Zero-Trust-Dashboard: Networks → Tunnels → Configure. Lang, beginnt oft mit "ey".'
GEHEIM[CLOUDFLARE_TUNNEL_TOKEN]=1

LABEL[POSTGRES_PASSWORD]='Datenbankpasswort'
HILFE[POSTGRES_PASSWORD]='Wird nur im Compose-Verbund gebraucht. Vorschlag ist zufaellig erzeugt.'
GEHEIM[POSTGRES_PASSWORD]=1

LABEL[SESSION_SECRET]='Sitzungsschluessel'
HILFE[SESSION_SECRET]='Unterschreibt Sitzungen, Anmeldelinks und Antwortlinks. Mindestens 32 Zeichen.'
GEHEIM[SESSION_SECRET]=1

LABEL[CRON_SECRET]='Cron-Schluessel'
HILFE[CRON_SECRET]='Schuetzt den Endpunkt, der Erinnerungen verschickt. Ohne ihn koennte jeder Nachrichten ausloesen.'
GEHEIM[CRON_SECRET]=1

LABEL[NOTIFICATION_CHANNEL]='Versandkanal'
HILFE[NOTIFICATION_CHANNEL]='dev = nichts geht raus (alles unter /dev/outbox) · email = ueber SMTP · whatsapp = Meta Cloud API'

LABEL[LOGIN_MAGIC_LINK]='Anmeldung per Link'
HILFE[LOGIN_MAGIC_LINK]='an oder aus. Jeder Link kostet eine WhatsApp-Nachricht — Vorgabe ist aus.'

LABEL[WHATSAPP_PHONE_NUMBER_ID]='WhatsApp Phone Number ID'
HILFE[WHATSAPP_PHONE_NUMBER_ID]='Aus dem Meta-Dashboard, WhatsApp → API Setup.'

LABEL[WHATSAPP_ACCESS_TOKEN]='WhatsApp Access Token'
HILFE[WHATSAPP_ACCESS_TOKEN]='Am besten ein Systembenutzer-Token, das nicht ablaeuft.'
GEHEIM[WHATSAPP_ACCESS_TOKEN]=1

LABEL[SMTP_URL]='SMTP-Adresse'
HILFE[SMTP_URL]='z. B. smtps://benutzer:passwort@mail.example.org:465'
GEHEIM[SMTP_URL]=1

LABEL[MAIL_FROM]='Absenderadresse'
HILFE[MAIL_FROM]='Steht als Absender in jeder E-Mail.'

LABEL[MAIL_TEST_RECIPIENT]='Testempfaenger'
HILFE[MAIL_TEST_RECIPIENT]='Leer lassen im Echtbetrieb. Gesetzt lenkt es *alle* Nachrichten auf dieses Postfach.'

LABEL[ADMIN_NAME]='Erster Admin: Name'
HILFE[ADMIN_NAME]='Vor- und Nachname. Daraus entsteht auch das Start-Passwort.'

LABEL[ADMIN_KUERZEL]='Erster Admin: Kuerzel'
HILFE[ADMIN_KUERZEL]='Zwei bis vier Grossbuchstaben, z. B. NB. Oeffentlich sichtbar.'

LABEL[ADMIN_TELEFON]='Erster Admin: Telefonnummer'
HILFE[ADMIN_TELEFON]='Damit meldet er sich an, z. B. 0157 22067123'

setze_vorgabe PUBLIC_BASE_URL 'https://'
# Hexadezimal und nicht base64: das Passwort landet im Abfrageteil einer
# postgres://-Adresse — in der .env und noch einmal in docker-compose.yml.
# `openssl rand -base64` liefert auch "/" und "+", und ein "/" beendet dort den
# Benutzerteil. Die Adresse ist dann keine gueltige URL mehr, und `next build`
# bricht beim Einlesen von @/db ab. 24 Byte sind 48 Zeichen aus [0-9a-f].
setze_vorgabe POSTGRES_PASSWORD "$(openssl rand -hex 24)"
setze_vorgabe SESSION_SECRET "$(openssl rand -base64 48)"
setze_vorgabe CRON_SECRET "$(openssl rand -base64 32)"
setze_vorgabe NOTIFICATION_CHANNEL 'dev'
setze_vorgabe LOGIN_MAGIC_LINK 'aus'
setze_vorgabe MAIL_FROM 'schiriplan@example.org'

# Welche Felder gefragt werden, haengt am Kanal.
felder() {
  local liste=(PUBLIC_BASE_URL CLOUDFLARE_TUNNEL_TOKEN POSTGRES_PASSWORD SESSION_SECRET
               CRON_SECRET NOTIFICATION_CHANNEL LOGIN_MAGIC_LINK)
  case ${WERT[NOTIFICATION_CHANNEL]} in
    whatsapp) liste+=(WHATSAPP_PHONE_NUMBER_ID WHATSAPP_ACCESS_TOKEN) ;;
    email)    liste+=(SMTP_URL MAIL_FROM MAIL_TEST_RECIPIENT) ;;
  esac
  liste+=(ADMIN_NAME ADMIN_KUERZEL ADMIN_TELEFON)
  printf '%s\n' "${liste[@]}"
}

# Ein Geheimnis wird nie ganz angezeigt — auch nicht in der Uebersicht, die
# jemand versehentlich abfotografiert oder in ein Ticket kopiert.
anzeige() {
  local wert=${WERT[$1]:-}
  [[ -n $wert ]] || { printf '%s(leer)%s' "$GELB" "$AUS"; return; }
  if [[ ${GEHEIM[$1]:-0} == 1 ]]; then
    printf '%s… (%d Zeichen)' "${wert:0:4}" "${#wert}"
  else
    printf '%s' "$wert"
  fi
}

pruefe() {
  local schluessel=$1 wert=$2
  case $schluessel in
    PUBLIC_BASE_URL)
      [[ $wert =~ ^https?://[^[:space:]/]+ ]] || { echo "Muss mit http:// oder https:// beginnen und einen Host nennen."; return 1; } ;;
    SESSION_SECRET)
      (( ${#wert} >= 32 )) || { echo "Mindestens 32 Zeichen — die Anwendung weist kuerzere im Echtbetrieb ab."; return 1; } ;;
    POSTGRES_PASSWORD)
      [[ -n $wert ]] || { echo "Darf nicht leer bleiben."; return 1; }
      # Es steht in zwei postgres://-Adressen, und docker-compose.yml setzt es
      # dort ebenso ungeschuetzt ein. Erlaubt sind deshalb nur Zeichen, die in
      # einer URL nichts bedeuten — "/", "@", ":" und "%" zerlegten sie.
      [[ $wert =~ ^[A-Za-z0-9._~-]+$ ]] ||
        { echo "Nur Buchstaben, Ziffern und . _ ~ - — andere Zeichen zerlegen die Datenbankadresse."; return 1; } ;;
    CRON_SECRET|CLOUDFLARE_TUNNEL_TOKEN|ADMIN_NAME|ADMIN_TELEFON)
      [[ -n $wert ]] || { echo "Darf nicht leer bleiben."; return 1; } ;;
    NOTIFICATION_CHANNEL)
      [[ $wert == dev || $wert == email || $wert == whatsapp ]] || { echo "Nur dev, email oder whatsapp."; return 1; } ;;
    LOGIN_MAGIC_LINK)
      [[ $wert == an || $wert == aus ]] || { echo "Nur an oder aus."; return 1; } ;;
    ADMIN_KUERZEL)
      [[ $wert =~ ^[A-ZÄÖÜ]{2,4}$ ]] || { echo "Zwei bis vier Grossbuchstaben."; return 1; } ;;
    WHATSAPP_PHONE_NUMBER_ID|WHATSAPP_ACCESS_TOKEN|SMTP_URL)
      [[ -n $wert ]] || { echo "Fuer den gewaehlten Kanal noetig."; return 1; } ;;
  esac
  return 0
}

frage_feld() {
  local schluessel=$1 eingabe meldung
  while true; do
    printf '\n  %s%s%s\n' "$FETT" "${LABEL[$schluessel]}" "$AUS"
    printf '  %s\n' "${HILFE[$schluessel]}"
    if [[ ${GEHEIM[$schluessel]:-0} == 1 ]]; then
      # Verdeckt eingeben; Enter uebernimmt den vorhandenen Wert.
      printf '  Aktuell: %s\n  Neuer Wert (leer = unveraendert): ' "$(anzeige "$schluessel")"
      read -rs eingabe; echo
    else
      printf '  [%s]: ' "${WERT[$schluessel]:-}"
      read -r eingabe
    fi
    [[ -n $eingabe ]] || eingabe=${WERT[$schluessel]:-}
    if meldung=$(pruefe "$schluessel" "$eingabe"); then
      WERT[$schluessel]=$eingabe
      return 0
    fi
    printf '  %s%s%s\n' "$ROT" "$meldung" "$AUS"
  done
}

schritt "Angaben"
info "Enter uebernimmt jeweils den Wert in eckigen Klammern."
mapfile -t offen < <(felder)
for schluessel in "${offen[@]}"; do frage_feld "$schluessel"; done

# ─────────────────────────────────────────────────────────────────────────────
# Uebersicht mit Aenderungsmoeglichkeit
# ─────────────────────────────────────────────────────────────────────────────

while true; do
  mapfile -t liste < <(felder)
  printf '\n%s── Uebersicht ─────────────────────────────────────────────%s\n\n' "$FETT$BLAU" "$AUS"
  for i in "${!liste[@]}"; do
    printf '  %s%2d%s  %-28s %s\n' "$FETT" "$((i + 1))" "$AUS" "${LABEL[${liste[$i]}]}" "$(anzeige "${liste[$i]}")"
  done
  printf '\n  Geheimnisse sind gekuerzt dargestellt.\n'
  printf '\n  %sNummer%s aendern · %sj%s uebernehmen · %sa%s abbrechen: ' \
    "$FETT" "$AUS" "$FETT$GRUEN" "$AUS" "$FETT$ROT" "$AUS"
  read -r wahl
  case ${wahl,,} in
    j|ja)
      # Ein Wechsel des Kanals blendet hier Felder ein, die vorher gar nicht
      # gefragt wurden. Sie waeren leer, und ein leerer Token faellt erst beim
      # ersten Versand auf. Deshalb vor dem Uebernehmen noch einmal alles pruefen.
      unvollstaendig=0
      for schluessel in "${liste[@]}"; do
        if ! meldung=$(pruefe "$schluessel" "${WERT[$schluessel]:-}"); then
          printf '  %s%s: %s%s\n' "$ROT" "${LABEL[$schluessel]}" "$meldung" "$AUS"
          unvollstaendig=1
        fi
      done
      (( unvollstaendig )) || break
      printf '  %sBitte die genannten Felder noch ausfuellen.%s\n' "$ROT" "$AUS" ;;
    a|abbruch) fehler "Abgebrochen. Es wurde nichts geschrieben." ;;
    ''|*[!0-9]*) printf '  %sBitte eine Nummer, j oder a.%s\n' "$ROT" "$AUS" ;;
    *)
      if (( wahl >= 1 && wahl <= ${#liste[@]} )); then
        frage_feld "${liste[$((wahl - 1))]}"
      else
        printf '  %sDiese Nummer gibt es nicht.%s\n' "$ROT" "$AUS"
      fi ;;
  esac
done

# ─────────────────────────────────────────────────────────────────────────────
# .env schreiben
# ─────────────────────────────────────────────────────────────────────────────

schritt ".env schreiben"

if [[ -f .env ]]; then
  sicherung=".env.bak-$(date +%Y%m%d-%H%M%S)"
  cp -p .env "$sicherung"
  gut "Bisherige .env liegt als $sicherung daneben"
fi

# Erst mit engen Rechten anlegen, dann fuellen: zwischen Anlegen und chmod
# stuenden die Geheimnisse sonst kurz fuer alle lesbar da.
umask_vorher=$(umask)
umask 077
: > .env.neu

{
  echo "# Von einrichten.sh erzeugt am $(date --iso-8601=seconds)."
  echo "# Enthaelt Geheimnisse — nicht in die Versionsverwaltung, nicht weitergeben."
  echo
  echo "DATABASE_URL=postgres://schiriplan:${WERT[POSTGRES_PASSWORD]}@localhost:5432/schiriplan"
  echo "POSTGRES_PASSWORD=${WERT[POSTGRES_PASSWORD]}"
  echo
  echo "SESSION_SECRET=${WERT[SESSION_SECRET]}"
  echo "CRON_SECRET=${WERT[CRON_SECRET]}"
  echo
  echo "PUBLIC_BASE_URL=${WERT[PUBLIC_BASE_URL]}"
  echo "CLOUDFLARE_TUNNEL_TOKEN=${WERT[CLOUDFLARE_TUNNEL_TOKEN]}"
  echo
  echo "NOTIFICATION_CHANNEL=${WERT[NOTIFICATION_CHANNEL]}"
  echo "LOGIN_MAGIC_LINK=${WERT[LOGIN_MAGIC_LINK]}"
  echo
  echo "WHATSAPP_PHONE_NUMBER_ID=${WERT[WHATSAPP_PHONE_NUMBER_ID]:-}"
  echo "WHATSAPP_ACCESS_TOKEN=${WERT[WHATSAPP_ACCESS_TOKEN]:-}"
  echo
  echo "SMTP_URL=${WERT[SMTP_URL]:-}"
  echo "MAIL_FROM=${WERT[MAIL_FROM]:-}"
  echo "MAIL_TEST_RECIPIENT=${WERT[MAIL_TEST_RECIPIENT]:-}"
} >> .env.neu

mv .env.neu .env
chmod 600 .env
umask "$umask_vorher"
gut ".env geschrieben (nur fuer dich lesbar)"

# ─────────────────────────────────────────────────────────────────────────────
# Bauen und starten
# ─────────────────────────────────────────────────────────────────────────────

schritt "Abhaengigkeiten auf dem Rechner"
if [[ -d node_modules ]]; then
  gut "node_modules vorhanden — uebersprungen"
else
  info "npm ci laeuft. Das kann auf einer langsamen Leitung dauern."
  npm ci
  gut "Abhaengigkeiten installiert"
fi

schritt "Abbild bauen"
info "Auch das dauert beim ersten Mal — im Container laeuft ein eigenes npm ci."
docker compose build
gut "Abbild gebaut"

schritt "Datenbank starten und Schema einspielen"

# Die Datenbank ist im Verbund absichtlich ohne veroeffentlichten Port. Fuer die
# Migration wird sie einmalig auf 127.0.0.1 herausgereicht — nur auf die
# Rueckschleife, nicht ins Netz. Danach faellt die Zusatzdatei wieder weg und
# der Verbund startet ohne sie.
UEBERGANG=docker-compose.einrichtung.yml
cat > "$UEBERGANG" <<'YML'
# Nur waehrend der Einrichtung. Reicht die Datenbank auf die Rueckschleife
# heraus, damit die Migration vom Rechner aus laufen kann.
services:
  db:
    ports:
      - '127.0.0.1:55432:5432'
YML
aufraeumen() { rm -f "$UEBERGANG" .env.neu; }
trap aufraeumen EXIT

docker compose -f docker-compose.yml -f "$UEBERGANG" up -d db

info "Auf die Datenbank warten"
for versuch in {1..60}; do
  if docker compose exec -T db pg_isready -U schiriplan >/dev/null 2>&1; then break; fi
  (( versuch < 60 )) || fehler "Die Datenbank ist nicht hochgekommen. 'docker compose logs db' sagt mehr."
  sleep 1
done
gut "Datenbank erreichbar"

DATABASE_URL="postgres://schiriplan:${WERT[POSTGRES_PASSWORD]}@127.0.0.1:55432/schiriplan" \
  npm run db:migrate
gut "Schema eingespielt"

schritt "Ersten Admin anlegen"
vorhandene=$(docker compose exec -T db psql -U schiriplan -d schiriplan -tAc \
  "select count(*) from referees where role = 'admin'" 2>/dev/null || echo 0)
if [[ ${vorhandene//[^0-9]/} -gt 0 ]]; then
  gut "Es gibt bereits $vorhandene Admin-Konto(en) — uebersprungen"
  START_PASSWORT=''
else
  if ausgabe=$(DATABASE_URL="postgres://schiriplan:${WERT[POSTGRES_PASSWORD]}@127.0.0.1:55432/schiriplan" \
    npm run --silent seed:admin -- \
      --name "${WERT[ADMIN_NAME]}" \
      --initials "${WERT[ADMIN_KUERZEL]}" \
      --phone "${WERT[ADMIN_TELEFON]}" 2>&1); then
    printf '%s\n' "$ausgabe"
    # Das Start-Passwort steht nur in dieser Ausgabe; gespeichert ist bloss sein
    # Hash. Ohne sed waere es nach diesem Lauf nicht mehr zu erfahren — dann
    # bliebe nur ein Zuruecksetzen durch einen anderen Admin.
    START_PASSWORT=$(printf '%s' "$ausgabe" | sed -n 's/.*Start-Passwort "\([^"]*\)".*/\1/p')
    gut "Admin angelegt"
  else
    printf '%s\n' "$ausgabe"
    fehler "Der erste Admin liess sich nicht anlegen. Der Verbund laeuft noch nicht."
  fi
fi

schritt "Verbund starten"
# Ohne die Zusatzdatei: die Datenbank wird dabei neu erzeugt und ist danach
# wieder ausschliesslich im Compose-Netz erreichbar.
docker compose up -d
gut "Alle Dienste gestartet"

info "Auf den Healthcheck warten"
gesund=0
app_container=$(docker compose ps -q app)
for versuch in {1..60}; do
  zustand=$(docker inspect -f '{{if .State.Health}}{{.State.Health.Status}}{{else}}ohne{{end}}' \
    "$app_container" 2>/dev/null || echo unbekannt)
  [[ $zustand == healthy ]] && { gesund=1; break; }
  sleep 2
done

# ─────────────────────────────────────────────────────────────────────────────
# Abschluss
# ─────────────────────────────────────────────────────────────────────────────

printf '\n%s── Fertig ─────────────────────────────────────────────────%s\n\n' "$FETT$GRUEN" "$AUS"

if (( gesund )); then
  gut "Die App meldet sich gesund."
else
  warnung "Die App ist noch nicht gesund. 'docker compose logs -f app' sagt, woran es liegt."
fi

docker compose ps

printf '\n  Erreichbar unter: %s%s%s\n' "$FETT" "${WERT[PUBLIC_BASE_URL]}" "$AUS"
if [[ -n ${START_PASSWORT:-} ]]; then
  printf '\n  Erste Anmeldung\n'
  printf '    Telefonnummer:  %s\n' "${WERT[ADMIN_TELEFON]}"
  printf '    Start-Passwort: %s%s%s\n' "$FETT" "$START_PASSWORT" "$AUS"
  printf '    Es gilt 14 Tage und muss beim ersten Anmelden geaendert werden.\n'
fi

cat <<'ENDE'

  Was jetzt noch aussteht

    · Impressum und Datenschutz in src/config/legal.ts eintragen —
      /impressum weist offen aus, was fehlt.
    · docs/datenschutzerklaerung.md pruefen lassen, danach
      LEGAL.reviewed auf true setzen.
    · Sicherungen liegen taeglich unter ./sicherungen. Sie enthalten Namen
      und Telefonnummern und gehoeren verschluesselt weggelegt, sobald sie
      den Server verlassen.

  Nuetzlich

    docker compose ps                  Zustand aller Dienste
    docker compose logs -f app         Protokoll der Anwendung
    docker compose logs -f cron        jeder Nachrichtenlauf, der etwas tat
    ./einrichten.sh                    noch einmal, um Werte zu aendern

ENDE

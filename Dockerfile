# Mehrstufiger Build: Abhaengigkeiten, Build, schlankes Laufzeit-Abbild.
FROM node:22-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

FROM node:22-alpine AS build
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
# Platzhalter, nur fuer den Build.
#
# `next build` sammelt die Seitendaten ein und laedt dabei jede Route — und
# damit @/db, das die Adresse beim Laden des Moduls anlegt. Verbunden wird
# nichts, sie muss sich nur lesen lassen.
#
# Vorher kam der Wert aus der .env, die ohne .dockerignore mit in den Kontext
# geriet. Das Bauen hing damit am Inhalt einer Datei, die es nichts angeht:
# ein Passwort mit "/" darin machte die Adresse unlesbar und brach den Build
# ab. Jetzt steht hier ein fester Wert, und die .env bleibt draussen.
ENV DATABASE_URL=postgres://build:build@localhost:5432/build
RUN npm run build

FROM node:22-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production
RUN addgroup -S app && adduser -S app -G app
COPY --from=build --chown=app:app /app/.next/standalone ./
COPY --from=build --chown=app:app /app/.next/static ./.next/static
COPY --from=build --chown=app:app /app/public ./public
USER app
EXPOSE 3000
CMD ["node", "server.js"]

/**
 * Repariert Knopfadressen, in denen der Platzhalter zweimal steht.
 *
 * Vier freigegebene Vorlagen tragen als Adresse ihres URL-Knopfes
 *
 *     https://schiri.ben-schnorr.com/antwort/%7B%7B1%7D%7D{{1}}
 *
 * `%7B%7B1%7D%7D` ist ein prozentkodiertes `{{1}}` — also der Platzhalter als
 * **Text**. Dahinter steht er ein zweites Mal als **Variable**. Beim Versand
 * ersetzt Meta nur die Variable und laesst den Text stehen; beim Empfaenger
 * kommt `…/antwort/{{1}}<Token>` an. Der Link fuehrt auf eine Adresse, deren
 * Token die Signaturpruefung nicht besteht, und die Bestaetigung scheitert,
 * ohne dass die Seite sagen koennte, warum.
 *
 * Entstanden ist das beim Anlegen von Hand: wer die fertige Adresse in das
 * Feld „URL“ kopiert und danach eine Variable hinzufuegt, hat den Platzhalter
 * zweimal drin — einmal kodiert im Text, einmal als Variable am Ende.
 *
 * Meta laesst eine freigegebene Vorlage bearbeiten. Die Neufassung geht
 * erneut in die Pruefung (`PENDING`) und ist ueblicherweise nach Minuten bis
 * wenigen Stunden wieder `APPROVED`. Bis dahin verschickt die Anwendung
 * weiter die alte Fassung — deshalb schneidet `normaliseAnswerToken` den
 * Vorsatz zusaetzlich serverseitig ab.
 *
 * Aufruf:
 *   npx tsx --tsconfig tsconfig.skripte.json src/cli/vorlagen-reparieren.ts <waba-id> [--reparieren]
 *
 * Ohne `--reparieren` wird nichts geschickt: der Lauf zeigt nur, was er
 * aendern wuerde. Das ist die Vorgabe, weil jede Aenderung eine neue Pruefung
 * ausloest.
 */
import { ANSWER_PATH } from '@/routes';

const waba = process.argv[2];
const commit = process.argv.includes('--reparieren');
if (!waba || waba.startsWith('--')) {
  throw new Error('WABA-Id fehlt. Aufruf: … src/cli/vorlagen-reparieren.ts <waba-id> [--reparieren]');
}

const token = process.env.WHATSAPP_ACCESS_TOKEN;
if (!token) throw new Error('WHATSAPP_ACCESS_TOKEN fehlt.');

const auth = { authorization: `Bearer ${token}` };
const graph = 'https://graph.facebook.com/v21.0';

interface Button {
  type: string;
  text?: string;
  url?: string;
  example?: string[];
}
interface Component {
  type: string;
  text?: string;
  buttons?: Button[];
  [key: string]: unknown;
}
interface Template {
  id: string;
  name: string;
  language: string;
  status: string;
  components: Component[];
}

/* — 1. Bestand lesen, samt Id: ohne sie laesst sich nichts bearbeiten. — */
const existing: Template[] = [];
let next: string | null =
  `${graph}/${waba}/message_templates?limit=100&fields=id,name,language,status,components`;
while (next) {
  const response = await fetch(next, { headers: auth });
  const body = (await response.json()) as {
    data?: Template[];
    paging?: { next?: string };
    error?: { message?: string };
  };
  if (!response.ok) throw new Error(`Bestand lesen: ${body.error?.message ?? response.status}`);
  existing.push(...(body.data ?? []));
  next = body.paging?.next ?? null;
}
console.log(`${existing.length} Vorlagen gelesen.`);

/**
 * Ob eine Adresse den Platzhalter mehr als einmal traegt — kodiert oder nicht.
 *
 * Geprueft wird auf der dekodierten Fassung: `%7B%7B1%7D%7D` und `{{1}}` sind
 * dasselbe Zeichen fuer Meta, und genau daran ist der Fehler entstanden.
 */
const brokenUrl = (url: string): boolean => {
  const decoded = decodeURIComponent(url);
  return (decoded.match(/\{\{\d+\}\}/g) ?? []).length > 1;
};

/** Die Adresse, wie sie aussehen muss: genau eine Variable, ganz am Ende. */
const repairedUrl = (url: string): string => `${new URL(url).origin}${ANSWER_PATH}/{{1}}`;

/*
 * Der Beispielwert muss glaubwuerdig aussehen, sonst lehnt die Pruefung ab.
 * Er ist erfunden und traegt nichts Echtes — die Form eines Tokens genuegt.
 */
const EXAMPLE_TOKEN =
  'eyJrIjoiY29uZmlybSIsImciOiJnLTIwMjYtMDgtMjkiLCJyIjoici1qayJ9.Qm9YV3pKc0RmMkg0ZQ';

const broken = existing.filter((template) =>
  template.components.some((component) =>
    (component.buttons ?? []).some((button) => button.url !== undefined && brokenUrl(button.url)),
  ),
);

if (broken.length === 0) {
  console.log('\nNichts zu reparieren — keine Adresse trägt den Platzhalter doppelt.');
  process.exit(0);
}

console.log(`\n${broken.length} Vorlagen mit doppeltem Platzhalter:`);
for (const template of broken) {
  console.log(`  ${template.status.padEnd(10)} ${template.language.padEnd(6)} ${template.name}`);
}

/* — 2. Bearbeiten — */
for (const template of broken) {
  /*
   * Meta erwartet beim Bearbeiten **alle** Bestandteile, nicht nur den
   * geaenderten. Kopiert wird deshalb der gelesene Stand; ersetzt wird allein
   * die kaputte Adresse.
   */
  const components = template.components.map((component) => {
    if (!component.buttons) return component;
    return {
      ...component,
      buttons: component.buttons.map((button) =>
        button.url !== undefined && brokenUrl(button.url)
          ? {
              ...button,
              url: repairedUrl(button.url),
              example: [`${new URL(button.url).origin}${ANSWER_PATH}/${EXAMPLE_TOKEN}`],
            }
          : button,
      ),
    };
  });

  const before = template.components
    .flatMap((c) => c.buttons ?? [])
    .map((b) => b.url)
    .filter((url): url is string => url !== undefined && brokenUrl(url));
  const after = components
    .flatMap((c) => c.buttons ?? [])
    .map((b) => b.url)
    .filter((url): url is string => url !== undefined);

  console.log(`\n— ${template.name} (${template.language})`);
  console.log(`  vorher:  ${before.join(', ')}`);
  console.log(`  nachher: ${after.join(', ')}`);

  if (!commit) continue;

  const response = await fetch(`${graph}/${template.id}`, {
    method: 'POST',
    headers: { ...auth, 'content-type': 'application/json' },
    body: JSON.stringify({ components }),
  });
  const body = (await response.json()) as { success?: boolean; error?: { message?: string } };
  console.log(
    response.ok
      ? '  ✓ eingereicht — die Vorlage steht jetzt wieder in der Prüfung (PENDING).'
      : `  ✗ ${body.error?.message ?? response.status}`,
  );
}

if (!commit) {
  console.log('\nTrockenlauf. Zum wirklichen Ändern dieselbe Zeile mit --reparieren.');
}

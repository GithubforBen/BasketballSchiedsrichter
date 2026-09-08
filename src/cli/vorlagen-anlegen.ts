/**
 * Laedt die Vorlagen bei Meta herunter und legt die fehlenden an.
 *
 * Zwoelf Vorlagen von Hand anzuklicken ist muehsam und fehleranfaellig — das
 * steht schon in `docs/whatsapp-vorlagen.md`, und dies ist das Skript, das
 * dort angeboten wird. Es liest zuerst den Bestand
 * (`GET /{waba-id}/message_templates`), schreibt ihn nach
 * `docs/whatsapp-vorlagen.json`, und legt danach nur an, was fehlt.
 *
 * Zweimal laufen schadet nicht: was schon da ist, wird uebersprungen.
 *
 * Aufruf:  npx tsx --tsconfig tsconfig.skripte.json src/cli/vorlagen-anlegen.ts <waba-id> [--anlegen]
 *
 * Ohne `--anlegen` wird nichts geschickt — dann zeigt der Lauf nur, was fehlte
 * und was er einreichen wuerde. Eine freigegebene Vorlage laesst sich bei Meta
 * nicht mehr aendern, nur ersetzen; deshalb ist der Trockenlauf die Vorgabe.
 */
import { writeFileSync } from 'node:fs';
import { TEMPLATE_LANGUAGE } from '@/notifications/templates';
import { ANSWER_PATH } from '@/routes';

const waba = process.argv[2];
const commit = process.argv.includes('--anlegen');
if (!waba || waba.startsWith('--')) {
  throw new Error('WABA-Id fehlt. Aufruf: … src/cli/vorlagen-anlegen.ts <waba-id> [--anlegen]');
}

const token = process.env.WHATSAPP_ACCESS_TOKEN;
if (!token) throw new Error('WHATSAPP_ACCESS_TOKEN fehlt.');

const api = `https://graph.facebook.com/v21.0/${waba}/message_templates`;
const auth = { authorization: `Bearer ${token}` };

interface Component {
  type: string;
  text?: string;
  buttons?: { type: string; text?: string; url?: string }[];
}
interface Template {
  name: string;
  language: string;
  status: string;
  category: string;
  components: Component[];
}

/* — 1. Bestand lesen — */
const existing: Template[] = [];
let next: string | null = `${api}?limit=100`;
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

writeFileSync('docs/whatsapp-vorlagen.json', `${JSON.stringify(existing, null, 2)}\n`);
console.log(`${existing.length} Vorlagen gelesen → docs/whatsapp-vorlagen.json`);
for (const t of existing) {
  console.log(`  ${t.status.padEnd(10)} ${t.language.padEnd(6)} ${t.name}`);
}

/*
 * Die Adresse der Knoepfe steht nicht im Code, sondern in den freigegebenen
 * Vorlagen: sie ist der Domainname, unter dem der Verein erreichbar ist. Er
 * wird aus dem Bestand gelesen, damit die neuen Vorlagen auf dieselbe Adresse
 * zeigen wie die alten und nicht auf eine erfundene.
 */
const urlFromExisting = existing
  .flatMap((t) => t.components)
  .flatMap((c) => c.buttons ?? [])
  .map((b) => b.url)
  .find((url): url is string => typeof url === 'string' && url.startsWith('https://'));

if (!urlFromExisting) {
  throw new Error(
    'Keine freigegebene Vorlage mit https-Knopf gefunden — ohne sie ist der Domainname unbekannt.',
  );
}
const origin = new URL(urlFromExisting).origin;
console.log(`\nKnopf-Adressen zeigen auf ${origin}`);

/* — 2. Was fehlt — */
const has = (name: string): boolean =>
  existing.some((t) => t.name === name && t.language === TEMPLATE_LANGUAGE);

const beispiel = {
  spiel: 'Sa 29.08.2026, 10:30 Uhr · U14 · BG Nordstadt gegen TV Ostheim',
  ort: 'Sporthalle Nordstadt, Feld 2',
};

const wanted: readonly Record<string, unknown>[] = [
  {
    name: 'schiriplan_anmeldung',
    language: TEMPLATE_LANGUAGE,
    category: 'AUTHENTICATION',
    message_send_ttl_seconds: 900,
    components: [
      /* Kein Paketname: der Kopieren-Knopf braucht keinen, One-Tap gibt es nur fuer Apps. */
      { type: 'BODY', add_security_recommendation: true },
      { type: 'FOOTER', code_expiration_minutes: 15 },
      { type: 'BUTTONS', buttons: [{ type: 'OTP', otp_type: 'COPY_CODE', text: 'Code kopieren' }] },
    ],
  },
  {
    name: 'schiriplan_termin_geaendert',
    language: TEMPLATE_LANGUAGE,
    category: 'UTILITY',
    components: [
      {
        type: 'BODY',
        text: [
          'Hallo {{1}},',
          '',
          'du bist als Schiedsrichter für dieses Spiel eingetragen:',
          '{{2}}',
          'Ort: {{3}}',
          '',
          'Das Spiel wurde verlegt:',
          '',
          'Neue Zeit: {{4}}',
          '',
          'Neuer Ort: {{5}}.',
          'Anpfiff {{6}}.',
          '',
          'Passt der neue Termin?',
          'Bitte sag zu oder ab.',
        ].join('\n'),
        example: {
          body_text: [
            [
              'Jonas',
              beispiel.spiel,
              beispiel.ort,
              'Sa 05.09.2026, 10:30 Uhr',
              'Zeppelinhalle',
              'in 9 Tagen',
            ],
          ],
        },
      },
      {
        type: 'BUTTONS',
        buttons: [
          {
            type: 'URL',
            text: 'Zu oder Absagen',
            /* Die eine erlaubte Variable steht am Ende der Adresse — der Antwort-Token. */
            url: `${origin}${ANSWER_PATH}/{{1}}`,
            example: [`${origin}${ANSWER_PATH}/beispieltoken`],
          },
        ],
      },
    ],
  },
  {
    name: 'schiriplan_erinnerung',
    language: TEMPLATE_LANGUAGE,
    category: 'UTILITY',
    components: [
      {
        type: 'BODY',
        text: [
          'Hallo {{1}},',
          '',
          'Erinnerung: {{2}} vor Anpfiff.',
          '{{3}}',
          'Ort: {{4}}',
          'Anpfiff {{5}}.',
          '',
          'Bis dann!',
        ].join('\n'),
        example: {
          body_text: [['Jonas', '1 Tag', beispiel.spiel, beispiel.ort, 'in 22 Stunden']],
        },
      },
      {
        type: 'BUTTONS',
        buttons: [{ type: 'URL', text: 'Zum Kalender', url: `${origin}/kalender` }],
      },
    ],
  },
];

const missing = wanted.filter((t) => !has(String(t['name'])));
if (missing.length === 0) {
  console.log('\nNichts zu tun — alle drei Vorlagen sind angelegt.');
} else {
  console.log(`\n${missing.length} fehlen: ${missing.map((t) => t['name']).join(', ')}`);
}

/* — 3. Anlegen — */
for (const template of missing) {
  const name = String(template['name']);
  if (!commit) {
    console.log(`\n— würde anlegen: ${name}\n${JSON.stringify(template, null, 2)}`);
    continue;
  }
  const response = await fetch(api, {
    method: 'POST',
    headers: { ...auth, 'content-type': 'application/json' },
    body: JSON.stringify(template),
  });
  const body = (await response.json()) as { id?: string; status?: string; error?: { message?: string } };
  console.log(
    response.ok
      ? `✓ ${name} eingereicht (${body.status ?? 'PENDING'}, Id ${body.id})`
      : `✗ ${name}: ${body.error?.message ?? response.status}`,
  );
}

if (!commit && missing.length > 0) {
  console.log('\nTrockenlauf. Zum wirklichen Anlegen dieselbe Zeile mit --anlegen.');
}

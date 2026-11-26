// Every word on the site, typed from CONTENT.md. No copy lives anywhere else.
// url: null means Vipin has not supplied it yet; the UI shows "soon".

export type Row = { label: string; side?: string; line?: string; url?: string | null };
export type Block =
  | { kind: 'p'; text: string; links?: Record<string, string> }
  | { kind: 'h'; text: string }
  | { kind: 'list'; rows: Row[] };
export type Note = { key: NoteKey; word: string; billboard: string; title: string; blocks: Block[] };
export type NoteKey = 'name' | 'work' | 'books' | 'thoughts';

export const identity = {
  name: 'Vipin Sharma',
  description:
    "Vipin Sharma. Founder's Office at Incentiv, working where AI meets financial decisions. Open to founder's office, growth and ops roles at fintechs.",
  ogDescription: "Founder's Office at Incentiv. AI x financial decisions. Open to fintech roles.",
  base: 'Bengaluru',
};

export const SOON = 'soon';

export const notes: Note[] = [
  {
    key: 'name',
    word: 'Name',
    billboard: 'VIPIN',
    title: 'Vipin Sharma',
    blocks: [
      { kind: 'p', text: "Founder's Office at Incentiv, a private markets infrastructure company in Bengaluru." },
      { kind: 'p', text: 'I build the tools, data and outbound engines a small finance team runs on. I work where AI meets financial decisions.' },
      { kind: 'p', text: 'MBA in Finance and Business Analytics, FLAME University, 2026. Originally from Jodhpur.' },
      { kind: 'h', text: 'Looking for' },
      { kind: 'p', text: "Founder's office, growth and ops roles at funded fintechs. Bengaluru or remote." },
      { kind: 'h', text: 'Elsewhere' },
      {
        kind: 'list',
        rows: [
          { label: 'GitHub', side: 'vipin-sharma08', url: 'https://github.com/vipin-sharma08' },
          { label: 'LinkedIn', url: null },
          { label: 'X', url: null },
          { label: 'Substack', side: 'WIRTW', url: null },
          { label: 'Get my number', url: null },
        ],
      },
    ],
  },
  {
    key: 'work',
    word: 'Work',
    billboard: 'WORK',
    title: 'Work',
    blocks: [
      { kind: 'h', text: "Incentiv, Founder's Office · since June 2026" },
      {
        kind: 'list',
        rows: [
          { label: 'Funding-leads engine', line: 'Every morning it sweeps Indian funding news, finds the CEO and finance lead at each newly funded company, enriches them and queues them for review.' },
          { label: 'ESOP pool calculator', line: 'A sizing tool for founders on incentiv.finance/tools.' },
          { label: 'Grant', line: 'Founders enter a few inputs and download a ready ESOP grant letter.' },
          { label: 'India funding map', line: 'Click a city to see its funded startups and founders.' },
          { label: 'Folio blog pipeline', line: 'Research, write, audit, design and publish, as one pipeline.' },
          { label: 'SEBI RIA register', line: 'A scraper and clean dataset of registered investment advisers.' },
        ],
      },
      { kind: 'h', text: 'Side builds' },
      {
        kind: 'list',
        rows: [
          { label: 'MemoAI', line: 'An AI investment memo generator on the Claude API and n8n.', url: 'https://memo-ai-eosin.vercel.app' },
          { label: 'Adani Green IVM', line: 'An integrated value and ESG workbook.' },
        ],
      },
      { kind: 'h', text: 'Before' },
      {
        kind: 'list',
        rows: [
          { label: 'WhiteSight', side: 'Fintech research' },
          { label: 'Deccan Nutraceuticals', side: 'Finance and MIS' },
        ],
      },
    ],
  },
  {
    key: 'books',
    word: 'Books',
    billboard: 'BOOKS',
    title: 'Books',
    blocks: [
      { kind: 'p', text: "What's on the desk right now." },
      // SAMPLE LIST from CONTENT.md, TODO(vipin): replace with real books
      {
        kind: 'list',
        rows: [
          { label: 'Superforecasting', side: 'Philip Tetlock' },
          { label: "Poor Charlie's Almanack", side: 'Charles T. Munger' },
          { label: 'High Output Management', side: 'Andrew S. Grove' },
          { label: 'The Alchemy of Finance', side: 'George Soros' },
        ],
      },
    ],
  },
  {
    key: 'thoughts',
    word: 'Thoughts',
    billboard: 'THOUGHTS',
    title: 'Thoughts',
    blocks: [
      { kind: 'p', text: 'I write WIRTW, a weekly note on markets and AI, on Substack and LinkedIn.' },
      { kind: 'h', text: 'On my mind' },
      {
        kind: 'list',
        rows: [
          { label: 'Prediction markets', side: 'and thinking in odds' },
          { label: 'Indian private markets', side: 'funds, founders, ESOPs' },
          { label: 'AI and money', side: 'how decisions get made' },
        ],
      },
      { kind: 'h', text: 'In the drafts' },
      { kind: 'list', rows: [{ label: "Who owns Anthropic isn't who runs it" }] },
    ],
  },
];

export const ORDER: NoteKey[] = notes.map((n) => n.key);

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
// "22 November 2026 at 14:24"
export const stamp = (d: Date, hhmm: string) => `${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]} ${d.getUTCFullYear()} at ${hhmm}`;
// "Bengaluru · 14:24 IST"
export const footer = (hhmm: string) => `${identity.base} · ${hhmm} IST`;

// Every word on the site, typed from CONTENT.md. No copy lives anywhere else.
// A Part with url: null means Vipin has not supplied the link yet; the UI shows it greyed as "soon".

export type Part = string | { text: string; url: string | null };
export type Row = { label: string; side: string; href?: string; external?: boolean };
export type Item = { label: string; line: string; tag?: string; url?: string };
export type Section =
  | { heading?: string; kind: 'rows'; rows: Row[]; fine?: string }
  | { heading?: string; kind: 'items'; items: Item[] };
export type View = { title: string; lede: Part[]; sections: Section[] };
export type ViewKey = 'work' | 'books' | 'thoughts' | 'music';

export const identity = {
  name: 'Vipin Sharma',
  description:
    "Vipin Sharma. Founder's Office at Incentiv, building where AI meets financial decisions. Looking for founder's office, growth and ops roles at funded fintechs.",
  ogDescription: "Founder's Office at Incentiv. AI and financial decisions. Bengaluru.",
  copyright: '© 2026 Vipin Sharma',
  city: 'bangalore',
};

export const SOON_TIP = 'Link coming soon';

export const home = {
  first: 'Vipin',
  role: 'Founder’s Office, Incentiv',
  intro: ['Bio'] as Part[],
  reach: [
    'You can reach me on ',
    { text: 'GitHub', url: 'https://github.com/vipin-sharma08' },
    ', ',
    { text: 'LinkedIn', url: null },
    ', ',
    { text: 'X', url: null },
    ' and ',
    { text: 'Substack', url: null },
    '.',
  ] as Part[],
  egg: 'Draw on the sky',
  sections: [
    {
      heading: 'Notes',
      kind: 'rows',
      rows: [
        { label: 'Work', side: 'What I’ve built at Incentiv', href: '#work' },
        { label: 'Books', side: 'On the desk right now', href: '#books' },
        { label: 'Thoughts', side: 'WIRTW and what’s on my mind', href: '#thoughts' },
        { label: 'Music', side: 'On while I build', href: '#music' },
      ],
    },
    {
      heading: 'Projects',
      kind: 'rows',
      rows: [
        { label: 'Funding-leads engine', side: 'Funding news to a daily lead queue', href: '#work' },
        { label: 'ESOP pool calculator', side: 'Pool sizing for founders', href: '#work' },
        { label: 'Grant', side: 'ESOP grant letters for founders', href: '#work' },
        { label: 'India funding map', side: 'Funded startups, city by city', href: '#work' },
        { label: 'Folio blog pipeline', side: 'Research to publish, one pipeline', href: '#work' },
        { label: 'SEBI RIA register', side: 'Clean data on registered advisers', href: '#work' },
        { label: 'MemoAI', side: 'AI investment memos ↗', href: 'https://memo-ai-eosin.vercel.app', external: true },
      ],
    },
    {
      heading: 'Experience',
      kind: 'rows',
      rows: [
        { label: 'Incentiv', side: 'Founder’s Office, 2026' },
        { label: 'FLAME University', side: 'MBA, Finance and Business Analytics, 2026' },
        { label: 'WhiteSight', side: 'Fintech research' },
        { label: 'Deccan Nutraceuticals', side: 'Finance and MIS' },
      ],
    },
  ] as Section[],
};

export const views: Record<ViewKey, View> = {
  work: {
    title: 'Work',
    lede: ['At Incentiv I build the machinery behind a small team: data, tools and outbound that run without anyone babysitting them.'],
    sections: [
      {
        heading: 'Incentiv, since June 2026',
        kind: 'items',
        items: [
          { label: 'Funding-leads engine', tag: 'Daily', line: 'Sweeps Indian funding news each morning, finds the CEO and finance lead at every newly funded company, and queues them for review.' },
          { label: 'ESOP pool calculator', line: 'A sizing tool for founders on incentiv.finance/tools.' },
          { label: 'Grant', line: 'Founders enter a few inputs and download a ready ESOP grant letter.' },
          { label: 'India funding map', line: 'Click a city to see its funded startups and founders.' },
          { label: 'Folio blog pipeline', line: 'Research, write, audit, design and publish, as one pipeline.' },
          { label: 'SEBI RIA register', line: 'A scraper and clean dataset of registered investment advisers.' },
        ],
      },
      {
        heading: 'Side builds',
        kind: 'items',
        items: [
          { label: 'MemoAI', url: 'https://memo-ai-eosin.vercel.app', line: 'An AI investment memo generator on the Claude API and n8n.' },
          { label: 'Adani Green IVM', line: 'An integrated value and ESG workbook.' },
        ],
      },
    ],
  },
  books: {
    title: 'Books',
    lede: ['What’s on the desk right now.'],
    sections: [
      {
        kind: 'rows',
        rows: [
          { label: 'Superforecasting', side: 'Philip Tetlock' },
          { label: 'Poor Charlie’s Almanack', side: 'Charles T. Munger' },
          { label: 'High Output Management', side: 'Andrew S. Grove' },
          { label: 'The Alchemy of Finance', side: 'George Soros' },
        ],
        fine: 'Sample list, to swap for the real one.',
      },
    ],
  },
  thoughts: {
    title: 'Thoughts',
    lede: ['I write ', { text: 'WIRTW', url: null }, ', a weekly note on markets and AI.'],
    sections: [
      {
        heading: 'On my mind',
        kind: 'rows',
        rows: [
          { label: 'Prediction markets', side: 'Thinking in odds' },
          { label: 'Indian private markets', side: 'Funds, founders, ESOPs' },
          { label: 'AI and money', side: 'How decisions get made' },
        ],
      },
      { heading: 'In the drafts', kind: 'rows', rows: [{ label: 'Who owns Anthropic isn’t who runs it', side: 'Draft' }] },
    ],
  },
  music: {
    title: 'Music',
    lede: ['Always on while I build: ambient for deep work, loud for the walk home.'],
    sections: [
      {
        kind: 'rows',
        rows: [
          { label: 'Kun Faya Kun', side: 'A. R. Rahman, Javed Ali, Mohit Chauhan' },
          { label: 'Intro', side: 'The xx' },
          { label: 'Iktara', side: 'Amit Trivedi, Kavita Seth' },
          { label: 'Nuvole Bianche', side: 'Ludovico Einaudi' },
          { label: 'Midnight City', side: 'M83' },
        ],
        fine: 'Sample list, to swap for the real one.',
      },
    ],
  },
};

export const ui = { home: '↖ Home', range: 'Snow peaks of the Himalaya above a deodar forest', clear: 'Clear', done: 'Done' };

# Content: every word on the site

Single source of truth. Claude Code turns this into `content.ts`; no copy lives anywhere else.
`TODO` = Vipin still has to supply it. Until then the UI shows "soon" (greyed, not a link).

## Identity
- Name: Vipin Sharma
- Meta description: Vipin Sharma. Founder's Office at Incentiv, working where AI meets financial decisions. Open to founder's office, growth and ops roles at fintechs.
- OG description: Founder's Office at Incentiv. AI x financial decisions. Open to fintech roles.
- Base: Bengaluru (Indiranagar), IST, UTC+5:30

## The four words (2x2 grid)
Name · Work · Books · Thoughts
Billboard text when hovered: "VIPIN", "WORK", "BOOKS", "THOUGHTS"

## Note: Name
Title: Vipin Sharma
- Founder's Office at Incentiv, a private markets infrastructure company in Bengaluru.
- I build the tools, data and outbound engines a small finance team runs on. I work where AI meets financial decisions.
- MBA in Finance and Business Analytics, FLAME University, 2026. Originally from Jodhpur.

Looking for
- Founder's office, growth and ops roles at funded fintechs. Bengaluru or remote.

Elsewhere
| Label | Handle | URL |
|---|---|---|
| GitHub | vipin-sharma08 | https://github.com/vipin-sharma08 |
| LinkedIn | | TODO |
| X | | TODO |
| Substack | WIRTW | TODO |
| Get my number | | opens the number flow (UI only for now) |

## Note: Work
Section: Incentiv, Founder's Office · since June 2026
| Item | Line | Number (TODO, one real metric each) |
|---|---|---|
| Funding-leads engine | Every morning it sweeps Indian funding news, finds the CEO and finance lead at each newly funded company, enriches them and queues them for review. | TODO |
| ESOP pool calculator | A sizing tool for founders on incentiv.finance/tools. | TODO |
| Grant | Founders enter a few inputs and download a ready ESOP grant letter. | TODO |
| India funding map | Click a city to see its funded startups and founders. | TODO |
| Folio blog pipeline | Research, write, audit, design and publish, as one pipeline. | TODO |
| SEBI RIA register | A scraper and clean dataset of registered investment advisers. | TODO |

Section: Side builds
| Item | Line | Link |
|---|---|---|
| MemoAI | An AI investment memo generator on the Claude API and n8n. | https://memo-ai-eosin.vercel.app |
| Adani Green IVM | An integrated value and ESG workbook. | |

Section: Before
| Company | Role |
|---|---|
| WhiteSight | Fintech research |
| Deccan Nutraceuticals | Finance and MIS |

## Note: Books
Intro: What's on the desk right now.
SAMPLE LIST, TODO replace with real books:
- Superforecasting, Philip Tetlock
- Poor Charlie's Almanack, Charles T. Munger
- High Output Management, Andrew S. Grove
- The Alchemy of Finance, George Soros

## Note: Thoughts
- I write WIRTW, a weekly note on markets and AI, on Substack and LinkedIn.

On my mind
- Prediction markets: and thinking in odds
- Indian private markets: funds, founders, ESOPs
- AI and money: how decisions get made

In the drafts
- Who owns Anthropic isn't who runs it

## Note sheet chrome
- Round back button, round next button
- Date stamp, live IST: "22 November 2026 at 14:24"
- Footer meta (bottom left): "Bengaluru · 14:24 IST"

## Salvaged copy (from the chrome card page, use only if the matching feature comes back)

Welcome sequence (flips, then lands on the last line):
1. Khamma ghani. (Marwari, where I'm from)
2. Namaskara. (Kannada, where I live)
3. Namaste. (Hindi, at home)
4. Hello. (English, everywhere else)
5. Hi, I'm Vipin.

Time-of-day line: "It's {time} in Bengaluru, so I'm {doing}." Visitors outside India also see their own local time.
| IST hour | {doing} |
|---|---|
| 00-05 | probably still building something |
| 05-08 | probably reading the morning's funding news |
| 08-10 | probably on my way to Indiranagar |
| 10-13 | probably deep in work |
| 13-14 | probably at lunch |
| 14-19 | probably shipping something |
| 19-22 | probably out on a walk, music on |
| 22-24 | probably still building something |

Music. Lede: "Always on while I build: ambient for deep work, loud for the walk home."
PLACEHOLDER TRACKS, TODO replace with real ones:
- Kun Faya Kun, A. R. Rahman, Javed Ali, Mohit Chauhan (7:53)
- Intro, The xx (2:08)
- Iktara, Amit Trivedi, Kavita Seth (4:07)
- Nuvole Bianche, Ludovico Einaudi (5:57)
- Midnight City, M83 (4:03)

Education (was its own card section; now folded into the Name note):
- FLAME University: MBA, Finance and Business Analytics. Pune, class of 2026
- Certifications: Prompt Engineering, Vanderbilt University. AI Fluency, Anthropic
- Toolkit: Python, FastAPI, the Claude API, n8n, React and Next.js
- Methods: DCF, ESG frameworks, panel regressions

Contact extras:
- Based in: Indiranagar, Bangalore. Open to remote
- Time zone: IST, UTC+5:30. Replies within a day

Get my number flow (UI only, backend later):
1. Visitor enters name, email, what it's about
2. 6-digit code: boxes auto-advance, accept paste, resend countdown
3. "Verified" screen
Keep a `NUMBER_DEMO = true` flag and a visible "Preview" line until a backend exists. Mark backend spots `TODO(backend)`.

## Still missing (TODO list for Vipin)
- [ ] LinkedIn, X, Substack URLs
- [ ] Real books (4 to 6)
- [ ] Real tracks, if Music comes back
- [ ] One real number per Work item
- [ ] Contact email to show (or keep it behind "Get my number")
- [ ] Resume PDF, if wanted
- [ ] The two images: LED dot-screen reference, Notes screenshot

## Sky page (26 Nov 2026, from reference/04)
The live site uses this copy; `content.ts` holds it word for word. Sections above that the Sky page doesn't show (the 2x2 words, sheet chrome) are kept for history.
- Home: "Bio" / "You can reach me on GitHub, LinkedIn, X and Substack." (26 Nov: the intro line was replaced with "Bio" at Vipin's ask)
- Notes rows: Work, Books, Thoughts, Music. Projects rows: the six Incentiv builds plus MemoAI, each with a short line. Experience rows: Incentiv, FLAME University, WhiteSight, Deccan Nutraceuticals.
- Music (SAMPLE LIST, TODO replace): Kun Faya Kun, Intro, Iktara, Nuvole Bianche, Midnight City

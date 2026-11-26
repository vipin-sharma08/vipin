'use client';
import { Fragment, useEffect, useRef, useState } from 'react';
import { home, identity, SOON_TIP, ui, views, type Part, type Row, type Section, type ViewKey } from '@/content';
import { startSky, type Engine, type SkyMode, type Theme } from '@/lib/sky';

type Key = 'home' | ViewKey;
const keyOf = (hash: string): Key => { const k = hash.slice(1); return k in views ? (k as ViewKey) : 'home'; };

function Rich({ parts }: { parts: Part[] }) {
  return parts.map((p, i) =>
    typeof p === 'string' ? <Fragment key={i}>{p}</Fragment>
    : p.url ? <a key={i} href={p.url} target="_blank" rel="noopener">{p.text}</a>
    : <span key={i} className="soon" title={SOON_TIP}>{p.text}</span>,
  );
}

function RowItem({ r }: { r: Row }) {
  const inner = <><span className="l">{r.label}</span><span className="lead" aria-hidden="true" /><span className="d">{r.side}</span></>;
  return <li>{r.href
    ? <a className="row" href={r.href} {...(r.external ? { target: '_blank', rel: 'noopener' } : {})}>{inner}</a>
    : <div className="row">{inner}</div>}</li>;
}

function Sections({ list }: { list: Section[] }) {
  return list.map((s, i) => (
    <section key={i}>
      {s.heading && <h2>{s.heading}</h2>}
      {s.kind === 'rows'
        ? <><ul className="rows">{s.rows.map((r) => <RowItem key={r.label} r={r} />)}</ul>{s.fine && <p className="fine">{s.fine}</p>}</>
        : <ul className="items">{s.items.map((it) => (
            <li key={it.label}>
              <b>{it.url ? <a href={it.url} target="_blank" rel="noopener">{it.label}</a> : it.label}</b>
              {it.tag && <span className="tag">{it.tag}</span>}
              <p>{it.line}</p>
            </li>))}</ul>}
    </section>
  ));
}

function Egg() {
  return (
    <button id="egg" aria-label={home.egg} title={home.egg}>
      <svg viewBox="0 0 18 18" aria-hidden="true">
        {[0, 1, 2].flatMap((y) => [0, 1, 2].map((x) => (
          <circle key={x + y * 3} style={{ ['--i' as string]: x + y * 3 }} cx={3 + x * 6} cy={3 + y * 6} r="2.1" fill="currentColor" />
        )))}
      </svg>
    </button>
  );
}

function Home({ egg }: { egg: boolean }) {
  return <>
    <div className="me">
      <canvas id="orb" aria-hidden="true" />
      <div>
        <h1>V<span className="dt">i</span>p<span className="dt dt2">i</span>n</h1>
        <p className="role">{home.role}</p>
      </div>
    </div>
    <div className="intro">
      <p><Rich parts={home.intro} />{egg && <Egg />}</p>
      <p><Rich parts={home.reach} /></p>
    </div>
    <Sections list={home.sections} />
  </>;
}

function Sub({ k }: { k: ViewKey }) {
  const v = views[k];
  return <>
    <a className="back" href="#">{ui.home}</a>
    <h1 className="title">{v.title}</h1>
    <p className="lede"><Rich parts={v.lede} /></p>
    <Sections list={v.sections} />
  </>;
}

export default function SkyPage({ sky, assets }: { sky?: SkyMode; assets?: string } = {}) {
  const [key, setKey] = useState<Key>('home');
  const [out, setOut] = useState(false);
  const [boot, setBoot] = useState<{ mode: SkyMode; forced: Theme | null } | null>(null);
  const mode: SkyMode = boot?.mode ?? 'dots';
  const engine = useRef<Engine | null>(null);
  const cur = useRef<Key | null>(null);

  // read ?sky= and ?theme= (dev and screenshots) and the hash route
  useEffect(() => {
    const q = new URLSearchParams(location.search);
    const t = q.get('theme') || (q.get('night') === '1' ? 'night' : null);
    const forced = (['day', 'night', 'monsoon'] as Theme[]).includes(t as Theme) ? (t as Theme) : null;
    const first = keyOf(location.hash);
    cur.current = first; setKey(first);
    document.body.classList.toggle('sub', first !== 'home');
    setBoot({ mode: sky ?? (q.get('sky') === 'ascii' ? 'ascii' : 'dots'), forced });
  }, [sky]);

  // start the engine once the sky element for this mode is in the DOM
  useEffect(() => {
    if (!boot) return;
    engine.current = startSky(boot.mode, boot.forced, assets);
    return () => { engine.current?.stop(); engine.current = null; };
  }, [boot, assets]);

  // router: fade the column out, swap, fade back in
  useEffect(() => {
    const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
    let timer = 0;
    const route = () => {
      const k = keyOf(location.hash);
      if (k === cur.current) return;
      cur.current = k;
      const swap = () => {
        setKey(k);
        document.body.classList.toggle('sub', k !== 'home');
        document.title = k === 'home' ? identity.name : views[k].title + ' · ' + identity.name;
        window.scrollTo(0, 0);
        requestAnimationFrame(() => setOut(false));
      };
      if (reduce) swap(); else { setOut(true); timer = window.setTimeout(swap, 220); }
    };
    addEventListener('hashchange', route);
    return () => { removeEventListener('hashchange', route); clearTimeout(timer); };
  }, []);

  useEffect(() => { engine.current?.refresh(); }, [key, mode]);

  return <>
    {mode === 'dots' ? <canvas id="sky" aria-hidden="true" /> : <div id="asciiwrap" aria-hidden="true"><canvas id="ascii" /></div>}
    <div id="pad" aria-hidden="true" />
    <div id="hint" role="status">{home.egg}<button id="clear">{ui.clear}</button><button id="done">{ui.done}</button></div>
    <main>
      <header className="top"><a className="mark" href="#" aria-label={identity.name + ', home'}>{home.first}</a><button id="theme" /></header>
      <div id="view" className={out ? 'out' : undefined}>{key === 'home' ? <Home egg={mode === 'dots'} /> : <Sub k={key} />}</div>
      <div className="tick"><canvas id="trees" role="img" aria-label={ui.trees} /></div>
      <footer><span>{identity.copyright}</span><span className="now"><i /><span id="nowT" /></span></footer>
    </main>
  </>;
}

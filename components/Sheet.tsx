'use client';
import { forwardRef, useEffect, useState } from 'react';
import { notes, SOON, type Block, type NoteKey } from '@/content';
import s from './Sheet.module.css';

const typo = (t: string) => t.replace(/'/g, '’');

type Props = { open: NoteKey | null; stamp: string; typeTitle: boolean; reduce: boolean; onBack: () => void; onNext: () => void };

function BlockView({ b, style }: { b: Block; style: React.CSSProperties }) {
  if (b.kind === 'p') return <p className={`${s.p} ${s.ln}`} style={style}>{typo(b.text)}</p>;
  if (b.kind === 'h') return <h3 className={`${s.h} ${s.ln}`} style={style}>{typo(b.text)}</h3>;
  return (
    <ul className={`${s.list} ${s.ln}`} style={style}>
      {b.rows.map((r) => {
        const soon = r.url === null;
        const label = r.url ? (
          <a href={r.url} target="_blank" rel="noopener">{typo(r.label)}</a>
        ) : (
          typo(r.label)
        );
        const side = soon ? (r.side ? `${r.side}, ${SOON}` : SOON) : r.side;
        return (
          <li key={r.label} className={s.row}>
            <span className={`${s.label} ${soon ? s.soon : ''}`}>{label}</span>
            {side && <span className={s.side}>{typo(side)}</span>}
            {r.line && <span className={s.line}>{typo(r.line)}</span>}
          </li>
        );
      })}
    </ul>
  );
}

const Sheet = forwardRef<HTMLButtonElement, Props>(function Sheet({ open, stamp, typeTitle, reduce, onBack, onNext }, backRef) {
  // keep the last note rendered while the sheet slides out
  const [shown, setShown] = useState<NoteKey>('name');
  const [go, setGo] = useState(false);
  const [typed, setTyped] = useState<number | null>(null);
  const note = notes.find((n) => n.key === shown)!;

  useEffect(() => {
    if (!open) return;
    setShown(open);
    setGo(false);
    let r2 = 0;
    const r1 = requestAnimationFrame(() => { r2 = requestAnimationFrame(() => setGo(true)); });
    return () => { cancelAnimationFrame(r1); cancelAnimationFrame(r2); };
  }, [open]);

  // torch variant (dev only): the title types itself in
  useEffect(() => {
    if (!open || !typeTitle || reduce) { setTyped(null); return; }
    const title = notes.find((n) => n.key === open)!.title;
    let i = 0, id = 0;
    setTyped(0);
    const step = () => { i++; setTyped(i); if (i < title.length) id = window.setTimeout(step, 55 + Math.random() * 60); else id = window.setTimeout(() => setTyped(null), 900); };
    id = window.setTimeout(step, 250);
    return () => clearTimeout(id);
  }, [open, typeTitle, reduce]);

  const base = typeTitle ? 0.45 : 0.12;
  let i = 0;
  const delay = () => ({ transitionDelay: `${base + i++ * 0.05}s` });

  return (
    <aside className={`${s.sheet} ${open ? s.on : ''}`} role="dialog" aria-labelledby="note-title" inert={!open} data-sheet>
      <div className={s.head}>
        <button ref={backRef} className={s.round} onClick={onBack} aria-label="Back">
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M15 5l-7 7 7 7" /></svg>
        </button>
        <button className={s.round} onClick={onNext} aria-label="Next note">
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 5l7 7-7 7" /></svg>
        </button>
      </div>
      <p className={s.stamp}>{stamp}</p>
      <div className={`${s.body} ${go ? s.go : ''}`} key={shown}>
        <h2 id="note-title" className={s.title}>
          {typed === null ? note.title : <>{note.title.slice(0, typed)}<span className={s.caret} /></>}
        </h2>
        {note.blocks.map((b, k) => <BlockView key={k} b={b} style={delay()} />)}
      </div>
    </aside>
  );
});

export default Sheet;

import { useEffect, useState } from 'react';
import { formatBytes } from '../lib/files';
import { peekShared, toolsForFiles, type SharedInfo } from '../lib/shared';
import type { ToolSlug } from '../tools';

export interface ShareTexts {
  title: string;
  empty: string;
  note: string;
  tools: Record<string, string>;
}

interface Props {
  langs: string[];
  fallback: string;
  texts: Record<string, ShareTexts>;
}

/** /share/: shown after Android "Share → IslePlace"; offers the tools that fit the received files. */
export default function ShareTarget({ langs, fallback, texts }: Props) {
  const [lang, setLang] = useState(fallback);
  const [files, setFiles] = useState<(SharedInfo & { size?: number })[] | null>(null);

  useEffect(() => {
    const pick = (navigator.languages || [navigator.language]).map((l) => l.slice(0, 2).toLowerCase()).find((l) => langs.includes(l));
    if (pick) setLang(pick);
    peekShared().then(setFiles);
  }, []);

  const t = texts[lang];
  if (!files) return null;
  const tools: ToolSlug[] = toolsForFiles(files);
  return (
    <section className="share" data-testid="share">
      <h1>{files.length ? t.title : t.empty}</h1>
      {files.length > 0 && (
        <>
          <ul className="files">
            {files.map((f, i) => (
              <li key={i}>
                <span className="fname">
                  {f.name}
                  <small className="meta">{f.type || '—'}{f.size ? ` · ${formatBytes(f.size)}` : ''}</small>
                </span>
              </li>
            ))}
          </ul>
          <ul className="cards">
            {tools.map((s) => (
              <li key={s}>
                <a href={`/${lang}/${s}/?shared=1`}>{t.tools[s]}</a>
              </li>
            ))}
          </ul>
          <p className="privacy">🔒 {t.note}</p>
        </>
      )}
      {!files.length && (
        <p>
          <a className="btn" href={`/${lang}/`}>⇄ IslePlace Converter</a>
        </p>
      )}
    </section>
  );
}

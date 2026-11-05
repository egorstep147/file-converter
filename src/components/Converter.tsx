import { useEffect, useMemo, useRef, useState, type DragEvent, type ReactNode } from 'react';
import type { Dict } from '../i18n';
import { formatBytes, zipFiles, type OutputFile } from '../lib/files';
import { DEFAULT_OPTIONS, runTool, type Options, type Result } from '../lib/run';
import type { ToolSlug } from '../tools';

type UI = Dict['ui'];

interface Props {
  slug: ToolSlug;
  accept: string;
  multiple: boolean;
  ui: UI;
}

const ORDERED: ToolSlug[] = ['merge-pdf', 'jpg-to-pdf'];

export default function Converter({ slug, accept, multiple, ui }: Props) {
  const [files, setFiles] = useState<File[]>([]);
  const [opts, setOpts] = useState<Options>(DEFAULT_OPTIONS);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState(0);
  const [results, setResults] = useState<Result[] | null>(null);
  const [over, setOver] = useState(false);
  const input = useRef<HTMLInputElement>(null);

  const set = <K extends keyof Options>(k: K, v: Options[K]) => setOpts((o) => ({ ...o, [k]: v }));

  const add = (list: FileList | null) => {
    if (!list?.length) return;
    const picked = Array.from(list);
    setResults(null);
    setFiles((prev) => (multiple ? [...prev, ...picked] : picked.slice(0, 1)));
  };

  // on a slow connection the user may pick files before React hydrates: pick them up
  useEffect(() => {
    if (input.current?.files?.length) add(input.current.files);
  }, []);

  const onDrop = (e: DragEvent) => {
    e.preventDefault();
    setOver(false);
    add(e.dataTransfer.files);
  };

  const move = (i: number, d: -1 | 1) =>
    setFiles((prev) => {
      const next = [...prev];
      const j = i + d;
      if (j < 0 || j >= next.length) return prev;
      [next[i], next[j]] = [next[j], next[i]];
      return next;
    });

  const reset = () => {
    setFiles([]);
    setResults(null);
    setProgress(0);
    if (input.current) input.current.value = '';
  };

  const run = async () => {
    setBusy(true);
    setProgress(0);
    setResults(null);
    try {
      setResults(await runTool(slug, files, opts, setProgress));
    } finally {
      setBusy(false);
    }
  };

  const outputs = useMemo(() => results?.flatMap((r) => r.outputs) ?? [], [results]);
  const canRun = files.length > 0 && !busy && !(slug === 'merge-pdf' && files.length < 2);

  return (
    <div className="converter">
      <label
        className={`drop${over ? ' over' : ''}`}
        onDragOver={(e) => {
          e.preventDefault();
          setOver(true);
        }}
        onDragLeave={() => setOver(false)}
        onDrop={onDrop}
      >
        <input ref={input} type="file" accept={accept} multiple={multiple} onChange={(e) => add(e.target.files)} hidden data-testid="file-input" />
        <span className="drop-title">{multiple ? ui.drop : ui.dropOne}</span>
        <span className="drop-or">{ui.or}</span>
        <span className="btn">{multiple ? ui.choose : ui.chooseOne}</span>
        <span className="drop-privacy">🔒 {ui.privacy}</span>
      </label>

      {files.length > 0 && (
        <>
          <ul className="files" aria-label={ui.files}>
            {files.map((f, i) => (
              <li key={`${f.name}-${i}`}>
                <span className="fname">{f.name}</span>
                <span className="fsize">{formatBytes(f.size)}</span>
                {ORDERED.includes(slug) && files.length > 1 && (
                  <>
                    <button type="button" className="icon" onClick={() => move(i, -1)} disabled={i === 0 || busy} aria-label={ui.moveUp} title={ui.moveUp}>↑</button>
                    <button type="button" className="icon" onClick={() => move(i, 1)} disabled={i === files.length - 1 || busy} aria-label={ui.moveDown} title={ui.moveDown}>↓</button>
                  </>
                )}
                <button type="button" className="icon" onClick={() => setFiles(files.filter((_, j) => j !== i))} disabled={busy} aria-label={ui.remove} title={ui.remove}>✕</button>
              </li>
            ))}
          </ul>

          <ToolOptions slug={slug} o={opts} set={set} ui={ui} />

          <div className="actions">
            <button type="button" className="btn primary" onClick={run} disabled={!canRun}>
              {busy ? `${ui.working} ${Math.round(progress * 100)}%` : ui.convert}
            </button>
            <button type="button" className="btn ghost" onClick={reset} disabled={busy}>{ui.clear}</button>
          </div>
          {busy && <progress value={progress} max={1} />}
        </>
      )}

      {results && <Results results={results} outputs={outputs} ui={ui} />}
    </div>
  );
}

function Results({ results, outputs, ui }: { results: Result[]; outputs: OutputFile[]; ui: UI }) {
  const urls = useMemo(() => new Map(outputs.map((o) => [o, URL.createObjectURL(o.blob)])), [outputs]);
  useEffect(() => () => urls.forEach((u) => URL.revokeObjectURL(u)), [urls]);
  const [zipping, setZipping] = useState(false);

  const downloadAll = async () => {
    setZipping(true);
    try {
      const zip = await zipFiles(outputs);
      const a = document.createElement('a');
      a.href = URL.createObjectURL(zip);
      a.download = 'converted.zip';
      a.click();
      setTimeout(() => URL.revokeObjectURL(a.href), 10_000);
    } finally {
      setZipping(false);
    }
  };

  return (
    <section className="results" aria-label={ui.results} data-testid="results">
      <h2>{ui.results}</h2>
      {outputs.length > 1 && (
        <button type="button" className="btn primary" onClick={downloadAll} disabled={zipping}>{ui.downloadAll}</button>
      )}
      <ul className="files">
        {results.map((r, i) => (
          <li key={i} className={r.error ? 'err' : ''}>
            {r.error ? (
              <span className="fname">
                {r.source}: {r.error === 'webp' ? ui.errorWebp : r.error === 'ranges' ? ui.rangesError : ui.error}
              </span>
            ) : (
              <div className="outs">
                {r.note === 'notSmaller' && <p className="note">{r.source}: {ui.notSmaller}</p>}
                {r.outputs.map((o, j) => (
                  <div key={j} className="out">
                    <span className="fname">{o.name}</span>
                    <span className="fsize">{formatBytes(o.blob.size)}</span>
                    <a className="btn" href={urls.get(o)} download={o.name}>{ui.download}</a>
                  </div>
                ))}
              </div>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="field">
      <span>{label}</span>
      {children}
    </label>
  );
}

function ToolOptions({ slug, o, set, ui }: { slug: ToolSlug; o: Options; set: <K extends keyof Options>(k: K, v: Options[K]) => void; ui: UI }) {
  switch (slug) {
    case 'compress-image':
      return (
        <div className="options">
          <Field label={`${ui.quality}: ${o.quality}`}>
            <input type="range" min={10} max={95} step={5} value={o.quality} onChange={(e) => set('quality', Number(e.target.value))} />
          </Field>
          <Field label={ui.format}>
            <select value={o.format} onChange={(e) => set('format', e.target.value as Options['format'])}>
              <option value="auto">{ui.formatAuto}</option>
              <option value="image/jpeg">JPG</option>
              <option value="image/webp">WebP</option>
            </select>
          </Field>
          <Field label={ui.maxWidth}>
            <input type="number" min={1} inputMode="numeric" value={o.maxWidth} onChange={(e) => set('maxWidth', e.target.value)} placeholder="1920" />
          </Field>
        </div>
      );
    case 'resize-image':
      return (
        <div className="options">
          <Field label={ui.resizeBy}>
            <select value={o.resizeMode} onChange={(e) => set('resizeMode', e.target.value as Options['resizeMode'])}>
              <option value="percent">{ui.percent}</option>
              <option value="px">{ui.pixels}</option>
            </select>
          </Field>
          {o.resizeMode === 'percent' ? (
            <Field label={`${ui.percent}: ${o.percent}%`}>
              <input type="range" min={5} max={100} step={5} value={o.percent} onChange={(e) => set('percent', Number(e.target.value))} />
            </Field>
          ) : (
            <>
              <Field label={ui.width}>
                <input type="number" min={1} inputMode="numeric" value={o.width} onChange={(e) => set('width', e.target.value)} />
              </Field>
              <Field label={ui.height}>
                <input type="number" min={1} inputMode="numeric" value={o.height} onChange={(e) => set('height', e.target.value)} />
              </Field>
            </>
          )}
          <p className="hint">{ui.keepRatio}</p>
        </div>
      );
    case 'jpg-to-pdf':
      return (
        <div className="options">
          <Field label={ui.pageSize}>
            <select value={o.pageSize} onChange={(e) => set('pageSize', e.target.value as Options['pageSize'])}>
              <option value="a4">{ui.pageA4}</option>
              <option value="image">{ui.pageImage}</option>
            </select>
          </Field>
        </div>
      );
    case 'split-pdf':
      return (
        <div className="options">
          <Field label={ui.splitMode}>
            <select value={o.splitMode} onChange={(e) => set('splitMode', e.target.value as Options['splitMode'])}>
              <option value="each">{ui.splitEach}</option>
              <option value="ranges">{ui.splitRanges}</option>
            </select>
          </Field>
          {o.splitMode === 'ranges' && (
            <Field label={ui.ranges}>
              <input type="text" value={o.ranges} onChange={(e) => set('ranges', e.target.value)} placeholder="1-3, 5" />
            </Field>
          )}
        </div>
      );
    case 'pdf-to-jpg':
      return (
        <div className="options">
          <Field label={ui.dpi}>
            <select value={o.dpi} onChange={(e) => set('dpi', Number(e.target.value))}>
              <option value={72}>72 DPI</option>
              <option value={150}>150 DPI</option>
              <option value={300}>300 DPI</option>
            </select>
          </Field>
        </div>
      );
    case 'compress-pdf':
      return (
        <div className="options">
          <Field label={ui.level}>
            <select value={o.level} onChange={(e) => set('level', e.target.value as Options['level'])}>
              <option value="strong">{ui.levelStrong}</option>
              <option value="medium">{ui.levelMedium}</option>
              <option value="light">{ui.levelLight}</option>
            </select>
          </Field>
          <p className="hint">{ui.pdfTextNote}</p>
        </div>
      );
    case 'ogg-to-mp3':
      return (
        <div className="options">
          <Field label={ui.bitrate}>
            <select value={o.kbps} onChange={(e) => set('kbps', Number(e.target.value))}>
              <option value={64}>64 kbps</option>
              <option value={128}>128 kbps</option>
              <option value={192}>192 kbps</option>
            </select>
          </Field>
        </div>
      );
    default:
      return null;
  }
}

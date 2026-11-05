import { useEffect, useId, useMemo, useRef, useState, type DragEvent, type ReactNode } from 'react';
import type { Dict } from '../i18n';
import { fmt, formatBytes, zipFiles, type OutputFile } from '../lib/files';
import { takeShared } from '../lib/shared';
import { COMBINES, DEFAULT_OPTIONS, runTool, sizeChange, type FileState, type Options, type Result } from '../lib/run';
import type { ToolSlug } from '../tools';

type UI = Dict['ui'];

interface Props {
  slug: ToolSlug;
  accept: string;
  multiple: boolean;
  ui: UI;
}

const ORDERED: ToolSlug[] = ['merge-pdf', 'jpg-to-pdf'];
const READY: FileState = { status: 'ready', progress: 0 };
const pctLabel = (n: number) => (n > 0 ? `+${n}%` : `−${Math.abs(n)}%`);

function errorText(r: Result, ui: UI): string {
  if (r.error === 'webp') return ui.errorWebp;
  if (r.error === 'ranges') return ui.rangesError;
  return ui.error;
}

export default function Converter({ slug, accept, multiple, ui }: Props) {
  const [files, setFiles] = useState<File[]>([]);
  const [states, setStates] = useState<FileState[]>([]);
  const [opts, setOpts] = useState<Options>(DEFAULT_OPTIONS);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState(0);
  const [results, setResults] = useState<Result[] | null>(null);
  const [over, setOver] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  const inputId = useId();
  const combines = COMBINES.includes(slug);

  const set = <K extends keyof Options>(k: K, v: Options[K]) => setOpts((o) => ({ ...o, [k]: v }));

  /** Any change of the file list invalidates statuses and results. */
  const replaceFiles = (next: File[]) => {
    setFiles(next);
    setStates(next.map(() => READY));
    setResults(null);
  };

  const add = (list: FileList | File[] | null) => {
    if (!list?.length) return;
    const picked = Array.from(list);
    setFiles((prev) => {
      const next = multiple ? [...prev, ...picked] : picked.slice(0, 1);
      setStates(next.map(() => READY));
      return next;
    });
    setResults(null);
  };

  useEffect(() => {
    // on a slow connection the user may pick files before React hydrates: pick them up
    if (input.current?.files?.length) add(input.current.files);
    // Android "Share → IslePlace" → /share/ → this tool with ?shared=1
    if (new URLSearchParams(location.search).has('shared')) {
      takeShared().then((files) => {
        if (files.length) add(files);
        history.replaceState(null, '', location.pathname);
      });
    }
  }, []);

  const onDrop = (e: DragEvent) => {
    e.preventDefault();
    setOver(false);
    add(e.dataTransfer.files);
  };
  const dragProps = {
    onDragOver: (e: DragEvent) => {
      e.preventDefault();
      setOver(true);
    },
    onDragLeave: () => setOver(false),
    onDrop,
  };

  const move = (i: number, d: -1 | 1) => {
    const j = i + d;
    if (j < 0 || j >= files.length) return;
    const next = [...files];
    [next[i], next[j]] = [next[j], next[i]];
    replaceFiles(next);
  };

  const reset = () => {
    replaceFiles([]);
    setProgress(0);
    if (input.current) input.current.value = '';
  };

  const run = async (o: Options = opts) => {
    setBusy(true);
    setProgress(0);
    setResults(null);
    setStates(files.map(() => READY));
    try {
      setResults(
        await runTool(slug, files, o, setProgress, (i, s) =>
          setStates((prev) => {
            const next = [...prev];
            next[i] = s;
            return next;
          }),
        ),
      );
    } finally {
      setBusy(false);
    }
  };

  const outputs = useMemo(() => results?.flatMap((r) => r.outputs) ?? [], [results]);
  const doneCount = states.filter((s) => s.status === 'done' || s.status === 'error').length;
  const canRun = files.length > 0 && !busy && !(slug === 'merge-pdf' && files.length < 2);

  return (
    <div className="converter">
      <input
        ref={input}
        id={inputId}
        type="file"
        accept={accept}
        multiple={multiple}
        onChange={(e) => {
          add(e.target.files);
          e.target.value = ''; // allow picking the same file again
        }}
        hidden
        data-testid="file-input"
      />

      {files.length === 0 ? (
        <label htmlFor={inputId} className={`drop${over ? ' over' : ''}`} {...dragProps}>
          <span className="drop-title">{multiple ? ui.drop : ui.dropOne}</span>
          <span className="drop-or">{ui.or}</span>
          <span className="btn">{multiple ? ui.choose : ui.chooseOne}</span>
          <span className="drop-privacy">🔒 {ui.privacy}</span>
        </label>
      ) : (
        <label htmlFor={inputId} className={`drop compact${over ? ' over' : ''}${busy ? ' off' : ''}`} {...dragProps} data-testid="add-more">
          <span aria-hidden="true">＋</span> {multiple ? ui.addMore : ui.replaceFile}
        </label>
      )}

      {files.length > 0 && (
        <>
          <ul className="files" aria-label={ui.files}>
            {files.map((f, i) => {
              const st = states[i] ?? READY;
              const r = combines ? undefined : results?.[i];
              const reason = st.status === 'error' && r?.error ? errorText(r, ui) : '';
              return (
                <li key={`${f.name}-${i}`} className={st.status === 'error' ? 'err' : ''} data-status={st.status}>
                  <span className="fname">
                    {f.name}
                    <small className={`meta${reason ? ' bad' : ''}`}>
                      {formatBytes(f.size)}
                      {reason ? ` · ${reason}` : ''}
                    </small>
                  </span>
                  {st.status === 'processing' && (
                    <>
                      <progress className="mini" value={st.progress} max={1} />
                      <span className="fsize">{Math.round(st.progress * 100)}%</span>
                    </>
                  )}
                  {st.status === 'done' && <span className="badge ok">✓ {ui.statusDone}</span>}
                  {st.status === 'error' && <span className="badge bad">! {ui.statusError}</span>}
                  {st.status === 'ready' && !busy && (
                    <>
                      {ORDERED.includes(slug) && files.length > 1 && (
                        <>
                          <button type="button" className="icon" onClick={() => move(i, -1)} disabled={i === 0} aria-label={ui.moveUp} title={ui.moveUp}>↑</button>
                          <button type="button" className="icon" onClick={() => move(i, 1)} disabled={i === files.length - 1} aria-label={ui.moveDown} title={ui.moveDown}>↓</button>
                        </>
                      )}
                      <button type="button" className="icon" onClick={() => replaceFiles(files.filter((_, j) => j !== i))} aria-label={ui.remove} title={ui.remove}>✕</button>
                    </>
                  )}
                </li>
              );
            })}
          </ul>

          <ToolOptions slug={slug} o={opts} set={set} ui={ui} />

          <div className="actions">
            <button type="button" className="btn primary" onClick={() => run()} disabled={!canRun}>
              {busy ? `${ui.working} ${Math.round(progress * 100)}%` : ui.convert}
            </button>
            <button type="button" className="btn ghost" onClick={reset} disabled={busy}>{ui.clear}</button>
          </div>
          {busy && (
            <p className="status" role="status">
              {fmt(ui.processed, { done: doneCount, total: files.length })}
            </p>
          )}
        </>
      )}

      {results && <Results results={results} outputs={outputs} ui={ui} combines={combines} onJpg={() => run({ ...opts, fallbackJpeg: true })} />}
    </div>
  );
}

function Results({ results, outputs, ui, combines, onJpg }: { results: Result[]; outputs: OutputFile[]; ui: UI; combines: boolean; onJpg: () => void }) {
  const urls = useMemo(() => new Map(outputs.map((o) => [o, URL.createObjectURL(o.blob)])), [outputs]);
  useEffect(() => () => urls.forEach((u) => URL.revokeObjectURL(u)), [urls]);
  const [zipping, setZipping] = useState(false);

  const ok = results.filter((r) => !r.error);
  const webpFailed = results.some((r) => r.error === 'webp');
  // sizes are comparable when every successful input produced exactly one file
  const comparable = ok.length > 0 && ok.every((r) => r.outputs.length === 1);
  const totalIn = ok.reduce((n, r) => n + r.inputSize, 0);
  const totalOut = ok.reduce((n, r) => n + r.outputs.reduce((m, o) => m + o.blob.size, 0), 0);
  const totalChange = comparable ? sizeChange(totalIn, totalOut) : null;

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

      {ok.length > 0 && (
        <div className="alert ok" role="status" data-testid="summary">
          <strong>{fmt(ui.summaryDone, { n: ok.length, total: results.length })}</strong>
          {totalChange !== null && <span>{fmt(ui.sizeSummary, { from: formatBytes(totalIn), to: formatBytes(totalOut), pct: pctLabel(totalChange) })}</span>}
        </div>
      )}

      {webpFailed && (
        <div className="alert bad" role="alert">
          <strong>{ui.errorWebp}</strong>
          <button type="button" className="btn" onClick={onJpg}>{ui.saveAsJpg}</button>
        </div>
      )}

      {outputs.length > 1 && (
        <button type="button" className="btn primary" onClick={downloadAll} disabled={zipping}>{ui.downloadAll}</button>
      )}

      <ul className="files">
        {results.map((r, i) =>
          r.error ? (
            // per-file errors are shown in the file list; combined tools have no row there
            combines ? (
              <li key={i} className="err">
                <span className="fname">{r.source}: {errorText(r, ui)}</span>
              </li>
            ) : null
          ) : (
            <li key={i}>
              <div className="outs">
                {r.note === 'notSmaller' && <p className="note">{r.source}: {ui.notSmaller}</p>}
                {r.outputs.map((o, j) => {
                  const change = r.outputs.length === 1 && r.note !== 'notSmaller' ? sizeChange(r.inputSize, o.blob.size) : null;
                  return (
                    <div key={j} className="out">
                      <span className="fname">
                        {o.name}
                        <small className="meta">
                          {change !== null ? `${formatBytes(r.inputSize)} → ${formatBytes(o.blob.size)}` : formatBytes(o.blob.size)}
                        </small>
                      </span>
                      {change !== null && <span className={`badge ${change < 0 ? 'ok' : 'neutral'}`}>{pctLabel(change)}</span>}
                      <a className="btn" href={urls.get(o)} download={o.name}>↓ {ui.download}</a>
                    </div>
                  );
                })}
              </div>
            </li>
          ),
        )}
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

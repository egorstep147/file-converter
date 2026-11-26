import { useEffect, useId, useMemo, useRef, useState, type DragEvent, type ReactNode } from 'react';
import type { Dict } from '../i18n';
import { fmt, formatBytes, zipFiles, type OutputFile } from '../lib/files';
import type { ImageMime, RotateOp } from '../lib/image';
import { isNativeApp, shareFiles } from '../lib/native';
import { takeShared } from '../lib/shared';
import { sendToChat, telegramInitData } from '../lib/telegram';
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
const COMPARE_SLUGS: ToolSlug[] = ['compress-image', 'any-to-jpg', 'strip-exif', 'png-to-jpg', 'webp-to-jpg', 'jpg-to-png', 'jpg-to-webp'];
const READY: FileState = { status: 'ready', progress: 0 };
const pctLabel = (n: number) => (n > 0 ? `+${n}%` : `−${Math.abs(n)}%`);

function isPreviewableImage(f: { name: string; type: string }): boolean {
  if (['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/avif', 'image/bmp', 'image/svg+xml'].includes(f.type)) return true;
  return /\.(jpe?g|png|webp|gif|avif|bmp|svg)$/i.test(f.name);
}

function errorText(r: Result, ui: UI): string {
  if (r.error === 'webp') return ui.errorWebp;
  if (r.error === 'ranges') return ui.rangesError;
  return ui.error;
}

export default function Converter({ slug, accept, multiple, ui }: Props) {
  const [files, setFiles] = useState<File[]>([]);
  const [states, setStates] = useState<FileState[]>([]);
  const [thumbUrls, setThumbUrls] = useState<string[]>([]);
  const [opts, setOpts] = useState<Options>(DEFAULT_OPTIONS);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState(0);
  const [results, setResults] = useState<Result[] | null>(null);
  const [over, setOver] = useState(false);
  const [pageDrag, setPageDrag] = useState(false);
  const [toast, setToast] = useState('');
  const filesRef = useRef<File[]>([]);
  filesRef.current = files;
  const input = useRef<HTMLInputElement>(null);
  const inputId = useId();
  const combines = COMBINES.includes(slug) || (slug === 'zip-files' && opts.zipMode === 'create');

  const set = <K extends keyof Options>(k: K, v: Options[K]) => setOpts((o) => ({ ...o, [k]: v }));

  /** Any change of the file list invalidates statuses and results. */
  const replaceFiles = (next: File[]) => {
    filesRef.current = next;
    setFiles(next);
    setStates(next.map(() => READY));
    setResults(null);
  };

  const add = (list: FileList | File[] | null) => {
    if (!list?.length) return;
    const picked = Array.from(list);
    const next = multiple ? [...filesRef.current, ...picked] : picked.slice(0, 1);
    replaceFiles(next);
  };

  useEffect(() => {
    const urls = files.map((f) => (isPreviewableImage(f) ? URL.createObjectURL(f) : ''));
    setThumbUrls(urls);
    return () => {
      urls.forEach((u) => {
        if (u) URL.revokeObjectURL(u);
      });
    };
  }, [files]);

  useEffect(() => {
    // on a slow connection the user may pick files before React hydrates: pick them up
    if (input.current?.files?.length) add(input.current.files);
    // Android "Share → IslePlace" → /share/ → this tool with ?shared=1
    if (new URLSearchParams(location.search).has('shared')) {
      takeShared().then((shared) => {
        if (shared.length) add(shared);
        history.replaceState(null, '', location.pathname);
      });
    }
  }, []);

  // Global Ctrl+V paste and full-page drag-and-drop
  useEffect(() => {
    let depth = 0;
    const onPaste = (e: ClipboardEvent) => {
      const tag = (e.target as HTMLElement | null)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
      const pasted = e.clipboardData?.files?.length
        ? Array.from(e.clipboardData.files)
        : Array.from(e.clipboardData?.items ?? [])
            .filter((it) => it.kind === 'file')
            .map((it) => it.getAsFile())
            .filter((f): f is File => !!f);
      if (pasted.length) {
        e.preventDefault();
        add(pasted);
        setToast(pasted.map((f) => f.name).slice(0, 2).join(', '));
      }
    };
    const hasFiles = (e: globalThis.DragEvent) => e.dataTransfer?.types?.includes('Files') ?? false;
    const onDragEnter = (e: globalThis.DragEvent) => {
      if (!hasFiles(e)) return;
      e.preventDefault();
      depth++;
      setPageDrag(true);
    };
    const onDragOver = (e: globalThis.DragEvent) => {
      if (hasFiles(e)) e.preventDefault();
    };
    const onDragLeave = (e: globalThis.DragEvent) => {
      if (!hasFiles(e)) return;
      depth = Math.max(0, depth - 1);
      if (depth === 0) setPageDrag(false);
    };
    const onWindowDrop = (e: globalThis.DragEvent) => {
      depth = 0;
      setPageDrag(false);
      if (!e.dataTransfer?.files?.length) return;
      e.preventDefault();
      add(e.dataTransfer.files);
    };
    window.addEventListener('paste', onPaste);
    window.addEventListener('dragenter', onDragEnter);
    window.addEventListener('dragover', onDragOver);
    window.addEventListener('dragleave', onDragLeave);
    window.addEventListener('drop', onWindowDrop);
    return () => {
      window.removeEventListener('paste', onPaste);
      window.removeEventListener('dragenter', onDragEnter);
      window.removeEventListener('dragover', onDragOver);
      window.removeEventListener('dragleave', onDragLeave);
      window.removeEventListener('drop', onWindowDrop);
    };
  }, [multiple]);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(''), 2400);
    return () => clearTimeout(t);
  }, [toast]);

  const onDrop = (e: DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setOver(false);
    setPageDrag(false);
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
  const compareInputUrl = COMPARE_SLUGS.includes(slug) && results?.length === 1 && !results[0].error && results[0].outputs.length === 1 ? thumbUrls[0] : '';

  return (
    <div className="converter">
      {pageDrag && <div className="page-drop" aria-hidden="true">{ui.dropAnywhere}</div>}
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
          <span className="drop-icon" aria-hidden="true">
            <svg width="26" height="26" viewBox="0 0 24 24" fill="none">
              <path d="M12 16V4m0 0-5 5m5-5 5 5M4 17v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </span>
          <span className="drop-title">{multiple ? ui.drop : ui.dropOne}</span>
          <span className="drop-or">{ui.or}</span>
          <span className="btn primary">{multiple ? ui.choose : ui.chooseOne}</span>
          <span className="drop-paste">{ui.pasteHint}</span>
          <span className="drop-privacy">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <rect x="5" y="11" width="14" height="10" rx="2" stroke="currentColor" strokeWidth="2" />
              <path d="M8 11V7a4 4 0 0 1 8 0v4" stroke="currentColor" strokeWidth="2" />
            </svg>
            <span>{ui.privacy}</span>
          </span>
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
              const thumb = thumbUrls[i];
              return (
                <li key={`${f.name}-${i}`} className={st.status === 'error' ? 'err' : ''} data-status={st.status}>
                  {thumb && <img className="thumb" src={thumb} alt="" />}
                  <span className="fname">
                    {f.name}
                    <small className={`meta${reason ? ' bad' : ''}`} title={reason && r?.detail ? r.detail : undefined}>
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
              {busy && <span className="spinner" aria-hidden="true" />}
              <span>{busy ? `${ui.working} ${Math.round(progress * 100)}%` : ui.convert}</span>
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

      {results && <Results results={results} outputs={outputs} ui={ui} combines={combines} compareBeforeUrl={compareInputUrl} onJpg={() => run({ ...opts, fallbackJpeg: true })} />}
      {toast && (
        <div className="toast" role="status" aria-live="polite">
          <span className="toast-dot" aria-hidden="true">✓</span>
          <span>{toast}</span>
        </div>
      )}
    </div>
  );
}

function BeforeAfter({ beforeUrl, afterUrl, beforeSize, afterSize, ui }: { beforeUrl: string; afterUrl: string; beforeSize: number; afterSize: number; ui: UI }) {
  const [pos, setPos] = useState(50);
  return (
    <div className="ba" data-testid="before-after">
      <div className="ba-stage">
        <img src={afterUrl} alt={ui.after} className="ba-img" />
        <img src={beforeUrl} alt={ui.before} className="ba-img ba-top" style={{ clipPath: `inset(0 ${100 - pos}% 0 0)` }} />
        <div className="ba-line" style={{ left: `${pos}%` }} aria-hidden="true">
          <span className="ba-knob">⇄</span>
        </div>
      </div>
      <input type="range" className="ba-slider" min={0} max={100} value={pos} onChange={(e) => setPos(Number(e.target.value))} aria-label={`${ui.before} / ${ui.after}`} />
      <div className="ba-labels">
        <span>{ui.before}: {formatBytes(beforeSize)}</span>
        <span>{ui.after}: {formatBytes(afterSize)}</span>
      </div>
    </div>
  );
}

function Results({ results, outputs, ui, combines, compareBeforeUrl, onJpg }: { results: Result[]; outputs: OutputFile[]; ui: UI; combines: boolean; compareBeforeUrl: string; onJpg: () => void }) {
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
  const singleOut = compareBeforeUrl && ok.length === 1 && ok[0].outputs[0]?.blob.type.startsWith('image/') ? ok[0].outputs[0] : null;
  const singleOutUrl = singleOut ? urls.get(singleOut) : undefined;

  const native = useMemo(isNativeApp, []);
  // Telegram Mini App: downloads often don't work in its WebView → send results to the chat via the bot
  const tg = useMemo(telegramInitData, []);
  const [sent, setSent] = useState<'idle' | 'sending' | 'done' | 'error'>('idle');
  const toChat = async (files: OutputFile[]) => {
    if (!tg) return;
    setSent('sending');
    try {
      await sendToChat(files, tg);
      setSent('done');
    } catch {
      setSent('error');
    }
  };
  // Android app: blob links can't be downloaded in the WebView → system share sheet instead
  const nativeSave = (e: { preventDefault: () => void }, files: OutputFile[]) => {
    if (!native) return;
    e.preventDefault();
    shareFiles(files).catch(() => {});
  };

  const downloadAll = async () => {
    setZipping(true);
    try {
      const zip = await zipFiles(outputs);
      if (native) return await shareFiles([{ name: 'converted.zip', blob: zip }]);
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

      {singleOut && singleOutUrl && (
        <BeforeAfter beforeUrl={compareBeforeUrl} afterUrl={singleOutUrl} beforeSize={ok[0].inputSize} afterSize={singleOut.blob.size} ui={ui} />
      )}

      {tg && outputs.length > 0 && (
        <div className="tg" data-testid="telegram">
          <button type="button" className="btn primary" onClick={() => toChat(outputs)} disabled={sent === 'sending'}>
            {outputs.length > 1 ? ui.sendAllToChat : ui.sendToChat}
          </button>
          <span className={`tg-status ${sent}`} role="status">
            {sent === 'sending' ? ui.sendingNote : sent === 'done' ? ui.sentToChat : sent === 'error' ? ui.sendFailed : ''}
          </span>
        </div>
      )}

      {outputs.length > 1 && (
        <button type="button" className={`btn${tg ? '' : ' primary'}`} onClick={downloadAll} disabled={zipping}>{ui.downloadAll}</button>
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
                      <div className="out-head">
                        {o.blob.type.startsWith('image/') && <img className="thumb" src={urls.get(o)} alt="" />}
                        <span className="fname">
                          <span className="fname-text">{o.name}</span>
                          <small className="meta">
                            {change !== null ? `${formatBytes(r.inputSize)} → ${formatBytes(o.blob.size)}` : formatBytes(o.blob.size)}
                          </small>
                        </span>
                        {change !== null && <span className={`badge ${change < 0 ? 'ok' : 'neutral'}`}>{pctLabel(change)}</span>}
                      </div>
                      <a className="btn out-dl" href={urls.get(o)} download={o.name} onClick={(e) => nativeSave(e, [o])}>
                        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                          <path d="M12 4v12m0 0-4-4m4 4 4-4M4 18v1a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-1" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                        <span>{ui.download}</span>
                      </a>
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

function Segmented<T extends string | number>({
  value,
  options,
  onChange,
  label,
}: {
  value: T;
  options: readonly { value: T; label: string; title?: string }[];
  onChange: (v: T) => void;
  label: string;
}) {
  return (
    <div className="seg" role="group" aria-label={label}>
      {options.map((opt) => {
        const active = opt.value === value;
        return (
          <button
            key={String(opt.value)}
            type="button"
            className={`seg-btn${active ? ' active' : ''}`}
            aria-pressed={active}
            title={opt.title}
            onClick={() => onChange(opt.value)}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}

function ToolOptions({ slug, o, set, ui }: { slug: ToolSlug; o: Options; set: <K extends keyof Options>(k: K, v: Options[K]) => void; ui: UI }) {
  switch (slug) {
    case 'any-to-jpg':
      return (
        <div className="options">
          <div className="field">
            <span>{ui.format}</span>
            <Segmented
              label={ui.format}
              value={o.outFormat}
              onChange={(v) => set('outFormat', v as ImageMime)}
              options={[
                { value: 'image/jpeg', label: 'JPG' },
                { value: 'image/png', label: 'PNG' },
                { value: 'image/webp', label: 'WebP' },
              ]}
            />
          </div>
          {o.outFormat !== 'image/png' && (
            <Field label={`${ui.quality}: ${o.quality}`}>
              <input type="range" min={10} max={95} step={5} value={o.quality} onChange={(e) => set('quality', Number(e.target.value))} />
            </Field>
          )}
        </div>
      );
    case 'rotate-image':
      return (
        <div className="options">
          <Field label={ui.rotateAngle}>
            <select value={o.rotateOp} onChange={(e) => set('rotateOp', e.target.value as RotateOp)}>
              <option value="90">{ui.rotate90}</option>
              <option value="180">{ui.rotate180}</option>
              <option value="270">{ui.rotate270}</option>
              <option value="flip-h">{ui.flipH}</option>
              <option value="flip-v">{ui.flipV}</option>
            </select>
          </Field>
        </div>
      );
    case 'compress-image':
      return (
        <div className="options">
          <Field label={`${ui.quality}: ${o.quality}`}>
            <input type="range" min={10} max={95} step={5} value={o.quality} onChange={(e) => set('quality', Number(e.target.value))} />
          </Field>
          <div className="field">
            <span>{ui.format}</span>
            <Segmented
              label={ui.format}
              value={o.format}
              onChange={(v) => set('format', v as Options['format'])}
              options={[
                { value: 'auto', label: ui.formatAuto.split(/\s*[(\uff08]/)[0], title: ui.formatAuto },
                { value: 'image/jpeg', label: 'JPG' },
                { value: 'image/webp', label: 'WebP' },
              ]}
            />
          </div>
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
          <div className="field">
            <span>{ui.pageSize}</span>
            <Segmented
              label={ui.pageSize}
              value={o.pageSize}
              onChange={(v) => set('pageSize', v as Options['pageSize'])}
              options={[
                { value: 'a4', label: ui.pageA4 },
                { value: 'image', label: ui.pageImage },
              ]}
            />
          </div>
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
    case 'rotate-pdf':
      return (
        <div className="options">
          <Field label={ui.rotateAngle}>
            <select value={o.pdfAngle} onChange={(e) => set('pdfAngle', Number(e.target.value) as 90 | 180 | 270)}>
              <option value={90}>{ui.rotate90}</option>
              <option value={180}>{ui.rotate180}</option>
              <option value={270}>{ui.rotate270}</option>
            </select>
          </Field>
        </div>
      );
    case 'pdf-to-jpg':
    case 'pdf-to-png':
      return (
        <div className="options">
          <div className="field">
            <span>{ui.dpi}</span>
            <Segmented
              label={ui.dpi}
              value={o.dpi}
              onChange={(v) => set('dpi', Number(v))}
              options={[
                { value: 72, label: '72 DPI' },
                { value: 150, label: '150 DPI' },
                { value: 300, label: '300 DPI' },
              ]}
            />
          </div>
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
    case 'audio-to-mp3':
      return (
        <div className="options">
          <div className="field">
            <span>{ui.bitrate}</span>
            <Segmented
              label={ui.bitrate}
              value={o.kbps}
              onChange={(v) => set('kbps', Number(v))}
              options={[
                { value: 64, label: '64 kbps' },
                { value: 128, label: '128 kbps' },
                { value: 192, label: '192 kbps' },
              ]}
            />
          </div>
        </div>
      );
    case 'zip-files':
      return (
        <div className="options">
          <Field label={ui.zipMode}>
            <select value={o.zipMode} onChange={(e) => set('zipMode', e.target.value as 'create' | 'extract')}>
              <option value="create">{ui.zipCreate}</option>
              <option value="extract">{ui.zipExtract}</option>
            </select>
          </Field>
        </div>
      );
    default:
      return null;
  }
}

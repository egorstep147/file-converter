/**
 * Android app (Capacitor): the WebView cannot "download" blob: links, so results are written to the
 * app cache and handed to the system share sheet (save to Files / Drive, send to a messenger).
 * On the website these functions are never called; the plugins are loaded only inside the app.
 */
import type { OutputFile } from './files';

export function isNativeApp(): boolean {
  const cap = (globalThis as { Capacitor?: { isNativePlatform?: () => boolean } }).Capacitor;
  return !!cap?.isNativePlatform?.();
}

const toBase64 = (blob: Blob) =>
  new Promise<string>((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result).split(',')[1] ?? '');
    r.onerror = () => reject(r.error);
    r.readAsDataURL(blob);
  });

export async function shareFiles(files: OutputFile[]): Promise<void> {
  const [{ Filesystem, Directory }, { Share }] = await Promise.all([import('@capacitor/filesystem'), import('@capacitor/share')]);
  const uris: string[] = [];
  for (const f of files) {
    const res = await Filesystem.writeFile({ path: `results/${f.name}`, data: await toBase64(f.blob), directory: Directory.Cache, recursive: true });
    uris.push(res.uri);
  }
  await Share.share({ files: uris });
}

/**
 * Telegram Mini App support. Telegram opens the site with #tgWebAppData=<initData>; we keep it for the
 * session (navigation between tools drops the hash). initData is signed by Telegram, the bot checks it.
 */
import type { OutputFile } from './files';

// Bot endpoint (apps/bot/bot/webapp.py behind Caddy). Override at build time: PUBLIC_BOT_API=https://...
export const BOT_API: string = import.meta.env.PUBLIC_BOT_API ?? 'https://convert-bot.130-17-30-251.sslip.io:8443';

const KEY = 'tgInitData';

export function telegramInitData(): string | null {
  if (typeof window === 'undefined') return null;
  const live = (window as { Telegram?: { WebApp?: { initData?: string } } }).Telegram?.WebApp?.initData;
  if (live) return live;
  const fromHash = new URLSearchParams(location.hash.slice(1)).get('tgWebAppData');
  if (fromHash) {
    sessionStorage.setItem(KEY, fromHash);
    return fromHash;
  }
  return sessionStorage.getItem(KEY);
}

/** Send results to the user's Telegram chat through the bot, one request per file. */
export async function sendToChat(files: OutputFile[], initData: string, api = BOT_API): Promise<void> {
  for (const f of files) {
    const body = new FormData();
    body.append('file', f.blob, f.name);
    const r = await fetch(`${api}/api/send`, { method: 'POST', headers: { 'X-Telegram-Init-Data': initData }, body });
    if (!r.ok) throw new Error(`send failed: ${r.status}`);
  }
}

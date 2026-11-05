/** Voice messages (Ogg/Opus from Telegram, WhatsApp, ...) -> MP3, decoded with WASM so Safari works too. */
import { renameTo, type OutputFile } from './files';

/** Float PCM [-1, 1] -> 16-bit PCM (pure, unit-tested). */
export function floatTo16(src: Float32Array): Int16Array {
  const out = new Int16Array(src.length);
  for (let i = 0; i < src.length; i++) {
    const s = Math.max(-1, Math.min(1, src[i]));
    out[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
  }
  return out;
}

export async function decodeOggOpus(bytes: Uint8Array): Promise<{ channels: Float32Array[]; sampleRate: number }> {
  const { OggOpusDecoder } = await import('ogg-opus-decoder');
  const dec = new OggOpusDecoder();
  await dec.ready;
  try {
    const r = await dec.decodeFile(bytes);
    if (!r.samplesDecoded) throw new Error('no audio decoded');
    return { channels: r.channelData, sampleRate: r.sampleRate };
  } finally {
    dec.free();
  }
}

export async function encodeMp3(channels: Float32Array[], sampleRate: number, kbps: number, onProgress?: (d: number, t: number) => void): Promise<Uint8Array> {
  const { Mp3Encoder } = await import('@breezystack/lamejs');
  const stereo = channels.length > 1;
  const enc = new Mp3Encoder(stereo ? 2 : 1, sampleRate, kbps);
  const left = floatTo16(channels[0]);
  const right = stereo ? floatTo16(channels[1]) : undefined;
  const parts: Uint8Array[] = [];
  const block = 1152 * 64;
  for (let i = 0; i < left.length; i += block) {
    const chunk = enc.encodeBuffer(left.subarray(i, i + block), right?.subarray(i, i + block));
    if (chunk.length) parts.push(chunk.slice());
    onProgress?.(Math.min(i + block, left.length), left.length);
    if ((i / block) % 16 === 15) await new Promise((r) => setTimeout(r)); // keep the page responsive
  }
  const end = enc.flush();
  if (end.length) parts.push(end.slice());
  const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0));
  let off = 0;
  for (const p of parts) {
    out.set(p, off);
    off += p.length;
  }
  return out;
}

export async function oggToMp3(file: File, kbps: number, onProgress?: (d: number, t: number) => void): Promise<OutputFile> {
  const { channels, sampleRate } = await decodeOggOpus(new Uint8Array(await file.arrayBuffer()));
  const mp3 = await encodeMp3(channels, sampleRate, kbps, onProgress);
  return { name: renameTo(file.name, 'audio/mpeg'), blob: new Blob([mp3 as BlobPart], { type: 'audio/mpeg' }) };
}

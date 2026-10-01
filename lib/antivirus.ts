import net from 'net';

/**
 * Virus scanning of uploaded proof files with ClamAV (clamd), over its TCP
 * INSTREAM protocol: the file is streamed to clamd in memory, never written
 * to a shared disk.
 *
 * Fail closed: unless scanning is explicitly turned off (ANTIVIRUS=off), a
 * file that could not be scanned — clamd not configured, down, slow or in
 * error — is refused, never stored unchecked.
 *
 *   CLAMAV_HOST        clamd address (required unless ANTIVIRUS=off)
 *   CLAMAV_PORT        default 3310
 *   CLAMAV_TIMEOUT_MS  default 30000
 *   ANTIVIRUS=off      store files without scanning them (development only)
 */

export type ScanResult =
  | { status: 'clean' }
  | { status: 'infected'; signature: string }
  /** Scanning turned off with ANTIVIRUS=off. */
  | { status: 'skipped' };

export class AntivirusUnavailable extends Error {}

const CHUNK_BYTES = 64 * 1024;

export function antivirusDisabled(): boolean {
  return process.env.ANTIVIRUS === 'off';
}

export async function scanFile(content: Buffer): Promise<ScanResult> {
  if (antivirusDisabled()) return { status: 'skipped' };

  const host = process.env.CLAMAV_HOST;
  if (!host) throw new AntivirusUnavailable('CLAMAV_HOST is not set (set ANTIVIRUS=off to store files unscanned)');
  const port = Number(process.env.CLAMAV_PORT || 3310);
  const timeoutMs = Number(process.env.CLAMAV_TIMEOUT_MS || 30_000);

  const reply = await instream(host, port, timeoutMs, content);
  return parseReply(reply);
}

/** clamd answers `stream: OK`, `stream: <signature> FOUND`, or `<reason> ERROR`. */
export function parseReply(reply: string): ScanResult {
  const text = reply.replace(/\0/g, '').trim();
  if (/^stream: OK$/.test(text)) return { status: 'clean' };
  const found = text.match(/^stream: (.+) FOUND$/);
  if (found) return { status: 'infected', signature: found[1]! };
  throw new AntivirusUnavailable(`Unexpected clamd reply: ${text.slice(0, 200)}`);
}

function instream(host: string, port: number, timeoutMs: number, content: Buffer): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    let settled = false;
    const finish = (error: Error | null, reply?: string) => {
      if (settled) return;
      settled = true;
      socket.destroy();
      if (error) reject(error instanceof AntivirusUnavailable ? error : new AntivirusUnavailable(error.message));
      else resolve(reply ?? '');
    };

    const socket = net.createConnection({ host, port });
    socket.setTimeout(timeoutMs, () => finish(new AntivirusUnavailable(`clamd did not answer within ${timeoutMs} ms`)));
    socket.on('error', (error) => finish(error));
    socket.on('data', (data) => chunks.push(data));
    socket.on('end', () => finish(null, Buffer.concat(chunks).toString('utf8')));
    socket.on('close', () => finish(null, Buffer.concat(chunks).toString('utf8')));

    socket.on('connect', () => {
      socket.write('zINSTREAM\0');
      for (let offset = 0; offset < content.length; offset += CHUNK_BYTES) {
        const chunk = content.subarray(offset, offset + CHUNK_BYTES);
        const size = Buffer.alloc(4);
        size.writeUInt32BE(chunk.length);
        socket.write(size);
        socket.write(chunk);
      }
      socket.write(Buffer.alloc(4)); // zero-length chunk: end of stream
    });
  });
}

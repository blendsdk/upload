import { createReadStream } from 'node:fs';
import { createConnection } from 'node:net';

/** Result of scanning one file. */
export interface ScanResult {
  clean: boolean;
  signature?: string;
}

/** Pluggable content scanner. */
export interface ContentScanner {
  scan(filePath: string, signal?: AbortSignal): Promise<ScanResult>;
}

/** Default scanner for environments that do not run malware scanning. */
export class NoopScanner implements ContentScanner {
  public async scan(): Promise<ScanResult> {
    return { clean: true };
  }
}

/** ClamAV daemon settings. */
export interface ClamAvScannerOptions {
  host?: string;
  port?: number;
  timeoutMs?: number;
}

/**
 * ClamAV daemon scanner using the INSTREAM command.
 *
 * ClamAV is deliberately an optional integration: the package ships only the
 * small socket client, never a bundling of the scanner engine.
 */
export class ClamAvScanner implements ContentScanner {
  private readonly host: string;
  private readonly port: number;
  private readonly timeoutMs: number;

  public constructor(options: ClamAvScannerOptions = {}) {
    this.host = options.host ?? '127.0.0.1';
    this.port = options.port ?? 3310;
    this.timeoutMs = options.timeoutMs ?? 30_000;
  }

  public scan(filePath: string, signal?: AbortSignal): Promise<ScanResult> {
    return new Promise((resolve, reject) => {
      const socket = createConnection({ host: this.host, port: this.port });
      let response = '';
      let settled = false;

      const finish = (error?: Error, result?: ScanResult): void => {
        if (settled) {
          return;
        }
        settled = true;
        socket.destroy();
        if (error) {
          reject(error);
        } else {
          resolve(result ?? { clean: false });
        }
      };

      const onAbort = (): void => finish(new Error('Scan canceled.'));
      signal?.addEventListener('abort', onAbort, { once: true });

      socket.setTimeout(this.timeoutMs);
      socket.on('timeout', () => finish(new Error('ClamAV scan timed out.')));
      socket.on('error', (error) => finish(error));
      socket.on('data', (chunk) => {
        response += chunk.toString('utf8');
        if (!response.includes('\0')) {
          return;
        }
        signal?.removeEventListener('abort', onAbort);
        const text = response.replace(/\0/g, '').trim();
        const found = /:\s*(.+?)\s+FOUND$/i.exec(text);
        if (found) {
          finish(undefined, { clean: false, signature: found[1] });
        } else if (/\bOK$/i.test(text)) {
          finish(undefined, { clean: true });
        } else {
          finish(new Error(`ClamAV returned an unexpected response: ${text}`));
        }
      });

      socket.on('connect', () => {
        socket.write('zINSTREAM\0');
        const input = createReadStream(filePath);
        input.on('error', (error) => finish(error));
        input.on('data', (chunk: string | Buffer) => {
          const data = typeof chunk === 'string' ? Buffer.from(chunk) : chunk;
          const length = Buffer.alloc(4);
          length.writeUInt32BE(data.length, 0);
          socket.write(length);
          socket.write(data);
        });
        input.on('end', () => {
          socket.write(Buffer.alloc(4));
        });
      });
    });
  }
}

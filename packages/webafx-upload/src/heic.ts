/** Optional decoder for HEIC/HEIF input. */
export interface HeicDecoder {
  decode(input: Uint8Array): Promise<Uint8Array>;
}

/**
 * HEIC decoder backed by the optional `heic-convert` package.
 *
 * The dependency is loaded dynamically because libheif has a different
 * licensing profile and a large install footprint. Applications that accept
 * HEIC must install `heic-convert` explicitly.
 */
export class HeicConvertDecoder implements HeicDecoder {
  public async decode(input: Uint8Array): Promise<Uint8Array> {
    let convert: (options: {
      buffer: Uint8Array;
      format: 'JPEG' | 'PNG';
      quality?: number;
    }) => Promise<ArrayBuffer>;
    try {
      convert = (await import('heic-convert')).default;
    } catch {
      throw new Error('HEIC decoding is not installed. Add the optional heic-convert dependency.');
    }
    const output = await convert({
      buffer: input,
      format: 'JPEG',
      quality: 0.9,
    });
    return new Uint8Array(output);
  }
}

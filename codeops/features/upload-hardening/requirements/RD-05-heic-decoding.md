# RD-05: HEIC Decoding

> **Status**: Implemented
> **Depends On**: —

## Requirements

- `HeicDecoder` converts HEIC/HEIF bytes to JPEG before sharp processing.
- `HeicConvertDecoder` uses the optional `heic-convert` package loaded dynamically.
- Image policies may accept `image/heic` and `image/heif` when a decoder is configured.
- A missing/invalid decoder produces a clear `invalid_content` error, not a crash.
- The decoder is optional; local installs do not require libheif.

## Acceptance

- [ ] The server builds without `heic-convert` installed.
- [ ] The processor uses the decoder for HEIC/HEIF and normalizes through sharp.
- [ ] Documentation explains the HEVC licensing trade-off.

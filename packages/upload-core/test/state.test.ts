import { describe, expect, it } from 'vitest';
import { canTransition, isTerminalStatus } from '../src/index.js';

describe('upload state machine', () => {
  it('allows the happy path', () => {
    expect(canTransition('pending', 'uploading')).toBe(true);
    expect(canTransition('uploading', 'uploaded')).toBe(true);
    expect(canTransition('uploaded', 'processing')).toBe(true);
    expect(canTransition('processing', 'ready')).toBe(true);
  });

  it('supports deferred staging and commit', () => {
    expect(canTransition('processing', 'staged')).toBe(true);
    expect(canTransition('staged', 'committed')).toBe(true);
  });

  it('rejects backwards transitions', () => {
    expect(canTransition('ready', 'uploading')).toBe(false);
    expect(canTransition('canceled', 'uploading')).toBe(false);
  });

  it('marks commit, expiry and cancel as terminal', () => {
    expect(isTerminalStatus('committed')).toBe(true);
    expect(isTerminalStatus('expired')).toBe(true);
    expect(isTerminalStatus('canceled')).toBe(true);
    expect(isTerminalStatus('processing')).toBe(false);
  });
});

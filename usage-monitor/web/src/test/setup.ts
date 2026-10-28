import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { afterEach, vi } from 'vitest';

// Local-time formatting is asserted in UTC.
process.env.TZ = 'UTC';

// jsdom does not implement scrollTo. Current browsers return a Promise from it, so the stub does too.
window.scrollTo = vi.fn(() => Promise.resolve()) as unknown as typeof window.scrollTo;

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.useRealTimers();
  window.location.hash = '';
});

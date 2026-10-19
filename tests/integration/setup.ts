import '@testing-library/jest-dom/vitest';

// Use jsdom storage even when Node exposes its own localStorage accessor.
Object.defineProperty(globalThis, 'localStorage', {
  configurable: true,
  value: window.localStorage,
});

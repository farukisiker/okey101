import { defineConfig } from 'vitest/config';

// Threads, not forks: on Windows (Node 24.15) a forked worker running the HTTP suites sometimes dies natively
// (exit 0xC0000409) after its tests pass, with any store. Worker threads never showed it (16 runs).
export default defineConfig({ test: { pool: 'threads' } });

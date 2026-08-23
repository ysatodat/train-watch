import { cp, mkdir, rm } from 'node:fs/promises';

await mkdir('public', { recursive: true });
await rm('public/data', { recursive: true, force: true });
await cp('data', 'public/data', { recursive: true });
await cp('icon.svg', 'public/icon.svg');

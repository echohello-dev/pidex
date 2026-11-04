import { execFile } from 'node:child_process';
import path from 'node:path';
import { promisify } from 'node:util';
import { createServer as createTcpServer, type AddressInfo } from 'node:net';
import { createServer } from 'vite';
import type { TestProject } from 'vitest/node';

export default async function setup(project: TestProject) {
  const root = path.resolve(__dirname, '../..');
  const exec = promisify(execFile);
  await Promise.all(
    ['tsconfig.main.json', 'tsconfig.preload.json'].map((config) =>
      exec(
        process.execPath,
        [path.join(root, 'node_modules/typescript/bin/tsc'), '-p', config],
        { cwd: root },
      ),
    ),
  );
  // Vite treats port 0 as its default port. Ask the OS for an available port
  // explicitly so E2E can run alongside the normal development server.
  const port = await new Promise<number>((resolve, reject) => {
    const probe = createTcpServer();
    probe.once('error', reject);
    probe.listen(0, '127.0.0.1', () => {
      const { port } = probe.address() as AddressInfo;
      probe.close((error) => (error ? reject(error) : resolve(port)));
    });
  });
  const server = await createServer({
    root: path.join(root, 'src/renderer'),
    configFile: path.join(root, 'vite.config.ts'),
    logLevel: 'warn',
    server: { host: '127.0.0.1', port, strictPort: true },
  });
  try {
    await server.listen();
    const url = server.resolvedUrls?.local[0];
    if (!url) throw new Error('The E2E renderer server did not start.');
    project.provide('rendererUrl', url);
    return () => server.close();
  } catch (error) {
    await server.close();
    throw error;
  }
}

declare module 'vitest' {
  export interface ProvidedContext {
    rendererUrl: string;
  }
}

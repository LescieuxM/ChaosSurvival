import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import electron from 'electron';
import { createServer } from 'vite';

const root = fileURLToPath(new URL('../', import.meta.url));
let server,
  child,
  stopping = false;

async function stop(code = 0) {
  if (stopping) return;
  stopping = true;
  child?.kill();
  await server?.close();
  process.exitCode = code;
}

process.once('SIGINT', () => {
  void stop();
});
process.once('SIGTERM', () => {
  void stop();
});

try {
  server = await createServer({
    root,
    server: { host: '127.0.0.1', port: 5173, open: false },
  });
  await server.listen();
  const devUrl = server.resolvedUrls.local[0];
  const env = { ...process.env, CHAOS_DEV_URL: devUrl };
  // Some IDE terminals set this flag for their own Electron-based Node runtime.
  delete env.ELECTRON_RUN_AS_NODE;
  console.log(`Chaos Survival — développement Electron (${devUrl})`);
  console.log('F11 / Alt+Entrée : plein écran. F12 : outils de développement.');
  child = spawn(electron, [root, ...process.argv.slice(2)], { cwd: root, stdio: 'inherit', env });
  child.once('error', (error) => {
    console.error(error);
    void stop(1);
  });
  child.once('exit', (code) => {
    void stop(code ?? 0);
  });
} catch (error) {
  console.error(error);
  await stop(1);
}

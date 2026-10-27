/** Desenvolvimento: recompila o app ao salvar e reinicia o servidor quando server/ muda. */
import { spawn } from 'node:child_process';

const run = (cmd, args) => {
  const p = spawn(cmd, args, { stdio: 'inherit', env: { ...process.env } });
  p.on('exit', (code) => { if (code) process.exit(code); });
  return p;
};

const web = run(process.execPath, ['scripts/build.mjs', '--watch']);
// pequeno atraso para o primeiro build do app terminar antes do servidor subir
setTimeout(() => {
  const api = run(process.execPath, ['--import', 'tsx', '--watch-path=server', '--watch-path=shared', 'server/index.ts']);
  const stop = () => { web.kill(); api.kill(); process.exit(0); };
  process.on('SIGINT', stop);
  process.on('SIGTERM', stop);
}, 1500);

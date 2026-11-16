const { spawn } = require('node:child_process');
const path = require('node:path');

const root = __dirname;
const apiPort = String(Number(process.env.API_PORT) || 3131);
const vitePort = String(Number(process.env.VITE_PORT) || 5176);
const viteScript = path.join(root, 'node_modules', 'vite', 'bin', 'vite.js');
const children = [];
let stopping = false;

function stopChildren(exitCode) {
  if (stopping) return;
  stopping = true;
  process.exitCode = exitCode;
  children.forEach((child) => child.kill());
}

function startProcess(name, script, args, env) {
  const child = spawn(process.execPath, [script, ...args], {
    cwd: root,
    env,
    stdio: 'inherit'
  });
  children.push(child);

  child.on('error', (error) => {
    console.error(`Unable to start ${name}: ${error.message}`);
    stopChildren(1);
  });

  child.on('exit', (code, signal) => {
    if (stopping) return;
    const reason = signal ? `signal ${signal}` : `exit code ${code}`;
    console.error(`${name} stopped with ${reason}.`);
    stopChildren(code || 1);
  });

  return child;
}

process.on('SIGINT', () => stopChildren(0));
process.on('SIGTERM', () => stopChildren(0));

startProcess('University data API', path.join(root, 'server.cjs'), [], {
  ...process.env,
  PORT: apiPort
});

startProcess(
  'Vite',
  viteScript,
  ['--host', '127.0.0.1', '--port', vitePort, '--strictPort', '--open'],
  { ...process.env, API_PORT: apiPort }
);

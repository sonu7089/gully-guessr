// Builds the container in Cloud Build and deploys it to Cloud Run.
//   node scripts/deploy-cloudrun.mjs [--project gully-guessr] [--region asia-south1] [--account you@example.com]
// Reads the VITE_* values from .env (never printed). Needs the gcloud CLI.
import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';

const arg = (name, fallback) => {
  const i = process.argv.indexOf(`--${name}`);
  return i > -1 ? process.argv[i + 1] : fallback;
};
const project = arg('project', 'gully-guessr');
const region = arg('region', 'asia-south1');
const account = arg('account');
const service = arg('service', 'gully-guessr');

const env = existsSync('.env')
  ? Object.fromEntries(
      readFileSync('.env', 'utf8')
        .split(/\r?\n/)
        .filter((l) => /^\s*[A-Z_]+=/.test(l))
        .map((l) => [l.slice(0, l.indexOf('=')).trim(), l.slice(l.indexOf('=') + 1).trim()]),
    )
  : {};
const need = ['VITE_GOOGLE_MAPS_API_KEY', 'VITE_FIREBASE_API_KEY', 'VITE_FIREBASE_AUTH_DOMAIN', 'VITE_FIREBASE_PROJECT_ID', 'VITE_FIREBASE_APP_ID'];
const missing = need.filter((k) => !env[k]);
if (missing.length) {
  console.error(`Missing in .env: ${missing.join(', ')}`);
  process.exit(1);
}

const image = `${region}-docker.pkg.dev/${project}/gully/${service}:latest`;
const common = [`--project=${project}`, ...(account ? [`--account=${account}`] : [])];
const gcloud = (args) => {
  const r = spawnSync('gcloud', [...args, ...common], { stdio: 'inherit', shell: true });
  if (r.status !== 0) process.exit(r.status ?? 1);
};

// Image repository (ignored if it already exists).
spawnSync('gcloud', ['artifacts', 'repositories', 'create', 'gully', '--repository-format=docker', `--location=${region}`, ...common], { stdio: 'ignore', shell: true });

const subs = [
  `_IMAGE=${image}`,
  `_MAPS_KEY=${env.VITE_GOOGLE_MAPS_API_KEY}`,
  `_FB_API_KEY=${env.VITE_FIREBASE_API_KEY}`,
  `_FB_AUTH_DOMAIN=${env.VITE_FIREBASE_AUTH_DOMAIN}`,
  `_FB_PROJECT_ID=${env.VITE_FIREBASE_PROJECT_ID}`,
  `_FB_APP_ID=${env.VITE_FIREBASE_APP_ID}`,
].join(',');
gcloud(['builds', 'submit', '.', '--config=cloudbuild.yaml', `--substitutions=${subs}`]);

// One instance keeps every room in the same process; the timeout is the longest a socket can live
// (clients reconnect and rejoin automatically). Scales to zero when nobody is playing.
gcloud([
  'run', 'deploy', service,
  `--image=${image}`,
  `--region=${region}`,
  '--allow-unauthenticated',
  '--max-instances=1',
  '--min-instances=0',
  '--concurrency=250',
  '--timeout=3600',
  '--cpu=1',
  '--memory=512Mi',
  `--set-env-vars=FIREBASE_PROJECT_ID=${env.VITE_FIREBASE_PROJECT_ID}`,
]);

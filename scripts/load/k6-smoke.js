// Reproducible load-test harness (k6). PREPARED, NOT RUN here — running it is a
// deliberate, manual step against a STAGING deployment you control, never
// production, and it needs the k6 binary (https://k6.io) which is not bundled.
//
//   BASE_URL=https://staging.example.app k6 run scripts/load/k6-smoke.js
//
// It ramps virtual users doing read-only GETs against a configurable path, and
// fails the run if latency/error thresholds are exceeded. Defaults are gentle
// so an accidental run can't hammer anything. Tune VUS/DURATION/PATH via env.
//
// This smoke scenario is intentionally UNAUTHENTICATED and hits a benign route
// (the app shell by default). A realistic authenticated scenario (login, send a
// message, place an order) is sketched at the bottom and left to configure with
// a staging test account — see scripts/load/README.md.

import http from 'k6/http';
import { check, sleep } from 'k6';

const BASE_URL = __ENV.BASE_URL;        // required, e.g. https://staging.example.app
const PATH = __ENV.PATH_ || '/';         // read-only path to probe
const VUS = Number(__ENV.VUS || 10);     // concurrent virtual users
const DURATION = __ENV.DURATION || '30s';

export const options = {
  vus: VUS,
  duration: DURATION,
  thresholds: {
    http_req_failed: ['rate<0.01'],      // <1% errors
    http_req_duration: ['p(95)<800'],    // 95th percentile under 800ms
  },
};

export default function () {
  if (!BASE_URL) {
    throw new Error('Set BASE_URL to a STAGING deployment (never production).');
  }
  const res = http.get(`${BASE_URL}${PATH}`, { tags: { name: 'shell' } });
  check(res, { 'status is 2xx/3xx': (r) => r.status >= 200 && r.status < 400 });
  sleep(1);
}

// --- Authenticated scenario (template; fill in for staging) -----------------
// export function authedFlow() {
//   const token = __ENV.TEST_TOKEN; // a staging test account's access token
//   const headers = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };
//   // e.g. probe a read endpoint, then a write against a disposable staging chat.
//   // Keep writes idempotent/cleanable; NEVER target real users' data.
// }

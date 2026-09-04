// todo-web — tasks, served at /todo under the shared host. Transpiles the
// shared ui-kit and the Task feature package (TypeScript source, no build
// step) and proxies /api/* to the gateway.
//
// Plain .js (not .ts): `next start` re-reads this file at runtime, which
// requires the `typescript` package to be present — but production images
// are deployed with `pnpm deploy --prod`, which excludes devDependencies.
/** @type {import('next').NextConfig} */
const config = {
  // Single-origin topology — see the note in lms-web/next.config.js. Compiled
  // into the image; must match TASK_URL (`http://app.localhost/todo`) and the
  // `handle /todo/*` block in infra/Caddyfile.
  basePath: '/todo',
  transpilePackages: ['@platform/ui-kit', '@task/web'],
  async rewrites() {
    const apiGateway = process.env['API_GATEWAY_INTERNAL_URL'] ?? 'http://localhost:4000';
    // `source` is auto-prefixed to /todo/api/:path*; the absolute `destination`
    // is left un-prefixed. See the fuller note in lms-web/next.config.js.
    return [{ source: '/api/:path*', destination: `${apiGateway}/:path*` }];
  },
};

module.exports = config;

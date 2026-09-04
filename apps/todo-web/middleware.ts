import { createProductMiddleware, productOrigins } from '@platform/ui-kit/middleware';

// Task product app, served at /todo under the shared host. Verifies the shared
// session cookie and bounces unauthenticated users to the auth app, preserving
// the target. `selfOrigin` — see the note in lms-web's middleware.
export const middleware = createProductMiddleware({
  protectedPrefixes: ['/tasks', '/api/'],
  selfOrigin: productOrigins().task,
});

// `config.matcher` below is deliberately APP-RELATIVE. Next prepends this app's
// `basePath` to every matcher at build time, so writing the prefix here would
// produce a doubled `/todo/todo/...` that matches nothing — leaving these routes
// unauthenticated. Same for `protectedPrefixes`: `request.nextUrl.pathname`
// reaches middleware with the prefix already stripped. See the long note on
// DEFAULT_PROTECTED in @platform/ui-kit/middleware for the empirical evidence.
export const config = {
  matcher: ['/tasks/:path*', '/api/:path*'],
};

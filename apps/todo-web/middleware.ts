import { createProductMiddleware, productOrigins } from '@platform/ui-kit/middleware';

// Task product app (todo.app.com). Verifies the shared .app.com session cookie
// and bounces unauthenticated users to the auth origin, preserving the target.
// `selfOrigin` — see the note in lms-web's middleware.
export const middleware = createProductMiddleware({
  protectedPrefixes: ['/tasks', '/api/'],
  selfOrigin: productOrigins().task,
});

export const config = {
  matcher: ['/tasks/:path*', '/api/:path*'],
};

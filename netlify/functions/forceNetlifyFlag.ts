// server.ts checks process.env.NETLIFY to decide whether it's running as a
// Netlify Function (skip the local vite dev server / self-starting listener)
// or as the local dev server. That variable isn't reliably present in the
// deployed function's runtime (only at build time), so we set it ourselves.
// Must be the first import in api.ts: ES module evaluation runs a module's
// sibling imports in declaration order before any of the importing file's
// own top-level code, so this has to be its own leaf module to actually run
// before server.ts is evaluated.
if (!process.env.NETLIFY) {
  process.env.NETLIFY = 'true';
}

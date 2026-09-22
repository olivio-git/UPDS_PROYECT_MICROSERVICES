import { lazy, type ComponentType } from "react";

const RELOAD_FLAG = "cba:chunk-reload-attempted";

/**
 * React.lazy for route screens, resilient to redeploys.
 *
 * Every build emits chunks with content hashes in their names and removes the
 * previous ones. A tab opened before a deploy still references the old names,
 * so navigating to a not-yet-loaded route fetches a file that no longer exists.
 * On that failure we reload once to pick up the new index.html; if the reload
 * does not fix it, the error propagates normally.
 */
export function lazyRoute<T extends ComponentType<any>>(
  factory: () => Promise<{ default: T }>,
) {
  return lazy(() =>
    factory()
      .then((module) => {
        sessionStorage.removeItem(RELOAD_FLAG);
        return module;
      })
      .catch((error: unknown) => {
        if (!sessionStorage.getItem(RELOAD_FLAG)) {
          sessionStorage.setItem(RELOAD_FLAG, "1");
          window.location.reload();
          // Keep Suspense showing the fallback while the page reloads.
          return new Promise<never>(() => {});
        }
        sessionStorage.removeItem(RELOAD_FLAG);
        throw error;
      }),
  );
}

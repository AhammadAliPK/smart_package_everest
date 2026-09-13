import { useEffect, useRef } from 'react';

/**
 * Route-change focus contract (UX-DR18): every page's `<h1>` is focusable and
 * receives focus on mount/navigation, so screen readers announce the new page.
 * Returns the ref to spread on the title element (className `page-title` gets
 * the brand focus ring from styles.css).
 */
export function usePageTitleFocus<T extends HTMLElement>() {
  const ref = useRef<T | null>(null);

  useEffect(() => {
    ref.current?.focus();
  }, []);

  return ref;
}

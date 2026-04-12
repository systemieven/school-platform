import { useEffect, useRef } from 'react';

export function useScrollReveal(threshold = 0.15) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add('revealed');
            io.unobserve(entry.target);
          }
        });
      },
      { threshold, rootMargin: '0px 0px -60px 0px' },
    );

    /** Observe any new [data-reveal] children that haven't been revealed yet */
    function scan() {
      el!.querySelectorAll('[data-reveal]:not(.revealed)').forEach((child) => {
        io.observe(child);
      });
    }

    scan();

    // Re-scan whenever the DOM changes (e.g. async data renders new sections)
    const mo = new MutationObserver(scan);
    mo.observe(el, { childList: true, subtree: true });

    return () => {
      io.disconnect();
      mo.disconnect();
    };
  }, [threshold]);

  return ref;
}

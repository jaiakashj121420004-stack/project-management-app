import { useLayoutEffect, useState, type RefObject } from 'react';

/** The measured pixel size of an element. */
export interface ElementSize {
  width: number;
  height: number;
}

/**
 * Track an element's content-box size with a ResizeObserver. Used to give the
 * Konva <Stage> explicit pixel dimensions (it can't size itself from CSS). Reads
 * the initial size synchronously before paint to avoid a 0×0 first frame.
 */
export function useElementSize(ref: RefObject<HTMLElement | null>): ElementSize {
  const [size, setSize] = useState<ElementSize>({ width: 0, height: 0 });

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;

    const measure = (width: number, height: number) =>
      setSize((prev) =>
        prev.width === width && prev.height === height ? prev : { width, height },
      );

    measure(Math.floor(el.clientWidth), Math.floor(el.clientHeight));

    const observer = new ResizeObserver((entries) => {
      const rect = entries[0]?.contentRect;
      if (rect) measure(Math.floor(rect.width), Math.floor(rect.height));
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, [ref]);

  return size;
}

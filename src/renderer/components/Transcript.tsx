import {
  memo,
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import {
  defaultRangeExtractor,
  useVirtualizer,
  type Range,
} from '@tanstack/react-virtual';
import { layout, prepare } from '@chenglou/pretext';
import type { Entry } from '../timeline';
import { TranscriptRow } from './WorkbenchControls';

// Entry objects are stable between deltas. A WeakMap releases closed sessions and
// avoids preparing the entire archive again when only its last message changes.
const estimates = new WeakMap<Entry, { width: number; height: number }>();
function estimate(entry: Entry, width: number) {
  const cached = estimates.get(entry);
  if (cached?.width === width) return cached.height;
  const height =
    entry.kind === 'tool'
      ? 42
      : 28 +
        layout(
          prepare(
            entry.text || 'Thinking…',
            entry.kind === 'user'
              ? '400 13px "IBM Plex Mono"'
              : '400 18px Newsreader',
          ),
          Math.max(100, width),
          entry.kind === 'user' ? 20 : 28,
        ).height +
        (entry.kind === 'assistant' && entry.thinking ? 26 : 0);
  estimates.set(entry, { width, height });
  return height;
}

/** Measured rows retain native Markdown selection and expandable tool output. */
export const Transcript = memo(function Transcript({
  entries,
  follow = false,
  children,
}: {
  entries: Entry[];
  follow?: boolean;
  children?: ReactNode;
}) {
  const viewport = useRef<HTMLDivElement>(null);
  const expanded = useRef(new Map<string, boolean>());
  const [selection, setSelection] = useState<[number, number] | null>(null);
  const [focused, setFocused] = useState<number | null>(null);
  const rangeExtractor = useCallback(
    (range: Range) => {
      const indexes = new Set(defaultRangeExtractor(range));
      // Keep selected DOM nodes alive while scrolling, including the text between
      // endpoints. Large intentional selections may mount more than the viewport.
      if (selection)
        for (
          let i = selection[0];
          i <= Math.min(selection[1], range.count - 1);
          i++
        )
          indexes.add(i);
      if (focused !== null && focused < range.count) indexes.add(focused);
      return [...indexes].sort((a, b) => a - b);
    },
    [selection, focused],
  );
  const virtual = useVirtualizer({
    count: entries.length,
    getScrollElement: () => viewport.current,
    getItemKey: useCallback((index: number) => entries[index].key, [entries]),
    estimateSize: (index) =>
      estimate(entries[index], viewport.current?.clientWidth ?? 780),
    overscan: 6,
    gap: 16,
    anchorTo: follow ? 'end' : 'start',
    followOnAppend: follow,
    scrollEndThreshold: 48,
    useAnimationFrameWithResizeObserver: true,
    rangeExtractor,
  });
  useLayoutEffect(() => {
    if (follow && entries.length) virtual.scrollToEnd();
    // Only initial positioning. Later updates follow the reader's scroll state.
  }, [follow, virtual]);
  useEffect(() => {
    const indexOf = (node: Node | null) => {
      const element = node instanceof Element ? node : node?.parentElement;
      const row = element?.closest<HTMLElement>('[data-index]');
      return row && viewport.current?.contains(row)
        ? Number(row.dataset.index)
        : null;
    };
    const update = () => {
      const value = document.getSelection();
      const start = indexOf(value?.anchorNode ?? null);
      const end = indexOf(value?.focusNode ?? null);
      setSelection((previous) => {
        const next: [number, number] | null =
          value && !value.isCollapsed && start !== null && end !== null
            ? [Math.min(start, end), Math.max(start, end)]
            : null;
        return previous?.[0] === next?.[0] && previous?.[1] === next?.[1]
          ? previous
          : next;
      });
    };
    document.addEventListener('selectionchange', update);
    return () => document.removeEventListener('selectionchange', update);
  }, []);
  useEffect(() => {
    const element = viewport.current;
    if (!element) return;
    let width = element.clientWidth;
    let frame = 0;
    const remeasure = () => {
      virtual.measure();
      cancelAnimationFrame(frame);
      // A cache reset also invalidates unchanged mounted rows: ResizeObserver
      // only reports rows whose physical dimensions changed.
      frame = requestAnimationFrame(() => {
        element
          .querySelectorAll<HTMLElement>('.wb-transcript-row')
          .forEach(virtual.measureElement);
      });
    };
    const observer = new ResizeObserver(() => {
      if (element.clientWidth !== width) {
        width = element.clientWidth;
        remeasure();
      }
    });
    observer.observe(element);
    let mounted = true;
    void document.fonts?.ready.then(() => {
      if (mounted) remeasure();
    });
    return () => {
      mounted = false;
      cancelAnimationFrame(frame);
      observer.disconnect();
    };
  }, [virtual]);

  return (
    <div
      ref={viewport}
      className="wb-transcript"
      tabIndex={0}
      aria-label="Conversation"
      onWheelCapture={(event) => {
        if (event.deltaY < 0) virtual.cancelScroll();
      }}
      onPointerDownCapture={() => virtual.cancelScroll()}
      onKeyDownCapture={(event) => {
        if (['Home', 'PageUp', 'ArrowUp'].includes(event.key))
          virtual.cancelScroll();
      }}
      onFocusCapture={(event) => {
        const row = (event.target as Element).closest<HTMLElement>(
          '[data-index]',
        );
        setFocused(row ? Number(row.dataset.index) : null);
      }}
      onBlurCapture={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget))
          setFocused(null);
      }}
    >
      <div
        className="wb-transcript-rows"
        style={{ height: virtual.getTotalSize() }}
      >
        {virtual.getVirtualItems().map((row) => (
          <div
            key={row.key}
            data-index={row.index}
            ref={virtual.measureElement}
            className="wb-transcript-row"
            style={{ transform: `translateY(${row.start}px)` }}
          >
            <TranscriptRow
              entry={entries[row.index]}
              expanded={expanded.current}
            />
          </div>
        ))}
      </div>
      {children}
    </div>
  );
});

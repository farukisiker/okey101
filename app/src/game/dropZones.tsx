import { createContext, useCallback, useContext, useMemo, useRef, type ReactNode, type RefObject } from 'react';
import type { HostInstance } from 'react-native';

export interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

interface DropZones {
  register(key: string, ref: RefObject<HostInstance | null>): () => void;
  /** Re-measures every zone (call when a drag starts; layouts may have scrolled). */
  measureAll(): void;
  hitTest(x: number, y: number): { key: string; rect: Rect } | null;
}

const Ctx = createContext<DropZones | null>(null);

/** Registry of on-screen drop targets (rack, discard pile, table melds) in window coordinates. */
export function DropZoneProvider({ children }: { children: ReactNode }) {
  const refs = useRef(new Map<string, RefObject<HostInstance | null>>());
  const rects = useRef(new Map<string, Rect>());

  const measureAll = useCallback(() => {
    refs.current.forEach((ref, key) => {
      ref.current?.measureInWindow((x, y, width, height) => rects.current.set(key, { x, y, width, height }));
    });
  }, []);

  const value = useMemo<DropZones>(
    () => ({
      register(key, ref) {
        refs.current.set(key, ref);
        return () => {
          refs.current.delete(key);
          rects.current.delete(key);
        };
      },
      measureAll,
      hitTest(x, y) {
        // Smaller zones win so a meld inside the table area beats the area itself.
        let hit: { key: string; rect: Rect } | null = null;
        rects.current.forEach((rect, key) => {
          const inside = x >= rect.x && x <= rect.x + rect.width && y >= rect.y && y <= rect.y + rect.height;
          if (inside && (!hit || rect.width * rect.height < hit.rect.width * hit.rect.height)) hit = { key, rect };
        });
        return hit;
      },
    }),
    [measureAll],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useDropZones(): DropZones {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('DropZoneProvider missing');
  return ctx;
}

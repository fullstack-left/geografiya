import { useEffect, type RefObject } from 'react';

/**
 * Wheel + two-finger pinch zoom on an element. Calls `onScaleBy(areaFactor)`.
 * Pinch: area factor = (distance ratio)², since area grows with length².
 */
export function useZoomGestures(ref: RefObject<HTMLElement | null>, enabled: boolean, onScaleBy: (f: number) => void) {
  useEffect(() => {
    const el = ref.current;
    if (!el || !enabled) return;

    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const delta = e.deltaMode === 1 ? e.deltaY * 16 : e.deltaY;
      onScaleBy(Math.exp(-delta * 0.002));
    };

    const pointers = new Map<number, { x: number; y: number }>();
    let lastDist = 0;
    const dist = () => {
      const [a, b] = [...pointers.values()];
      return a && b ? Math.hypot(a.x - b.x, a.y - b.y) : 0;
    };
    const onDown = (e: PointerEvent) => {
      pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (pointers.size === 2) lastDist = dist();
    };
    const onMove = (e: PointerEvent) => {
      if (!pointers.has(e.pointerId)) return;
      pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (pointers.size !== 2) return;
      const d = dist();
      if (lastDist > 0 && d > 0) onScaleBy((d / lastDist) ** 2);
      lastDist = d;
    };
    const onUp = (e: PointerEvent) => {
      pointers.delete(e.pointerId);
      lastDist = pointers.size === 2 ? dist() : 0;
    };

    el.addEventListener('wheel', onWheel, { passive: false });
    el.addEventListener('pointerdown', onDown);
    el.addEventListener('pointermove', onMove);
    el.addEventListener('pointerup', onUp);
    el.addEventListener('pointercancel', onUp);
    el.addEventListener('pointerleave', onUp);
    return () => {
      el.removeEventListener('wheel', onWheel);
      el.removeEventListener('pointerdown', onDown);
      el.removeEventListener('pointermove', onMove);
      el.removeEventListener('pointerup', onUp);
      el.removeEventListener('pointercancel', onUp);
      el.removeEventListener('pointerleave', onUp);
    };
  }, [ref, enabled, onScaleBy]);
}

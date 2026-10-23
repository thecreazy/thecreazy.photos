// Smooth wheel scrolling on the pages that scroll the document (shooting pages, Archive, Contact). Touch scrolling stays the browser's own.
// The home page is not one of them: its roll is driven by scripts/home/input.ts, not by the page scroll.
import Lenis from 'lenis';

const skip = document.body.classList.contains('home') || matchMedia('(prefers-reduced-motion: reduce)').matches || matchMedia('(pointer: coarse)').matches; // touch keeps the native scroll

if (!skip) {
  const lenis = new Lenis({ lerp: 0.11, wheelMultiplier: 0.9 });
  const raf = (t: number) => { lenis.raf(t); requestAnimationFrame(raf); };
  requestAnimationFrame(raf);
  addEventListener('pageshow', (e) => { if (e.persisted) lenis.resize(); }); // back button restored the page from the bfcache
}

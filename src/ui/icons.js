// Tiny inline SVG icons (no emoji, no assets). icon(name) returns an <svg> element using currentColor.
const NS = 'http://www.w3.org/2000/svg';
const PATHS = {
  pause: '<rect x="5" y="4" width="4" height="12" rx="1"/><rect x="11" y="4" width="4" height="12" rx="1"/>',
  play: '<path d="M6 4.2v11.6a.8.8 0 0 0 1.2.7l9-5.8a.8.8 0 0 0 0-1.4l-9-5.8A.8.8 0 0 0 6 4.2z"/>',
  dots: '<circle cx="4.5" cy="10" r="1.6"/><circle cx="10" cy="10" r="1.6"/><circle cx="15.5" cy="10" r="1.6"/>',
  contrast: '<circle cx="10" cy="10" r="7" fill="none" stroke="currentColor" stroke-width="1.6"/><path d="M10 3a7 7 0 0 1 0 14z"/>',
  chevron: '<path d="M7.5 4.5 13 10l-5.5 5.5" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>',
  star: '<path d="M10 2.8l2.2 4.6 5 .7-3.6 3.5.9 5-4.5-2.4-4.5 2.4.9-5L2.8 8.1l5-.7z" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"/>',
  starOn: '<path d="M10 2.8l2.2 4.6 5 .7-3.6 3.5.9 5-4.5-2.4-4.5 2.4.9-5L2.8 8.1l5-.7z" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"/>',
  image: '<rect x="3" y="4" width="14" height="12" rx="2" fill="none" stroke="currentColor" stroke-width="1.6"/><circle cx="7.5" cy="8.3" r="1.4"/><path d="M4 14.5l4-3.6 3 2.5 2.4-2 3 3" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"/>',
  close: '<path d="M5 5l10 10M15 5L5 15" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>',
};

export function icon(name, size = 18) {
  const svg = document.createElementNS(NS, 'svg');
  svg.setAttribute('viewBox', '0 0 20 20');
  svg.setAttribute('width', String(size));
  svg.setAttribute('height', String(size));
  svg.setAttribute('aria-hidden', 'true');
  svg.setAttribute('focusable', 'false');
  svg.setAttribute('fill', 'currentColor');
  svg.classList.add('ico');
  svg.innerHTML = PATHS[name] || '';
  return svg;
}

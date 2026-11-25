import { showThumbnail, THUMBNAIL_SETTING, thumbnailsEnabled } from './thumbnails';

const root = document.documentElement;
const examplesToggle = document.querySelector<HTMLButtonElement>('[data-examples-toggle]')!;
const examplesPreference = examplesToggle.dataset.examplesToggle!;

function loadGalleryThumbnails() {
  const enabled = !root.hasAttribute('data-examples-hidden') && thumbnailsEnabled();
  for (const preview of document.querySelectorAll<HTMLElement>('[data-thumbnail][data-address]')) {
    showThumbnail(preview, preview.dataset.address!, enabled);
  }
}

function renderExamples(hidden: boolean) {
  root.toggleAttribute('data-examples-hidden', hidden);
  examplesToggle.textContent = hidden ? 'Mostrar ejemplos' : 'Ocultar ejemplos';
  examplesToggle.setAttribute('aria-expanded', String(!hidden));
  loadGalleryThumbnails();
}

renderExamples(root.hasAttribute('data-examples-hidden'));
examplesToggle.hidden = false;
examplesToggle.addEventListener('click', () => {
  const hidden = !root.hasAttribute('data-examples-hidden');
  renderExamples(hidden);
  try {
    if (hidden) localStorage.setItem(examplesPreference, 'hidden');
    else localStorage.removeItem(examplesPreference);
  } catch {}
});

window.addEventListener('storage', ({ key, newValue }) => {
  if (key === examplesPreference || key === null) renderExamples(newValue === 'hidden');
  else if (key === THUMBNAIL_SETTING) loadGalleryThumbnails();
});

const filters = document.querySelector<HTMLElement>('.gallery-filters')!;
const buttons = [...filters.querySelectorAll<HTMLButtonElement>('button')];
const entries = [...document.querySelectorAll<HTMLElement>('[data-gallery-entry]')];
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');

filters.hidden = false;

for (const button of buttons) {
  button.addEventListener('click', () => {
    if (button.getAttribute('aria-pressed') === 'true') return;
    const filter = button.dataset.galleryFilter;
    for (const item of buttons) item.setAttribute('aria-pressed', String(item === button));

    const positions = entries.map((entry) => entry.hidden ? undefined : entry.getBoundingClientRect());
    for (const entry of entries) {
      entry.getAnimations?.().forEach((animation) => animation.cancel());
      entry.hidden = Boolean(filter && entry.dataset.galleryEntry !== filter);
    }
    if (reducedMotion.matches || typeof Element.prototype.animate !== 'function') return;

    entries.forEach((entry, index) => {
      if (entry.hidden) return;
      const before = positions[index];
      const after = entry.getBoundingClientRect();
      const offset = before
        ? `translate(${before.x - after.x}px, ${before.y - after.y}px)`
        : 'translateY(10px)';
      entry.animate(
        [{ transform: offset, opacity: before ? 1 : 0.55 }, { transform: 'none', opacity: 1 }],
        { duration: 300, easing: 'cubic-bezier(.22, 1, .36, 1)' },
      );
    });
  });
}

const steps = [...document.querySelectorAll<HTMLDetailsElement>('[data-guide-step]')];
const panels = [...document.querySelectorAll<HTMLElement>('[data-guide-panel]')];
for (const step of steps) {
  step.addEventListener('toggle', () => {
    if (!step.open) return;
    for (const other of steps) {
      if (other !== step) other.open = false;
    }
    for (const panel of panels) panel.hidden = panel.dataset.guidePanel !== step.dataset.guideStep;
  });
}

export const THUMBNAIL_SETTING = 'atajo.miniaturas';

export function thumbnailsEnabled() {
  try {
    return localStorage.getItem(THUMBNAIL_SETTING) !== 'off';
  } catch {
    return true;
  }
}

const localSuffixes = new Set(['example', 'internal', 'invalid', 'lan', 'local', 'localdomain', 'localhost', 'onion', 'test']);

export function thumbnailUrl(address: string) {
  const url = new URL(address);
  const hostname = url.hostname.toLowerCase().replace(/\.$/, '');
  const suffix = hostname.split('.').at(-1) ?? '';
  if (
    !['http:', 'https:'].includes(url.protocol) || url.username || url.password || url.port ||
    !hostname.includes('.') || !/^(?:[a-z]{2,}|xn--[a-z0-9-]+)$/.test(suffix) || localSuffixes.has(suffix) ||
    hostname === 'home.arpa' || hostname.endsWith('.home.arpa')
  ) return undefined;

  return `https://image.thum.io/get/width/640/crop/675/noanimate/${url.origin}/`;
}

export function showThumbnail(preview: HTMLElement, address: string, enabled: boolean) {
  const image = preview.querySelector('img')!;
  const source = enabled ? thumbnailUrl(address) : undefined;
  if (image.getAttribute('src') === (source ?? null)) return;

  delete preview.dataset.previewReady;
  image.onload = null;
  image.onerror = null;
  if (!source) {
    image.removeAttribute('src');
    return;
  }

  image.onload = () => { preview.dataset.previewReady = ''; };
  image.onerror = () => { delete preview.dataset.previewReady; };
  image.src = source;
  if (image.complete && image.naturalWidth) preview.dataset.previewReady = '';
}

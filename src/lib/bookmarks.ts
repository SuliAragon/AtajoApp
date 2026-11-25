export interface Bookmark {
  id: string;
  name: string;
  url: string;
  note: string;
}

export interface Section {
  id: string;
  name: string;
  links: Bookmark[];
}

export const keyFor = (text: string) => text.trim().normalize('NFC').toLocaleLowerCase('es');

export function newId() {
  return Array.from(crypto.getRandomValues(new Uint32Array(4)), (part) => part.toString(16)).join('-');
}

export function bookmarkUrl(value: string) {
  const address = value.trim();
  if (!address || /\s/.test(address)) throw new Error('Introduce una dirección web válida.');

  const isAbsolute = /^https?:\/\//i.test(address);
  const isDomain = /^(?:[^/:]+\.[^/:]+|localhost|\[[\da-f:]+\])(?=[:/?#]|$)/i.test(address);
  if (!isAbsolute && !isDomain) throw new Error('Introduce una dirección web HTTP o HTTPS.');

  let url: URL;
  try {
    url = new URL(isAbsolute ? address : `https://${address}`);
  } catch {
    throw new Error('Introduce una dirección web válida.');
  }
  if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password) {
    throw new Error('Introduce una dirección web HTTP o HTTPS sin credenciales.');
  }
  return url.href;
}

export function mergeSections(current: Section[], incoming: Section[]) {
  const next = structuredClone(current);
  const byName = new Map(next.map((section) => [keyFor(section.name), section]));
  for (const section of incoming) {
    const key = keyFor(section.name);
    const existing = byName.get(key);
    if (!existing) {
      const copy = structuredClone(section);
      next.push(copy);
      byName.set(key, copy);
      continue;
    }
    const urls = new Set(existing.links.map((link) => link.url));
    for (const link of section.links) {
      if (!urls.has(link.url)) existing.links.push({ ...link });
      urls.add(link.url);
    }
  }
  return next;
}

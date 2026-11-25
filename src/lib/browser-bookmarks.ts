import { bookmarkUrl, keyFor, newId, type Bookmark, type Section } from './bookmarks';

export function importBrowserBookmarks(source: string) {
  // The template keeps imported markup inert. Only text and validated URLs leave it.
  const template = document.createElement('template');
  template.innerHTML = source;
  const rootLists = [...template.content.querySelectorAll('dl')].filter((list) => !list.parentElement?.closest('dl'));
  if (!rootLists.length) {
    throw new Error('El HTML no parece un archivo de marcadores exportado por un navegador.');
  }

  const sections: Section[] = [];
  const folders = new Map<string, Section>();
  const sectionNames = new Set<string>();
  const seenUrls = new Map<Section, Set<string>>();
  let rootSection: Section | undefined;
  let skipped = 0;

  function createSection(name: string) {
    const section = { id: newId(), name, links: [] };
    sections.push(section);
    seenUrls.set(section, new Set());
    return section;
  }

  function addBookmark(anchor: Element, folder?: Section) {
    const address = anchor.getAttribute('href')?.trim() ?? '';
    let url: string;
    try {
      if (!/^https?:\/\//i.test(address)) throw new Error();
      url = bookmarkUrl(address);
    } catch {
      skipped++;
      return;
    }

    const section = folder ?? (rootSection ??= createSection('Sin carpeta'));
    const urls = seenUrls.get(section)!;
    if (urls.has(url)) {
      skipped++;
      return;
    }

    const link = { id: newId(), name: anchor.textContent?.trim() || url, url, note: '' };
    urls.add(url);
    section.links.push(link);
    return link;
  }

  function visitList(list: Element, path: string[], parent?: Section) {
    let folder: { path: string[]; section: Section } | undefined;
    let lastLink: Bookmark | undefined;
    for (const entry of list.children) {
      if (entry.matches('p, hr')) continue;
      if (entry.matches('dd')) {
        if (lastLink) lastLink.note = entry.textContent?.trim() ?? '';
        lastLink = undefined;
        continue;
      }
      if (entry.matches('dl')) {
        visitList(entry, folder?.path ?? path, folder?.section ?? parent);
        folder = undefined;
        lastLink = undefined;
        continue;
      }

      folder = undefined;
      lastLink = undefined;
      if (!entry.matches('dt')) continue;
      const heading = entry.querySelector(':scope > h3');
      if (heading) {
        const names = [...path, heading.textContent?.trim() || 'Carpeta sin nombre'];
        const key = JSON.stringify(names.map(keyFor));
        let section = folders.get(key);
        if (!section) {
          const preferred = names.join(' › ');
          let displayName = preferred;
          for (let suffix = 2; sectionNames.has(keyFor(displayName)); suffix++) {
            displayName = `${preferred} (${suffix})`;
          }
          sectionNames.add(keyFor(displayName));
          section = createSection(displayName);
          folders.set(key, section);
        }
        folder = { path: names, section };
        const nested = entry.querySelector(':scope > dl');
        if (nested) {
          visitList(nested, names, section);
          folder = undefined;
        }
        continue;
      }

      const anchor = entry.querySelector(':scope > a[href]');
      if (anchor) lastLink = addBookmark(anchor, parent);
      const note = entry.querySelector(':scope > dd');
      if (lastLink && note) lastLink.note = note.textContent?.trim() ?? '';
    }
  }

  for (const list of rootLists) visitList(list, []);
  if (rootSection && sectionNames.has(keyFor(rootSection.name))) {
    let suffix = 2;
    while (sectionNames.has(keyFor(`Sin carpeta (${suffix})`))) suffix++;
    rootSection.name = `Sin carpeta (${suffix})`;
  }
  if (!sections.length) {
    throw new Error('No se han encontrado marcadores HTTP o HTTPS ni carpetas en este archivo.');
  }
  return { sections, skipped };
}

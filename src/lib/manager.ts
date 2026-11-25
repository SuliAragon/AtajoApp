import { bookmarkUrl, keyFor, mergeSections, newId, type Bookmark, type Section } from './bookmarks';
import { exportCsv, importCsv } from './csv';
import { importBrowserBookmarks } from './browser-bookmarks';
import { showThumbnail, THUMBNAIL_SETTING, thumbnailsEnabled } from './thumbnails';

const STORE_KEY = 'atajo.marcadores.v1';

function element<T extends HTMLElement = HTMLElement>(id: string) {
  return document.getElementById(id) as T;
}

function template(id: string) {
  return element<HTMLTemplateElement>(id).content.cloneNode(true) as DocumentFragment;
}

function message(error: unknown) {
  return error instanceof Error ? error.message : 'No se ha podido completar la operación.';
}

const notice = element('storage-notice');
const sectionNav = element('section-nav');
const sectionList = element('sections');
const search = element<HTMLInputElement>('bookmark-search');
const thumbnailSetting = element<HTMLInputElement>('thumbnail-setting');
const fileInput = element<HTMLInputElement>('import-file');
const dialog = element<HTMLDialogElement>('editor');
const form = element<HTMLFormElement>('editor-form');
const fields = element('form-fields');
const errorBox = element('form-error');
const submit = element<HTMLButtonElement>('editor-submit');
const toast = element('toast');
let selectedSection = '';
let showPreviews = thumbnailsEnabled();
let toastTimer: number;
let edit: ((data: FormData) => void) | undefined;
let restoreFocus: (() => void) | undefined;

function load(raw: string | null): Section[] {
  if (raw === null) return [];
  const value = JSON.parse(raw) as { version?: number; sections?: Section[] };
  if (value?.version !== 1 || !Array.isArray(value.sections)) throw new Error('Copia local incompatible.');
  return value.sections.map((section) => {
    if (typeof section.id !== 'string' || typeof section.name !== 'string' || !Array.isArray(section.links)) {
      throw new Error('Sección incompatible.');
    }
    return {
      ...section,
      links: section.links.map((link) => {
        if (typeof link.id !== 'string' || typeof link.name !== 'string' || typeof link.note !== 'string') {
          throw new Error('Marcador incompatible.');
        }
        return { ...link, url: bookmarkUrl(link.url) };
      }),
    };
  });
}

let sections: Section[];
try {
  sections = load(localStorage.getItem(STORE_KEY));
} catch {
  sections = [];
  notice.hidden = false;
}

function persist(next: Section[]) {
  sections = next;
  try {
    localStorage.setItem(STORE_KEY, JSON.stringify({ version: 1, sections }));
    notice.hidden = true;
  } catch {
    notice.hidden = false;
  }
  render();
}

function showToast(text: string) {
  window.clearTimeout(toastTimer);
  toast.textContent = text;
  toast.hidden = false;
  toastTimer = window.setTimeout(() => {
    toast.hidden = true;
    toast.textContent = '';
  }, 4200);
}

function renderSidebar() {
  const options = [{ id: '', name: 'Todas', count: sections.reduce((sum, section) => sum + section.links.length, 0) }];
  options.push(...sections.map(({ id, name, links }) => ({ id, name, count: links.length })));
  sectionNav.replaceChildren(...options.map(({ id, name, count }) => {
    const fragment = template('section-choice-template');
    const button = fragment.firstElementChild as HTMLButtonElement;
    button.dataset.section = id;
    button.setAttribute('aria-pressed', String(id === selectedSection));
    button.querySelector('[data-icon]')!.append(template(id ? 'folder-icon' : 'grid-icon'));
    button.querySelector('.section-label')!.textContent = name;
    button.querySelector('.count')!.textContent = String(count);
    return fragment;
  }));
}

function bookmarkCard(bookmark: Bookmark, section: Section) {
  const fragment = template('card-template');
  const anchor = fragment.querySelector('a')!;
  anchor.href = bookmark.url;
  const hostname = new URL(bookmark.url).hostname;
  fragment.querySelector('.card-copy strong')!.textContent = bookmark.name;
  fragment.querySelector('.card-domain')!.textContent = hostname;
  const preview = fragment.querySelector<HTMLElement>('[data-thumbnail]')!;
  preview.querySelector('[data-preview-name]')!.textContent = bookmark.name;
  preview.querySelector('[data-preview-host]')!.textContent = hostname;
  preview.hidden = !showPreviews;
  showThumbnail(preview, bookmark.url, showPreviews);
  const note = fragment.querySelector<HTMLElement>('.card-note')!;
  note.textContent = bookmark.note;
  note.hidden = !bookmark.note;
  fragment.querySelectorAll<HTMLButtonElement>('button').forEach((button) => {
    button.dataset.section = section.id;
    button.dataset.link = bookmark.id;
    button.setAttribute('aria-label', `${button.title}: ${bookmark.name}`);
    if (button.dataset.action === 'reorder-link') button.hidden = section.links.length < 2;
  });
  return fragment;
}

const searchable = (text: string) => keyFor(text).normalize('NFD').replace(/\p{Diacritic}/gu, '');

function renderSections() {
  const query = searchable(search.value);
  const matching = sections
    .filter((section) => !selectedSection || section.id === selectedSection)
    .map((section) => ({
      section,
      links: query
        ? section.links.filter(({ name, url, note }) => searchable(`${section.name} ${name} ${url} ${note}`).includes(query))
        : section.links,
    }))
    .filter(({ links }) => !query || links.length);

  if (!matching.length) {
    const empty = document.createElement('div');
    empty.className = 'empty-board';
    const title = document.createElement('h2');
    title.textContent = query ? 'No hay coincidencias' : 'Crea tu primera sección';
    const detail = document.createElement('p');
    detail.textContent = query ? 'Prueba con otro nombre o dirección.' : 'Crea una sección para agrupar los enlaces que quieras guardar.';
    empty.append(title, detail);
    sectionList.replaceChildren(empty);
    return;
  }

  sectionList.replaceChildren(...matching.map(({ section, links }) => {
    const fragment = template('section-template');
    fragment.querySelector('h2')!.textContent = section.name;
    fragment.querySelectorAll<HTMLButtonElement>('.section-actions button').forEach((button) => {
      button.dataset.section = section.id;
      button.setAttribute('aria-label', `${button.title}: ${section.name}`);
      if (button.dataset.action === 'reorder-section') button.hidden = sections.length < 2;
    });
    const grid = fragment.querySelector('.card-grid')!;
    if (links.length) {
      grid.append(...links.map((link) => bookmarkCard(link, section)));
    } else {
      const empty = document.createElement('p');
      empty.className = 'empty-section';
      empty.textContent = 'Esta sección aún está vacía.';
      grid.append(empty);
    }
    return fragment;
  }));
}

function render() {
  if (selectedSection && !sections.some(({ id }) => id === selectedSection)) selectedSection = '';
  renderSidebar();
  renderSections();
}

function field(label: string, input: HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement) {
  const wrapper = document.createElement('label');
  wrapper.className = 'field';
  wrapper.append(label, input);
  return wrapper;
}

function textField(label: string, name: string, value = '', placeholder = '') {
  const input = document.createElement('input');
  input.name = name;
  input.value = value;
  input.placeholder = placeholder;
  input.required = true;
  if (name === 'url') {
    input.inputMode = 'url';
    input.autocapitalize = 'none';
    input.spellcheck = false;
  }
  return field(label, input);
}

function selectField(label: string, name: string, options: [string, string][], current: string) {
  const select = document.createElement('select');
  select.name = name;
  for (const [value, text] of options) select.add(new Option(text, value));
  select.value = current;
  return field(label, select);
}

function value(data: FormData, name: string) {
  return String(data.get(name) ?? '').trim();
}

interface EditorOptions {
  title: string;
  intro?: string;
  submitLabel: string;
  children?: HTMLElement[];
  onSubmit: (data: FormData) => void;
  destructive?: boolean;
  opener?: HTMLButtonElement;
}

function openEditor(options: EditorOptions) {
  element('editor-title').textContent = options.title;
  const intro = element('editor-intro');
  intro.textContent = options.intro ?? '';
  intro.hidden = !options.intro;
  fields.replaceChildren(...(options.children ?? []));
  errorBox.hidden = true;
  submit.textContent = options.submitLabel;
  submit.classList.toggle('danger', Boolean(options.destructive));
  submit.classList.toggle('primary', !options.destructive);
  edit = options.onSubmit;
  restoreFocus = () => {
    if (options.opener?.isConnected) return options.opener.focus();
    const equivalent = [...document.querySelectorAll<HTMLButtonElement>('#main button[data-action]')].find(
      ({ dataset }) => dataset.action === options.opener?.dataset.action
        && dataset.section === options.opener?.dataset.section
        && dataset.link === options.opener?.dataset.link,
    );
    (equivalent ?? element('new-link'))?.focus();
  };
  dialog.showModal();
  (fields.querySelector<HTMLElement>('input, select, textarea') ?? form.querySelector<HTMLElement>('[data-action="cancel"]'))?.focus();
}

function openSection(opener: HTMLButtonElement, section?: Section) {
  openEditor({
    title: section ? 'Renombrar sección' : 'Nueva sección',
    submitLabel: section ? 'Guardar cambios' : 'Crear sección',
    children: [textField('Nombre de la sección', 'name', section?.name, 'Ej. Herramientas')],
    opener,
    onSubmit(data) {
      const name = value(data, 'name');
      if (!name) throw new Error('Escribe un nombre para la sección.');
      if (sections.some((item) => item.id !== section?.id && keyFor(item.name) === keyFor(name))) {
        throw new Error('Ya hay una sección con ese nombre.');
      }
      if (section) {
        if (!sections.some(({ id }) => id === section.id)) throw new Error('Esta sección ya no existe.');
        persist(sections.map((item) => item.id === section.id ? { ...item, name } : item));
      } else {
        const id = newId();
        selectedSection = id;
        search.value = '';
        persist([...sections, { id, name, links: [] }]);
      }
      showToast(section ? 'Sección renombrada.' : 'Sección creada.');
    },
  });
}

function openLink(opener: HTMLButtonElement, sectionId?: string, current?: Bookmark) {
  if (!sections.length) return openSection(opener);
  const notes = document.createElement('textarea');
  notes.name = 'note';
  notes.value = current?.note ?? '';
  notes.rows = 3;
  openEditor({
    title: current ? 'Editar marcador' : 'Nuevo marcador',
    submitLabel: current ? 'Guardar cambios' : 'Añadir marcador',
    children: [
      textField('Nombre', 'name', current?.name, 'Ej. Mi blog favorito'),
      textField('Dirección web', 'url', current?.url, 'https://ejemplo.com'),
      selectField('Sección', 'section', sections.map(({ id, name }) => [id, name]), sectionId || selectedSection || sections[0].id),
      field('Nota (opcional)', notes),
    ],
    opener,
    onSubmit(data) {
      const name = value(data, 'name');
      if (!name) throw new Error('Escribe un nombre para el marcador.');
      const url = bookmarkUrl(value(data, 'url'));
      const target = sections.find(({ id }) => id === value(data, 'section'));
      if (!target) throw new Error('Esta sección ya no existe.');
      if (current && !sections.some(({ links }) => links.some(({ id }) => id === current.id))) {
        throw new Error('Este marcador ya no existe.');
      }
      if (target.links.some((link) => link.id !== current?.id && link.url === url)) {
        throw new Error('Esta web ya está guardada en esa sección.');
      }
      const next = { id: current?.id ?? newId(), name, url, note: value(data, 'note') };
      if (selectedSection) selectedSection = target.id;
      search.value = '';
      persist(sections.map((section) => {
        if (section.id === target.id) {
          const links = section.links.some(({ id }) => id === next.id)
            ? section.links.map((link) => link.id === next.id ? next : link)
            : [...section.links, next];
          return { ...section, links };
        }
        return { ...section, links: section.links.filter(({ id }) => id !== next.id) };
      }));
      showToast(current ? 'Marcador actualizado.' : 'Marcador añadido.');
    },
  });
}

function reorderItems<T extends { id: string }>(items: T[], id: string, position: number) {
  const current = items.findIndex((item) => item.id === id);
  if (current < 0 || !Number.isInteger(position) || position < 0 || position >= items.length) {
    throw new Error('La lista ha cambiado. Cierra el formulario y vuelve a intentarlo.');
  }
  const next = [...items];
  const [item] = next.splice(current, 1);
  next.splice(position, 0, item);
  return next;
}

function openReorder(opener: HTMLButtonElement, section: Section, link?: Bookmark) {
  const items = link ? section.links : sections;
  const item = link ?? section;
  const options: [string, string][] = items.map(({ name }, index) => [String(index), `${index + 1}. ${name}`]);
  const current = items.findIndex(({ id }) => id === item.id);
  openEditor({
    title: link ? 'Cambiar posición del marcador' : 'Cambiar posición de la sección',
    intro: link ? `«${link.name}» en «${section.name}».` : `«${section.name}» en la lista de secciones.`,
    submitLabel: 'Guardar posición',
    children: [selectField('Nueva posición', 'position', options, String(current))],
    opener,
    onSubmit(data) {
      const currentSection = sections.find(({ id }) => id === section.id);
      const latest = link ? currentSection?.links : sections;
      if (!latest || latest.length !== items.length || latest.some(({ id }, index) => id !== items[index].id)) {
        throw new Error('La lista ha cambiado. Cierra el formulario y vuelve a intentarlo.');
      }
      const position = Number(value(data, 'position'));
      if (position === current) return;

      if (link && currentSection) {
        const links = reorderItems(currentSection.links, link.id, position);
        persist(sections.map((entry) => entry.id === section.id ? { ...entry, links } : entry));
      } else {
        persist(reorderItems(sections, section.id, position));
      }
      showToast(`«${item.name}» ahora está en la posición ${position + 1}.`);
    },
  });
}

function confirmDelete(opener: HTMLButtonElement, section: Section, link?: Bookmark) {
  const count = section.links.length;
  openEditor({
    title: link ? 'Eliminar marcador' : 'Eliminar sección',
    intro: link
      ? `Se eliminará el marcador «${link.name}».`
      : `Se eliminará la sección «${section.name}»${count ? ` y ${count === 1 ? 'el marcador que contiene' : `sus ${count} marcadores`}` : ''}.`,
    submitLabel: 'Eliminar',
    destructive: true,
    opener,
    onSubmit() {
      persist(link
        ? sections.map((item) => item.id === section.id ? { ...item, links: item.links.filter(({ id }) => id !== link.id) } : item)
        : sections.filter(({ id }) => id !== section.id));
      showToast(link ? 'Marcador eliminado.' : 'Sección eliminada.');
    },
  });
}

function download() {
  const url = URL.createObjectURL(new Blob([exportCsv(sections)], { type: 'text/csv;charset=utf-8' }));
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = 'atajo-marcadores.csv';
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  showToast('Copia CSV descargada.');
}

async function readImportFile(file: File) {
  const buffer = await file.arrayBuffer();
  const bom = new Uint8Array(buffer, 0, Math.min(2, buffer.byteLength));
  if (bom[0] === 0xff && bom[1] === 0xfe) return new TextDecoder('utf-16le').decode(buffer);
  if (bom[0] === 0xfe && bom[1] === 0xff) return new TextDecoder('utf-16be').decode(buffer);
  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(buffer);
  } catch {
    return new TextDecoder('windows-1252').decode(buffer);
  }
}

fileInput.addEventListener('change', async () => {
  const file = fileInput.files?.[0];
  fileInput.value = '';
  if (!file) return;
  try {
    const source = await readImportFile(file);
    const isHtml = /\.html?$/i.test(file.name) || file.type === 'text/html' || /^\s*<!doctype\s+netscape-bookmark-file-1/i.test(source);
    const imported = isHtml ? importBrowserBookmarks(source) : { sections: importCsv(source), skipped: 0 };
    const incoming = imported.sections;
    if (dialog.open) return showToast('Cierra el formulario y vuelve a importar el archivo.');
    const count = incoming.reduce((sum, section) => sum + section.links.length, 0);
    const summary = `${incoming.length} ${incoming.length === 1 ? 'sección' : 'secciones'} y ${count} ${count === 1 ? 'marcador' : 'marcadores'}`;
    const skipped = imported.skipped
      ? ` Se ${imported.skipped === 1 ? 'omitió 1 enlace duplicado o incompatible' : `omitieron ${imported.skipped} enlaces duplicados o incompatibles`}.`
      : '';
    const modeField = selectField('Cómo importar', 'mode', [
      ['merge', 'Añadir a mis marcadores'],
      ['replace', 'Sustituir todos mis marcadores'],
    ], 'merge');
    openEditor({
      title: isHtml ? 'Importar marcadores del navegador' : 'Importar CSV',
      intro: `Se pueden importar ${summary}.${skipped}`,
      submitLabel: 'Importar',
      children: [modeField],
      opener: document.querySelector<HTMLButtonElement>('[data-action="upload"]')!,
      onSubmit(data) {
        const replace = value(data, 'mode') === 'replace';
        selectedSection = '';
        search.value = '';
        persist(replace ? incoming : mergeSections(sections, incoming));
        showToast('Importación completada.');
      },
    });
    modeField.addEventListener('change', () => {
      const replace = modeField.querySelector('select')!.value === 'replace';
      submit.textContent = replace ? 'Sustituir e importar' : 'Importar';
      submit.classList.toggle('danger', replace);
      submit.classList.toggle('primary', !replace);
    });
  } catch (error) {
    showToast(message(error));
  }
});

search.addEventListener('input', renderSections);
thumbnailSetting.checked = showPreviews;
thumbnailSetting.addEventListener('change', () => {
  showPreviews = thumbnailSetting.checked;
  try {
    localStorage.setItem(THUMBNAIL_SETTING, showPreviews ? 'on' : 'off');
  } catch {
    showToast('El navegador no ha podido recordar esta preferencia.');
  }
  renderSections();
});

form.addEventListener('submit', (event) => {
  event.preventDefault();
  errorBox.hidden = true;
  try {
    edit?.(new FormData(form));
    dialog.close();
  } catch (error) {
    errorBox.textContent = message(error);
    errorBox.hidden = false;
  }
});

dialog.addEventListener('close', () => restoreFocus?.());

element('main').addEventListener('click', (event) => {
  const button = (event.target as Element).closest<HTMLButtonElement>('button[data-action]');
  if (!button) return;
  const { action, section: sectionId, link: linkId } = button.dataset;
  const section = sections.find(({ id }) => id === sectionId);
  const link = section?.links.find(({ id }) => id === linkId);

  switch (action) {
    case 'filter':
      selectedSection = sectionId ?? '';
      render();
      [...sectionNav.querySelectorAll('button')].find((item) => item.dataset.section === selectedSection)?.focus();
      break;
    case 'add-section': openSection(button); break;
    case 'edit-section': if (section) openSection(button, section); break;
    case 'reorder-section': if (section) openReorder(button, section); break;
    case 'delete-section': if (section) confirmDelete(button, section); break;
    case 'add-link': openLink(button, sectionId); break;
    case 'edit-link': if (link) openLink(button, sectionId, link); break;
    case 'reorder-link': if (section && link) openReorder(button, section, link); break;
    case 'delete-link': if (section && link) confirmDelete(button, section, link); break;
    case 'upload': fileInput.click(); break;
    case 'download': download(); break;
    case 'cancel': dialog.close(); break;
  }
});

window.addEventListener('storage', (event) => {
  if (event.key === THUMBNAIL_SETTING || event.key === null) {
    showPreviews = thumbnailsEnabled();
    thumbnailSetting.checked = showPreviews;
    if (event.key === THUMBNAIL_SETTING) return renderSections();
  }
  if (event.key !== STORE_KEY && event.key !== null) return;
  try {
    sections = load(event.newValue);
    render();
  } catch {
    notice.hidden = false;
  }
});

render();
document.querySelectorAll<HTMLElement>('[data-ready]').forEach((node) => { node.hidden = false; });

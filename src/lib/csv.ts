import { bookmarkUrl, keyFor, newId, type Section } from './bookmarks';

const header = ['seccion', 'nombre', 'url', 'descripcion', 'tipo'];
const formula = /^[\s\uFEFF]*[=+@-]|^[\t\r\n]/;

function encodeCell(value: string) {
  const safe = value.startsWith("'") || formula.test(value) ? "'" + value : value;
  return '"' + safe.replaceAll('"', '""') + '"';
}

function decodeCell(value: string) {
  return value.startsWith("'") && (value[1] === "'" || formula.test(value.slice(1)))
    ? value.slice(1)
    : value;
}

export function exportCsv(sections: Section[]) {
  const rows = [header];
  for (const section of sections) {
    if (!section.links.length) rows.push([section.name, '', '', '', 'seccion']);
    for (const { name, url, note } of section.links) {
      rows.push([section.name, name, url, note, 'marcador']);
    }
  }
  return '\uFEFF' + rows.map((row) => row.map(encodeCell).join(',')).join('\r\n') + '\r\n';
}

function detectDelimiter(text: string) {
  const counts = new Map([ [',', 0], [';', 0], ['\t', 0] ]);
  let quoted = false;
  for (const char of text) {
    if (char === '"') quoted = !quoted;
    if (quoted) continue;
    if (char === '\n' || char === '\r') break;
    if (counts.has(char)) counts.set(char, counts.get(char)! + 1);
  }
  return [...counts].sort((a, b) => b[1] - a[1])[0][0];
}

function csvRows(text: string, delimiter: string) {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = '';
  let state: 'plain' | 'quoted' | 'closed' = 'plain';

  function endCell() {
    row.push(cell);
    cell = '';
    state = 'plain';
  }

  function endRow() {
    endCell();
    rows.push(row);
    row = [];
  }

  for (let index = 0; index < text.length; index++) {
    const char = text[index];
    if (state === 'quoted') {
      if (char !== '"') {
        cell += char;
      } else if (text[index + 1] === '"') {
        cell += '"';
        index++;
      } else {
        state = 'closed';
      }
    } else if (char === delimiter) {
      endCell();
    } else if (char === '\r' || char === '\n') {
      if (char === '\r' && text[index + 1] === '\n') index++;
      endRow();
    } else if (state === 'closed' && char === ' ') {
      continue;
    } else if (char === '"' && state === 'plain' && !cell.trim()) {
      cell = '';
      state = 'quoted';
    } else if (char === '"' || state === 'closed') {
      throw new Error(`Revisa las comillas de la fila ${rows.length + 1}.`);
    } else {
      cell += char;
    }
  }
  if (state === 'quoted') throw new Error('El CSV contiene un campo con comillas sin cerrar.');
  if (cell || row.length || state === 'closed') endRow();
  return rows;
}

const normalizedHeader = (value: string) => keyFor(value).normalize('NFD').replace(/\p{Diacritic}/gu, '');

export function importCsv(source: string): Section[] {
  let text = source.replace(/^\uFEFF/, '').replace(/^(?:\s*\r?\n)+/, '');
  const directive = text.match(/^sep=([,;\t])\r?\n/i);
  if (directive) text = text.slice(directive[0].length);
  if (!text.trim()) throw new Error('El archivo CSV está vacío.');

  const [columns = [], ...rows] = csvRows(text, directive?.[1] ?? detectDelimiter(text));
  const labels = columns.map(normalizedHeader);
  const find = (...names: string[]) => labels.findIndex((label) => names.includes(label));
  const sectionColumn = find('seccion', 'categoria', 'carpeta', 'section', 'folder', 'category');
  const nameColumn = find('nombre', 'titulo', 'name', 'title');
  const urlColumn = find('url', 'enlace', 'link', 'direccion');
  const noteColumn = find('descripcion', 'nota', 'notas', 'description', 'note', 'notes');
  const typeColumn = find('tipo');
  const ownFormat = header.every((label, index) => labels[index] === label);
  if (sectionColumn < 0 || nameColumn < 0 || urlColumn < 0) {
    throw new Error('El CSV debe incluir las columnas seccion, nombre y url.');
  }

  const sections = new Map<string, Section>();
  const urlsBySection = new Map<string, Set<string>>();

  for (const [index, row] of rows.entries()) {
    if (!row.some((cell) => cell.trim())) continue;
    const get = (column: number) => {
      const cell = (row[column] ?? '').trim();
      return ownFormat ? decodeCell(cell) : cell;
    };
    const sectionName = get(sectionColumn);
    const name = get(nameColumn);
    const address = get(urlColumn);
    const note = get(noteColumn);
    const sectionOnly = !address && !name && !note && (!get(typeColumn) || get(typeColumn) === 'seccion');
    const rowNumber = index + 2;
    if (!sectionName) throw new Error(`Falta la sección en la fila ${rowNumber}.`);
    if (!sectionOnly && (!name || !address)) throw new Error(`Falta el nombre o la URL en la fila ${rowNumber}.`);

    const key = keyFor(sectionName);
    if (!sections.has(key)) {
      sections.set(key, { id: newId(), name: sectionName, links: [] });
      urlsBySection.set(key, new Set());
    }
    if (!sectionOnly) {
      let url: string;
      try {
        url = bookmarkUrl(address);
      } catch {
        throw new Error(`La URL de la fila ${rowNumber} no es válida.`);
      }
      const seen = urlsBySection.get(key)!;
      if (!seen.has(url)) sections.get(key)!.links.push({ id: newId(), name, url, note });
      seen.add(url);
    }
  }
  return [...sections.values()];
}

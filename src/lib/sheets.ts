import Papa from 'papaparse';

const SHEET_NAMES = {
  preguntas: 'Preguntas',
  respuestas: 'Respuestas',
  filtroEspecial: 'Filtro especial',
  grupos: 'Grupos',
  gruposDetalle: 'Grupos a detalles',
  slackId: 'SlackID',
} as const;

export type SheetKey = keyof typeof SHEET_NAMES;

export async function fetchSheetRows(sheetId: string, sheetName: string): Promise<string[][]> {
  const url = `https://docs.google.com/spreadsheets/d/${sheetId}/gviz/tq?tqx=out:csv&sheet=${encodeURIComponent(sheetName)}`;
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`No se pudo leer la hoja "${sheetName}" (HTTP ${res.status}). Verifica que el Sheet esté compartido como "cualquiera con el enlace puede ver".`);
  }
  const csv = await res.text();
  const parsed = Papa.parse<string[]>(csv, { skipEmptyLines: false });
  return parsed.data as string[][];
}

export async function fetchAllSheets(sheetId: string) {
  const entries = await Promise.all(
    (Object.keys(SHEET_NAMES) as SheetKey[]).map(async key => {
      const rows = await fetchSheetRows(sheetId, SHEET_NAMES[key]);
      return [key, rows] as const;
    }),
  );
  return Object.fromEntries(entries) as Record<SheetKey, string[][]>;
}

export function cell(row: string[] | undefined, index: number): string {
  return (row?.[index] ?? '').toString().trim();
}

/** True for the trailing padding rows Google Sheets exports past the real data. */
export function isBlankRow(row: string[] | undefined): boolean {
  return !row || row.every(c => (c ?? '').toString().trim() === '');
}

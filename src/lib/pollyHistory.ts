/**
 * Historial de encuestas Polly (Inicio del día / Cierre del día) importado de
 * "Análisis Polly 2026T 3.xlsx" — snapshot puntual que Angie subió, no una fuente en vivo (no se
 * vuelve a sincronizar sola; para actualizarla hay que repetir la normalización con un export nuevo).
 *
 * Cómo se calculó cada entrada, a partir de la hoja `Calc_Data` del archivo:
 *  - `inicio.average`: promedio de la columna `Respuesta` (0–10, ya normalizada por Polly) en las
 *    filas con Tipo="Inicio" y Respuesta>0 (0 ahí es "no respondió ese día", no una calificación).
 *  - `cierreParticipacion`: el Tipo="Fin" en este archivo es binario (0/1) y refleja solo si hubo
 *    respuesta ese día, no una calificación — por eso aquí solo se reporta participación, no promedio.
 *  - El Tipo="Semanal" no tenía ninguna fila con dato real en este export (siempre 0), así que no se
 *    incluye ningún campo para la encuesta semanal.
 *  - Los nombres del archivo se emparejaron contra el organigrama actual (`orgChart.ts`) por
 *    coincidencia de tokens normalizados (sin acentos, ignorando "de/la/del") — cubre diferencias de
 *    orden y segundos nombres (ej. "David Camhi de la Tejera" ↔ "David Camhi De La Tejera").
 *  - Solo incluye personas que SIGUEN en el equipo (están en `ORG_TEAMS`) y que además ya tenían
 *    correo asignado — quien no aparece aquí simplemente no tenía registros en ese archivo (típicamente
 *    porque entró a Toroto después del periodo que cubre), y `pollyHistoryFor` devuelve null para ellas.
 */
export interface PollyInicioStats {
  /** Promedio 0–10 de las respuestas reales (excluye días sin respuesta). */
  average: number;
  totalResponses: number;
  from: string; // YYYY-MM-DD de la primera respuesta registrada
  to: string; // YYYY-MM-DD de la última respuesta registrada
}

export interface PollyCierreParticipacion {
  /** % de días con respuesta registrada sobre el total de días con encuesta enviada. */
  participationPct: number;
  totalResponses: number;
  from: string;
  to: string;
}

export interface PollyHistoryEntry {
  fullName: string;
  inicio?: PollyInicioStats;
  cierreParticipacion?: PollyCierreParticipacion;
}

const POLLY_HISTORY: Record<string, PollyHistoryEntry> = {
  'david@toroto.mx': {
    fullName: 'David Camhi De La Tejera',
    inicio: { average: 7.93, totalResponses: 29, from: '2024-09-05', to: '2025-06-10' },
    cierreParticipacion: { participationPct: 29.3, totalResponses: 12, from: '2024-07-29', to: '2025-03-12' },
  },
  'alejandro@toroto.mx': {
    fullName: 'Alejandro Morales Heimlich',
    inicio: { average: 8.62, totalResponses: 291, from: '2024-09-10', to: '2026-08-26' },
    cierreParticipacion: { participationPct: 76.7, totalResponses: 231, from: '2024-08-01', to: '2026-05-25' },
  },
  'ana@toroto.mx': {
    fullName: 'Ana Schravesande Illescas',
    inicio: { average: 8.42, totalResponses: 346, from: '2024-09-03', to: '2026-08-27' },
    cierreParticipacion: { participationPct: 84.9, totalResponses: 315, from: '2024-08-01', to: '2026-05-25' },
  },
  'andrea@toroto.mx': {
    fullName: 'Andrea del Rocío Bárcenas García',
    inicio: { average: 8.49, totalResponses: 343, from: '2024-09-03', to: '2026-08-27' },
    cierreParticipacion: { participationPct: 86.5, totalResponses: 334, from: '2024-08-01', to: '2026-05-25' },
  },
  'ane@toroto.mx': {
    fullName: 'Ane Garay Olazabal',
    inicio: { average: 8.14, totalResponses: 253, from: '2025-03-31', to: '2026-08-06' },
    cierreParticipacion: { participationPct: 100.0, totalResponses: 186, from: '2025-04-02', to: '2026-05-25' },
  },
  'aretha@toroto.mx': {
    fullName: 'Aretha Flores González',
    inicio: { average: 9.83, totalResponses: 304, from: '2024-09-25', to: '2026-08-27' },
    cierreParticipacion: { participationPct: 91.9, totalResponses: 194, from: '2024-09-24', to: '2026-05-20' },
  },
  'christian@toroto.mx': {
    fullName: 'Christian Gerardo Leon Moo',
    inicio: { average: 9.11, totalResponses: 203, from: '2024-09-03', to: '2026-08-26' },
    cierreParticipacion: { participationPct: 80.4, totalResponses: 238, from: '2024-08-01', to: '2026-04-30' },
  },
  'dgavaldon@toroto.mx': {
    fullName: 'Daniela Gavaldón Eichelmann',
    inicio: { average: 8.1, totalResponses: 205, from: '2025-04-07', to: '2026-08-27' },
    cierreParticipacion: { participationPct: 97.2, totalResponses: 139, from: '2025-04-28', to: '2026-05-20' },
  },
  'diana@toroto.mx': {
    fullName: 'Diana Laura Lomelí Ramírez',
    inicio: { average: 7.69, totalResponses: 314, from: '2024-09-03', to: '2026-08-26' },
    cierreParticipacion: { participationPct: 84.6, totalResponses: 192, from: '2024-12-12', to: '2026-05-25' },
  },
  'eleazar@toroto.mx': {
    fullName: 'Eleazar Beh Miss',
    inicio: { average: 7.94, totalResponses: 103, from: '2024-09-03', to: '2026-08-27' },
    cierreParticipacion: { participationPct: 69.1, totalResponses: 65, from: '2024-08-01', to: '2026-05-19' },
  },
  'elva@toroto.mx': {
    fullName: 'Elva Leyva Cruz',
    inicio: { average: 9.02, totalResponses: 344, from: '2024-09-03', to: '2026-08-27' },
    cierreParticipacion: { participationPct: 88.9, totalResponses: 352, from: '2024-08-01', to: '2026-05-25' },
  },
  'emiliano@toroto.mx': {
    fullName: 'Emiliano Guijosa Guadarrama',
    inicio: { average: 7.14, totalResponses: 340, from: '2024-09-03', to: '2026-08-27' },
    cierreParticipacion: { participationPct: 76.1, totalResponses: 287, from: '2024-08-01', to: '2026-05-25' },
  },
  'emilianoflores@toroto.mx': {
    fullName: 'José Emiliano Flores Pérez',
    inicio: { average: 10.0, totalResponses: 27, from: '2025-06-05', to: '2025-08-11' },
    cierreParticipacion: { participationPct: 100.0, totalResponses: 20, from: '2025-06-05', to: '2025-10-27' },
  },
  'gilberto@toroto.mx': {
    fullName: 'Gilberto Gonzalez Barrios',
    inicio: { average: 9.97, totalResponses: 346, from: '2024-09-05', to: '2026-08-27' },
    cierreParticipacion: { participationPct: 86.4, totalResponses: 330, from: '2024-08-01', to: '2026-05-25' },
  },
  'guillermina@toroto.mx': {
    fullName: 'Guillermina Viancarlos',
    inicio: { average: 7.47, totalResponses: 316, from: '2024-09-03', to: '2026-08-27' },
    cierreParticipacion: { participationPct: 82.3, totalResponses: 289, from: '2024-08-01', to: '2026-05-25' },
  },
  'helen@toroto.mx': {
    fullName: 'Helen Jacquelinne Hernández Roblero',
    inicio: { average: 9.94, totalResponses: 324, from: '2024-11-12', to: '2026-08-27' },
    cierreParticipacion: { participationPct: 99.7, totalResponses: 310, from: '2024-11-11', to: '2026-05-21' },
  },
  'iris@toroto.mx': {
    fullName: 'Iris Becerra Reyes',
    inicio: { average: 9.39, totalResponses: 314, from: '2024-09-05', to: '2026-08-27' },
    cierreParticipacion: { participationPct: 91.1, totalResponses: 277, from: '2024-09-04', to: '2026-05-22' },
  },
  'ivancastro@toroto.mx': {
    fullName: 'Iván Castro Trujano',
    inicio: { average: 9.19, totalResponses: 334, from: '2024-09-06', to: '2026-08-27' },
    cierreParticipacion: { participationPct: 87.9, totalResponses: 311, from: '2024-08-02', to: '2026-05-25' },
  },
  'jenni@toroto.mx': {
    fullName: 'Jenni Arce López',
    inicio: { average: 9.4, totalResponses: 353, from: '2024-09-03', to: '2026-08-27' },
    cierreParticipacion: { participationPct: 85.1, totalResponses: 338, from: '2024-08-01', to: '2026-05-25' },
  },
  'jose@toroto.mx': {
    fullName: 'José Reyes Sanchez-Cutillas',
    inicio: { average: 7.65, totalResponses: 334, from: '2024-09-10', to: '2026-08-27' },
    cierreParticipacion: { participationPct: 88.4, totalResponses: 343, from: '2024-08-01', to: '2026-05-25' },
  },
  'juan@toroto.mx': {
    fullName: 'Juan Lozano Lázaro',
    inicio: { average: 9.05, totalResponses: 359, from: '2024-09-03', to: '2026-08-27' },
    cierreParticipacion: { participationPct: 87.4, totalResponses: 367, from: '2024-08-01', to: '2026-05-25' },
  },
  'juancarlosg@toroto.mx': {
    fullName: 'Juan Carlos Gallardo Brigido',
    inicio: { average: 6.02, totalResponses: 220, from: '2024-09-03', to: '2026-05-12' },
    cierreParticipacion: { participationPct: 82.0, totalResponses: 259, from: '2024-08-01', to: '2026-05-11' },
  },
  'juanjose@toroto.mx': {
    fullName: 'Juan José Romero Martínez',
    inicio: { average: 8.9, totalResponses: 106, from: '2026-02-05', to: '2026-08-26' },
    cierreParticipacion: { participationPct: 98.1, totalResponses: 53, from: '2026-02-04', to: '2026-05-25' },
  },
  'juanmanuel@toroto.mx': {
    fullName: 'Juan Manuel Cortes Rivas',
    inicio: { average: 10.0, totalResponses: 103, from: '2026-02-02', to: '2026-08-27' },
    cierreParticipacion: { participationPct: 100.0, totalResponses: 49, from: '2026-02-24', to: '2026-05-25' },
  },
  'karen@toroto.mx': {
    fullName: 'Karen Lizeth Caceres Ruiz',
    inicio: { average: 9.46, totalResponses: 231, from: '2024-09-03', to: '2026-08-24' },
    cierreParticipacion: { participationPct: 85.4, totalResponses: 175, from: '2024-07-26', to: '2026-05-25' },
  },
  'karla@toroto.mx': {
    fullName: 'Karla Rebolledo Fernandez',
    inicio: { average: 8.44, totalResponses: 337, from: '2024-09-03', to: '2026-08-27' },
    cierreParticipacion: { participationPct: 82.0, totalResponses: 309, from: '2024-07-29', to: '2026-05-25' },
  },
  'lourdes@toroto.mx': {
    fullName: 'Lourdes Montejo Montejo',
    inicio: { average: 9.29, totalResponses: 368, from: '2024-09-03', to: '2026-08-27' },
    cierreParticipacion: { participationPct: 86.1, totalResponses: 372, from: '2024-08-01', to: '2026-05-25' },
  },
  'luis@toroto.mx': {
    fullName: 'Luis Ortega Arguelles',
    inicio: { average: 8.97, totalResponses: 155, from: '2024-09-10', to: '2026-08-25' },
    cierreParticipacion: { participationPct: 76.7, totalResponses: 135, from: '2024-07-26', to: '2026-01-15' },
  },
  'luisloyde@toroto.mx': {
    fullName: 'Luis Antonio Loyde De La Cruz',
    inicio: { average: 8.85, totalResponses: 273, from: '2025-05-19', to: '2026-08-27' },
    cierreParticipacion: { participationPct: 97.5, totalResponses: 234, from: '2025-05-15', to: '2026-05-25' },
  },
  'mariajose@toroto.mx': {
    fullName: 'María José Moranchel Sánchez',
    inicio: { average: 9.93, totalResponses: 68, from: '2026-05-04', to: '2026-08-27' },
    cierreParticipacion: { participationPct: 100.0, totalResponses: 15, from: '2026-05-04', to: '2026-05-25' },
  },
  'mariokoyoc@toroto.mx': {
    fullName: 'Mario Alberto Koyoc Uc',
    inicio: { average: 9.77, totalResponses: 337, from: '2024-10-25', to: '2026-08-27' },
    cierreParticipacion: { participationPct: 100.0, totalResponses: 349, from: '2024-11-07', to: '2026-05-25' },
  },
  'miguel@toroto.mx': {
    fullName: 'Miguel Angel Garzon Hernandez',
    inicio: { average: 9.38, totalResponses: 312, from: '2024-11-12', to: '2026-08-25' },
    cierreParticipacion: { participationPct: 99.3, totalResponses: 293, from: '2024-11-11', to: '2026-05-22' },
  },
  'nasly@toroto.mx': {
    fullName: 'Nasly Dayana Parra Rodríguez',
    inicio: { average: 8.69, totalResponses: 336, from: '2024-09-03', to: '2026-08-27' },
    cierreParticipacion: { participationPct: 82.3, totalResponses: 270, from: '2024-08-01', to: '2026-05-22' },
  },
  'octabio@toroto.mx': {
    fullName: 'Jenrry Octabio Santiago Alvarez',
    inicio: { average: 7.85, totalResponses: 362, from: '2024-09-03', to: '2026-08-27' },
    cierreParticipacion: { participationPct: 86.6, totalResponses: 369, from: '2024-08-01', to: '2026-05-22' },
  },
  'patricia@toroto.mx': {
    fullName: 'Patricia Mendoza Elizarraras',
    inicio: { average: 7.94, totalResponses: 340, from: '2024-09-03', to: '2026-08-27' },
    cierreParticipacion: { participationPct: 87.8, totalResponses: 337, from: '2024-08-05', to: '2026-05-25' },
  },
  'raul@toroto.mx': {
    fullName: 'Raúl Lucario Benitez',
    inicio: { average: 9.84, totalResponses: 339, from: '2024-09-06', to: '2026-08-24' },
    cierreParticipacion: { participationPct: 89.3, totalResponses: 326, from: '2024-08-09', to: '2026-05-25' },
  },
  'renan@toroto.mx': {
    fullName: 'Renán Gonzalez Hoyos',
    inicio: { average: 9.99, totalResponses: 366, from: '2024-11-12', to: '2026-08-27' },
    cierreParticipacion: { participationPct: 100.0, totalResponses: 338, from: '2024-11-11', to: '2026-05-25' },
  },
  'samantha@toroto.mx': {
    fullName: 'Samantha Ortiz Sanchez',
    inicio: { average: 8.18, totalResponses: 271, from: '2025-03-24', to: '2026-08-27' },
    cierreParticipacion: { participationPct: 98.7, totalResponses: 231, from: '2025-03-24', to: '2026-05-25' },
  },
  'samuel@toroto.mx': {
    fullName: 'Samuel García Carreón',
    inicio: { average: 9.77, totalResponses: 361, from: '2024-09-03', to: '2026-08-27' },
    cierreParticipacion: { participationPct: 87.2, totalResponses: 354, from: '2024-08-01', to: '2026-05-25' },
  },
  'santiago.jimenez@toroto.mx': {
    fullName: 'Adrián Santiago Jiménez Ocampo',
    inicio: { average: 7.79, totalResponses: 329, from: '2024-10-07', to: '2026-08-27' },
    cierreParticipacion: { participationPct: 92.4, totalResponses: 278, from: '2024-10-04', to: '2026-05-19' },
  },
  'santiago@toroto.mx': {
    fullName: 'Santiago Espinosa Harispuru',
    inicio: { average: 8.92, totalResponses: 13, from: '2025-03-24', to: '2026-08-20' },
  },
  'sofiasalas@toroto.mx': {
    fullName: 'Sofia Salas Ungar',
    inicio: { average: 9.09, totalResponses: 76, from: '2026-04-20', to: '2026-08-27' },
    cierreParticipacion: { participationPct: 100.0, totalResponses: 24, from: '2026-04-20', to: '2026-05-25' },
  },
  'valentina@toroto.mx': {
    fullName: 'Valentina Ronzon Cruz',
    inicio: { average: 7.44, totalResponses: 224, from: '2025-06-23', to: '2026-08-27' },
    cierreParticipacion: { participationPct: 85.5, totalResponses: 106, from: '2025-06-23', to: '2026-05-14' },
  },
  'xicotencatl@toroto.mx': {
    fullName: 'Xicotencatl Camacho Coronel',
    inicio: { average: 7.92, totalResponses: 346, from: '2024-09-03', to: '2026-08-27' },
    cierreParticipacion: { participationPct: 85.4, totalResponses: 351, from: '2024-08-01', to: '2026-05-25' },
  },
  'yessica@toroto.mx': {
    fullName: 'Yessica Lyssete Cruz Diaz',
    inicio: { average: 8.94, totalResponses: 126, from: '2024-12-10', to: '2026-08-24' },
    cierreParticipacion: { participationPct: 100.0, totalResponses: 65, from: '2024-12-12', to: '2026-01-08' },
  },
};

/** Reporte histórico Polly de esa persona, o null si no tenía registros en este archivo. */
export function pollyHistoryFor(email: string): PollyHistoryEntry | null {
  return POLLY_HISTORY[email.trim().toLowerCase()] ?? null;
}

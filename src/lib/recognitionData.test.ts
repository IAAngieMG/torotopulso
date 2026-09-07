import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseNominations } from './recognitionData.ts';

const header = ['ID respuesta', 'Fecha y hora', 'Mes reconocimiento', 'Slack ID', 'Nombre de quien responde', 'Email', 'Respuesta libre', 'Origen', 'Estado'];

test('parseNominations descarta la fila EJEMPLO-001 del template', () => {
  const rows = [
    header,
    ['EJEMPLO-001', '06/09/2026 10:00', 'Septiembre 2026', 'UXXXXXXXX', 'Nombre Apellido', 'nombre@toroto.mx', 'Quiero reconocer a [persona] porque [motivo breve].', 'Slack · Reconocimientos Tropa Bot', 'Recibida'],
    ['R-002', '07/09/2026 09:00', 'Septiembre 2026', 'U123', 'Luis Ortega', 'luis@toroto.mx', 'Quiero reconocer a Karen Caceres porque siempre da el extra con el equipo.', 'Slack', 'Recibida'],
    ['', '', '', '', '', '', '', '', ''],
  ];
  const nominations = parseNominations(rows);
  assert.equal(nominations.length, 1);
  assert.equal(nominations[0].id, 'R-002');
  assert.equal(nominations[0].nominatorEmail, 'luis@toroto.mx');
  assert.match(nominations[0].rawText, /Karen Caceres/);
});

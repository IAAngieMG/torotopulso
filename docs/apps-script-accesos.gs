/**
 * Pégalo en el Sheet "Pulso Toroto en tiempo real": Extensiones > Apps Script, borra lo que haya
 * en Code.gs, pega esto, reemplaza CAMBIA_ESTE_SECRETO por una contraseña larga inventada por ti
 * (la misma que le des a Claude para la variable de entorno ACCESS_LOG_SECRET), guarda, y en
 * Implementar > Nueva implementación: tipo "Aplicación web", Ejecutar como "Yo", Quién tiene
 * acceso "Cualquier persona". Copia la URL que te da (termina en /exec) — esa es
 * ACCESS_LOG_WEBHOOK_URL. El secreto es lo único que protege el endpoint (es público por
 * necesidad de Apps Script), así que que sea largo y no lo compartas fuera de Pulso.
 */
function doPost(e) {
  var SECRET = 'CAMBIA_ESTE_SECRETO';

  var data = JSON.parse(e.postData.contents);
  if (data.secret !== SECRET) {
    return ContentService.createTextOutput('forbidden').setMimeType(ContentService.MimeType.TEXT);
  }

  var ss = SpreadsheetApp.getActiveSpreadsheet();

  if (data.sheet === 'brief') {
    var brief = ss.getSheetByName('Brief por líder') || ss.insertSheet('Brief por líder');
    if (brief.getLastRow() === 0) {
      brief.appendRow(['Fecha', 'Nombre', 'Correo', 'Equipo', 'Inicio del día', 'Cierre del día', 'Participación %', 'Red flags activas']);
    }
    data.rows.forEach(function (r) {
      brief.appendRow([r.at, r.name, r.email, r.team, r.bdAverage, r.btAverage, r.participationPct, r.redFlagsCount]);
    });
  } else {
    var accesos = ss.getSheetByName('Accesos') || ss.insertSheet('Accesos');
    if (accesos.getLastRow() === 0) {
      accesos.appendRow(['Fecha', 'Tipo', 'Nombre', 'Correo', 'Vista']);
    }
    data.rows.forEach(function (r) {
      accesos.appendRow([r.at, r.type, r.name, r.email, r.view]);
    });
  }

  return ContentService.createTextOutput('ok').setMimeType(ContentService.MimeType.TEXT);
}

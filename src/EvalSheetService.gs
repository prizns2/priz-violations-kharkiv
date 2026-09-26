/****************************************************************
 * РОБОТА З ЛИСТОМ «ОЦЕНКА»
 * На відміну від «Категория 1/2» тут не було запасних службових
 * колонок — додаємо R сам, при першому зверненні (з заголовком,
 * приховану), за тим самим принципом, що O/P у порушеннях.
 ****************************************************************/

function getEvalSheet_(ss) {
  var sheet = ss.getSheetByName(CONFIG.SHEET_EVAL);
  if (!sheet) throw new Error('Не знайдений лист «' + CONFIG.SHEET_EVAL + '»');

  if (sheet.getMaxColumns() < CONFIG.EVAL_ID_COLUMN) {
    sheet.insertColumnsAfter(sheet.getMaxColumns(), CONFIG.EVAL_ID_COLUMN - sheet.getMaxColumns());
  }

  var header = sheet.getRange(1, CONFIG.EVAL_ID_COLUMN).getValue();
  if (!header) {
    sheet.getRange(1, CONFIG.EVAL_ID_COLUMN).setValue('ID запису (бот)');
    sheet.hideColumns(CONFIG.EVAL_ID_COLUMN);
  }

  return sheet;
}

function findEvalRowById_(sheet, id) {
  var lastRow = sheet.getLastRow();
  if (lastRow < CONFIG.EVAL_FIRST_DATA_ROW) return -1;

  var ids = sheet
    .getRange(CONFIG.EVAL_FIRST_DATA_ROW, CONFIG.EVAL_ID_COLUMN, lastRow - CONFIG.EVAL_FIRST_DATA_ROW + 1, 1)
    .getDisplayValues();

  for (var i = 0; i < ids.length; i++) {
    if (String(ids[i][0]).trim() === id) return CONFIG.EVAL_FIRST_DATA_ROW + i;
  }
  return -1;
}

/** Пише A-H і I-M (бали) та O (коментар). N, P, Q — формули, не чіпаємо. */
function writeEvalRow_(sheet, row, fields) {
  sheet.getRange(row, 1, 1, 8).setValues([[
    CONFIG.REGION, CONFIG.OPERATOR_NAME, fields.date, fields.seller,
    fields.storeName, fields.manager, fields.time, fields.gender
  ]]);
  sheet.getRange(row, 3, 1, 1).setNumberFormat('dd.MM.yyyy');

  sheet.getRange(row, 9, 1, 5).setValues([[
    fields.scores.meeting, fields.scores.needs, fields.scores.extraSales,
    fields.scores.sale, fields.scores.closing
  ]]);

  sheet.getRange(row, 15, 1, 1).setValue(fields.comment);
}

function appendEval_(ss, fields, id) {
  var sheet = getEvalSheet_(ss);
  var lastDataRow = Math.max(sheet.getLastRow(), CONFIG.EVAL_FIRST_DATA_ROW - 1);
  var targetRow = lastDataRow + 1;

  ensureSheetHasRow_(sheet, targetRow);
  var templateRow = lastDataRow >= CONFIG.EVAL_FIRST_DATA_ROW ? lastDataRow : CONFIG.EVAL_FIRST_DATA_ROW;
  prepareNewRow_(sheet, templateRow, targetRow);

  writeEvalRow_(sheet, targetRow, fields);
  sheet.getRange(targetRow, CONFIG.EVAL_ID_COLUMN).setValue(id);
}

function updateEval_(ss, id, fields) {
  var sheet = getEvalSheet_(ss);
  var row = findEvalRowById_(sheet, id);
  if (row < 0) throw new Error('Оцінку не знайдено');
  writeEvalRow_(sheet, row, fields);
}

function deleteEval_(ss, id) {
  var sheet = getEvalSheet_(ss);
  var row = findEvalRowById_(sheet, id);
  if (row < 0) throw new Error('Оцінку не знайдено');
  sheet.deleteRow(row);
}

function listOwnEvals_(ss) {
  var sheet = getEvalSheet_(ss);
  var lastRow = sheet.getLastRow();
  if (lastRow < CONFIG.EVAL_FIRST_DATA_ROW) return [];

  var rowCount = lastRow - CONFIG.EVAL_FIRST_DATA_ROW + 1;
  var values = sheet
    .getRange(CONFIG.EVAL_FIRST_DATA_ROW, 1, rowCount, CONFIG.EVAL_ID_COLUMN)
    .getDisplayValues();

  var out = [];
  for (var i = 0; i < values.length; i++) {
    var id = String(values[i][CONFIG.EVAL_ID_COLUMN - 1] || '').trim();
    if (id.indexOf(CONFIG.RECORD_ID_PREFIX) !== 0) continue;

    var storeName = values[i][4];
    var storeMatch = storeName.match(/^(\d{1,3})\b/);

    out.push({
      id: id,
      date: values[i][2],
      seller: values[i][3],
      storeCode: storeMatch ? storeMatch[1].padStart(3, '0') : '',
      storeName: storeName,
      manager: values[i][5],
      time: values[i][6],
      gender: values[i][7],
      meeting: values[i][8],
      needs: values[i][9],
      extraSales: values[i][10],
      sale: values[i][11],
      closing: values[i][12],
      comment: values[i][14]
    });
  }

  out.sort(function (a, b) { return a.date < b.date ? 1 : a.date > b.date ? -1 : 0; });
  return out;
}

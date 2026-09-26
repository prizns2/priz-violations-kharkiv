/****************************************************************
 * РОБОТА З ГУГЛ ТАБЛИЦЕЮ
 * Логіка запису/сортування повторює appendRecordsBatch_ зі старого
 * бота «Вносит нарушения Харькова» — щоб не ламати спільну таблицю.
 ****************************************************************/

function getSpreadsheet_() {
  return SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID);
}

function getCategorySheet_(ss, category) {
  var name = category === 1 ? CONFIG.SHEET_CATEGORY_1 : CONFIG.SHEET_CATEGORY_2;
  var sheet = ss.getSheetByName(name);
  if (!sheet) throw new Error('Не знайдений лист «' + name + '»');
  return sheet;
}

function getStoreMap_(ss) {
  var sheet = ss.getSheetByName(CONFIG.STORE_REFERENCE_SHEET);
  if (!sheet) throw new Error('Не знайдений лист «' + CONFIG.STORE_REFERENCE_SHEET + '»');
  var lastRow = sheet.getLastRow();
  if (lastRow < CONFIG.STORE_REFERENCE_FIRST_ROW) return {};

  var values = sheet
    .getRange(CONFIG.STORE_REFERENCE_FIRST_ROW, CONFIG.STORE_REFERENCE_COLUMN,
      lastRow - CONFIG.STORE_REFERENCE_FIRST_ROW + 1, 2)
    .getDisplayValues();

  var map = {};
  for (var i = 0; i < values.length; i++) {
    var fullName = String(values[i][0] || '').trim();
    var manager = String(values[i][1] || '').trim();
    if (!fullName) continue;
    var m = fullName.match(/^(\d{1,3})\b/);
    if (!m) continue;
    var code = m[1].padStart(3, '0');
    map[code] = { code: code, name: fullName, manager: manager };
  }
  return map;
}

function getStoreList_() {
  var map = getStoreMap_(getSpreadsheet_());
  return Object.keys(map).sort().map(function (k) { return map[k]; });
}

function generateRecordId_() {
  return CONFIG.RECORD_ID_PREFIX + Utilities.getUuid();
}

function todayKyiv_() {
  var now = new Date();
  var tz = CONFIG.TIMEZONE;
  var y = Number(Utilities.formatDate(now, tz, 'yyyy'));
  var m = Number(Utilities.formatDate(now, tz, 'MM'));
  var d = Number(Utilities.formatDate(now, tz, 'dd'));
  return new Date(y, m - 1, d);
}

function findRowById_(sheet, id) {
  var lastRow = sheet.getLastRow();
  if (lastRow < CONFIG.FIRST_DATA_ROW) return -1;
  var ids = sheet
    .getRange(CONFIG.FIRST_DATA_ROW, CONFIG.RECORD_ID_COLUMN, lastRow - CONFIG.FIRST_DATA_ROW + 1, 1)
    .getDisplayValues();
  for (var i = 0; i < ids.length; i++) {
    if (String(ids[i][0]).trim() === id) return CONFIG.FIRST_DATA_ROW + i;
  }
  return -1;
}

function findRecordAnyCategory_(ss, id) {
  var s1 = getCategorySheet_(ss, 1);
  var row = findRowById_(s1, id);
  if (row > 0) return { sheet: s1, row: row, category: 1 };

  var s2 = getCategorySheet_(ss, 2);
  row = findRowById_(s2, id);
  if (row > 0) return { sheet: s2, row: row, category: 2 };

  return null;
}

function ensureSheetHasRow_(sheet, requiredRow) {
  var maxRows = sheet.getMaxRows();
  if (requiredRow > maxRows) sheet.insertRowsAfter(maxRows, requiredRow - maxRows);
}

/** Копирует формат и валидацию с шаблонной строки — как prepareNewRows_ в старом боте */
function prepareNewRow_(sheet, templateRow, targetRow) {
  var lastColumn = Math.max(sheet.getLastColumn(), CONFIG.STORE_SORT_COLUMN);
  var target = sheet.getRange(targetRow, 1, 1, lastColumn);
  target.clearContent();

  var source = sheet.getRange(templateRow, 1, 1, lastColumn);
  source.copyTo(target, SpreadsheetApp.CopyPasteType.PASTE_FORMAT, false);
  source.copyTo(target, SpreadsheetApp.CopyPasteType.PASTE_DATA_VALIDATION, false);

  sheet.setRowHeight(targetRow, sheet.getRowHeight(templateRow));
}

/** Сортировка по B (дата), затем P (числовой номер ТТ) — как в старом боте */
function sortSheet_(sheet) {
  var lastRow = sheet.getLastRow();
  if (lastRow < CONFIG.FIRST_DATA_ROW) return;
  var rowCount = lastRow - CONFIG.FIRST_DATA_ROW + 1;
  var lastColumn = Math.max(sheet.getLastColumn(), CONFIG.STORE_SORT_COLUMN);

  sheet.getRange(CONFIG.FIRST_DATA_ROW, 1, rowCount, lastColumn).sort([
    { column: 2, ascending: true },
    { column: CONFIG.STORE_SORT_COLUMN, ascending: true }
  ]);
}

/**
 * Пишет A-E, F-H і (для кат.1) I-L. M, N бот не трогает — як старий бот.
 * K — відшкодовано покупцю (магазин повернув гроші за обсчет),
 * L — відшкодовано магазину (покупець доплатив і закрив недостачу).
 */
function writeRowFields_(sheet, row, fields, category) {
  sheet.getRange(row, 1, 1, 5).setValues([[
    CONFIG.REGION, fields.date, CONFIG.OPERATOR_NAME, fields.storeName, fields.manager
  ]]);
  sheet.getRange(row, 2, 1, 1).setNumberFormat('dd.MM.yyyy');

  sheet.getRange(row, 6, 1, 3).setValues([[
    fields.violation, fields.employeeName, fields.fabula
  ]]);

  if (category === 1) {
    sheet.getRange(row, 9, 1, 4).setValues([[
      numOrBlank_(fields.customerDamage),
      numOrBlank_(fields.storeDamage),
      numOrBlank_(fields.reimbursedCustomer),
      numOrBlank_(fields.reimbursedStore)
    ]]);
  }
}

function numOrBlank_(v) {
  return (v === null || v === undefined || v === '') ? '' : v;
}

function appendRecord_(ss, category, fields, id) {
  var sheet = getCategorySheet_(ss, category);
  var lastDataRow = Math.max(sheet.getLastRow(), CONFIG.FIRST_DATA_ROW - 1);
  var targetRow = lastDataRow + 1;

  ensureSheetHasRow_(sheet, targetRow);
  var templateRow = lastDataRow >= CONFIG.FIRST_DATA_ROW ? lastDataRow : CONFIG.FIRST_DATA_ROW;
  prepareNewRow_(sheet, templateRow, targetRow);

  writeRowFields_(sheet, targetRow, fields, category);
  sheet.getRange(targetRow, CONFIG.RECORD_ID_COLUMN, 1, 2).setValues([[id, Number(fields.storeCode)]]);

  sortSheet_(sheet);
}

/**
 * Пакетна вставка кількох записів однієї категорії за один прохід:
 * один clearContent/copyTo на весь діапазон, один setValues на колонку,
 * одне сортування в кінці — як appendRecordsBatch_ у старому боте.
 * records: [{ fields, id }]
 */
function appendRecordsBatch_(ss, category, records) {
  if (!records || !records.length) return;

  var sheet = getCategorySheet_(ss, category);
  var lastDataRow = Math.max(sheet.getLastRow(), CONFIG.FIRST_DATA_ROW - 1);
  var startRow = lastDataRow + 1;
  var requiredLastRow = startRow + records.length - 1;

  ensureSheetHasRow_(sheet, requiredLastRow);

  var templateRow = lastDataRow >= CONFIG.FIRST_DATA_ROW ? lastDataRow : CONFIG.FIRST_DATA_ROW;
  var lastColumn = Math.max(sheet.getLastColumn(), CONFIG.STORE_SORT_COLUMN);

  var targetRange = sheet.getRange(startRow, 1, records.length, lastColumn);
  targetRange.clearContent();

  var sourceRange = sheet.getRange(templateRow, 1, 1, lastColumn);
  sourceRange.copyTo(targetRange, SpreadsheetApp.CopyPasteType.PASTE_FORMAT, false);
  sourceRange.copyTo(targetRange, SpreadsheetApp.CopyPasteType.PASTE_DATA_VALIDATION, false);

  var rowHeight = sheet.getRowHeight(templateRow);
  for (var i = 0; i < records.length; i++) sheet.setRowHeight(startRow + i, rowHeight);

  var valuesAE = records.map(function (r) {
    return [CONFIG.REGION, r.fields.date, CONFIG.OPERATOR_NAME, r.fields.storeName, r.fields.manager];
  });
  sheet.getRange(startRow, 1, records.length, 5).setValues(valuesAE);
  sheet.getRange(startRow, 2, records.length, 1).setNumberFormat('dd.MM.yyyy');

  var valuesFH = records.map(function (r) {
    return [r.fields.violation, r.fields.employeeName, r.fields.fabula];
  });
  sheet.getRange(startRow, 6, records.length, 3).setValues(valuesFH);

  if (category === 1) {
    var valuesIJKL = records.map(function (r) {
      return [
        numOrBlank_(r.fields.customerDamage),
        numOrBlank_(r.fields.storeDamage),
        numOrBlank_(r.fields.reimbursedCustomer),
        numOrBlank_(r.fields.reimbursedStore)
      ];
    });
    sheet.getRange(startRow, 9, records.length, 4).setValues(valuesIJKL);
  }

  var serviceValues = records.map(function (r) {
    return [r.id, Number(r.fields.storeCode)];
  });
  sheet.getRange(startRow, CONFIG.RECORD_ID_COLUMN, records.length, 2).setValues(serviceValues);

  sortSheet_(sheet);
}

function updateRecord_(ss, id, fields) {
  var found = findRecordAnyCategory_(ss, id);
  if (!found) throw new Error('Запис не знайдено');

  if (found.category !== fields.category) {
    found.sheet.deleteRow(found.row);
    appendRecord_(ss, fields.category, fields, id);
    return;
  }

  writeRowFields_(found.sheet, found.row, fields, fields.category);
  found.sheet.getRange(found.row, CONFIG.STORE_SORT_COLUMN, 1, 1).setValues([[Number(fields.storeCode)]]);
  sortSheet_(found.sheet);
}

function deleteRecord_(ss, id) {
  var found = findRecordAnyCategory_(ss, id);
  if (!found) throw new Error('Запис не знайдено');
  found.sheet.deleteRow(found.row);
}

function listOwnRecords_(ss) {
  var out = [];

  [1, 2].forEach(function (category) {
    var sheet = getCategorySheet_(ss, category);
    var lastRow = sheet.getLastRow();
    if (lastRow < CONFIG.FIRST_DATA_ROW) return;

    var rowCount = lastRow - CONFIG.FIRST_DATA_ROW + 1;
    var values = sheet
      .getRange(CONFIG.FIRST_DATA_ROW, 1, rowCount, CONFIG.RECORD_ID_COLUMN)
      .getDisplayValues();

    for (var i = 0; i < values.length; i++) {
      var id = String(values[i][CONFIG.RECORD_ID_COLUMN - 1] || '').trim();
      if (id.indexOf(CONFIG.RECORD_ID_PREFIX) !== 0) continue;

      var storeName = values[i][3];
      var storeMatch = storeName.match(/^(\d{1,3})\b/);

      out.push({
        id: id,
        category: category,
        date: values[i][1],
        storeCode: storeMatch ? storeMatch[1].padStart(3, '0') : '',
        storeName: storeName,
        manager: values[i][4],
        violation: values[i][5],
        employeeName: values[i][6],
        fabula: values[i][7],
        customerDamage: category === 1 ? values[i][8] : '',
        storeDamage: category === 1 ? values[i][9] : '',
        reimbursedCustomer: category === 1 ? values[i][10] : '',
        reimbursedStore: category === 1 ? values[i][11] : ''
      });
    }
  });

  out.sort(function (a, b) { return a.date < b.date ? 1 : a.date > b.date ? -1 : 0; });
  return out;
}

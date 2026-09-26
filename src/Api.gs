/****************************************************************
 * ТОЧКИ ВХОДУ ДЛЯ MINI APP (google.script.run)
 * Кожна функція перевіряє initData і власника перед дією.
 ****************************************************************/

function logError_(ss, type, details, user, payload) {
  try {
    var sheet = ss.getSheetByName(CONFIG.ERROR_SHEET);
    if (!sheet) {
      sheet = ss.insertSheet(CONFIG.ERROR_SHEET);
      sheet.getRange(1, 1, 1, 7).setValues([[
        'Дата', 'Тип помилки', 'Деталі', 'Telegram ID', 'Відправник', 'Повідомлення', 'Статус'
      ]]);
      sheet.setFrozenRows(1);
    }
    sheet.appendRow([
      new Date(), type, details,
      user ? String(user.id) : '',
      user ? ((user.first_name || '') + (user.username ? ' (@' + user.username + ')' : '')) : '',
      payload ? JSON.stringify(payload) : '',
      'Не оброблено'
    ]);
    sheet.getRange(sheet.getLastRow(), 1).setNumberFormat('dd.MM.yyyy HH:mm:ss');
  } catch (e) {
    // логирование ошибок — последний рубеж, тут падать уже некуда
  }
}

function api_bootstrap(initDataRaw) {
  try {
    verifyInitData_(initDataRaw);
    return {
      ok: true,
      operatorName: CONFIG.OPERATOR_NAME,
      storeList: getStoreList_(),
      category1: CATEGORY_1,
      category2: CATEGORY_2
    };
  } catch (e) {
    return { ok: false, error: String(e.message || e) };
  }
}

function api_parseText(initDataRaw, text) {
  try {
    verifyInitData_(initDataRaw);
    var parsed = parseViolationText(text);
    var storeMap = getStoreMap_(getSpreadsheet_());
    var store = parsed.ttNumber ? storeMap[parsed.ttNumber] : null;

    return {
      ok: true,
      ttNumber: parsed.ttNumber,
      storeName: store ? store.name : '',
      manager: store ? store.manager : '',
      storeFound: !!store,
      employeeName: parsed.employeeName,
      fabula: parsed.fabula,
      category: parsed.category,
      violation: parsed.violation,
      alternatives: parsed.alternatives,
      customerDamage: parsed.customerDamage,
      storeDamage: parsed.storeDamage,
      reimbursed: parsed.reimbursed,
      warnings: parsed.warnings
    };
  } catch (e) {
    return { ok: false, error: String(e.message || e) };
  }
}

function validatePayload_(payload) {
  if (!payload || !payload.storeCode) throw new Error('Не вказано ТТ');
  if (!payload.employeeName) throw new Error('Не вказано ПІБ співробітника');
  if (payload.category !== 1 && payload.category !== 2) throw new Error('Не вказана категорія порушення');
  if (!payload.violation) throw new Error('Не вказаний тип порушення');
  if (!payload.fabula) throw new Error('Не вказана фабула');
}

function buildFields_(payload) {
  var storeMap = getStoreMap_(getSpreadsheet_());
  var store = storeMap[payload.storeCode];
  if (!store) throw new Error('ТТ ' + payload.storeCode + ' не знайдена у довіднику «Пример»');

  return {
    date: todayKyiv_(),
    storeName: store.name,
    storeCode: store.code,
    manager: store.manager,
    violation: payload.violation,
    employeeName: payload.employeeName,
    fabula: payload.fabula,
    customerDamage: payload.customerDamage !== undefined && payload.customerDamage !== '' ? Number(payload.customerDamage) : null,
    storeDamage: payload.storeDamage !== undefined && payload.storeDamage !== '' ? Number(payload.storeDamage) : null,
    reimbursed: payload.reimbursed !== undefined && payload.reimbursed !== '' ? Number(payload.reimbursed) : null
  };
}

function api_submit(initDataRaw, payload) {
  var ss = getSpreadsheet_();
  var user = null;
  try {
    user = verifyInitData_(initDataRaw);
    validatePayload_(payload);
    var id = generateRecordId_();
    var fields = buildFields_(payload);
    appendRecord_(ss, payload.category, fields, id);
    return { ok: true, id: id };
  } catch (e) {
    logError_(ss, 'Помилка внесення запису', String(e.message || e), user, payload);
    return { ok: false, error: String(e.message || e) };
  }
}

function api_listMine(initDataRaw) {
  try {
    verifyInitData_(initDataRaw);
    return { ok: true, records: listOwnRecords_(getSpreadsheet_()) };
  } catch (e) {
    return { ok: false, error: String(e.message || e) };
  }
}

function api_updateRecord(initDataRaw, id, payload) {
  var ss = getSpreadsheet_();
  var user = null;
  try {
    user = verifyInitData_(initDataRaw);
    validatePayload_(payload);
    var fields = buildFields_(payload);
    fields.category = payload.category;
    updateRecord_(ss, id, fields);
    return { ok: true };
  } catch (e) {
    logError_(ss, 'Помилка редагування запису', String(e.message || e), user, payload);
    return { ok: false, error: String(e.message || e) };
  }
}

function api_deleteRecord(initDataRaw, id) {
  var ss = getSpreadsheet_();
  var user = null;
  try {
    user = verifyInitData_(initDataRaw);
    deleteRecord_(ss, id);
    return { ok: true };
  } catch (e) {
    logError_(ss, 'Помилка видалення запису', String(e.message || e), user, { id: id });
    return { ok: false, error: String(e.message || e) };
  }
}

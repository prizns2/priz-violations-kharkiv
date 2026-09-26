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
      reimbursedCustomer: parsed.reimbursedCustomer,
      reimbursedStore: parsed.reimbursedStore,
      warnings: parsed.warnings
    };
  } catch (e) {
    return { ok: false, error: String(e.message || e) };
  }
}

/** Розбиває текст на кілька нарушень за порожнім рядком і розбирає кожне окремо. */
function api_parseBulk(initDataRaw, text) {
  try {
    verifyInitData_(initDataRaw);
    var storeMap = getStoreMap_(getSpreadsheet_());
    var chunks = String(text || '').split(/\n\s*\n+/).map(function (s) { return s.trim(); }).filter(Boolean);

    var items = chunks.map(function (chunk) {
      var parsed = parseViolationText(chunk);
      var store = parsed.ttNumber ? storeMap[parsed.ttNumber] : null;
      return {
        raw: chunk,
        ttNumber: parsed.ttNumber,
        storeCode: store ? store.code : '',
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
        reimbursedCustomer: parsed.reimbursedCustomer,
        reimbursedStore: parsed.reimbursedStore,
        warnings: parsed.warnings,
        clean: parsed.warnings.length === 0 && !!store
      };
    });

    return { ok: true, items: items };
  } catch (e) {
    return { ok: false, error: String(e.message || e) };
  }
}

/** Пакетний запис — тільки записи без попереджень власник підтверджує одним натисканням. */
function api_submitBulk(initDataRaw, items) {
  var ss = getSpreadsheet_();
  var user = null;
  try {
    user = verifyInitData_(initDataRaw);
    var byCategory = { 1: [], 2: [] };
    var results = [];

    (items || []).forEach(function (item, idx) {
      try {
        validatePayload_(item);
        var fields = buildFields_(item);
        var id = generateRecordId_();
        byCategory[item.category].push({ fields: fields, id: id });
        results.push({ index: idx, ok: true, id: id });
      } catch (e) {
        results.push({ index: idx, ok: false, error: String(e.message || e) });
      }
    });

    if (byCategory[1].length) appendRecordsBatch_(ss, 1, byCategory[1]);
    if (byCategory[2].length) appendRecordsBatch_(ss, 2, byCategory[2]);
    invalidateLists_();

    return { ok: true, results: results };
  } catch (e) {
    logError_(ss, 'Помилка масового внесення', String(e.message || e), user, { count: (items || []).length });
    return { ok: false, error: String(e.message || e) };
  }
}

function validatePayload_(payload) {
  if (!payload || !payload.storeCode) throw new Error('Не указана ТТ');
  if (!payload.employeeName) throw new Error('Не указано ФИО сотрудника');
  if (payload.category !== 1 && payload.category !== 2) throw new Error('Не указана категория нарушения');
  if (!payload.violation) throw new Error('Не указан тип нарушения');
  if (!payload.fabula) throw new Error('Не указана фабула');
}

function buildFields_(payload) {
  var storeMap = getStoreMap_(getSpreadsheet_());
  var store = storeMap[payload.storeCode];
  if (!store) throw new Error('ТТ ' + payload.storeCode + ' не найдена в справочнике «Пример»');

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
    reimbursedCustomer: payload.reimbursedCustomer !== undefined && payload.reimbursedCustomer !== '' ? Number(payload.reimbursedCustomer) : null,
    reimbursedStore: payload.reimbursedStore !== undefined && payload.reimbursedStore !== '' ? Number(payload.reimbursedStore) : null
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
    invalidateLists_();
    return { ok: true, id: id };
  } catch (e) {
    logError_(ss, 'Помилка внесення запису', String(e.message || e), user, payload);
    return { ok: false, error: String(e.message || e) };
  }
}

/** Кеш списків на 5 хв.; будь-який наш запис/правка/видалення скидає його. */
function cachedList_(key, compute) {
  var cache = CacheService.getScriptCache();
  var hit = cache.get(key);
  if (hit) return JSON.parse(hit);
  var value = compute();
  try { cache.put(key, JSON.stringify(value), 300); } catch (e) { /* завеликий для кешу — не критично */ }
  return value;
}

function invalidateLists_() {
  CacheService.getScriptCache().removeAll(['list_recs', 'list_evals']);
}

function api_listMine(initDataRaw) {
  try {
    verifyInitData_(initDataRaw);
    return { ok: true, records: cachedList_('list_recs', function () { return listOwnRecords_(getSpreadsheet_()); }) };
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
    invalidateLists_();
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
    invalidateLists_();
    return { ok: true };
  } catch (e) {
    logError_(ss, 'Помилка видалення запису', String(e.message || e), user, { id: id });
    return { ok: false, error: String(e.message || e) };
  }
}

/****************************************************************
 * ОЦІНКА ОБСЛУГОВУВАННЯ
 ****************************************************************/

function validateEvalPayload_(payload) {
  if (!payload || !payload.storeCode) throw new Error('Не указана ТТ');
  if (!payload.seller) throw new Error('Не указан продавец');
  if (!payload.comment) throw new Error('Не указан комментарий');
}

function buildEvalFields_(payload) {
  var storeMap = getStoreMap_(getSpreadsheet_());
  var store = storeMap[payload.storeCode];
  if (!store) throw new Error('ТТ ' + payload.storeCode + ' не найдена в справочнике «Пример»');

  return {
    date: todayKyiv_(),
    storeName: store.name,
    storeCode: store.code,
    manager: store.manager,
    seller: payload.seller,
    time: payload.time || '',
    gender: payload.gender || '',
    comment: payload.comment,
    scores: detectEvalScores_(payload.comment)
  };
}

function api_submitEval(initDataRaw, payload) {
  var ss = getSpreadsheet_();
  var user = null;
  try {
    user = verifyInitData_(initDataRaw);
    validateEvalPayload_(payload);
    var id = generateRecordId_();
    var fields = buildEvalFields_(payload);
    appendEval_(ss, fields, id);
    invalidateLists_();
    return { ok: true, id: id, scores: fields.scores };
  } catch (e) {
    logError_(ss, 'Помилка внесення оцінки', String(e.message || e), user, payload);
    return { ok: false, error: String(e.message || e) };
  }
}

function api_listMyEvals(initDataRaw) {
  try {
    verifyInitData_(initDataRaw);
    return { ok: true, records: cachedList_('list_evals', function () { return listOwnEvals_(getSpreadsheet_()); }) };
  } catch (e) {
    return { ok: false, error: String(e.message || e) };
  }
}

function api_updateEval(initDataRaw, id, payload) {
  var ss = getSpreadsheet_();
  var user = null;
  try {
    user = verifyInitData_(initDataRaw);
    validateEvalPayload_(payload);
    var fields = buildEvalFields_(payload);
    updateEval_(ss, id, fields);
    invalidateLists_();
    return { ok: true, scores: fields.scores };
  } catch (e) {
    logError_(ss, 'Помилка редагування оцінки', String(e.message || e), user, payload);
    return { ok: false, error: String(e.message || e) };
  }
}

function api_deleteEval(initDataRaw, id) {
  var ss = getSpreadsheet_();
  var user = null;
  try {
    user = verifyInitData_(initDataRaw);
    deleteEval_(ss, id);
    invalidateLists_();
    return { ok: true };
  } catch (e) {
    logError_(ss, 'Помилка видалення оцінки', String(e.message || e), user, { id: id });
    return { ok: false, error: String(e.message || e) };
  }
}

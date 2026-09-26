(function () {
  'use strict';

  var API_URL = 'https://script.google.com/macros/s/AKfycbzv-tzr18zzcxzixppgyDm26FbR4rIE4cffIEFp8HgtoeDfaf2Wqwcmej1J_-s3au8_zg/exec';

  var pendingCalls = 0;

  function callDone() {
    pendingCalls--;
    if (!pendingCalls) document.body.classList.remove('busy');
  }

  /* Пока идёт любой запрос — сверху бежит полоска загрузки. */
  function callApi(fn, args, silent) {
    if (!silent) {
      pendingCalls++;
      document.body.classList.add('busy');
    }
    return fetch(API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify({ fn: fn, args: args })
    }).then(function (r) { return r.json(); }).then(
      function (v) { if (!silent) callDone(); return v; },
      function (e) { if (!silent) callDone(); throw e; }
    );
  }

  /* Кнопка на время запроса: крутилка, другой текст, блокировка. */
  function setLoading(btn, loadingText, on) {
    if (on) {
      btn.dataset.label = btn.textContent;
      btn.textContent = loadingText;
      btn.disabled = true;
      btn.classList.add('loading');
    } else {
      btn.textContent = btn.dataset.label || btn.textContent;
      btn.disabled = false;
      btn.classList.remove('loading');
    }
  }

  var tg = window.Telegram && window.Telegram.WebApp;
  var initData = tg ? tg.initData : '';

  if (tg) {
    tg.ready();
    tg.expand();
  }

  (function setGreeting() {
    var h = new Date().getHours();
    var text = h < 6 ? 'Доброй ночи' : h < 12 ? 'Доброе утро' : h < 18 ? 'Добрый день' : 'Добрый вечер';
    var el = document.getElementById('greeting-text');
    if (el) el.textContent = text;
  })();

  function debugInfo_() {
    if (!tg) return 'window.Telegram.WebApp отсутствует (скрипт telegram-web-app.js не загрузился)';
    return 'platform=' + tg.platform + ' version=' + tg.version +
      ' initData.length=' + (tg.initData || '').length +
      ' initDataUnsafe.user=' + JSON.stringify(tg.initDataUnsafe && tg.initDataUnsafe.user);
  }

  var state = {
    storeList: [],
    category1: [],
    category2: [],
    editingId: null,
    bulkItems: [],
    evalEditingId: null
  };

  var els = {
    tabs: document.querySelectorAll('.tab-btn'),
    screens: {
      add: document.getElementById('screen-add'),
      bulk: document.getElementById('screen-bulk'),
      eval: document.getElementById('screen-eval'),
      list: document.getElementById('screen-list')
    },
    evalStoreInput: document.getElementById('eval-store-input'),
    evalStoreList: document.getElementById('eval-store-list'),
    evalManagerInput: document.getElementById('eval-manager-input'),
    evalSellerInput: document.getElementById('eval-seller-input'),
    evalTimeInput: document.getElementById('eval-time-input'),
    evalGenderSelect: document.getElementById('eval-gender-select'),
    evalCommentInput: document.getElementById('eval-comment-input'),
    evalSubmitBtn: document.getElementById('eval-submit-btn'),
    evalCancelEditBtn: document.getElementById('eval-cancel-edit-btn'),
    evalFormTitle: document.getElementById('eval-form-title'),
    evalRecordsContainer: document.getElementById('eval-records-container'),
    bulkText: document.getElementById('bulk-text'),
    bulkParseBtn: document.getElementById('bulk-parse-btn'),
    bulkResults: document.getElementById('bulk-results'),
    bulkSubmitBtn: document.getElementById('bulk-submit-btn'),
    rawText: document.getElementById('raw-text'),
    parseBtn: document.getElementById('parse-btn'),
    storeInput: document.getElementById('store-input'),
    storeList: document.getElementById('store-list'),
    storeField: document.getElementById('field-store'),
    storeNote: document.getElementById('store-note'),
    managerInput: document.getElementById('manager-input'),
    employeeField: document.getElementById('field-employee'),
    employeeInput: document.getElementById('employee-input'),
    fabulaField: document.getElementById('field-fabula'),
    fabulaInput: document.getElementById('fabula-input'),
    violationField: document.getElementById('field-violation'),
    violationSelect: document.getElementById('violation-select'),
    violationNote: document.getElementById('violation-note'),
    violationChips: document.getElementById('violation-chips'),
    damageBlock: document.getElementById('damage-block'),
    damageCustomer: document.getElementById('damage-customer'),
    damageStore: document.getElementById('damage-store'),
    damageReimbursedCustomer: document.getElementById('damage-reimbursed-customer'),
    damageReimbursedStore: document.getElementById('damage-reimbursed-store'),
    submitBtn: document.getElementById('submit-btn'),
    cancelEditBtn: document.getElementById('cancel-edit-btn'),
    recordsContainer: document.getElementById('records-container'),
    toast: document.getElementById('toast')
  };

  var selectedStore = null;

  function showToast(text) {
    els.toast.textContent = text;
    els.toast.classList.add('show');
    setTimeout(function () { els.toast.classList.remove('show'); }, 2200);
  }

  function clearWarnings() {
    ['storeField', 'employeeField', 'fabulaField', 'violationField'].forEach(function (k) {
      els[k].classList.remove('warn');
    });
    els.storeNote.classList.add('hidden');
    els.violationNote.classList.add('hidden');
    els.violationChips.classList.add('hidden');
    els.violationChips.innerHTML = '';
  }

  function switchTab(name) {
    els.tabs.forEach(function (btn) {
      btn.classList.toggle('active', btn.dataset.screen === name);
    });
    Object.keys(els.screens).forEach(function (key) {
      els.screens[key].classList.toggle('active', key === name);
    });
    if (name === 'list') loadRecords();
    if (name === 'eval') loadEvals();
  }

  els.tabs.forEach(function (btn) {
    btn.addEventListener('click', function () { switchTab(btn.dataset.screen); });
  });

  /* ---------- combobox ТТ ---------- */

  function renderStoreList(query) {
    var q = (query || '').trim().toLowerCase();
    var matches = state.storeList.filter(function (s) {
      return !q || s.code.indexOf(q) === 0 || s.name.toLowerCase().indexOf(q) !== -1;
    }).slice(0, 30);

    els.storeList.innerHTML = '';
    matches.forEach(function (s) {
      var item = document.createElement('div');
      item.className = 'combo-item';
      item.textContent = s.name;
      item.addEventListener('mousedown', function (e) {
        e.preventDefault();
        selectStore(s);
      });
      els.storeList.appendChild(item);
    });
    els.storeList.classList.toggle('open', matches.length > 0);
  }

  function selectStore(store) {
    selectedStore = store;
    els.storeInput.value = store.name;
    els.managerInput.value = store.manager;
    els.storeList.classList.remove('open');
    els.storeField.classList.remove('warn');
    els.storeNote.classList.add('hidden');
  }

  function selectStoreByCode(code) {
    var store = state.storeList.filter(function (s) { return s.code === code; })[0];
    if (store) selectStore(store);
    return store;
  }

  els.storeInput.addEventListener('input', function () {
    selectedStore = null;
    els.managerInput.value = '';
    renderStoreList(els.storeInput.value);
  });

  els.storeInput.addEventListener('focus', function () {
    renderStoreList(els.storeInput.value);
  });

  document.addEventListener('click', function (e) {
    if (!els.storeField.contains(e.target)) els.storeList.classList.remove('open');
  });

  /* ---------- тип нарушения ---------- */

  function fillViolationSelect() {
    var html = '<option value="">— выберите —</option>';
    html += '<optgroup label="1 категория">';
    state.category1.forEach(function (t) {
      html += '<option value="1|' + escapeHtml_(t) + '">' + escapeHtml_(t) + '</option>';
    });
    html += '</optgroup><optgroup label="2 категория">';
    state.category2.forEach(function (t) {
      html += '<option value="2|' + escapeHtml_(t) + '">' + escapeHtml_(t) + '</option>';
    });
    html += '</optgroup>';
    els.violationSelect.innerHTML = html;
  }

  function escapeHtml_(s) {
    return String(s).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
  }

  function setViolation(category, violation) {
    els.violationSelect.value = category + '|' + violation;
    toggleDamageBlock();
  }

  function toggleDamageBlock() {
    var val = els.violationSelect.value;
    var category = val ? Number(val.split('|')[0]) : null;
    els.damageBlock.classList.toggle('hidden', category !== 1);
  }

  els.violationSelect.addEventListener('change', toggleDamageBlock);

  els.violationChips.addEventListener('click', function (e) {
    var chip = e.target.closest('.chip');
    if (!chip) return;
    setViolation(Number(chip.dataset.category), chip.dataset.violation);
  });

  /* ---------- разбор текста ---------- */

  els.parseBtn.addEventListener('click', function () {
    var text = els.rawText.value.trim();
    if (!text) return;

    setLoading(els.parseBtn, 'Разбираю…', true);
    callApi('parseText', [initData, text])
      .then(function (res) {
        if (!res.ok) { showToast(res.error); return; }
        applyParsed(res);
      })
      .catch(function (err) { showToast(String(err)); })
      .then(function () { setLoading(els.parseBtn, '', false); });
  });

  els.rawText.addEventListener('input', function () {
    if (!els.rawText.value.trim()) resetForm();
  });

  function applyParsed(res) {
    clearWarnings();

    if (res.ttNumber) {
      var store = selectStoreByCode(res.ttNumber);
      if (!store) {
        els.storeInput.value = res.ttNumber;
        els.storeField.classList.add('warn');
        els.storeNote.classList.remove('hidden');
      }
    } else {
      els.storeField.classList.add('warn');
    }

    els.employeeInput.value = res.employeeName || '';
    if ((res.warnings || []).indexOf('employeeName') !== -1) {
      els.employeeField.classList.add('warn');
    }

    els.fabulaInput.value = res.fabula || '';

    if (res.violation) {
      setViolation(res.category, res.violation);
    } else {
      els.violationSelect.value = '';
    }

    if ((res.warnings || []).indexOf('violation') !== -1) {
      els.violationField.classList.add('warn');
      els.violationNote.classList.remove('hidden');

      var alts = res.alternatives || [];
      if (alts.length) {
        els.violationChips.classList.remove('hidden');
        els.violationChips.innerHTML = '';
        alts.forEach(function (a) {
          var chip = document.createElement('span');
          chip.className = 'chip';
          chip.textContent = a.violation;
          chip.dataset.category = a.category;
          chip.dataset.violation = a.violation;
          els.violationChips.appendChild(chip);
        });
      }
    }

    els.damageCustomer.value = res.customerDamage != null ? res.customerDamage : '';
    els.damageStore.value = res.storeDamage != null ? res.storeDamage : '';
    els.damageReimbursedCustomer.value = res.reimbursedCustomer != null ? res.reimbursedCustomer : '';
    els.damageReimbursedStore.value = res.reimbursedStore != null ? res.reimbursedStore : '';
    toggleDamageBlock();
  }

  /* ---------- внесение / редактирование ---------- */

  function resetForm() {
    state.editingId = null;
    els.rawText.value = '';
    els.storeInput.value = '';
    els.managerInput.value = '';
    els.employeeInput.value = '';
    els.fabulaInput.value = '';
    els.violationSelect.value = '';
    els.damageCustomer.value = '';
    els.damageStore.value = '';
    els.damageReimbursedCustomer.value = '';
    els.damageReimbursedStore.value = '';
    selectedStore = null;
    clearWarnings();
    toggleDamageBlock();
    els.submitBtn.textContent = 'Внести';
    els.cancelEditBtn.classList.add('hidden');
  }

  function buildPayload() {
    var val = els.violationSelect.value;
    if (!val) { showToast('Выберите тип нарушения'); return null; }
    var parts = val.split('|');
    var category = Number(parts[0]);
    var violation = parts.slice(1).join('|');

    var storeCode = selectedStore ? selectedStore.code : (els.storeInput.value.match(/^(\d{1,3})/) || [])[1];
    if (!storeCode) { showToast('Выберите ТТ из списка'); return null; }
    storeCode = String(storeCode).padStart(3, '0');

    if (!els.employeeInput.value.trim()) { showToast('Укажите ФИО сотрудника'); return null; }
    if (!els.fabulaInput.value.trim()) { showToast('Укажите фабулу'); return null; }

    return {
      storeCode: storeCode,
      category: category,
      violation: violation,
      employeeName: els.employeeInput.value.trim(),
      fabula: els.fabulaInput.value.trim(),
      customerDamage: els.damageCustomer.value,
      storeDamage: els.damageStore.value,
      reimbursedCustomer: els.damageReimbursedCustomer.value,
      reimbursedStore: els.damageReimbursedStore.value
    };
  }

  els.submitBtn.addEventListener('click', function () {
    var payload = buildPayload();
    if (!payload) return;

    setLoading(els.submitBtn, state.editingId ? 'Сохраняю…' : 'Записываю…', true);

    var onDone = function (res) {
      setLoading(els.submitBtn, '', false);
      if (!res.ok) { showToast(res.error); return; }
      showToast(state.editingId ? 'Сохранено' : 'Записано');
      resetForm();
      loadRecords();
    };
    var onFail = function (err) {
      setLoading(els.submitBtn, '', false);
      showToast(String(err));
    };

    var call = state.editingId
      ? callApi('updateRecord', [initData, state.editingId, payload])
      : callApi('submit', [initData, payload]);

    call.then(onDone).catch(onFail);
  });

  els.cancelEditBtn.addEventListener('click', resetForm);

  /* ---------- масове внесення ---------- */

  function renderBulkResults() {
    if (!state.bulkItems.length) {
      els.bulkResults.innerHTML = '';
      els.bulkSubmitBtn.classList.add('hidden');
      return;
    }

    els.bulkResults.innerHTML = '';
    state.bulkItems.forEach(function (item, idx) {
      var card = document.createElement('div');

      if (item.clean) {
        card.className = 'bulk-item';
        card.innerHTML =
          '<input type="checkbox" ' + (item.include ? 'checked' : '') + '>' +
          '<div class="body">' +
          '<div class="title">' + escapeHtml_(item.storeName) + '</div>' +
          '<div class="sub">' + escapeHtml_(item.violation) + ' — ' + escapeHtml_(item.employeeName) + '</div>' +
          '</div>';
        card.querySelector('input').addEventListener('change', function (e) {
          state.bulkItems[idx].include = e.target.checked;
        });
      } else {
        var issue = !item.storeFound ? 'ТТ ' + (item.ttNumber || '?') + ' не найдена в справочнике'
          : (item.warnings || []).indexOf('violation') !== -1 ? 'Тип нарушения определён неоднозначно'
          : (item.warnings || []).indexOf('employeeName') !== -1 ? 'Не распознано ФИО сотрудника'
          : 'Нужна проверка вручную';

        card.className = 'bulk-item problem';
        card.innerHTML =
          '<div class="body">' +
          '<div class="title">' + escapeHtml_(item.raw.slice(0, 60)) + (item.raw.length > 60 ? '…' : '') + '</div>' +
          '<div class="issue">⚠️ ' + issue + '</div>' +
          '<button class="fix-btn">Исправить вручную</button>' +
          '</div>';
        card.querySelector('.fix-btn').addEventListener('click', function () {
          resetForm();
          els.rawText.value = item.raw;
          switchTab('add');
          els.parseBtn.click();
        });
      }

      els.bulkResults.appendChild(card);
    });

    var hasClean = state.bulkItems.some(function (i) { return i.clean; });
    els.bulkSubmitBtn.classList.toggle('hidden', !hasClean);
  }

  els.bulkParseBtn.addEventListener('click', function () {
    var text = els.bulkText.value.trim();
    if (!text) return;

    setLoading(els.bulkParseBtn, 'Разбираю…', true);
    callApi('parseBulk', [initData, text])
      .then(function (res) {
        if (!res.ok) { showToast(res.error); return; }
        state.bulkItems = res.items.map(function (item) {
          return Object.assign({ include: item.clean }, item);
        });
        renderBulkResults();
      })
      .catch(function (err) { showToast(String(err)); })
      .then(function () { setLoading(els.bulkParseBtn, '', false); });
  });

  els.bulkSubmitBtn.addEventListener('click', function () {
    var payloads = state.bulkItems.filter(function (i) { return i.clean && i.include; });
    if (!payloads.length) return;

    setLoading(els.bulkSubmitBtn, 'Вношу…', true);
    callApi('submitBulk', [initData, payloads])
      .then(function (res) {
        setLoading(els.bulkSubmitBtn, '', false);
        if (!res.ok) { showToast(res.error); return; }
        var okCount = res.results.filter(function (r) { return r.ok; }).length;
        showToast('Внесено ' + okCount + ' из ' + payloads.length);

        var submittedRaws = payloads.map(function (p) { return p.raw; });
        state.bulkItems = state.bulkItems.filter(function (i) { return submittedRaws.indexOf(i.raw) === -1; });
        els.bulkText.value = state.bulkItems.map(function (i) { return i.raw; }).join('\n\n');
        renderBulkResults();
      })
      .catch(function (err) {
        setLoading(els.bulkSubmitBtn, '', false);
        showToast(String(err));
      });
  });

  /* ---------- список записей ---------- */

  function cacheGet_(key) {
    try { return JSON.parse(localStorage.getItem(key)); } catch (e) { return null; }
  }

  function cacheSet_(key, value) {
    try { localStorage.setItem(key, JSON.stringify(value)); } catch (e) { /* без кешу теж працює */ }
  }

  /* Показуємо збережений список одразу, а свіжий підтягуємо у фоні. */
  function loadRecords() {
    var cached = cacheGet_('recs');
    if (cached) renderRecords(cached);
    else els.recordsContainer.innerHTML = '<div class="empty-hint"><span class="spinner"></span> Загрузка…</div>';

    callApi('listMine', [initData], true)
      .then(function (res) {
        if (!res.ok) { if (!cached) els.recordsContainer.innerHTML = '<div class="empty-hint">' + res.error + '</div>'; return; }
        cacheSet_('recs', res.records);
        renderRecords(res.records);
      })
      .catch(function (err) {
        if (!cached) els.recordsContainer.innerHTML = '<div class="empty-hint">' + String(err) + '</div>';
      });
  }

  function formatDate(d) {
    return d || '';
  }

  function renderRecords(records) {
    if (!records || !records.length) {
      els.recordsContainer.innerHTML = '<div class="empty-hint">Пока нет записей</div>';
      return;
    }

    els.recordsContainer.innerHTML = '';
    records.forEach(function (r) {
      var card = document.createElement('div');
      card.className = 'record-card';
      card.innerHTML =
        '<div class="top"><span>' + formatDate(r.date) + '</span><span>' + r.category + ' категория</span></div>' +
        '<div class="title">' + escapeHtml_(r.storeName) + '</div>' +
        '<div class="fabula">' + escapeHtml_(r.violation) + ' — ' + escapeHtml_(r.employeeName) + '</div>' +
        '<div class="record-actions">' +
        '<button class="edit">Редактировать</button>' +
        '<button class="delete">Удалить</button>' +
        '</div>';

      card.querySelector('.edit').addEventListener('click', function () { startEdit(r); });
      card.querySelector('.delete').addEventListener('click', function () { confirmDelete(r); });

      els.recordsContainer.appendChild(card);
    });
  }

  function startEdit(r) {
    resetForm();
    state.editingId = r.id;

    var store = selectStoreByCode(r.storeCode);
    if (!store) {
      els.storeInput.value = r.storeName;
      els.managerInput.value = r.manager;
    }

    els.employeeInput.value = r.employeeName || '';
    els.fabulaInput.value = r.fabula || '';
    setViolation(r.category, r.violation);
    els.damageCustomer.value = r.customerDamage || '';
    els.damageStore.value = r.storeDamage || '';
    els.damageReimbursedCustomer.value = r.reimbursedCustomer || '';
    els.damageReimbursedStore.value = r.reimbursedStore || '';

    els.submitBtn.textContent = 'Сохранить';
    els.cancelEditBtn.classList.remove('hidden');

    switchTab('add');
  }

  function confirmDelete(r) {
    var doDelete = function () {
      callApi('deleteRecord', [initData, r.id])
        .then(function (res) {
          if (!res.ok) { showToast(res.error); return; }
          showToast('Удалено');
          loadRecords();
        })
        .catch(function (err) { showToast(String(err)); });
    };

    if (tg && tg.showConfirm) {
      tg.showConfirm('Удалить эту запись?', function (ok) { if (ok) doDelete(); });
    } else if (window.confirm('Удалить эту запись?')) {
      doDelete();
    }
  }

  /* ---------- оцінка обслуговування ---------- */

  var selectedEvalStore = null;

  function renderEvalStoreList(query) {
    var q = (query || '').trim().toLowerCase();
    var matches = state.storeList.filter(function (s) {
      return !q || s.code.indexOf(q) === 0 || s.name.toLowerCase().indexOf(q) !== -1;
    }).slice(0, 30);

    els.evalStoreList.innerHTML = '';
    matches.forEach(function (s) {
      var item = document.createElement('div');
      item.className = 'combo-item';
      item.textContent = s.name;
      item.addEventListener('mousedown', function (e) {
        e.preventDefault();
        selectEvalStore(s);
      });
      els.evalStoreList.appendChild(item);
    });
    els.evalStoreList.classList.toggle('open', matches.length > 0);
  }

  function selectEvalStore(store) {
    selectedEvalStore = store;
    els.evalStoreInput.value = store.name;
    els.evalManagerInput.value = store.manager;
    els.evalStoreList.classList.remove('open');
  }

  function selectEvalStoreByCode(code) {
    var store = state.storeList.filter(function (s) { return s.code === code; })[0];
    if (store) selectEvalStore(store);
    return store;
  }

  els.evalStoreInput.addEventListener('input', function () {
    selectedEvalStore = null;
    els.evalManagerInput.value = '';
    renderEvalStoreList(els.evalStoreInput.value);
  });

  els.evalStoreInput.addEventListener('focus', function () {
    renderEvalStoreList(els.evalStoreInput.value);
  });

  document.addEventListener('click', function (e) {
    if (!els.evalStoreInput.contains(e.target) && !els.evalStoreList.contains(e.target)) {
      els.evalStoreList.classList.remove('open');
    }
  });

  /* маска часу: вводяться тільки цифри, автоматично додається ":" після другої */
  els.evalTimeInput.addEventListener('input', function () {
    var digits = els.evalTimeInput.value.replace(/\D/g, '').slice(0, 4);
    els.evalTimeInput.value = digits.length > 2 ? digits.slice(0, 2) + ':' + digits.slice(2) : digits;
  });

  function resetEvalForm() {
    state.evalEditingId = null;
    selectedEvalStore = null;
    els.evalStoreInput.value = '';
    els.evalManagerInput.value = '';
    els.evalSellerInput.value = '';
    els.evalTimeInput.value = '';
    els.evalGenderSelect.value = 'м';
    els.evalCommentInput.value = '';
    els.evalFormTitle.textContent = 'Оценка обслуживания';
    els.evalSubmitBtn.textContent = 'Внести оценку';
    els.evalCancelEditBtn.classList.add('hidden');
  }

  function buildEvalPayload() {
    var storeCode = selectedEvalStore ? selectedEvalStore.code : (els.evalStoreInput.value.match(/^(\d{1,3})/) || [])[1];
    if (!storeCode) { showToast('Выберите ТТ из списка'); return null; }
    storeCode = String(storeCode).padStart(3, '0');

    if (!els.evalSellerInput.value.trim()) { showToast('Укажите продавца'); return null; }
    if (!els.evalCommentInput.value.trim()) { showToast('Укажите комментарий'); return null; }

    return {
      storeCode: storeCode,
      seller: els.evalSellerInput.value.trim(),
      time: els.evalTimeInput.value.trim(),
      gender: els.evalGenderSelect.value,
      comment: els.evalCommentInput.value.trim()
    };
  }

  els.evalSubmitBtn.addEventListener('click', function () {
    var payload = buildEvalPayload();
    if (!payload) return;

    setLoading(els.evalSubmitBtn, state.evalEditingId ? 'Сохраняю…' : 'Вношу…', true);

    var onDone = function (res) {
      setLoading(els.evalSubmitBtn, '', false);
      if (!res.ok) { showToast(res.error); return; }
      showToast(state.evalEditingId ? 'Оценка сохранена' : 'Оценка внесена');
      resetEvalForm();
      loadEvals();
    };
    var onFail = function (err) {
      setLoading(els.evalSubmitBtn, '', false);
      showToast(String(err));
    };

    var call = state.evalEditingId
      ? callApi('updateEval', [initData, state.evalEditingId, payload])
      : callApi('submitEval', [initData, payload]);

    call.then(onDone).catch(onFail);
  });

  els.evalCancelEditBtn.addEventListener('click', resetEvalForm);

  function loadEvals() {
    var cached = cacheGet_('evals');
    if (cached) renderEvalRecords(cached);
    else els.evalRecordsContainer.innerHTML = '<div class="empty-hint"><span class="spinner"></span> Загрузка…</div>';

    callApi('listMyEvals', [initData], true)
      .then(function (res) {
        if (!res.ok) { if (!cached) els.evalRecordsContainer.innerHTML = '<div class="empty-hint">' + res.error + '</div>'; return; }
        cacheSet_('evals', res.records);
        renderEvalRecords(res.records);
      })
      .catch(function (err) {
        if (!cached) els.evalRecordsContainer.innerHTML = '<div class="empty-hint">' + String(err) + '</div>';
      });
  }

  function renderEvalRecords(records) {
    if (!records || !records.length) {
      els.evalRecordsContainer.innerHTML = '<div class="empty-hint">Пока нет оценок</div>';
      return;
    }

    els.evalRecordsContainer.innerHTML = '';
    records.forEach(function (r) {
      var total = [r.meeting, r.needs, r.extraSales, r.sale, r.closing]
        .reduce(function (sum, v) { return sum + (Number(v) || 0); }, 0);

      var card = document.createElement('div');
      card.className = 'record-card';
      card.innerHTML =
        '<div class="top"><span>' + (r.date || '') + ' ' + (r.time || '') + '</span><span>' + total + ' / 10</span></div>' +
        '<div class="title">' + escapeHtml_(r.storeName) + '</div>' +
        '<div class="fabula">' + escapeHtml_(r.seller) + ' — ' + escapeHtml_(r.comment) + '</div>' +
        '<div class="record-actions">' +
        '<button class="edit">Редактировать</button>' +
        '<button class="delete">Удалить</button>' +
        '</div>';

      card.querySelector('.edit').addEventListener('click', function () { startEditEval(r); });
      card.querySelector('.delete').addEventListener('click', function () { confirmDeleteEval(r); });

      els.evalRecordsContainer.appendChild(card);
    });
  }

  function startEditEval(r) {
    resetEvalForm();
    state.evalEditingId = r.id;

    var store = selectEvalStoreByCode(r.storeCode);
    if (!store) {
      els.evalStoreInput.value = r.storeName;
      els.evalManagerInput.value = r.manager;
    }

    els.evalSellerInput.value = r.seller || '';
    els.evalTimeInput.value = r.time || '';
    els.evalGenderSelect.value = r.gender || 'м';
    els.evalCommentInput.value = r.comment || '';

    els.evalFormTitle.textContent = 'Редактирование оценки';
    els.evalSubmitBtn.textContent = 'Сохранить';
    els.evalCancelEditBtn.classList.remove('hidden');
  }

  function confirmDeleteEval(r) {
    var doDelete = function () {
      callApi('deleteEval', [initData, r.id])
        .then(function (res) {
          if (!res.ok) { showToast(res.error); return; }
          showToast('Удалено');
          loadEvals();
        })
        .catch(function (err) { showToast(String(err)); });
    };

    if (tg && tg.showConfirm) {
      tg.showConfirm('Удалить эту оценку?', function (ok) { if (ok) doDelete(); });
    } else if (window.confirm('Удалить эту оценку?')) {
      doDelete();
    }
  }

  /* ---------- старт ---------- */

  callApi('bootstrap', [initData])
    .then(function (res) {
      if (!res.ok) {
        document.getElementById('app').innerHTML =
          '<div class="empty-hint">' + res.error + '<br><br><small>' + debugInfo_() + '</small></div>';
        return;
      }
      state.storeList = res.storeList;
      state.category1 = res.category1;
      state.category2 = res.category2;
      fillViolationSelect();
      loadRecords();
      loadEvals();
    })
    .catch(function (err) {
      document.getElementById('app').innerHTML = '<div class="empty-hint">' + String(err) + '</div>';
    });

})();

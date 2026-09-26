(function () {
  'use strict';

  var API_URL = 'https://script.google.com/macros/s/AKfycbzv-tzr18zzcxzixppgyDm26FbR4rIE4cffIEFp8HgtoeDfaf2Wqwcmej1J_-s3au8_zg/exec';

  function callApi(fn, args) {
    return fetch(API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify({ fn: fn, args: args })
    }).then(function (r) { return r.json(); });
  }

  var tg = window.Telegram && window.Telegram.WebApp;
  var initData = tg ? tg.initData : '';

  if (tg) {
    tg.ready();
    tg.expand();
  }

  (function setGreeting() {
    var h = new Date().getHours();
    var text = h < 6 ? 'Доброї ночі' : h < 12 ? 'Доброго ранку' : h < 18 ? 'Доброго дня' : 'Доброго вечора';
    var el = document.getElementById('greeting-text');
    if (el) el.textContent = text;
  })();

  function debugInfo_() {
    if (!tg) return 'window.Telegram.WebApp відсутній (скрипт telegram-web-app.js не завантажився)';
    return 'platform=' + tg.platform + ' version=' + tg.version +
      ' initData.length=' + (tg.initData || '').length +
      ' initDataUnsafe.user=' + JSON.stringify(tg.initDataUnsafe && tg.initDataUnsafe.user);
  }

  var state = {
    storeList: [],
    category1: [],
    category2: [],
    editingId: null
  };

  var els = {
    tabs: document.querySelectorAll('.tab-btn'),
    screens: {
      add: document.getElementById('screen-add'),
      list: document.getElementById('screen-list')
    },
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
    damageReimbursed: document.getElementById('damage-reimbursed'),
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
    html += '<optgroup label="1 категорія">';
    state.category1.forEach(function (t) {
      html += '<option value="1|' + escapeHtml_(t) + '">' + escapeHtml_(t) + '</option>';
    });
    html += '</optgroup><optgroup label="2 категорія">';
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

    callApi('parseText', [initData, text])
      .then(function (res) {
        if (!res.ok) { showToast(res.error); return; }
        applyParsed(res);
      })
      .catch(function (err) { showToast(String(err)); });
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
    els.damageReimbursed.value = res.reimbursed != null ? res.reimbursed : '';
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
    els.damageReimbursed.value = '';
    selectedStore = null;
    clearWarnings();
    toggleDamageBlock();
    els.submitBtn.textContent = 'Внести';
    els.cancelEditBtn.classList.add('hidden');
  }

  function buildPayload() {
    var val = els.violationSelect.value;
    if (!val) { showToast('Оберіть тип порушення'); return null; }
    var parts = val.split('|');
    var category = Number(parts[0]);
    var violation = parts.slice(1).join('|');

    var storeCode = selectedStore ? selectedStore.code : (els.storeInput.value.match(/^(\d{1,3})/) || [])[1];
    if (!storeCode) { showToast('Оберіть ТТ зі списку'); return null; }
    storeCode = String(storeCode).padStart(3, '0');

    if (!els.employeeInput.value.trim()) { showToast('Вкажіть ПІБ співробітника'); return null; }
    if (!els.fabulaInput.value.trim()) { showToast('Вкажіть фабулу'); return null; }

    return {
      storeCode: storeCode,
      category: category,
      violation: violation,
      employeeName: els.employeeInput.value.trim(),
      fabula: els.fabulaInput.value.trim(),
      customerDamage: els.damageCustomer.value,
      storeDamage: els.damageStore.value,
      reimbursed: els.damageReimbursed.value
    };
  }

  els.submitBtn.addEventListener('click', function () {
    var payload = buildPayload();
    if (!payload) return;

    els.submitBtn.disabled = true;

    var onDone = function (res) {
      els.submitBtn.disabled = false;
      if (!res.ok) { showToast(res.error); return; }
      showToast(state.editingId ? 'Збережено' : 'Записано');
      resetForm();
    };
    var onFail = function (err) {
      els.submitBtn.disabled = false;
      showToast(String(err));
    };

    var call = state.editingId
      ? callApi('updateRecord', [initData, state.editingId, payload])
      : callApi('submit', [initData, payload]);

    call.then(onDone).catch(onFail);
  });

  els.cancelEditBtn.addEventListener('click', resetForm);

  /* ---------- список записей ---------- */

  function loadRecords() {
    els.recordsContainer.innerHTML = '<div class="empty-hint">Завантаження…</div>';
    callApi('listMine', [initData])
      .then(function (res) {
        if (!res.ok) { els.recordsContainer.innerHTML = '<div class="empty-hint">' + res.error + '</div>'; return; }
        renderRecords(res.records);
      })
      .catch(function (err) {
        els.recordsContainer.innerHTML = '<div class="empty-hint">' + String(err) + '</div>';
      });
  }

  function formatDate(d) {
    return d || '';
  }

  function renderRecords(records) {
    if (!records || !records.length) {
      els.recordsContainer.innerHTML = '<div class="empty-hint">Поки що немає записів</div>';
      return;
    }

    els.recordsContainer.innerHTML = '';
    records.forEach(function (r) {
      var card = document.createElement('div');
      card.className = 'record-card';
      card.innerHTML =
        '<div class="top"><span>' + formatDate(r.date) + '</span><span>' + r.category + ' категорія</span></div>' +
        '<div class="title">' + escapeHtml_(r.storeName) + '</div>' +
        '<div class="fabula">' + escapeHtml_(r.violation) + ' — ' + escapeHtml_(r.employeeName) + '</div>' +
        '<div class="record-actions">' +
        '<button class="edit">Редагувати</button>' +
        '<button class="delete">Видалити</button>' +
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
    els.damageReimbursed.value = r.reimbursed || '';

    els.submitBtn.textContent = 'Зберегти';
    els.cancelEditBtn.classList.remove('hidden');

    switchTab('add');
  }

  function confirmDelete(r) {
    var doDelete = function () {
      callApi('deleteRecord', [initData, r.id])
        .then(function (res) {
          if (!res.ok) { showToast(res.error); return; }
          showToast('Видалено');
          loadRecords();
        })
        .catch(function (err) { showToast(String(err)); });
    };

    if (tg && tg.showConfirm) {
      tg.showConfirm('Видалити цей запис?', function (ok) { if (ok) doDelete(); });
    } else if (window.confirm('Видалити цей запис?')) {
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
    })
    .catch(function (err) {
      document.getElementById('app').innerHTML = '<div class="empty-hint">' + String(err) + '</div>';
    });

})();

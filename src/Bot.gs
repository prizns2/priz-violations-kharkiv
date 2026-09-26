/****************************************************************
 * TELEGRAM-БОТ: відповідь на /start з кнопкою відкриття Mini App
 * Оновлення забираємо опитуванням (pollTelegram, тригер щохвилини).
 * Захист від дублів через update_id у CacheService — про всяк випадок.
 ****************************************************************/

function tgCall_(method, payload) {
  var res = UrlFetchApp.fetch('https://api.telegram.org/bot' + getBotToken_() + '/' + method, {
    method: 'post',
    contentType: 'application/json',
    payload: JSON.stringify(payload || {}),
    muteHttpExceptions: true
  });
  return JSON.parse(res.getContentText());
}

function handleTelegramUpdate_(update) {
  var cache = CacheService.getScriptCache();
  var key = 'upd_' + update.update_id;
  if (cache.get(key)) return;
  cache.put(key, '1', 21600);

  var msg = update.message;
  if (!msg || !msg.chat || msg.chat.type !== 'private' || !msg.from) return;

  var chatId = msg.chat.id;

  if (String(msg.from.id) !== getOwnerTelegramId_()) {
    tgCall_('sendMessage', { chat_id: chatId, text: 'Это личный бот. Доступ закрыт.' });
    return;
  }

  var sent = tgCall_('sendMessage', {
    chat_id: chatId,
    text: 'PRIZ Харьков\nНарушения · Оценка обслуживания\n\nНажми кнопку, чтобы открыть.',
    reply_markup: { inline_keyboard: [[{ text: 'Открыть', web_app: { url: CONFIG.MINI_APP_URL } }]] }
  });

  if (/^\/start/.test(msg.text || '') && sent.ok) {
    tgCall_('unpinAllChatMessages', { chat_id: chatId });
    tgCall_('pinChatMessage', {
      chat_id: chatId,
      message_id: sent.result.message_id,
      disable_notification: true
    });
  }
}

/**
 * Опитування getUpdates раз на хвилину замість webhook: Apps Script відповідає на POST
 * редиректом 302, Telegram вважає це помилкою й застрягає на повторах доставки.
 */
function pollTelegram() {
  var props = PropertiesService.getScriptProperties();
  var offset = Number(props.getProperty('TG_OFFSET') || 0);

  var res = tgCall_('getUpdates', {
    offset: offset,
    timeout: 0,
    limit: 50,
    allowed_updates: ['message']
  });
  if (!res.ok || !res.result.length) return;

  res.result.forEach(function (update) {
    try {
      handleTelegramUpdate_(update);
    } catch (e) {
      logError_(getSpreadsheet_(), 'Помилка обробки повідомлення бота', String(e.message || e), null, { update_id: update.update_id });
    }
    offset = update.update_id + 1;
  });

  props.setProperty('TG_OFFSET', String(offset));
}

/** Запустити один раз вручну з редактора: дозволи, вимкнення webhook, тригер щохвилини. */
function startBotPolling() {
  tgCall_('deleteWebhook', { drop_pending_updates: true });

  ScriptApp.getProjectTriggers().forEach(function (t) {
    if (t.getHandlerFunction() === 'pollTelegram') ScriptApp.deleteTrigger(t);
  });
  ScriptApp.newTrigger('pollTelegram').timeBased().everyMinutes(1).create();

  Logger.log('Опитування Telegram запущено');
}

function stopBotPolling() {
  ScriptApp.getProjectTriggers().forEach(function (t) {
    if (t.getHandlerFunction() === 'pollTelegram') ScriptApp.deleteTrigger(t);
  });
}

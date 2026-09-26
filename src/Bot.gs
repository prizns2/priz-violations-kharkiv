/****************************************************************
 * TELEGRAM-БОТ: відповідь на /start з кнопкою відкриття Mini App
 * Telegram шле оновлення webhook-ом на /exec (див. doPost у Code.gs).
 * Apps Script у відповідь віддає 302, тому Telegram може повторити
 * доставку — захист від дублів через update_id у CacheService.
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

/** Запустити один раз вручну з редактора Apps Script — щоб надати дозвіл на UrlFetchApp. */
function authorizeBot() {
  Logger.log(JSON.stringify(tgCall_('getMe')));
}

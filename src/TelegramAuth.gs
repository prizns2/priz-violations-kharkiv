/****************************************************************
 * ПЕРЕВІРКА initData ІЗ TELEGRAM MINI APP
 * https://core.telegram.org/bots/webapps#validating-data-received-via-the-mini-app
 ****************************************************************/

function getBotToken_() {
  var token = PropertiesService.getScriptProperties().getProperty('BOT_TOKEN');
  if (!token) throw new Error('BOT_TOKEN не заданий у Script Properties');
  return token;
}

function getOwnerTelegramId_() {
  var id = PropertiesService.getScriptProperties().getProperty('OWNER_TELEGRAM_ID');
  if (!id) throw new Error('OWNER_TELEGRAM_ID не заданий у Script Properties');
  return String(id);
}

function bytesToHex_(bytes) {
  return bytes.map(function (b) {
    return ('0' + (b & 0xFF).toString(16)).slice(-2);
  }).join('');
}

/**
 * Перевіряє HMAC-підпис initData та що це власник.
 * Повертає об'єкт user з Telegram при успіху, інакше кидає Error.
 */
function verifyInitData_(initData) {
  if (!initData) throw new Error('Немає initData');

  var pairs = initData.split('&');
  var hash = '';
  var checkParts = [];
  var user = null;

  for (var i = 0; i < pairs.length; i++) {
    var eq = pairs[i].indexOf('=');
    if (eq < 0) continue;
    var key = decodeURIComponent(pairs[i].substring(0, eq));
    var value = decodeURIComponent(pairs[i].substring(eq + 1));
    if (key === 'hash') {
      hash = value;
    } else {
      checkParts.push(key + '=' + value);
      if (key === 'user') user = JSON.parse(value);
    }
  }

  if (!hash) throw new Error('initData без hash');

  checkParts.sort();
  var dataCheckString = checkParts.join('\n');

  var secretKey = Utilities.computeHmacSha256Signature(
    Utilities.newBlob(getBotToken_()).getBytes(),
    Utilities.newBlob('WebAppData').getBytes()
  );
  var computedHash = bytesToHex_(
    Utilities.computeHmacSha256Signature(
      Utilities.newBlob(dataCheckString).getBytes(),
      secretKey
    )
  );

  if (computedHash !== hash) {
    throw new Error('Недійсний підпис Telegram initData');
  }

  if (!user || String(user.id) !== getOwnerTelegramId_()) {
    throw new Error('Доступ заборонено: не власник');
  }

  return user;
}

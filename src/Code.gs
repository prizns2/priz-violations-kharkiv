/****************************************************************
 * JSON RPC-шлюз для статичного фронтенду (GitHub Pages).
 * Apps Script HtmlService у браузері подвійно обгортає сторінку
 * в iframe (на іншому домені googleusercontent.com), тому хеш,
 * куди Telegram кладе initData, до неї не доходить — саму сторінку
 * тому віддаємо з окремого хостингу (docs/), а сюди ходимо як в API.
 *
 * Тіло запиту: {"fn": "bootstrap", "args": [initData, ...]}
 * Відповідь: те саме, що повертає відповідна api_* функція.
 ****************************************************************/

var RPC_METHODS = {
  bootstrap: api_bootstrap,
  parseText: api_parseText,
  submit: api_submit,
  listMine: api_listMine,
  updateRecord: api_updateRecord,
  deleteRecord: api_deleteRecord
};

function doPost(e) {
  var result;
  try {
    var body = JSON.parse(e.postData.contents);
    var fn = RPC_METHODS[body.fn];
    if (!fn) throw new Error('Невідомий метод: ' + body.fn);
    result = fn.apply(null, body.args || []);
  } catch (err) {
    result = { ok: false, error: String(err.message || err) };
  }
  return ContentService.createTextOutput(JSON.stringify(result))
    .setMimeType(ContentService.MimeType.JSON);
}

/** Просте GET-опитування для перевірки, що Script Properties задані. */
function doGet(e) {
  var props = PropertiesService.getScriptProperties();
  return ContentService.createTextOutput(JSON.stringify({
    botTokenSet: !!props.getProperty('BOT_TOKEN'),
    ownerIdSet: !!props.getProperty('OWNER_TELEGRAM_ID')
  })).setMimeType(ContentService.MimeType.JSON);
}

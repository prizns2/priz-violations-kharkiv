/****************************************************************
 * ВХІД У WEB APP
 ****************************************************************/

function doGet(e) {
  if (e && e.parameter && e.parameter.diag === '1') {
    var props = PropertiesService.getScriptProperties();
    return ContentService.createTextOutput(JSON.stringify({
      botTokenSet: !!props.getProperty('BOT_TOKEN'),
      ownerIdSet: !!props.getProperty('OWNER_TELEGRAM_ID')
    })).setMimeType(ContentService.MimeType.JSON);
  }

  return HtmlService.createTemplateFromFile('index')
    .evaluate()
    .setTitle('PRIZ — Порушення')
    .addMetaTag('viewport', 'width=device-width, initial-scale=1')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

function include(filename) {
  return HtmlService.createHtmlOutputFromFile(filename).getContent();
}

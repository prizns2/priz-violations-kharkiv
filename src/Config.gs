/****************************************************************
 * НАСТРОЙКИ ПРОЕКТА
 ****************************************************************/

var CONFIG = {
  SPREADSHEET_ID: '19Y4GkwXSijz93NFUVHzGiiNinD-NkSWk0aNDfdL7ya4',
  REGION: 'Харків',
  OPERATOR_NAME: 'Приз Микита Сергійович',

  SHEET_CATEGORY_1: 'Категория 1',
  SHEET_CATEGORY_2: 'Категория 2',
  ERROR_SHEET: 'Помилки бота',

  STORE_REFERENCE_SHEET: 'Пример',
  STORE_REFERENCE_COLUMN: 31,   // AE — повна назва ТТ
  MANAGER_REFERENCE_COLUMN: 32, // AF — менеджер
  STORE_REFERENCE_FIRST_ROW: 1,

  RECORD_ID_COLUMN: 15,  // O — службовий ID запису
  STORE_SORT_COLUMN: 16, // P — числовий номер ТТ для сортування
  FIRST_DATA_ROW: 2,

  SHEET_EVAL: 'Оценка',
  EVAL_ID_COLUMN: 18, // R — службовий ID запису (нова колонка, у листі раніше не було)
  EVAL_FIRST_DATA_ROW: 2,

  RECORD_ID_PREFIX: 'app:',
  TIMEZONE: 'Europe/Kyiv',

  MINI_APP_URL: 'https://prizns2.github.io/priz-violations-kharkiv/'
};

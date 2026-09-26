/****************************************************************
 * РОЗБІР КОМЕНТАРЯ ОЦІНКИ ОБСЛУГОВУВАННЯ
 *
 * За замовчуванням кожен з 5 етапів = 2 (виконано). Власник пише
 * звичайний коментар (як фабулу для порушень), і якщо в ньому
 * знайдена фраза-тригер про провал етапу — цей етап стає 0.
 *
 * Список фраз мінімальний і буде розширюватись власником у міру
 * використання — так само, як RULES у Parser.js виросли з реальних
 * фабул. Нових фраз поки немає для «Виявлення потреби» — там завжди 2,
 * доки власник не назве конкретну фразу-тригер.
 ****************************************************************/

var EVAL_RULES = [
  { field: 'meeting', re: [/не поздоровал/, /не приві?тал/] },
  { field: 'needs', re: [] },
  { field: 'extraSales', re: [/нема[єе]?\s*доп\S*\s*(пропозиц|продаж)/, /нет доп\S*\s*предложен/] },
  { field: 'sale', re: [/не озвучил\S*\s*(прийнят|принят)\S*\s*купюр/] },
  { field: 'closing', re: [/не попрощал/, /не подяку/] }
];

function detectEvalScores_(comment) {
  var t = String(comment || '').toLowerCase().replace(/ё/g, 'е');
  var scores = { meeting: 2, needs: 2, extraSales: 2, sale: 2, closing: 2 };

  EVAL_RULES.forEach(function (rule) {
    for (var i = 0; i < rule.re.length; i++) {
      if (rule.re[i].test(t)) { scores[rule.field] = 0; break; }
    }
  });

  return scores;
}

if (typeof module !== 'undefined') module.exports = { detectEvalScores_: detectEvalScores_, EVAL_RULES: EVAL_RULES };

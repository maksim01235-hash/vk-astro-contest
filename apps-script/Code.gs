/**
 * apps-script/Code.gs — Google Apps Script backend for VK Contest.
 *
 * Версия: август 2026 (сервер-как-источник-истины).
 *
 * Обновления:
 *  - Новый лист Opens + действие markCardOpen: время первого просмотра
 *    карточки хранится на сервере (пара vk_id + card_id, под лока́том).
 *  - Logs: одна строка на отправку — [vk_id, timestamp, log], где log —
 *    вся накопленная пачка событий одной JSON-строкой. Атомарный appendRow
 *    под LockService; клиент автоматически сбрасывает буфер при переполнении.
 *  - saveManualLog: принимает vk_id владельца лога (автосброс клиента),
 *    по умолчанию 'admin' (кнопка в админке).
 *  - checkInputsAnswer/checkDndAnswer: серверная проверка числовых ответов
 *    (процентный допуск) и раскладки DnD по эталонным объектам зоны.
 *  - normalizeUserAnswer: единый формат ответа { inputs, dnd } без схлопывания.
 *  - checkMarkerAnswer: проверка координат метки.
 */

var SHEET_USERS = 'Users';
var SHEET_CARDS = 'Cards';
var SHEET_ANSWERS = 'Answers';
var SHEET_LOGS = 'Logs';
var SHEET_FEEDBACK = 'Feedback';
var SHEET_OPENS = 'Opens';

var HEADERS = {
  Users: ['vk_id', 'name', 'reg_date', 'subscribed', 'last_activity'],
  Cards: ['card_id', 'title', 'release_datetime', 'post_id', 'json_schema', 'is_active'],
  Answers: ['id', 'vk_id', 'card_id', 'open_timestamp', 'submit_timestamp', 'delta_seconds', 'user_answer', 'has_reposted'],
  Logs: ['vk_id', 'timestamp', 'log'],
  Feedback: ['id', 'timestamp', 'vk_id', 'name', 'card_id', 'message'],
  Opens: ['vk_id', 'card_id', 'first_open_timestamp'],
};

var CARDS_CACHE_TTL_SEC = 300;
var GROUP_MEMBERSHIP_CACHE_TTL_SEC = 600;

function getCache() {
  return CacheService.getScriptCache();
}

function doGet(e) {
  try {
    var action = String((e.parameter && e.parameter.action) || '');
    var result;

    switch (action) {
      case 'getCards': result = getCards(); break;
      case 'getCardsList': result = getCardsList(); break;
      case 'getCard': result = getCard(e.parameter.id); break;
      case 'checkUser': result = checkUser(e.parameter.vk_id, e.parameter.name); break;
      case 'getAnsweredCards': result = getAnsweredCards(e.parameter.vk_id); break;
      case 'getStats': result = getStats(); break;
      case 'checkRepost': result = checkRepostViaVK(e.parameter.vk_id, e.parameter.post_id); break;
      case 'getServerTime': result = { iso: new Date().toISOString() }; break;
      case 'markCardOpen': result = markCardOpen(e.parameter.vk_id, e.parameter.card_id); break;
      default: return jsonOut({ ok: false, error: 'Unknown action: ' + action });
    }


    return jsonOut({ ok: true, data: result });
  } catch (error) {
    return jsonOut({ ok: false, error: String(error) });
  }
}

function doPost(e) {
  try {
    var action = String((e.parameter && e.parameter.action) || '');
    var body = e.postData && e.postData.contents
      ? JSON.parse(e.postData.contents)
      : {};
    var result;

    switch (action) {
      case 'saveAnswer': result = saveAnswer(body); break;
      case 'saveUser': result = saveUser(body); break;
      case 'saveFeedback': result = saveFeedback(body); break;
      case 'saveCard': result = saveCard(body); break;
      case 'syncOffline': result = syncOffline(body); break;
      case 'saveManualLog': result = saveManualLog(body); break;
      default: return jsonOut({ ok: false, error: 'Unknown action: ' + action });
    }

    return jsonOut({ ok: true, data: result });
  } catch (error) {
    return jsonOut({ ok: false, error: String(error) });
  }
}

function jsonOut(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

function getSS() {
  return SpreadsheetApp.getActiveSpreadsheet();
}

function getSheet(name) {
  var ss = getSS();
  var sheet = ss.getSheetByName(name);

  if (!sheet) {
    sheet = ss.insertSheet(name);
    sheet.getRange(1, 1, 1, HEADERS[name].length).setValues([HEADERS[name]]);
  }

  return sheet;
}

function readSheet(name) {
  var sheet = getSheet(name);
  var data = sheet.getDataRange().getValues();
  if (data.length < 2) return [];

  var headers = data[0];
  var rows = [];

  for (var i = 1; i < data.length; i++) {
    var row = {};
    for (var j = 0; j < headers.length; j++) {
      row[headers[j]] = data[i][j];
    }
    rows.push(row);
  }

  return rows;
}

function findRow(name, key, value) {
  var rows = readSheet(name);

  for (var i = 0; i < rows.length; i++) {
    if (String(rows[i][key]) === String(value)) return rows[i];
  }

  return null;
}

function appendRow(name, obj) {
  var sheet = getSheet(name);
  var headers = HEADERS[name];

  sheet.appendRow(headers.map(function(header) {
    return obj[header] !== undefined ? obj[header] : '';
  }));
}

function updateRow(name, key, value, updates) {
  var sheet = getSheet(name);
  var data = sheet.getDataRange().getValues();
  if (!data.length) return false;

  var headers = data[0];
  var keyIndex = headers.indexOf(key);
  if (keyIndex === -1) return false;

  for (var i = 1; i < data.length; i++) {
    if (String(data[i][keyIndex]) !== String(value)) continue;

    for (var j = 0; j < headers.length; j++) {
      if (updates[headers[j]] !== undefined) {
        sheet.getRange(i + 1, j + 1).setValue(updates[headers[j]]);
      }
    }

    return true;
  }

  return false;
}

function nextId(name) {
  var rows = readSheet(name);
  var max = 0;

  rows.forEach(function(row) {
    var value = parseInt(row.id, 10);
    if (!isNaN(value) && value > max) max = value;
  });

  return max + 1;
}

// ============================================================
// Cards
// ============================================================

function getCards() {
  var cache = getCache();
  var cached = cache.get('cards_all');
  if (cached) return JSON.parse(cached);

  var cards = readSheet(SHEET_CARDS).filter(function(card) {
    return card.is_active === true || card.is_active === 'TRUE' || card.is_active === 'true';
  });

  cache.put('cards_all', JSON.stringify(cards), CARDS_CACHE_TTL_SEC);
  return cards;
}

function getCardsList() {
  var cache = getCache();
  var cached = cache.get('cards_list');
  if (cached) return JSON.parse(cached);

  var list = readSheet(SHEET_CARDS)
    .filter(function(card) {
      return card.is_active === true || card.is_active === 'TRUE' || card.is_active === 'true';
    })
    .map(function(card) {
      return {
        card_id: card.card_id,
        title: card.title,
        is_active: card.is_active,
      };
    });

  cache.put('cards_list', JSON.stringify(list), CARDS_CACHE_TTL_SEC);
  return list;
}

function getCard(id) {
  var cache = getCache();
  var cacheKey = 'card_' + String(id);
  var cached = cache.get(cacheKey);
  if (cached) return JSON.parse(cached);

  var card = findRow(SHEET_CARDS, 'card_id', id);
  if (card) cache.put(cacheKey, JSON.stringify(card), CARDS_CACHE_TTL_SEC);
  return card;
}

function invalidateCardCache(cardId) {
  var cache = getCache();
  cache.remove('cards_all');
  cache.remove('cards_list');
  cache.remove('card_' + String(cardId));
}

function saveCard(card) {
  if (!card.card_id) throw new Error('card_id is required');

  // Строгий режим (клиент всегда шлёт is_edit): защита от дублей card_id.
  //  - is_edit=true  → карточка обязана существовать (обновление);
  //  - is_edit=false → карточки с таким id быть не должно (создание);
  // без флага — прежний апсерт для совместимости.
  var strict = typeof card.is_edit === 'boolean';

  var lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    var exists = !!findRow(SHEET_CARDS, 'card_id', card.card_id);

    if (strict) {
      if (card.is_edit && !exists) throw new Error('CARD_NOT_FOUND');
      if (!card.is_edit && exists) throw new Error('CARD_ID_TAKEN');
    }

    var record = {
      card_id: card.card_id,
      title: card.title || '',
      release_datetime: card.release_datetime || '',
      post_id: card.post_id || '',
      json_schema: typeof card.json_schema === 'string'
        ? card.json_schema
        : JSON.stringify(card.json_schema),
      is_active: card.is_active !== false,
    };

    if (exists) {
      updateRow(SHEET_CARDS, 'card_id', card.card_id, record);
    } else {
      appendRow(SHEET_CARDS, record);
    }

    invalidateCardCache(card.card_id);
    return { saved: true, created: !exists };
  } finally {
    lock.releaseLock();
  }
}

// ============================================================
// Opens (время первого просмотра карточки)
// ============================================================

/**
 * Фиксирует факт открытия карточки и возвращает время первого просмотра.
 *
 * Для пары vk_id + card_id время записывается ОДИН раз (под лока́том,
 * чтобы параллельные запросы не создали дубли). Все последующие вызовы —
 * с любого устройства и после любой перезагрузки — возвращают то же время,
 * поэтому delta_seconds у пользователя всегда считается от одного момента.
 *
 * @param {string} vkId
 * @param {string} cardId
 * @returns {Object} { iso: string } — ISO-время первого просмотра
 */
function markCardOpen(vkId, cardId) {
  if (!vkId) throw new Error('vk_id is required');
  if (!cardId) throw new Error('card_id is required');

  var lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    var rows = readSheet(SHEET_OPENS);
    for (var i = 0; i < rows.length; i++) {
      if (
        String(rows[i].vk_id) === String(vkId) &&
        String(rows[i].card_id) === String(cardId)
      ) {
        return { iso: rows[i].first_open_timestamp };
      }
    }

    var iso = new Date().toISOString();
    appendRow(SHEET_OPENS, {
      vk_id: vkId,
      card_id: cardId,
      first_open_timestamp: iso,
    });
    return { iso: iso };
  } finally {
    lock.releaseLock();
  }
}

// ============================================================
// Users
// ============================================================

function checkUser(vkId, name) {
  if (!vkId) throw new Error('vk_id is required');

  var existing = findRow(SHEET_USERS, 'vk_id', vkId);
  if (existing) {
    var updates = { last_activity: new Date().toISOString() };
    if (name) updates.name = name;
    updateRow(SHEET_USERS, 'vk_id', vkId, updates);
    return existing;
  }

  var user = {
    vk_id: vkId,
    name: name || '',
    reg_date: new Date().toISOString(),
    subscribed: false,
    last_activity: new Date().toISOString(),
  };

  appendRow(SHEET_USERS, user);
  return user;
}

function saveUser(user) {
  if (!user.vk_id) throw new Error('vk_id is required');

  if (findRow(SHEET_USERS, 'vk_id', user.vk_id)) {
    updateRow(SHEET_USERS, 'vk_id', user.vk_id, user);
  } else {
    appendRow(SHEET_USERS, user);
  }

  return { saved: true };
}

// ============================================================
// Answers and Logs
// ============================================================

/**
 * Проверка ответа ImageMarkerBlock.
 *
 * @param {Object} markerData - { userX, userY }
 * @param {Object} jsonSchema - схема карточки с блоками
 * @returns {Object} { userX, userY, actualErrorPercent, isCorrect }
 */
function checkMarkerAnswer(markerData, jsonSchema) {
  if (!markerData || !jsonSchema || !jsonSchema.blocks) {
    return {
      userX: markerData ? markerData.userX || 0 : 0,
      userY: markerData ? markerData.userY || 0 : 0,
      actualErrorPercent: 0,
      isCorrect: false,
    };
  }

  // Ищем первый ImageMarkerBlock.
  var markerBlock = null;
  for (var i = 0; i < jsonSchema.blocks.length; i++) {
    if (jsonSchema.blocks[i].type === 'ImageMarkerBlock') {
      markerBlock = jsonSchema.blocks[i];
      break;
    }
  }

  if (!markerBlock) {
    return {
      userX: markerData ? markerData.userX || 0 : 0,
      userY: markerData ? markerData.userY || 0 : 0,
      actualErrorPercent: 0,
      isCorrect: false,
    };
  }

  var correctX = parseFloat(markerBlock.correctX) || 50;
  var correctY = parseFloat(markerBlock.correctY) || 50;
  var errorPercent = parseFloat(markerBlock.errorPercent) || 10;

  var userX = parseFloat(markerData.userX) || 0;
  var userY = parseFloat(markerData.userY) || 0;

  // Евклидово расстояние (радиус-вектор) в %.
  var dx = Math.abs(userX - correctX);
  var dy = Math.abs(userY - correctY);
  var distancePercent = Math.sqrt(dx * dx + dy * dy);

  var isCorrect = distancePercent <= errorPercent;

  return {
    userX: userX,
    userY: userY,
    actualErrorPercent: Math.round(distancePercent * 100) / 100,
    isCorrect: isCorrect,
  };
}

/**
 * Парсит число из произвольного значения пользователя.
 * Запятая нормализуется в точку, пробелы обрезаются.
 *
 * @param {*} value - сырое значение ответа
 * @returns {number} число или NaN, если значение не числовое
 */
function parseNumeric(value) {
  if (value === null || value === undefined) return NaN;
  var normalized = String(value).trim().replace(',', '.');
  if (normalized === '') return NaN;
  return parseFloat(normalized);
}

/**
 * Проверяет числовые ответы по схеме карточки (по аналогии с checkMarkerAnswer).
 *
 * Автопроверка включается только для блоков InputField с inputType === 'number'
 * и непустым correctAnswer. Допуск — процентный (tolerancePercent):
 * isCorrect = |user − correct| / |correct| × 100 ≤ tolerancePercent.
 * Особые случаи: correct = 0 → верен только точный 0; нечисловой ввод → isCorrect: false.
 *
 * @param {Object} inputs - сырые значения { [answerKey]: string }
 * @param {Object} jsonSchema - схема карточки с блоками
 * @returns {Object} { [answerKey]: { answer, actualErrorPercent, isCorrect } }
 */
function checkInputsAnswer(inputs, jsonSchema) {
  var results = {};
  if (!inputs || !jsonSchema || !jsonSchema.blocks) return results;

  for (var i = 0; i < jsonSchema.blocks.length; i++) {
    var block = jsonSchema.blocks[i];
    if (!block || block.type !== 'InputField') continue;
    if (block.inputType !== 'number') continue;

    var correctRaw = block.correctAnswer;
    if (correctRaw === undefined || correctRaw === null || String(correctRaw).trim() === '') continue;

    var key = block.answerKey;
    var rawValue = Object.prototype.hasOwnProperty.call(inputs, key) ? inputs[key] : '';
    var userNum = parseNumeric(rawValue);
    var correctNum = parseNumeric(correctRaw);

    var tolerancePercent = parseFloat(block.tolerancePercent);
    if (isNaN(tolerancePercent) || tolerancePercent < 0) tolerancePercent = 0;

    var entry = { answer: rawValue === undefined || rawValue === null ? '' : String(rawValue) };

    if (isNaN(userNum) || isNaN(correctNum)) {
      entry.actualErrorPercent = null;
      entry.isCorrect = false;
    } else if (correctNum === 0) {
      // Правильный ответ 0: процент отклонения не определён, верен только точный 0.
      entry.actualErrorPercent = userNum === 0 ? 0 : null;
      entry.isCorrect = userNum === 0;
    } else {
      var errorPercent = Math.abs(userNum - correctNum) / Math.abs(correctNum) * 100;
      entry.actualErrorPercent = Math.round(errorPercent * 100) / 100;
      entry.isCorrect = errorPercent <= tolerancePercent;
    }

    results[key] = entry;
  }

  return results;
}

/**
 * Возвращает карту эталонных объектов DnD-зон из схемы карточки.
 *
 * @param {Object} jsonSchema - схема карточки с блоками
 * @returns {Object} { [zoneId]: string[] } — только зоны с непустым correctObjectIds
 */
function getDndExpectedMap(jsonSchema) {
  var expectedMap = {};
  if (!jsonSchema || !jsonSchema.blocks) return expectedMap;

  for (var i = 0; i < jsonSchema.blocks.length; i++) {
    var block = jsonSchema.blocks[i];
    if (!block || block.type !== 'DragZone') continue;
    if (!Array.isArray(block.correctObjectIds) || block.correctObjectIds.length === 0) continue;
    expectedMap[block.zoneId] = block.correctObjectIds;
  }

  return expectedMap;
}

/**
 * Проверяет раскладку одной зоны: каждый объект верен, если он входит
 * в список эталонных; зона верна при точном совпадении множеств объектов.
 * Порядок объектов произвольный.
 *
 * @param {string[]} objectIds - фактические объекты зоны
 * @param {string[]} expectedIds - эталонные объекты зоны
 * @returns {Object} { objectsCorrect: boolean[], isCorrect: boolean }
 */
function checkDndZone(objectIds, expectedIds) {
  var expectedMap = {};
  for (var j = 0; j < expectedIds.length; j++) {
    expectedMap[expectedIds[j]] = true;
  }

  var actualMap = {};
  var objectsCorrect = [];
  for (var k = 0; k < objectIds.length; k++) {
    objectsCorrect.push(expectedMap[objectIds[k]] === true);
    actualMap[objectIds[k]] = true;
  }

  var isCorrect = objectIds.length === expectedIds.length;
  if (isCorrect) {
    for (var m = 0; m < expectedIds.length; m++) {
      if (actualMap[expectedIds[m]] !== true) {
        isCorrect = false;
        break;
      }
    }
  }

  return {
    objectsCorrect: objectsCorrect,
    isCorrect: isCorrect,
  };
}

/**
 * Преобразует ответ в строку для Answers.user_answer.
 *
 * Правила (единый формат для всех карточек):
 * 1. Всегда полный JSON { inputs, dnd }, включая пустое состояние.
 * 2. Числовые InputField с заданным correctAnswer записываются как
 *    { answer, actualErrorPercent, isCorrect }; остальные поля — строкой.
 * 3. DragZone со списком correctObjectIds записывается как
 *    { objects, objectsCorrect, isCorrect }; остальные зоны — массивом id.
 * 4. Marker есть → добавляется поле marker с результатами проверки.
 */
function normalizeUserAnswer(rawAnswer, jsonSchema) {
  if (typeof rawAnswer !== 'string') {
    return JSON.stringify(rawAnswer || {});
  }

  var parsed;
  try {
    parsed = JSON.parse(rawAnswer);
  } catch (error) {
    return rawAnswer;
  }

  if (!parsed || typeof parsed !== 'object') return rawAnswer;

  var inputs = parsed.inputs || {};
  var dnd = parsed.dnd || {};
  var marker = parsed.marker || null;

  // Проверяем наличие маркера и вычисляем правильность.
  var markerResult = null;
  if (marker) {
    markerResult = checkMarkerAnswer(marker, jsonSchema);
  }

  // Проверка числовых полей: проверяемые ключи заменяются объектом результата,
  // остальные поля сохраняются строкой «как есть».
  var checkedInputs = checkInputsAnswer(inputs, jsonSchema);
  var inputsOut = {};
  for (var inputKey in inputs) {
    if (Object.prototype.hasOwnProperty.call(inputs, inputKey)) {
      inputsOut[inputKey] = Object.prototype.hasOwnProperty.call(checkedInputs, inputKey)
        ? checkedInputs[inputKey]
        : inputs[inputKey];
    }
  }

  // Проверка DnD-зон: настроенные зоны заменяются объектом результата,
  // остальные (и unassigned) остаются массивами id.
  var expectedMap = getDndExpectedMap(jsonSchema);
  var dndOut = {};
  for (var zoneKey in dnd) {
    if (!Object.prototype.hasOwnProperty.call(dnd, zoneKey)) continue;
    var zoneObjects = dnd[zoneKey];
    if (
      Array.isArray(zoneObjects) &&
      zoneKey !== 'unassigned' &&
      Object.prototype.hasOwnProperty.call(expectedMap, zoneKey)
    ) {
      var zoneCheck = checkDndZone(zoneObjects, expectedMap[zoneKey]);
      dndOut[zoneKey] = {
        objects: zoneObjects,
        objectsCorrect: zoneCheck.objectsCorrect,
        isCorrect: zoneCheck.isCorrect,
      };
    } else {
      dndOut[zoneKey] = zoneObjects;
    }
  }

  // Единый формат: всегда полный JSON { inputs, dnd } (+ marker при наличии).
  var result = {
    inputs: inputsOut,
    dnd: dndOut,
  };
  if (markerResult) {
    result.marker = markerResult;
  }
  return JSON.stringify(result);
}

function saveAnswer(answer) {
  if (!answer.vk_id || !answer.card_id) {
    throw new Error('vk_id and card_id are required');
  }

  // Сериализуем проверку дубля и вставку: параллельные запросы без лока
  // могли бы оба пройти проверку и записать два одинаковых ответа.
  var lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    if (hasUserAnswered(answer.vk_id, answer.card_id)) {
      throw new Error('ANSWER_DUPLICATE');
    }

    var id = nextId(SHEET_ANSWERS);

    // Получаем схему карточки для проверки маркера.
    var card = getCard(answer.card_id);
    var jsonSchema = null;
    if (card && card.json_schema) {
      try {
        jsonSchema = JSON.parse(card.json_schema);
      } catch (e) {
        Logger.log('Failed to parse json_schema: ' + e);
      }
    }

    appendRow(SHEET_ANSWERS, {
      id: id,
      vk_id: answer.vk_id,
      card_id: answer.card_id,
      open_timestamp: answer.open_timestamp,
      submit_timestamp: answer.submit_timestamp || new Date().toISOString(),
      delta_seconds: answer.delta_seconds || 0,
      user_answer: normalizeUserAnswer(answer.user_answer, jsonSchema),
      has_reposted: answer.has_reposted || false,
    });

    if (answer.log && Array.isArray(answer.log) && answer.log.length > 0) {
      writeLog(answer.vk_id, answer.log);
    }

    return { id: id };
  } finally {
    lock.releaseLock();
  }
}

/**
 * Отвечал ли пользователь на карточку (пара vk_id + card_id в Answers).
 */
function hasUserAnswered(vkId, cardId) {
  var rows = readSheet(SHEET_ANSWERS);
  for (var i = 0; i < rows.length; i++) {
    if (String(rows[i].vk_id) === String(vkId) && String(rows[i].card_id) === String(cardId)) {
      return true;
    }
  }
  return false;
}

/**
 * Список карточек, на которые пользователь уже ответил.
 *
 * @param {string} vkId
 * @returns {string[]} массив card_id
 */
function getAnsweredCards(vkId) {
  if (!vkId) throw new Error('vk_id is required');

  var rows = readSheet(SHEET_ANSWERS);
  var answered = {};
  for (var i = 0; i < rows.length; i++) {
    if (String(rows[i].vk_id) === String(vkId)) {
      answered[String(rows[i].card_id)] = true;
    }
  }

  return Object.keys(answered);
}

/**
 * Записывает накопленную пачку событий в лист Logs ОДНОЙ строкой:
 * [vk_id, timestamp, log] — вся пачка сериализуется одной JSON-строкой
 * в ячейке «log». Одна строка = одна отправка (ответ, отзыв, автосброс,
 * ручная отправка из админки); старые строки остаются как архив.
 *
 * LockService + appendRow: параллельные запросы без лока вычисляли бы
 * одну и ту же «следующую строку» и затирали бы друг друга.
 *
 * @param {string} vkId - владелец лога ('admin' для ручной отправки из админ­ки)
 * @param {Array<Object>} events - события буфера { timestamp, event_type, event_data, ... }
 */
function writeLog(vkId, events) {
  // Сериализуем записи в Logs: параллельные запросы без лока вычисляли бы
  // одну и ту же «следующую строку» и затирали друг друга.
  var lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    var sheet = getSheet(SHEET_LOGS);
    // Атомарное добавление в конец: три колонки
    // [vk_id, timestamp, весь накопленный лог одной JSON-строкой].
    sheet.appendRow([
      vkId || 'anonymous',
      new Date().toISOString(),
      JSON.stringify(events),
    ]);
  } finally {
    lock.releaseLock();
  }
}

/**
 * Ручная/автоматическая отправка лога.
 * Клиентский автосброс присылает vk_id пользователя; кнопка «Отправить лог»
 * в админке vk_id не передаёт — запись уходит с vk_id='admin'.
 */
function saveManualLog(body) {
  var events = body.log;
  if (!events || !Array.isArray(events) || events.length === 0) {
    throw new Error('log is required and must be a non-empty array');
  }

  writeLog(body.vk_id || 'admin', events);
  return { saved: true, count: events.length };
}

// ============================================================
// Feedback
// ============================================================

function saveFeedback(feedback) {
  if (!feedback.message || !String(feedback.message).trim()) {
    throw new Error('message is required');
  }

  var id = nextId(SHEET_FEEDBACK);

  appendRow(SHEET_FEEDBACK, {
    id: id,
    timestamp: new Date().toISOString(),
    vk_id: feedback.vk_id || 'anonymous',
    name: feedback.name || '',
    card_id: feedback.card_id || '',
    message: String(feedback.message).trim(),
  });

  if (feedback.log && Array.isArray(feedback.log) && feedback.log.length > 0) {
    writeLog(feedback.vk_id || 'anonymous', feedback.log);
  }

  return { id: id };
}

// ============================================================
// Statistics
// ============================================================

function getStats() {
  var cards = readSheet(SHEET_CARDS);
  var answers = readSheet(SHEET_ANSWERS);
  var users = readSheet(SHEET_USERS);
  var totalUsers = users.length;

  var notificationSubscribedCount = users.filter(function(user) {
    return user.subscribed === true || user.subscribed === 'TRUE' || user.subscribed === 'true';
  }).length;

  var groupSubscribedCount = getGroupSubscribedCount(users.map(function(user) {
    return user.vk_id;
  }));

  return cards.map(function(card) {
    var cardAnswers = answers.filter(function(answer) {
      return String(answer.card_id) === String(card.card_id);
    });

    var uniqueRespondents = {};
    cardAnswers.forEach(function(answer) {
      uniqueRespondents[String(answer.vk_id)] = true;
    });

    var uniqueRespondentCount = Object.keys(uniqueRespondents).length;
    var deltas = cardAnswers.map(function(answer) {
      return parseFloat(answer.delta_seconds) || 0;
    });
    var totalAnswers = cardAnswers.length;
    var avgDelta = totalAnswers
      ? deltas.reduce(function(sum, value) { return sum + value; }, 0) / totalAnswers
      : 0;

    return {
      card_id: String(card.card_id),
      title: card.title,
      total_answers: totalAnswers,
      total_users: totalUsers,
      subscribed_count: notificationSubscribedCount,
      subscribed_group_count: groupSubscribedCount,
      pct_answered: totalUsers ? Math.round(uniqueRespondentCount / totalUsers * 100) : 0,
      avg_delta: Math.round(avgDelta),
      min_delta: totalAnswers ? Math.round(Math.min.apply(null, deltas)) : 0,
      max_delta: totalAnswers ? Math.round(Math.max.apply(null, deltas)) : 0,
      reposted_count: cardAnswers.filter(function(answer) {
        return answer.has_reposted === true || answer.has_reposted === 'TRUE' || answer.has_reposted === 'true';
      }).length,
    };
  });
}

function getGroupSubscribedCount(vkIds) {
  var cache = getCache();
  var cached = cache.get('group_subscribed_count');
  if (cached !== null) return parseInt(cached, 10);

  var props = PropertiesService.getScriptProperties();
  var token = props.getProperty('VK_SERVICE_TOKEN');
  var groupId = props.getProperty('VK_GROUP_ID_FOR_MEMBERSHIP');

  if (!token || !groupId) return 0;

  var uniqueIds = [];
  var seen = {};

  vkIds.forEach(function(vkId) {
    var id = String(vkId || '').trim();
    if (id && !seen[id]) {
      seen[id] = true;
      uniqueIds.push(id);
    }
  });

  var result = 0;
  var batchSize = 500;

  for (var i = 0; i < uniqueIds.length; i += batchSize) {
    var batch = uniqueIds.slice(i, i + batchSize);

    try {
      var response = UrlFetchApp.fetch(
        'https://api.vk.com/method/groups.isMember?' + serializeParams({
          group_id: groupId,
          user_ids: batch.join(','),
          v: '5.199',
          access_token: token,
        }),
      );

      var data = JSON.parse(response.getContentText());
      if (data.error) {
        Logger.log('groups.isMember error: ' + data.error.error_msg);
        continue;
      }

      (data.response || []).forEach(function(item) {
        if (item.member === 1) result += 1;
      });
    } catch (error) {
      Logger.log('groups.isMember batch failed: ' + String(error));
    }
  }

  cache.put('group_subscribed_count', String(result), GROUP_MEMBERSHIP_CACHE_TTL_SEC);
  return result;
}

// ============================================================
// Offline queue
// ============================================================

function syncOffline(body) {
  var answers = body.answers || [];
  var saved = 0;
  var skipped = 0;

  answers.forEach(function(answer) {
    try {
      saveAnswer(answer);
      saved += 1;
    } catch (error) {
      // Дубликат после сбоя между сохранением и очисткой очереди —
      // это нормальный исход: ответ уже есть в таблице.
      if (String(error).indexOf('ANSWER_DUPLICATE') !== -1) {
        skipped += 1;
      } else {
        Logger.log('syncOffline failed: ' + String(error));
      }
    }
  });

  return { saved: saved, skipped: skipped };
}

// ============================================================
// VK repost check
// ============================================================

function checkRepostViaVK(vkId, postId) {
  var props = PropertiesService.getScriptProperties();
  var token = props.getProperty('VK_SERVICE_TOKEN');
  var ownerId = props.getProperty('VK_OWNER_ID');

  if (!token) throw new Error('VK_SERVICE_TOKEN not set in Script Properties');
  if (!ownerId) throw new Error('VK_OWNER_ID not set in Script Properties');

  var response = UrlFetchApp.fetch(
    'https://api.vk.com/method/wall.getReposts?' + serializeParams({
      owner_id: ownerId,
      post_id: postId,
      count: 100,
      v: '5.199',
      access_token: token,
    }),
  );

  var data = JSON.parse(response.getContentText());
  if (data.error) throw new Error(data.error.error_msg);

  var reposts = data.response && data.response.items ? data.response.items : [];
  return reposts.some(function(item) {
    return String(item.from_id) === String(vkId);
  });
}

function serializeParams(obj) {
  return Object.keys(obj).map(function(key) {
    return encodeURIComponent(key) + '=' + encodeURIComponent(obj[key]);
  }).join('&');
}

// ============================================================
// Setup
// ============================================================

function setupSheets() {
  Object.keys(HEADERS).forEach(function(name) {
    getSheet(name);
  });
  Logger.log('Sheets initialized: ' + Object.keys(HEADERS).join(', '));
}
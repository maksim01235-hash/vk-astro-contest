/**
 * Google Apps Script backend for VK Contest.
 *
 * Обновления (август 2026):
 *  - CacheService для getCards/getCard/saveCard (TTL 5 мин).
 *  - Индекс строк Cards через CacheService для быстрого updateRow.
 *  - Новый action getCardsList (без json_schema).
 *  - Logs: старые строки — архив, новые — 3 столбца (vk_id, timestamp, log).
 *  - saveAnswer/saveFeedback принимают log и пишут его в Logs.
 */

var SHEET_USERS = 'Users';
var SHEET_CARDS = 'Cards';
var SHEET_ANSWERS = 'Answers';
var SHEET_LOGS = 'Logs';
var FEEDBACK_CELL = 'A2';

var HEADERS = {
  Users: ['vk_id', 'name', 'reg_date', 'subscribed', 'last_activity'],
  Cards: ['card_id', 'title', 'release_datetime', 'post_id', 'json_schema', 'is_active'],
  Answers: ['id', 'vk_id', 'card_id', 'open_timestamp', 'submit_timestamp', 'delta_seconds', 'user_answer', 'has_reposted'],
  Logs: ['id', 'timestamp', 'vk_id', 'event_type', 'event_data', 'page_url', 'user_agent'],
};

// Кеш: 5 минут для карточек.
var CACHE_TTL_SEC = 300;

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
      case 'getStats': result = getStats(); break;
      case 'checkRepost': result = checkRepostViaVK(e.parameter.vk_id, e.parameter.post_id); break;
      case 'getServerTime': result = { iso: new Date().toISOString() }; break;
      default: return jsonOut({ ok: false, error: 'Unknown action: ' + action });
    }
    return jsonOut({ ok: true, data: result });
  } catch (err) {
    return jsonOut({ ok: false, error: String(err) });
  }
}

function doPost(e) {
  try {
    var action = String((e.parameter && e.parameter.action) || '');
    var body = e.postData && e.postData.contents ? JSON.parse(e.postData.contents) : {};
    var result;
    switch (action) {
      case 'saveAnswer': result = saveAnswer(body); break;
      case 'saveUser': result = saveUser(body); break;
      case 'saveFeedback': result = saveFeedback(body); break;
      case 'saveCard': result = saveCard(body); break;
      case 'syncOffline': result = syncOffline(body); break;
      default: return jsonOut({ ok: false, error: 'Unknown action: ' + action });
    }
    return jsonOut({ ok: true, data: result });
  } catch (err) {
    return jsonOut({ ok: false, error: String(err) });
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
    var obj = {};
    for (var j = 0; j < headers.length; j++) obj[headers[j]] = data[i][j];
    rows.push(obj);
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
  sheet.appendRow(headers.map(function(h) {
    return obj[h] !== undefined ? obj[h] : '';
  }));
}

function updateRow(name, key, value, updates) {
  var sheet = getSheet(name);
  var data = sheet.getDataRange().getValues();
  if (!data.length) return false;
  var headers = data[0];
  for (var i = 1; i < data.length; i++) {
    if (String(data[i][0]) === String(value)) {
      for (var j = 0; j < headers.length; j++) {
        if (updates[headers[j]] !== undefined) {
          sheet.getRange(i + 1, j + 1).setValue(updates[headers[j]]);
        }
      }
      return true;
    }
  }
  return false;
}

function nextId(name) {
  var rows = readSheet(name);
  var max = 0;
  rows.forEach(function(row) {
    var n = parseInt(row.id, 10);
    if (!isNaN(n) && n > max) max = n;
  });
  return max + 1;
}

// ============================================================
// КЕШИРОВАНИЕ КАРТОЧЕК (CacheService)
// ============================================================

function getCards() {
  var cache = getCache();
  var cached = cache.get('cards_all');
  if (cached) {
    return JSON.parse(cached);
  }
  var cards = readSheet(SHEET_CARDS).filter(function(r) {
    return r.is_active === true || r.is_active === 'TRUE' || r.is_active === 'true';
  });
  cache.put('cards_all', JSON.stringify(cards), CACHE_TTL_SEC);
  return cards;
}

/**
 * Новый action: только card_id, title, is_active (без json_schema).
 * Используется в админке для селектора карточек.
 */
function getCardsList() {
  var cache = getCache();
  var cached = cache.get('cards_list');
  if (cached) {
    return JSON.parse(cached);
  }
  var cards = readSheet(SHEET_CARDS).filter(function(r) {
    return r.is_active === true || r.is_active === 'TRUE' || r.is_active === 'true';
  });
  var list = cards.map(function(c) {
    return {
      card_id: c.card_id,
      title: c.title,
      is_active: c.is_active,
    };
  });
  cache.put('cards_list', JSON.stringify(list), CACHE_TTL_SEC);
  return list;
}

function getCard(id) {
  var cache = getCache();
  var cached = cache.get('card_' + String(id));
  if (cached) {
    return JSON.parse(cached);
  }
  var card = findRow(SHEET_CARDS, 'card_id', id);
  if (card) {
    cache.put('card_' + String(id), JSON.stringify(card), CACHE_TTL_SEC);
  }
  return card;
}

/**
 * Инвалидация кеша при записи карточки.
 * Также ведём индекс card_id → номер строки для быстрого updateRow.
 */
function invalidateCardCache(cardId) {
  var cache = getCache();
  cache.remove('cards_all');
  cache.remove('cards_list');
  cache.remove('card_' + String(cardId));
}

function getCardsRowIndex(cardId) {
  var cache = getCache();
  var idx = cache.get('cards_index');
  if (idx) {
    var map = JSON.parse(idx);
    if (map[String(cardId)]) return map[String(cardId)];
  }
  // Индекса нет — сканируем лист (один раз), строим карту.
  var sheet = getSheet(SHEET_CARDS);
  var data = sheet.getDataRange().getValues();
  if (!data.length) return null;
  var headers = data[0];
  var cardIdCol = headers.indexOf('card_id');
  if (cardIdCol === -1) return null;
  var map = {};
  for (var i = 1; i < data.length; i++) {
    var cid = String(data[i][cardIdCol]);
    map[cid] = i + 1; // 1-based row number
  }
  cache.put('cards_index', JSON.stringify(map), CACHE_TTL_SEC);
  return map[String(cardId)] || null;
}

function updateCardsIndex(cardId, rowNum) {
  var cache = getCache();
  var idx = cache.get('cards_index');
  var map = idx ? JSON.parse(idx) : {};
  map[String(cardId)] = rowNum;
  cache.put('cards_index', JSON.stringify(map), CACHE_TTL_SEC);
}

// ============================================================
// ПОЛЬЗОВАТЕЛИ
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
// ОТВЕТЫ (с схлопыванием user_answer на сервере, опционально)
// ============================================================

function saveAnswer(answer) {
  if (!answer.vk_id || !answer.card_id) throw new Error('vk_id and card_id are required');
  var id = nextId(SHEET_ANSWERS);
  
  // Схлопывание user_answer на сервере (если клиент не схлопнул сам).
  var userAnswer = answer.user_answer;
  if (typeof userAnswer === 'string') {
    try {
      var parsed = JSON.parse(userAnswer);
      if (parsed.inputs && parsed.dnd) {
        var dndEmpty = true;
        for (var k in parsed.dnd) {
          if (k !== 'unassigned' && parsed.dnd[k].length > 0) {
            dndEmpty = false;
            break;
          }
        }
        if (dndEmpty) {
          var inputs = parsed.inputs || {};
          var keys = Object.keys(inputs);
          if (keys.length === 1) {
            userAnswer = inputs[keys[0]];
          } else if (keys.length > 1) {
            // Склейка через ";" в порядке keys (сортировка для предсказуемости).
            keys.sort();
            userAnswer = keys.map(function(k) { return inputs[k]; }).join(';');
          }
        }
      }
    } catch (e) {
      // Не JSON — оставляем как есть.
    }
  }
  
  appendRow(SHEET_ANSWERS, {
    id: id,
    vk_id: answer.vk_id,
    card_id: answer.card_id,
    open_timestamp: answer.open_timestamp,
    submit_timestamp: answer.submit_timestamp || new Date().toISOString(),
    delta_seconds: answer.delta_seconds || 0,
    user_answer: typeof userAnswer === 'string' ? userAnswer : JSON.stringify(userAnswer),
    has_reposted: answer.has_reposted || false,
  });
  
  // Если пришёл log — пишем в Logs (новая схема: vk_id, timestamp, log).
  if (answer.log && Array.isArray(answer.log) && answer.log.length > 0) {
    writeLogBatch([answer.vk_id], [new Date().toISOString()], [JSON.stringify(answer.log)]);
  }
  
  return { id: id };
}

// ============================================================
// ЛОГИ (новая схема: vk_id, timestamp, log — одним JSON в ячейке)
// ============================================================

/**
 * Пишет пачку логов в лист Logs.
 * Старые строки (7 столбцов) остаются как архив.
 * Новые записываются в 3 столбца: vk_id, timestamp, log.
 */
function writeLogBatch(vkIds, timestamps, logsJson) {
  var sheet = getSheet(SHEET_LOGS);
  var lastRow = sheet.getLastRow();
  var newRows = [];
  for (var i = 0; i < vkIds.length; i++) {
    newRows.push([
      vkIds[i],
      timestamps[i],
      logsJson[i],
    ]);
  }
  if (newRows.length > 0) {
    sheet.getRange(lastRow + 1, 1, newRows.length, 3).setValues(newRows);
  }
}

/**
 * Обратная связь: теперь лог фидбэка пишется в Logs (новая схема),
 * а не в отдельную ячейку A2. Старые записи в A2 остаются как архив.
 */
function saveFeedback(feedback) {
  if (!feedback.message || !String(feedback.message).trim()) {
    throw new Error('message is required');
  }
  
  var entry = {
    timestamp: new Date().toISOString(),
    vk_id: feedback.vk_id || 'anonymous',
    event_type: 'feedback',
    event_data: {
      card_id: feedback.card_id || '',
      name: feedback.name || '',
      message: String(feedback.message).trim(),
    },
    page_url: feedback.page_url || '',
    user_agent: feedback.user_agent || '',
  };
  
  // Пишем в Logs (новая схема: vk_id, timestamp, log).
  var logJson = JSON.stringify([entry]);
  writeLogBatch([entry.vk_id], [entry.timestamp], [logJson]);
  
  return { saved: true };
}

// ============================================================
// КАРТОЧКИ (с кешем и индексом строк)
// ============================================================

function saveCard(card) {
  if (!card.card_id) throw new Error('card_id is required');
  var existing = findRow(SHEET_CARDS, 'card_id', card.card_id);
  var record = {
    card_id: card.card_id,
    title: card.title || '',
    release_datetime: card.release_datetime || '',
    post_id: card.post_id || '',
    json_schema: typeof card.json_schema === 'string' ? card.json_schema : JSON.stringify(card.json_schema),
    is_active: card.is_active !== false,
  };
  if (existing) {
    var rowNum = getCardsRowIndex(card.card_id);
    if (rowNum) {
      var sheet = getSheet(SHEET_CARDS);
      var headers = HEADERS.Cards;
      for (var j = 0; j < headers.length; j++) {
        if (record[headers[j]] !== undefined) {
          sheet.getRange(rowNum, j + 1).setValue(record[headers[j]]);
        }
      }
    } else {
      // Индекс не нашёл — fallback на updateRow.
      updateRow(SHEET_CARDS, 'card_id', card.card_id, record);
    }
  } else {
    appendRow(SHEET_CARDS, record);
    // Обновляем индекс: новая строка = lastRow.
    var sheet = getSheet(SHEET_CARDS);
    updateCardsIndex(card.card_id, sheet.getLastRow());
  }
  
  // Инвалидируем кеш.
  invalidateCardCache(card.card_id);
  
  return { saved: true };
}

// ============================================================
// СТАТИСТИКА
// ============================================================

function getStats() {
  var cards = readSheet(SHEET_CARDS);
  var answers = readSheet(SHEET_ANSWERS);
  var users = readSheet(SHEET_USERS);
  var totalUsers = users.length;
  return cards.map(function(card) {
    var cardAnswers = answers.filter(function(a) {
      return String(a.card_id) === String(card.card_id);
    });
    var deltas = cardAnswers.map(function(a) { return parseFloat(a.delta_seconds) || 0; });
    var total = cardAnswers.length;
    var avg = total ? deltas.reduce(function(s, d) { return s + d; }, 0) / total : 0;
    return {
      card_id: String(card.card_id),
      title: card.title,
      total_answers: total,
      total_users: totalUsers,
      pct_answered: totalUsers ? Math.round(total / totalUsers * 100) : 0,
      avg_delta: Math.round(avg),
      min_delta: total ? Math.round(Math.min.apply(null, deltas)) : 0,
      max_delta: total ? Math.round(Math.max.apply(null, deltas)) : 0,
      reposted_count: cardAnswers.filter(function(a) { return a.has_reposted === true; }).length,
    };
  });
}

// ============================================================
// ОФФЛАЙН-ОЧЕРЕДЬ
// ============================================================

function syncOffline(body) {
  var answers = body.answers || [];
  var saved = 0;
  answers.forEach(function(answer) {
    try { saveAnswer(answer); saved++; } catch (e) {}
  });
  return { saved: saved };
}

// ============================================================
// ПРОВЕРКА РЕПОСТА (VK API)
// ============================================================

function checkRepostViaVK(vkId, postId) {
  var props = PropertiesService.getScriptProperties();
  var token = props.getProperty('VK_SERVICE_TOKEN');
  var ownerId = props.getProperty('VK_OWNER_ID');
  if (!token) throw new Error('VK_SERVICE_TOKEN not set in Script Properties');
  if (!ownerId) throw new Error('VK_OWNER_ID not set in Script Properties');
  var params = {
    owner_id: ownerId,
    post_id: postId,
    count: 100,
    v: '5.199',
    access_token: token,
  };
  var response = UrlFetchApp.fetch('https://api.vk.com/method/wall.getReposts?' + serializeParams(params));
  var data = JSON.parse(response.getContentText());
  if (data.error) throw new Error(data.error.error_msg);
  var reposts = data.response && data.response.items ? data.response.items : [];
  return reposts.some(function(item) { return String(item.from_id) === String(vkId); });
}

function serializeParams(obj) {
  return Object.keys(obj).map(function(k) {
    return encodeURIComponent(k) + '=' + encodeURIComponent(obj[k]);
  }).join('&');
}

// ============================================================
// ИНИЦИАЛИЗАЦИЯ ЛИСТОВ
// ============================================================

function setupSheets() {
  Object.keys(HEADERS).forEach(function(name) { getSheet(name); });
  Logger.log('Sheets initialized: ' + Object.keys(HEADERS).join(', '));
}
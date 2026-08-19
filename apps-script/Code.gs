/**
 * apps-script/Code.gs — Google Apps Script backend for VK Contest.
 *
 * Версия: август 2026.
 *
 * Возможности:
 *  - Кеширование Cards через CacheService.
 *  - Лёгкий getCardsList для админки.
 *  - user_answer: текстовые ответы схлопываются в строку;
 *    DnD-карточки всегда сохраняют полную JSON-структуру.
 *  - Лог пишется вместе с saveAnswer/saveFeedback, одной ячейкой на отправку.
 *  - Feedback записывается отдельными строками в лист Feedback.
 *  - Статистика считает уникальных ответивших пользователей.
 *  - Считает участников конкурса, подписанных на группу VK.
 *
 * Script Properties:
 *  VK_SERVICE_TOKEN              — service token VK API.
 *  VK_OWNER_ID                   — owner_id для проверки репостов.
 *  VK_GROUP_ID_FOR_MEMBERSHIP    — ID группы для подсчёта подписок среди участников.
 */

var SHEET_USERS = 'Users';
var SHEET_CARDS = 'Cards';
var SHEET_ANSWERS = 'Answers';
var SHEET_LOGS = 'Logs';
var SHEET_FEEDBACK = 'Feedback';

var HEADERS = {
  Users: ['vk_id', 'name', 'reg_date', 'subscribed', 'last_activity'],
  Cards: ['card_id', 'title', 'release_datetime', 'post_id', 'json_schema', 'is_active'],
  Answers: ['id', 'vk_id', 'card_id', 'open_timestamp', 'submit_timestamp', 'delta_seconds', 'user_answer', 'has_reposted'],
  // Старые строки Logs остаются архивом. Новые записи используют первые 3 столбца:
  // vk_id, timestamp, log.
  Logs: ['id', 'timestamp', 'vk_id', 'event_type', 'event_data', 'page_url', 'user_agent'],
  Feedback: ['id', 'timestamp', 'vk_id', 'name', 'card_id', 'message'],
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
      case 'getStats': result = getStats(); break;
      case 'checkRepost': result = checkRepostViaVK(e.parameter.vk_id, e.parameter.post_id); break;
      case 'getServerTime': result = { iso: new Date().toISOString() }; break;
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

  if (findRow(SHEET_CARDS, 'card_id', card.card_id)) {
    updateRow(SHEET_CARDS, 'card_id', card.card_id, record);
  } else {
    appendRow(SHEET_CARDS, record);
  }

  invalidateCardCache(card.card_id);
  return { saved: true };
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
 * Преобразует ответ в строку для Answers.user_answer.
 *
 * Правила:
 * 1. DnD есть (включая пустое/неразмещённое состояние) → полный JSON.
 * 2. DnD отсутствует, один inputs.answer → чистая строка ответа.
 * 3. DnD отсутствует, несколько inputs → значения через ";".
 */
function normalizeUserAnswer(rawAnswer) {
  if (typeof rawAnswer !== 'string') {
    return JSON.stringify(rawAnswer || {});
  }

  var parsed;
  try {
    parsed = JSON.parse(rawAnswer);
  } catch (error) {
    // Уже обычная строка.
    return rawAnswer;
  }

  if (!parsed || typeof parsed !== 'object') return rawAnswer;

  var inputs = parsed.inputs || {};
  var dnd = parsed.dnd || {};
  var dndKeys = Object.keys(dnd);

  /**
   * Важное правило:
   * DnD считается существующим, когда в объекте dnd есть хотя бы один ключ.
   * DnDContainer всегда передаёт unassigned при наличии DnD-объектов,
   * поэтому даже пустой ответ DnD-карточки сохраняет весь JSON.
   */
  if (dndKeys.length > 0) {
    return JSON.stringify({
      inputs: inputs,
      dnd: dnd,
    });
  }

  var inputKeys = Object.keys(inputs).sort();

  if (inputKeys.length === 1) {
    return String(inputs[inputKeys[0]] === undefined ? '' : inputs[inputKeys[0]]);
  }

  if (inputKeys.length > 1) {
    return inputKeys.map(function(key) {
      return String(inputs[key] === undefined ? '' : inputs[key]);
    }).join(';');
  }

  return '';
}

function saveAnswer(answer) {
  if (!answer.vk_id || !answer.card_id) {
    throw new Error('vk_id and card_id are required');
  }

  var id = nextId(SHEET_ANSWERS);

  appendRow(SHEET_ANSWERS, {
    id: id,
    vk_id: answer.vk_id,
    card_id: answer.card_id,
    open_timestamp: answer.open_timestamp,
    submit_timestamp: answer.submit_timestamp || new Date().toISOString(),
    delta_seconds: answer.delta_seconds || 0,
    user_answer: normalizeUserAnswer(answer.user_answer),
    has_reposted: answer.has_reposted || false,
  });

  // Лог пишется только как часть отправки ответа.
  if (answer.log && Array.isArray(answer.log) && answer.log.length > 0) {
    writeLog(answer.vk_id, answer.log);
  }

  return { id: id };
}

/**
 * Новая запись лога: одна строка на одну отправку.
 * Первые три столбца в листе Logs:
 *   A — vk_id
 *   B — timestamp
 *   C — JSON массива накопленных событий.
 *
 * Старые 7-колоночные строки не трогаются и остаются архивом.
 */
function writeLog(vkId, events) {
  var sheet = getSheet(SHEET_LOGS);
  var nextRow = sheet.getLastRow() + 1;
  sheet.getRange(nextRow, 1, 1, 3).setValues([[
    vkId || 'anonymous',
    new Date().toISOString(),
    JSON.stringify(events),
  ]]);
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

  // Лог пишется только как часть отправки обратной связи.
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

/**
 * Число пользователей из Users, которые состоят в нужной группе VK.
 * groups.isMember принимает до 500 user_ids за запрос.
 */
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

  answers.forEach(function(answer) {
    try {
      saveAnswer(answer);
      saved += 1;
    } catch (error) {
      Logger.log('syncOffline failed: ' + String(error));
    }
  });

  return { saved: saved };
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

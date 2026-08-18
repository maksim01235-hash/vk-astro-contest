/**
 * Google Apps Script backend for VK Contest.
 *
 * Обновления (август 2026, v2):
 *  - saveFeedback: запись отдельными строками в лист Feedback (было: ячейка A2).
 *  - getStats: добавлено subscribed_count.
 *  - getCards: кеш через CacheService (TTL 5 мин).
 *  - getCardsList: лёгкий список без json_schema.
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
  Logs: ['id', 'timestamp', 'vk_id', 'event_type', 'event_data', 'page_url', 'user_agent'],
  Feedback: ['id', 'timestamp', 'vk_id', 'name', 'card_id', 'message'],
};

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
// КЕШИРОВАНИЕ КАРТОЧЕК
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

function invalidateCardCache(cardId) {
  var cache = getCache();
  cache.remove('cards_all');
  cache.remove('cards_list');
  cache.remove('card_' + String(cardId));
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
// ОТВЕТЫ
// ============================================================

function saveAnswer(answer) {
  if (!answer.vk_id || !answer.card_id) throw new Error('vk_id and card_id are required');
  var id = nextId(SHEET_ANSWERS);
  appendRow(SHEET_ANSWERS, {
    id: id,
    vk_id: answer.vk_id,
    card_id: answer.card_id,
    open_timestamp: answer.open_timestamp,
    submit_timestamp: answer.submit_timestamp || new Date().toISOString(),
    delta_seconds: answer.delta_seconds || 0,
    user_answer: typeof answer.user_answer === 'string' ? answer.user_answer : JSON.stringify(answer.user_answer),
    has_reposted: answer.has_reposted || false,
  });
  return { id: id };
}

// ============================================================
// ОБРАТНАЯ СВЯЗЬ (новая версия: отдельные строки в лист Feedback)
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
  return { id: id };
}

// ============================================================
// КАРТОЧКИ
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
    updateRow(SHEET_CARDS, 'card_id', card.card_id, record);
  } else {
    appendRow(SHEET_CARDS, record);
  }
  invalidateCardCache(card.card_id);
  return { saved: true };
}

// ============================================================
// СТАТИСТИКА (с subscribed_count)
// ============================================================

function getStats() {
  var cards = readSheet(SHEET_CARDS);
  var answers = readSheet(SHEET_ANSWERS);
  var users = readSheet(SHEET_USERS);
  var totalUsers = users.length;
  
  // Подсчёт подписавшихся.
  var subscribedCount = 0;
  for (var i = 0; i < users.length; i++) {
    if (users[i].subscribed === true || users[i].subscribed === 'TRUE' || users[i].subscribed === 'true') {
      subscribedCount++;
    }
  }
  
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
      subscribed_count: subscribedCount,
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
// ПРОВЕРКА РЕПОСТА
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
// ИНИЦИАЛИЗАЦИЯ
// ============================================================

function setupSheets() {
  Object.keys(HEADERS).forEach(function(name) { getSheet(name); });
  Logger.log('Sheets initialized: ' + Object.keys(HEADERS).join(', '));
}
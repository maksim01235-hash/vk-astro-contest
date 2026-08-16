/**
 * ============================================================
 * Google Apps Script — бэкенд-прокси для VK Mini App.
 * ============================================================
 *
 * НАЗНАЧЕНИЕ:
 *  Этот скрипт работает как REST API поверх Google Sheets.
 *  Фронт (Next.js, статика на GitHub Pages) обращается к этому скрипту
 *  через URL веб-приложения для всех операций с данными.
 *
 * СТРУКТУРА ТАБЛИЦ (4 листа в одном документе Google Sheets):
 *
 * 1. Users:    vk_id | name | reg_date | subscribed | last_activity
 * 2. Cards:    card_id | title | release_datetime | post_id | json_schema | is_active
 * 3. Answers:  id | vk_id | card_id | open_timestamp | submit_timestamp | delta_seconds | user_answer | has_reposted
 * 4. Logs:     id | timestamp | vk_id | event_type | event_data | page_url | user_agent
 *
 * КАК ДЕПЛОИТЬ — см. docs/google-sheets-setup.md.
 *
 * ВАЖНО ПО CORS:
 *  Apps Script через ContentService не позволяет выставлять произвольные
 *  заголовки так же свободно, как Express. Для простых запросов (без preflight)
 *  фронт использует Content-Type: text/plain. Этот скрипт возвращает JSON
 *  в теле ContentService.MimeType.JSON — браузеры корректно читают его.
 *
 * БЕЗОПАСНОСТЬ:
 *  - Скрипт выполняется от имени владельника (Execute as: Me).
 *  - Доступ: Anyone (даже анонимные) — необходимо для статического фронта.
 *  - VK_SERVICE_TOKEN хранится в Script Properties (Файл → Свойства проекта).
 *  - Для production-защиты рекомендуется проверять подпись VK launch params
 *    (vk_user_id + vk_app_id + секрет), но это выходит за рамки MVP.
 * ============================================================
 */

// ============================================================
// КОНСТАНТЫ
// ============================================================

/** Имена листов в таблице. */
var SHEET_USERS = 'Users';
var SHEET_CARDS = 'Cards';
var SHEET_ANSWERS = 'Answers';
var SHEET_LOGS = 'Logs';

/** Заголовки столбцов для каждого листа (используется при инициализации). */
var HEADERS = {
  Users: ['vk_id', 'name', 'reg_date', 'subscribed', 'last_activity'],
  Cards: ['card_id', 'title', 'release_datetime', 'post_id', 'json_schema', 'is_active'],
  Answers: ['id', 'vk_id', 'card_id', 'open_timestamp', 'submit_timestamp', 'delta_seconds', 'user_answer', 'has_reposted'],
  Logs: ['id', 'timestamp', 'vk_id', 'event_type', 'event_data', 'page_url', 'user_agent'],
};

// ============================================================
// ОБРАБОТЧИКИ HTTP
// ============================================================

/**
 * doGet — обработка GET-запросов (чтение данных).
 * Параметр action определяет, что вернуть.
 */
function doGet(e) {
  try {
    var action = (e.parameter.action || '').toString();
    var result;

    switch (action) {
      case 'getCards':
        result = getCards();
        break;
      case 'getCard':
        result = getCard(e.parameter.id);
        break;
      case 'checkUser':
        result = checkUser(e.parameter.vk_id, e.parameter.name);
        break;
      case 'getStats':
        result = getStats();
        break;
      case 'checkRepost':
        result = checkRepostViaVK(e.parameter.vk_id, e.parameter.post_id);
        break;
      case 'getServerTime':
        result = { iso: new Date().toISOString() };
        break;
      default:
        return jsonOut({ ok: false, error: 'Unknown action: ' + action });
    }

    return jsonOut({ ok: true, data: result });
  } catch (err) {
    return jsonOut({ ok: false, error: String(err) });
  }
}

/**
 * doPost — обработка POST-запросов (запись данных).
 * Тело запроса — JSON-строка (Content-Type: text/plain).
 * Параметр action в query string.
 */
function doPost(e) {
  try {
    var action = (e.parameter.action || '').toString();
    var body = {};
    if (e.postData && e.postData.contents) {
      body = JSON.parse(e.postData.contents);
    }

    var result;

    switch (action) {
      case 'saveAnswer':
        result = saveAnswer(body);
        break;
      case 'saveUser':
        result = saveUser(body);
        break;
      case 'saveLog':
        result = saveLog(body);
        break;
      case 'saveCard':
        result = saveCard(body);
        break;
      case 'syncOffline':
        result = syncOffline(body);
        break;
      default:
        return jsonOut({ ok: false, error: 'Unknown action: ' + action });
    }

    return jsonOut({ ok: true, data: result });
  } catch (err) {
    return jsonOut({ ok: false, error: String(err) });
  }
}

// ============================================================
// ВЫВОД JSON (с CORS-дружественным форматом)
// ============================================================

/**
 * Возвращает JSON-ответ через ContentService.
 * Apps Script автоматически добавляет CORS-заголовки для простых запросов.
 */
function jsonOut(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

// ============================================================
// ХЕЛПЕРЫ ДЛЯ РАБОТЫ С ЛИСТАМИ
// ============================================================

/** Получить активную таблицу (spreadsheet). */
function getSS() {
  return SpreadsheetApp.getActiveSpreadsheet();
}

/** Получить лист по имени, создать если не существует. */
function getSheet(name) {
  var ss = getSS();
  var sheet = ss.getSheetByName(name);
  if (!sheet) {
    sheet = ss.insertSheet(name);
    // Записываем заголовки.
    sheet.getRange(1, 1, 1, HEADERS[name].length).setValues([HEADERS[name]]);
  }
  return sheet;
}

/** Прочитать все строки листа как массив объектов (по заголовкам). */
function readSheet(name) {
  var sheet = getSheet(name);
  var data = sheet.getDataRange().getValues();
  if (data.length < 2) return []; // только заголовки
  var headers = data[0];
  var rows = [];
  for (var i = 1; i < data.length; i++) {
    var obj = {};
    for (var j = 0; j < headers.length; j++) {
      obj[headers[j]] = data[i][j];
    }
    rows.push(obj);
  }
  return rows;
}

/** Найти строку по значению в первом столбце (vk_id, card_id, id). */
function findRow(name, key, value) {
  var rows = readSheet(name);
  for (var i = 0; i < rows.length; i++) {
    if (String(rows[i][key]) === String(value)) return rows[i];
  }
  return null;
}

/** Добавить строку в лист. */
function appendRow(name, obj) {
  var sheet = getSheet(name);
  var headers = HEADERS[name];
  var row = headers.map(function (h) {
    return obj[h] !== undefined ? obj[h] : '';
  });
  sheet.appendRow(row);
}

/** Обновить строку по ключу (первый столбец). */
function updateRow(name, key, value, updates) {
  var sheet = getSheet(name);
  var data = sheet.getDataRange().getValues();
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

/** Получить следующий автоинкрементный ID (max + 1). */
function nextId(name) {
  var rows = readSheet(name);
  var max = 0;
  for (var i = 0; i < rows.length; i++) {
    var n = parseInt(rows[i].id, 10);
    if (!isNaN(n) && n > max) max = n;
  }
  return max + 1;
}

// ============================================================
// ДЕЙСТВИЯ (АКЦИИ)
// ============================================================

/**
 * getCards — вернуть все активные карточки.
 * @returns массив объектов карточек.
 */
function getCards() {
  var rows = readSheet(SHEET_CARDS);
  return rows.filter(function (r) {
    return r.is_active === true || r.is_active === 'TRUE' || r.is_active === 'true';
  });
}

/**
 * getCard — вернуть одну карточку по ID.
 */
function getCard(id) {
  return findRow(SHEET_CARDS, 'card_id', id);
}

/**
 * checkUser — проверить пользователя по VK ID. Если нового — автосоздание.
 * Принимает опционально name (имя из VK) для сохранения.
 * @returns запись пользователя.
 */
function checkUser(vkId, name) {
  if (!vkId) throw new Error('vk_id is required');
  var existing = findRow(SHEET_USERS, 'vk_id', vkId);
  if (existing) {
    // Обновляем last_activity и name (если передано).
    var updates = { last_activity: new Date().toISOString() };
    if (name) updates.name = name;
    updateRow(SHEET_USERS, 'vk_id', vkId, updates);
    if (name) existing.name = name;
    existing.last_activity = updates.last_activity;
    return existing;
  }
  // Новый — создаём.
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

/**
 * saveUser — сохранить/обновить пользователя.
 */
function saveUser(user) {
  if (!user.vk_id) throw new Error('vk_id is required');
  var existing = findRow(SHEET_USERS, 'vk_id', user.vk_id);
  if (existing) {
    updateRow(SHEET_USERS, 'vk_id', user.vk_id, user);
  } else {
    appendRow(SHEET_USERS, user);
  }
  return { saved: true };
}

/**
 * saveAnswer — сохранить ответ пользователя на карточку.
 * Вычисляет delta_seconds если не передана.
 */
function saveAnswer(answer) {
  if (!answer.vk_id || !answer.card_id) throw new Error('vk_id and card_id are required');
  var id = nextId(SHEET_ANSWERS);
  var record = {
    id: id,
    vk_id: answer.vk_id,
    card_id: answer.card_id,
    open_timestamp: answer.open_timestamp,
    submit_timestamp: answer.submit_timestamp || new Date().toISOString(),
    delta_seconds: answer.delta_seconds || 0,
    user_answer: typeof answer.user_answer === 'string' ? answer.user_answer : JSON.stringify(answer.user_answer),
    has_reposted: answer.has_reposted || false,
  };
  appendRow(SHEET_ANSWERS, record);
  return { id: id };
}

/**
 * saveLog — сохранить лог события (fire-and-forget).
 */
function saveLog(log) {
  var id = nextId(SHEET_LOGS);
  var record = {
    id: id,
    timestamp: log.timestamp || new Date().toISOString(),
    vk_id: log.vk_id || 'anonymous',
    event_type: log.event_type || 'unknown',
    event_data: typeof log.event_data === 'string' ? log.event_data : JSON.stringify(log.event_data),
    page_url: log.page_url || '',
    user_agent: log.user_agent || '',
  };
  appendRow(SHEET_LOGS, record);
  return { id: id };
}

/**
 * saveCard — сохранить карточку из админки.
 * Если карточка с таким card_id существует — обновляем, иначе создаём.
 */
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
  return { saved: true };
}

/**
 * getStats — статистика по карточкам для админки.
 * Возвращает массив { card_id, title, total_answers, total_users, pct_answered, avg_delta, min, max, reposted_count }.
 */
function getStats() {
  var cards = readSheet(SHEET_CARDS);
  var answers = readSheet(SHEET_ANSWERS);
  var users = readSheet(SHEET_USERS);
  var totalUsers = users.length;
  var stats = [];

  for (var c = 0; c < cards.length; c++) {
    var card = cards[c];
    var cardAnswers = answers.filter(function (a) {
      return String(a.card_id) === String(card.card_id);
    });
    var total = cardAnswers.length;
    var deltas = cardAnswers.map(function (a) { return parseFloat(a.delta_seconds) || 0; });
    var avg = total > 0 ? deltas.reduce(function (s, d) { return s + d; }, 0) / total : 0;
    var min = total > 0 ? Math.min.apply(null, deltas) : 0;
    var max = total > 0 ? Math.max.apply(null, deltas) : 0;
    var reposted = cardAnswers.filter(function (a) { return a.has_reposted === true; }).length;
    var pct = totalUsers > 0 ? Math.round((total / totalUsers) * 100) : 0;

    stats.push({
      card_id: String(card.card_id),
      title: card.title,
      total_answers: total,
      total_users: totalUsers,
      pct_answered: pct,
      avg_delta: Math.round(avg),
      min_delta: Math.round(min),
      max_delta: Math.round(max),
      reposted_count: reposted,
    });
  }

  return stats;
}

/**
 * syncOffline — пакетная отправка ответов из оффлайн-очереди.
 * body = { answers: [AnswerRecord, ...] }
 */
function syncOffline(body) {
  var answers = body.answers || [];
  var saved = 0;
  for (var i = 0; i < answers.length; i++) {
    try {
      saveAnswer(answers[i]);
      saved++;
    } catch (e) {
      // пропускаем ошибочные
    }
  }
  return { saved: saved };
}

// ============================================================
// ОПЦИОНАЛЬНО: ПРОВЕРКА РЕПОСТА ЧЕРЕЗ VK API
// ============================================================

/**
 * checkRepostViaVK — проверка репоста через VK API (wall.getReposts).
 *
 * ТРЕБУЕТ в Script Properties:
 *   - VK_SERVICE_TOKEN — service token приложения VK.
 *   - VK_OWNER_ID — ID владельца стены (группы/пользователя),
 *     где опубликован пост конкурса. Отрицательное число = группа.
 *
 * ВАЖНО: этот метод вызывается doGet с action=checkRepost.
 *
 * @param vkId — VK ID пользователя
 * @param postId — ID поста
 * @returns true, если пользователь сделал репост
 */
function checkRepostViaVK(vkId, postId) {
  var props = PropertiesService.getScriptProperties();
  var token = props.getProperty('VK_SERVICE_TOKEN');
  var ownerId = props.getProperty('VK_OWNER_ID');
  if (!token) {
    throw new Error('VK_SERVICE_TOKEN not set in Script Properties');
  }
  if (!ownerId) {
    throw new Error('VK_OWNER_ID not set in Script Properties');
  }
  var url = 'https://api.vk.com/method/wall.getReposts';
  var params = {
    owner_id: ownerId,
    post_id: postId,
    count: 100,
    v: '5.199',
    access_token: token,
  };
  var response = UrlFetchApp.fetch(url + '?' + serializeParams(params));
  var data = JSON.parse(response.getContentText());
  if (data.error) throw new Error(data.error.error_msg);
  // Проверяем, есть ли vkId среди тех, кто сделал репост.
  var reposts = data.response && data.response.items ? data.response.items : [];
  for (var i = 0; i < reposts.length; i++) {
    if (String(reposts[i].from_id) === String(vkId)) return true;
  }
  return false;
}

/** Сериализует объект параметров в query string. */
function serializeParams(obj) {
  return Object.keys(obj)
    .map(function (k) { return encodeURIComponent(k) + '=' + encodeURIComponent(obj[k]); })
    .join('&');
}

// ============================================================
// ИНИЦИАЛИЗАЦИЯ (запустить один раз вручную)
// ============================================================

/**
 * setupSheets — создаёт все листы с заголовками.
 * Запустите один раз: Run → setupSheets.
 * После этого можно деплоить как веб-приложение.
 */
function setupSheets() {
  Object.keys(HEADERS).forEach(function (name) {
    getSheet(name); // создаёт лист и записывает заголовки
  });
  Logger.log('Sheets initialized: ' + Object.keys(HEADERS).join(', '));
}

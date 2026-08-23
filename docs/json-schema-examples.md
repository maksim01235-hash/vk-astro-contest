# Примеры JSON-схем карточек

JSON-схема описывает структуру карточки конкурса. Каждая карточка состоит из блоков, которые рендерятся в порядке `order`.

## Структура схемы

```json
{
  "blocks": [
    {
      "id": "unique-block-id",
      "type": "BlockType",
      "order": 0,
      ...остальные свойства в зависимости от типа
    }
  ]
}
```

### Идентификаторы блоков

Все идентификаторы редактируются в конструкторе и должны быть уникальны в своей области:

- **id** — среди всех блоков карточки;
- **answerKey** (InputField) — среди полей ввода; это ключ значения в `inputs` ответа;
- **zoneId** (DragZone) — среди зон; используется в `allowedZones` объектов;
- **objectId** (DragObject) — среди объектов; используется в `correctObjectIds` зон.

При переименовании `zoneId` / `objectId` ссылки в связанных блоках **не обновляются
автоматически** — исправьте их вручную перед сохранением карточки. Сохранение блокируется,
если идентификатор пустой или дублируется.

## Типы блоков

### TextBlock

Текстовый блок с поддержкой Markdown.

```json
{
  "id": "text-1",
  "type": "TextBlock",
  "order": 0,
  "content": "# Заголовок\n\nТекст условия **жирным** и *курсивом*.\n\n- Список\n- элементов"
}
```

### ImageBlock

Изображение или сетка изображений.

**Одиночное изображение:**
```json
{
  "id": "img-1",
  "type": "ImageBlock",
  "order": 1,
  "src": "https://example.com/image.jpg",
  "alt": "Описание изображения",
  "maxImageWidth": 600,
  "viewer": true
}
```

**Сетка изображений:**
```json
{
  "id": "img-grid-1",
  "type": "ImageBlock",
  "order": 1,
  "images": [
    { "id": "img-1", "src": "https://example.com/1.jpg", "alt": "Фото 1" },
    { "id": "img-2", "src": "https://example.com/2.jpg", "alt": "Фото 2" },
    { "id": "img-3", "src": "https://example.com/3.jpg", "alt": "Фото 3" }
  ],
  "layoutMode": "grid",
  "gridColumns": 3
}
```

### InputField

Поле ввода текста или числа.

```json
{
  "id": "input-1",
  "type": "InputField",
  "order": 2,
  "label": "Ваш ответ",
  "placeholder": "Введите текст...",
  "inputType": "text",
  "required": true,
  "answerKey": "answer"
}
```

**answerKey** — ключ, по которому значение попадёт в `inputs` ответа.  
**inputType**: `text` | `number` — тип данных ответа.

Для числовых полей (`inputType: "number"`) доступна автопроверка на сервере:

```json
{
  "id": "input-2",
  "type": "InputField",
  "order": 3,
  "label": "Сколько планет?",
  "inputType": "number",
  "correctAnswer": "8",
  "tolerancePercent": 5,
  "answerKey": "planets"
}
```

**correctAnswer** — правильный ответ; если задан, поле проверяется на сервере.  
**tolerancePercent** — допустимое отклонение в процентах от правильного ответа (0 или пусто — точное совпадение).

### Button

Кнопка отправки или репоста.

```json
{
  "id": "btn-1",
  "type": "Button",
  "order": 3,
  "label": "Отправить ответ",
  "action": "submit",
  "variant": "primary"
}
```

**action**: `submit` | `repost` | `custom`  
**variant**: `primary` | `secondary` | `danger`

### DragZone

Зона для перетаскивания объектов.

```json
{
  "id": "zone-1",
  "type": "DragZone",
  "order": 4,
  "zoneId": "zone-a",
  "label": "Зона A",
  "maxItems": 3,
  "correctObjectIds": ["obj-1", "obj-2"],
  "layoutMode": "auto",
  "gridColumns": 2
}
```

**zoneId** — уникальный идентификатор зоны (используется в `allowedZones` объектов).  
**maxItems** — максимум объектов в зоне (опционально).  
**correctObjectIds** — ID объектов, которые должны находиться в зоне для правильного ответа. Если список задан, зона проверяется на сервере при отправке ответа (пусто — без проверки).  
**layoutMode**: `auto` | `grid` — режим раскладки объектов в зоне.  
**gridColumns** — количество колонок для grid-режима.

### DragObject

Перетаскиваемый объект.

```json
{
  "id": "obj-1",
  "type": "DragObject",
  "order": 5,
  "objectId": "obj-alpha",
  "label": "Объект A",
  "textPosition": "left",
  "allowedZones": ["zone-a", "zone-b"],
  "image": "https://example.com/object.png",
  "imageSize": 64,
  "layoutMode": "auto",
  "gridColumns": 2
}
```

**objectId** — уникальный ID объекта (используется в состоянии DnD).  
**label** — текст объекта (опционально).  
**textPosition**: `left` | `right` | `top` | `bottom` — положение текста относительно изображения.  
**allowedZones** — список zoneId, куда можно перетащить объект.  
**image** — URL изображения объекта (опционально).  
**imageSize** — фиксированный размер изображения в px (опционально).  
**maxImageSize** — максимальный размер изображения (опционально, если не задан imageSize).  
**layoutMode**: `auto` | `grid` — режим внутренней раскладки объекта.  
**gridColumns** — количество колонок для grid-режима.

## Полный пример карточки

```json
{
  "blocks": [
    {
      "id": "text-1",
      "type": "TextBlock",
      "order": 0,
      "content": "# Найдите объект на карте\n\nПеретащите объекты в соответствующие зоны."
    },
    {
      "id": "img-1",
      "type": "ImageBlock",
      "order": 1,
      "src": "https://example.com/map.jpg",
      "alt": "Карта звёздного неба",
      "maxImageWidth": 600,
      "viewer": true
    },
    {
      "id": "zone-1",
      "type": "DragZone",
      "order": 2,
      "zoneId": "zone-a",
      "label": "Зона A",
      "maxItems": 2
    },
    {
      "id": "zone-2",
      "type": "DragZone",
      "order": 3,
      "zoneId": "zone-b",
      "label": "Зона B",
      "maxItems": 2
    },
    {
      "id": "obj-1",
      "type": "DragObject",
      "order": 4,
      "objectId": "obj-alpha",
      "label": "Объект A",
      "allowedZones": ["zone-a", "zone-b"],
      "image": "https://example.com/object-a.png",
      "imageSize": 64
    },
    {
      "id": "obj-2",
      "type": "DragObject",
      "order": 5,
      "objectId": "obj-beta",
      "label": "Объект B",
      "allowedZones": ["zone-a", "zone-b"],
      "image": "https://example.com/object-b.png",
      "imageSize": 64
    },
    {
      "id": "input-1",
      "type": "InputField",
      "order": 6,
      "label": "Комментарий (необязательно)",
      "placeholder": "Ваш комментарий...",
      "inputType": "text",
      "required": false,
      "answerKey": "comment"
    },
    {
      "id": "btn-1",
      "type": "Button",
      "order": 7,
      "label": "Отправить ответ",
      "action": "submit",
      "variant": "primary"
    }
  ]
}
```

## Формат ответа

Единый формат для всех карточек — полный JSON `{ inputs, dnd }`, включая пустое
состояние и unassigned-объекты DnD. Схлопывания для отдельных случаев нет.

### Карточка с DnD

```json
{
  "inputs": {
    "comment": "Текст комментария"
  },
  "dnd": {
    "zone-a": ["obj-alpha"],
    "zone-b": ["obj-beta"],
    "unassigned": []
  }
}
```

### Карточка без DnD

```json
{
  "inputs": {
    "name": "Иван",
    "comment": "Текст комментария"
  },
  "dnd": {}
}
```

Сервер сохранит `user_answer` как есть — строку JSON `{ inputs, dnd }`.

### Серверная проверка ответов

Если в схеме есть числовые InputField с `correctAnswer` или DragZone с `correctObjectIds`,
сервер при сохранении заменяет проверяемые значения на объекты с результатом проверки.
Непроверяемые поля остаются строками, непроверяемые зоны — массивами id.

```json
{
  "inputs": {
    "comment": "Свободный текст",
    "planets": { "answer": "8", "actualErrorPercent": 0, "isCorrect": true }
  },
  "dnd": {
    "unassigned": [],
    "zone-a": ["obj-alpha"],
    "zone-b": { "objects": ["obj-beta"], "objectsCorrect": [true], "isCorrect": true }
  },
  "marker": { "userX": 50, "userY": 50, "actualErrorPercent": 1.2, "isCorrect": true }
}
```

- **inputs.<key>** — `answer` (сырой ответ), `actualErrorPercent` (`|user − correct| / |correct| × 100`,
  округлён до 2 знаков; `null`, если ввод не число) и `isCorrect`
  (`percent ≤ tolerancePercent`; корректный ответ `0` — верен только точный `0`).
- **dnd.<zoneId>** — `objects` (фактические объекты, порядок произвольный),
  `objectsCorrect` (флаг по каждому объекту: лежит ли в эталонной зоне)
  и `isCorrect` (точное совпадение множеств объектов).
- Поле `marker` появляется только при наличии маркерного блока и данных метки.
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

Поле ввода текста, числа или email.

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
  "layoutMode": "auto",
  "gridColumns": 2
}
```

**zoneId** — уникальный идентификатор зоны (используется в `allowedZones` объектов).  
**maxItems** — максимум объектов в зоне (опционально).  
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

### Карточка с одним полем

```json
{
  "inputs": {
    "answer": "Текст ответа"
  },
  "dnd": {}
}
```

Сервер сохранит `user_answer` как чистую строку `"Текст ответа"`.

### Карточка с несколькими полями

```json
{
  "inputs": {
    "field1": "Ответ 1",
    "field2": "Ответ 2",
    "field3": "Ответ 3"
  },
  "dnd": {}
}
```

Сервер сохранит `user_answer` как строку `"Ответ 1;Ответ 2;Ответ 3"` (в стабильном порядке ключей).
# Примеры JSON-схем карточек

JSON-схема — это описание блоков карточки. Хранится в листе **Cards**,
поле `json_schema` (как JSON-строка). Админ-конструктор генерирует её
автоматически, но можно создать вручную.

## Структура

```json
{
  "blocks": [
    { "id": "...", "type": "TextBlock", "order": 0, "content": "..." },
    { "id": "...", "type": "ImageBlock", "order": 1, "src": "...", "alt": "..." },
    ...
  ]
}
```

## Пример 1: Простой вопрос с текстовым ответом

```json
{
  "blocks": [
    {
      "id": "t1",
      "type": "TextBlock",
      "order": 0,
      "content": "## Вопрос\nНазовите столицу **Австралии**."
    },
    {
      "id": "i1",
      "type": "InputField",
      "order": 1,
      "label": "Ваш ответ",
      "placeholder": "Например, Сидней",
      "inputType": "text",
      "required": true,
      "answerKey": "capital"
    },
    {
      "id": "b1",
      "type": "Button",
      "order": 2,
      "label": "Отправить ответ",
      "action": "submit",
      "variant": "primary"
    }
  ]
}
```

## Пример 2: Drag-and-drop (животные и зоны)

```json
{
  "blocks": [
    {
      "id": "t1",
      "type": "TextBlock",
      "order": 0,
      "content": "## Условие\nПеретащите **каждое животное** в правильную зону."
    },
    {
      "id": "z1",
      "type": "DragZone",
      "order": 1,
      "zoneId": "forest",
      "label": "Лес",
      "maxItems": 2
    },
    {
      "id": "z2",
      "type": "DragZone",
      "order": 2,
      "zoneId": "ocean",
      "label": "Океан",
      "maxItems": 2
    },
    {
      "id": "o1",
      "type": "DragObject",
      "order": 3,
      "objectId": "fox",
      "label": "Лиса",
      "allowedZones": ["forest"]
    },
    {
      "id": "o2",
      "type": "DragObject",
      "order": 4,
      "objectId": "whale",
      "label": "Кит",
      "allowedZones": ["ocean"]
    },
    {
      "id": "b1",
      "type": "Button",
      "order": 5,
      "label": "Отправить ответ",
      "action": "submit",
      "variant": "primary"
    }
  ]
}
```

## Пример 3: Карточка с картинкой и полем ввода числа

```json
{
  "blocks": [
    {
      "id": "t1",
      "type": "TextBlock",
      "order": 0,
      "content": "## Задача\nСколько геометрических фигур на картинке?"
    },
    {
      "id": "img1",
      "type": "ImageBlock",
      "order": 1,
      "src": "https://example.com/shapes.png",
      "alt": "Геометрические фигуры",
      "width": "full"
    },
    {
      "id": "i1",
      "type": "InputField",
      "order": 2,
      "label": "Количество фигур",
      "placeholder": "Введите число",
      "inputType": "number",
      "required": true,
      "answerKey": "count"
    },
    {
      "id": "b1",
      "type": "Button",
      "order": 3,
      "label": "Отправить ответ",
      "action": "submit",
      "variant": "primary"
    }
  ]
}
```

## Пример 4: Множественный выбор через DnD (с мультизонами)

```json
{
  "blocks": [
    {
      "id": "t1",
      "type": "TextBlock",
      "order": 0,
      "content": "## Сортировка слов\nРаспределите слова по частям речи."
    },
    {
      "id": "z1",
      "type": "DragZone",
      "order": 1,
      "zoneId": "noun",
      "label": "Существительные",
      "maxItems": 0
    },
    {
      "id": "z2",
      "type": "DragZone",
      "order": 2,
      "zoneId": "verb",
      "label": "Глаголы",
      "maxItems": 0
    },
    {
      "id": "o1",
      "type": "DragObject",
      "order": 3,
      "objectId": "дом",
      "label": "Дом",
      "allowedZones": ["noun"]
    },
    {
      "id": "o2",
      "type": "DragObject",
      "order": 4,
      "objectId": "бежать",
      "label": "Бежать",
      "allowedZones": ["verb"]
    },
    {
      "id": "o3",
      "type": "DragObject",
      "order": 5,
      "objectId": "книга",
      "label": "Книга",
      "allowedZones": ["noun"]
    },
    {
      "id": "o4",
      "type": "DragObject",
      "order": 6,
      "objectId": "читать",
      "label": "Читать",
      "allowedZones": ["verb"]
    },
    {
      "id": "b1",
      "type": "Button",
      "order": 7,
      "label": "Отправить ответ",
      "action": "submit",
      "variant": "primary"
    }
  ]
}
```

## Типы блоков

| Тип | Описание | Ключевые поля |
|-----|----------|---------------|
| TextBlock | Текст (Markdown) | content |
| ImageBlock | Картинка | src, alt, width |
| InputField | Поле ввода | label, inputType, answerKey, required |
| Button | Кнопка | label, action, variant |
| DragZone | Зона перетаскивания | zoneId, label, maxItems |
| DragObject | Объект перетаскивания | objectId, label, allowedZones, image |

## Как использовать

1. Скопируйте нужный пример.
2. Вставьте в лист **Cards**, поле `json_schema` (как строка).
3. Или используйте админ-конструктор для интерактивного создания.

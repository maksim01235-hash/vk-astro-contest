# Примеры JSON-схем карточек

Схема хранится в поле `json_schema` листа **Cards** как JSON-строка.

## Общая структура

```json
{
  "blocks": [
    { "id": "...", "type": "TextBlock", "order": 0, "content": "..." },
    {
      "id": "images1",
      "type": "ImageBlock",
      "order": 1,
      "images": [
        { "id": "image1", "src": "https://example.com/one.jpg", "alt": "Первое изображение" },
        { "id": "image2", "src": "https://example.com/two.jpg", "alt": "Второе изображение" }
      ],
      "layoutMode": "grid",
      "gridColumns": 2,
      "viewer": true
    }
  ]
}
```

## ImageBlock

```json
{
  "id": "img1",
  "type": "ImageBlock",
  "order": 1,
  "images": [
    { "id": "img1a", "src": "https://example.com/first.jpg", "alt": "Первое фото" },
    { "id": "img1b", "src": "https://example.com/second.jpg", "alt": "Второе фото" }
  ],
  "width": "full",
  "maxImageWidth": 800,
  "maxImageHeight": 600,
  "layoutMode": "grid",
  "gridColumns": 2,
  "viewer": true
}
```

`layoutMode` принимает значения `flow` или `grid`:

- `flow` — изображения располагаются в свободном адаптивном потоке;
- `grid` — изображения располагаются в сетке;
- `gridColumns` — количество колонок от 1 до 6.

Для старых карточек поддерживается формат:

```json
{
  "id": "img-old",
  "type": "ImageBlock",
  "order": 1,
  "src": "https://example.com/old.jpg",
  "alt": "Старое изображение"
}
```

При чтении старый `src` автоматически рассматривается как одно изображение.

## DragZone

```json
{
  "id": "zone1",
  "type": "DragZone",
  "order": 1,
  "zoneId": "forest",
  "label": "Лес",
  "maxItems": 0,
  "layoutMode": "grid",
  "gridColumns": 3
}
```

Для `DragZone` параметры `layoutMode` и `gridColumns` управляют расположением объектов внутри зоны.

## DragObject

```json
{
  "id": "object1",
  "type": "DragObject",
  "order": 2,
  "objectId": "fox",
  "label": "Лиса",
  "image": "https://example.com/fox.png",
  "allowedZones": ["forest"],
  "textPosition": "right",
  "layoutMode": "flow",
  "gridColumns": 2
}
```

`DragObject` поддерживает старые схемы без `layoutMode` и `gridColumns`; по умолчанию используется `flow`.

## Типы блоков

| Тип | Основные поля |
|---|---|
| `TextBlock` | `content` |
| `ImageBlock` | `images`, `layoutMode`, `gridColumns`, `viewer` |
| `InputField` | `label`, `inputType`, `answerKey`, `required` |
| `Button` | `label`, `action`, `variant` |
| `DragZone` | `zoneId`, `label`, `maxItems`, `layoutMode`, `gridColumns` |
| `DragObject` | `objectId`, `label`, `allowedZones`, `image`, `layoutMode`, `gridColumns` |

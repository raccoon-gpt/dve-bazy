# TASK-001 v2 — Болото 2

Повторная сдача по замечаниям `reviews/TASK-001-review.md`.

## Состав файлов
- `swamp_duckweed_01.png` — 96×96, RGBA
- `swamp_duckweed_02.png` — 96×96, RGBA
- `swamp_duckweed_03.png` — 96×96, RGBA
- `swamp_lily_flower_01.png` — 72×72, RGBA
- `swamp_lily_flower_02.png` — 72×72, RGBA
- `swamp_lily_single_01.png` — 64×64, RGBA
- `swamp_lily_single_02.png` — 64×64, RGBA
- `swamp_lily_single_03.png` — 64×64, RGBA
- `swamp_lily_single_04.png` — 64×64, RGBA
- `swamp_mushrooms_01.png` — 64×64, RGBA
- `swamp_mushrooms_02.png` — 64×64, RGBA
- `swamp_pad_01.png` — 102×102, RGBA
- `swamp_pad_02.png` — 102×102, RGBA
- `swamp_pad_03.png` — 102×102, RGBA
- `swamp_pad_04.png` — 102×102, RGBA
- `swamp_pebbles_01.png` — 64×64, RGBA
- `swamp_pebbles_02.png` — 64×64, RGBA
- `swamp_pebbles_03.png` — 64×64, RGBA
- `swamp_texture_grass.png` — 512×512, RGB
- `swamp_texture_mud.png` — 512×512, RGB
- `swamp_texture_water.png` — 512×512, RGB
- `swamp_tuft_01.png` — 72×72, RGBA
- `swamp_tuft_02.png` — 72×72, RGBA
- `swamp_tuft_03.png` — 72×72, RGBA
- `swamp_tuft_04.png` — 72×72, RGBA
- `swamp_tuft_05.png` — 72×72, RGBA
- `swamp_tuft_06.png` — 72×72, RGBA

## Изменения v2
- Заменены три текстуры 512×512, без крупных пятен ряски в воде; выполнена обработка краёв для уменьшения швов.
- Заменены четыре плиты 102×102, приведены к общему размеру и центровке.
- Новые низкие пучки травы: `swamp_tuft_01`, `_03`, `_05`, `_06`.
- Принятые ранее спрайты перенесены из v1 без изменений, включая `swamp_tuft_02` и `_04`.

## Примечание
Текстуры дополнительно приложены в виде файлов для проверки повтором 2×2. Требуется финальная проверка в движке; края и прозрачность спрайтов следует просмотреть на игровом фоне.

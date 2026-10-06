"""Нарезка и сжатие скриншотов для страницы hr-automotive.html.

Запуск (из папки tools/screenshots):
    python build_images.py cut  <рабочая_папка>   нарезать полные снимки публичного сайта по блокам
    python build_images.py webp <папка_с_png>     перевести PNG в WebP и положить в images/hr-automotive

Рабочая папка это та, что передана в capture-sections.js: там лежат site-<устройство>-fullpage.png и
site-<устройство>-heads.json с координатами заголовков.
"""
import glob
import json
import os
import sys

from PIL import Image

Image.MAX_IMAGE_PIXELS = None
HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.normpath(os.path.join(HERE, '..', '..', 'images', 'hr-automotive'))

# Блоки публичного сайта: ключ файла и начало заголовка, по которому блок находится на странице.
BLOCKS = [('about', 'Почему нас'), ('values', 'Ключевые ценности'), ('social', 'Социальный пакет'),
          ('vacancies', 'Открытые вакансии'), ('contacts', 'Контакты для связи')]
PAD = 70          # запас сверху: заголовок блока лежит выше самой секции
SCROLLBAR = 15    # полоса прокрутки сайта в десктопном снимке, её обрезаем


def to_webp(img, name, quality=82):
    path = os.path.join(OUT, name + '.webp')
    img.convert('RGB').save(path, 'WEBP', quality=quality, method=4)
    print('сохранено', path, img.size)


def cut(work):
    os.makedirs(OUT, exist_ok=True)
    for device in ('desktop', 'tablet', 'mobile'):
        meta = json.load(open(os.path.join(work, f'site-{device}-heads.json'), encoding='utf-8'))
        dpr, total, heads = meta['dpr'], meta['height'], meta['heads']
        ys = {}
        for key, text in BLOCKS:
            found = [h['y'] for h in heads if h['t'].startswith(text)]
            if not found:
                raise SystemExit(f'не найден заголовок «{text}» ({device})')
            ys[key] = found[0]
        page = Image.open(os.path.join(work, f'site-{device}-fullpage.png'))
        keys = [k for k, _ in BLOCKS]
        for n, key in enumerate(keys):
            top = max(0, ys[key] - PAD)
            bottom = (ys[keys[n + 1]] - PAD) if n + 1 < len(keys) else total
            width = page.width - (SCROLLBAR if device == 'desktop' else 0)
            to_webp(page.crop((0, int(top * dpr), width, int(bottom * dpr))), f'site-{key}-{device}')


def convert(src):
    os.makedirs(OUT, exist_ok=True)
    for png in sorted(glob.glob(os.path.join(src, '*.png'))):
        name = os.path.splitext(os.path.basename(png))[0]
        img = Image.open(png)
        if name.startswith('site-desktop') and img.width == 1440:
            img = img.crop((0, 0, img.width - SCROLLBAR, img.height))
        to_webp(img, name, 80)


if __name__ == '__main__':
    if len(sys.argv) != 3 or sys.argv[1] not in ('cut', 'webp'):
        raise SystemExit(__doc__)
    (cut if sys.argv[1] == 'cut' else convert)(sys.argv[2])

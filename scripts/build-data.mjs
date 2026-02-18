#!/usr/bin/env node
import fs from 'node:fs/promises';
import path from 'node:path';

const COLORS_URL = 'https://zhongguose.com/colors.json';
const COMMONS_API = 'https://commons.wikimedia.org/w/api.php';
const OUTPUT_DIR = path.resolve('data');
const OUTPUT_FILE = path.join(OUTPUT_DIR, 'colors-with-examples.json');
const META_FILE = path.join(OUTPUT_DIR, 'source-meta.json');

const HUE_PROFILES = {
  red: { label: '红系', keyword: 'red' },
  orange: { label: '橙系', keyword: 'orange' },
  yellow: { label: '黄系', keyword: 'yellow' },
  green: { label: '绿系', keyword: 'green' },
  cyan: { label: '青系', keyword: 'teal' },
  blue: { label: '蓝系', keyword: 'blue' },
  purple: { label: '紫系', keyword: 'purple' },
  pink: { label: '粉系', keyword: 'pink' },
  brown: { label: '棕系', keyword: 'brown' },
  gray: { label: '灰系', keyword: 'gray' },
  white: { label: '白系', keyword: 'white' },
  black: { label: '黑系', keyword: 'black' },
};

const CATEGORIES = [
  { key: 'object', label: '物件', base: 'ceramic object photograph' },
  { key: 'architecture', label: '建筑', base: 'architecture photograph' },
  { key: 'clothing', label: '服饰', base: 'clothing photograph' },
  { key: 'animal', label: '动物', base: 'bird animal photograph' },
  { key: 'plant', label: '植物', base: 'flower plant photograph' },
];

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function hexToRgb(hex) {
  const stripped = hex.replace('#', '');
  const r = Number.parseInt(stripped.slice(0, 2), 16);
  const g = Number.parseInt(stripped.slice(2, 4), 16);
  const b = Number.parseInt(stripped.slice(4, 6), 16);
  return [r, g, b];
}

function rgbToHsl([rRaw, gRaw, bRaw]) {
  const r = rRaw / 255;
  const g = gRaw / 255;
  const b = bRaw / 255;

  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const delta = max - min;

  let h = 0;
  if (delta !== 0) {
    if (max === r) {
      h = ((g - b) / delta) % 6;
    } else if (max === g) {
      h = (b - r) / delta + 2;
    } else {
      h = (r - g) / delta + 4;
    }
  }

  h = Math.round((h * 60 + 360) % 360);
  const l = (max + min) / 2;
  const s = delta === 0 ? 0 : delta / (1 - Math.abs(2 * l - 1));

  return [h, s, l];
}

function classifyHue(hex) {
  const [h, s, l] = rgbToHsl(hexToRgb(hex));

  if (s < 0.1 && l > 0.92) return 'white';
  if (s < 0.12 && l < 0.2) return 'black';
  if (s < 0.14) return 'gray';

  if (l < 0.42 && h >= 15 && h < 50) return 'brown';

  if (h < 15 || h >= 345) return 'red';
  if (h >= 15 && h < 45) return 'orange';
  if (h >= 45 && h < 70) return 'yellow';
  if (h >= 70 && h < 165) return 'green';
  if (h >= 165 && h < 200) return 'cyan';
  if (h >= 200 && h < 250) return 'blue';
  if (h >= 250 && h < 290) return 'purple';
  if (h >= 290 && h < 345) return 'pink';

  return 'gray';
}

function hashString(input) {
  let hash = 5381;
  for (let i = 0; i < input.length; i += 1) {
    hash = (hash * 33) ^ input.charCodeAt(i);
  }
  return Math.abs(hash >>> 0);
}

async function fetchJson(url) {
  const response = await fetch(url, {
    headers: {
      'User-Agent': 'chinese-colors-static-site/1.0',
    },
  });

  if (!response.ok) {
    throw new Error(`Request failed (${response.status}): ${url}`);
  }

  return response.json();
}

async function fetchCommonsImages(query, limit = 24) {
  const url = new URL(COMMONS_API);
  url.searchParams.set('action', 'query');
  url.searchParams.set('format', 'json');
  url.searchParams.set('generator', 'search');
  url.searchParams.set('gsrnamespace', '6');
  url.searchParams.set('gsrlimit', String(clamp(limit, 1, 50)));
  url.searchParams.set('gsrsearch', `${query} filetype:bitmap -illustration -vector -logo`);
  url.searchParams.set('prop', 'pageimages|imageinfo');
  url.searchParams.set('piprop', 'thumbnail');
  url.searchParams.set('pithumbsize', '720');
  url.searchParams.set('iiprop', 'url|extmetadata');

  const payload = await fetchJson(url.toString());
  const pages = payload?.query?.pages ? Object.values(payload.query.pages) : [];

  return pages
    .filter((page) => page?.thumbnail?.source && page?.imageinfo?.[0]?.descriptionurl)
    .map((page) => {
      const info = page.imageinfo[0] ?? {};
      const metadata = info.extmetadata ?? {};
      return {
        title: page.title?.replace(/^File:/, '') ?? 'Wikimedia Commons image',
        imageUrl: page.thumbnail.source,
        source: info.descriptionurl,
        license: metadata.LicenseShortName?.value ?? 'Wikimedia Commons',
        author: metadata.Artist?.value ?? '',
      };
    });
}

async function buildImagePools() {
  const pools = {};

  for (const [hueKey, hueProfile] of Object.entries(HUE_PROFILES)) {
    pools[hueKey] = {};

    for (const category of CATEGORIES) {
      const primaryQuery = `${hueProfile.keyword} ${category.base}`;
      const fallbackQuery = `${hueProfile.keyword} ${category.key} photo`;

      let images = await fetchCommonsImages(primaryQuery);
      if (images.length < 8) {
        const fallback = await fetchCommonsImages(fallbackQuery);
        images = [...images, ...fallback];
      }

      const deduped = Array.from(new Map(images.map((img) => [img.source, img])).values());
      pools[hueKey][category.key] = deduped.slice(0, 30);

      // avoid hammering Commons API
      await new Promise((resolve) => setTimeout(resolve, 120));
      process.stdout.write(`Fetched pool: ${hueKey}/${category.key} -> ${pools[hueKey][category.key].length}\n`);
    }
  }

  return pools;
}

function normalizeCmyk(cmykValue) {
  if (Array.isArray(cmykValue)) return cmykValue;
  if (typeof cmykValue === 'string') {
    return cmykValue
      .split(',')
      .map((item) => Number.parseInt(item.trim(), 10))
      .filter((item) => Number.isFinite(item));
  }
  return [];
}

async function main() {
  await fs.mkdir(OUTPUT_DIR, { recursive: true });

  const sourceColors = await fetchJson(COLORS_URL);
  const colors = Array.isArray(sourceColors) ? sourceColors : [];

  const pools = await buildImagePools();

  const dataset = colors.map((color, index) => {
    const hueKey = classifyHue(color.hex);
    const hueLabel = HUE_PROFILES[hueKey].label;
    const examples = CATEGORIES.map((category) => {
      const pool = pools[hueKey][category.key] ?? [];
      if (pool.length === 0) {
        return {
          category: category.key,
          categoryLabel: category.label,
          title: '暂无示例图',
          imageUrl: '',
          source: '',
          license: '',
          author: '',
        };
      }

      const pickIndex = hashString(`${color.name}|${color.hex}|${category.key}`) % pool.length;
      const picked = pool[pickIndex];
      return {
        category: category.key,
        categoryLabel: category.label,
        title: picked.title,
        imageUrl: picked.imageUrl,
        source: picked.source,
        license: picked.license,
        author: picked.author,
      };
    });

    return {
      id: index + 1,
      name: color.name,
      pinyin: color.pinyin,
      hex: color.hex,
      rgb: Array.isArray(color.RGB) ? color.RGB : hexToRgb(color.hex),
      cmyk: normalizeCmyk(color.CMYK),
      hueGroup: hueKey,
      hueLabel,
      examples,
    };
  });

  const meta = {
    generatedAt: new Date().toISOString(),
    source: {
      colors: COLORS_URL,
      images: 'https://commons.wikimedia.org/w/api.php',
    },
    totalColors: dataset.length,
    hueStats: Object.fromEntries(
      Object.keys(HUE_PROFILES).map((key) => [key, dataset.filter((item) => item.hueGroup === key).length]),
    ),
  };

  await fs.writeFile(OUTPUT_FILE, `${JSON.stringify(dataset, null, 2)}\n`, 'utf-8');
  await fs.writeFile(META_FILE, `${JSON.stringify(meta, null, 2)}\n`, 'utf-8');

  process.stdout.write(`\nDone. Colors: ${dataset.length}\n`);
  process.stdout.write(`Output: ${OUTPUT_FILE}\n`);
  process.stdout.write(`Meta: ${META_FILE}\n`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});

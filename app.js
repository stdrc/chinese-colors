const wallEl = document.getElementById('colorWall');
const hueFiltersEl = document.getElementById('hueFilters');
const tileTemplate = document.getElementById('tileTemplate');
const paletteBoardEl = document.getElementById('paletteBoard');
const modeTabsEl = document.getElementById('modeTabs');

const hueOrder = [
  'red',
  'orange',
  'yellow',
  'green',
  'cyan',
  'blue',
  'purple',
  'pink',
  'brown',
  'white',
  'gray',
  'black',
];

const state = {
  colors: [],
  filtered: [],
  hue: 'all',
  mode: 'colors',
  palettes: [],
  colorByHex: new Map(),
  nearestColorByHex: new Map(),
};

const viewModes = [
  { key: 'colors', label: '色谱墙' },
  { key: 'palettes', label: '配色板' },
];
const validModeKeys = new Set(viewModes.map((item) => item.key));

const defaultPaletteRoles = ['背景色', '文本色', '主色', '强调色', '辅助色'];

const paletteSources = {
  fengya: {
    title: '《中国传统配色手册·风雅色》',
    href: 'https://search.worldcat.org/title/1542925334',
    host: 'WorldCat',
  },
  guose: {
    title: '《国色之美：中国经典传统色配色速查手册》',
    href: 'https://search.worldcat.org/title/1396087160',
    host: 'WorldCat',
  },
  theory: {
    title: '《中国传统色：配色原理与实践应用》',
    href: 'https://search.worldcat.org/title/1456528097',
    host: 'WorldCat',
  },
  theme: {
    title: '《中国传统色主题配色手册》',
    href: 'https://books.google.com/books/about/%E4%B8%AD%E5%9B%BD%E4%BC%A0%E7%BB%9F%E8%89%B2%E4%B8%BB%E9%A2%98%E9%85%8D%E8%89%B2%E6%89%8B%E5%86%8C.html?id=UNhn0AEACAAJ',
    host: 'Google Books',
  },
};

const sourcedPaletteSpecs = [
  { name: '青出于蓝', source: 'fengya', picks: ['鱼肚白', '青灰', '靛青', '群青', '景泰蓝'] },
  { name: '落红有情', source: 'fengya', picks: ['荷花白', '雁灰', '桃红', '月季红', '榴花红'] },
  { name: '水绿相宜', source: 'fengya', picks: ['月白', '绿灰', '蛋白石绿', '竹绿', '海青'] },
  { name: '白立五色', source: 'fengya', picks: ['银白', '水牛灰', '靛青', '银朱', '金盏黄'] },
  { name: '宫墙丹黄', source: 'guose', picks: ['鱼肚白', '海报灰', '朱红', '金盏黄', '鹦鹉绿'] },
  { name: '江山青绿', source: 'guose', picks: ['鱼肚白', '夏云灰', '竹篁绿', '青矾绿', '靛青'] },
  { name: '烟霞桃绛', source: 'guose', picks: ['芡食白', '雁灰', '桃红', '莲瓣红', '紫荆红'] },
  { name: '霁雪岚青', source: 'guose', picks: ['云峰白', '鱼尾灰', '景泰蓝', '海青', '鸢尾蓝'] },
  { name: '春融', source: 'theory', picks: ['月白', '艾绿', '麦苗绿', '淡橘橙', '莲瓣红'] },
  { name: '秋实', source: 'theory', picks: ['鱼肚白', '麂棕', '橄榄黄绿', '榴花红', '淡松烟'] },
  { name: '冬夜', source: 'theory', picks: ['银白', '鱼尾灰', '满天星紫', '靛青', '乌梅紫'] },
  { name: '霜叶丹砂', source: 'theory', picks: ['银白', '雁灰', '淡赭', '朱红', '银朱'] },
  { name: '国潮金朱', source: 'theme', picks: ['鱼肚白', '水牛灰', '藤黄', '银朱', '酱紫'] },
  { name: '青瓷雾岚', source: 'theme', picks: ['云峰白', '夏云灰', '浪花绿', '海青', '鱼尾灰'] },
  { name: '山茶暖棕', source: 'theme', picks: ['荷花白', '松鼠灰', '淡赭', '余烬红', '栗棕'] },
  { name: '海棠绛紫', source: 'theme', picks: ['芡食白', '暮云灰', '海棠红', '豆蔻紫', '乌梅紫'] },
];

function hexToRgb(hex) {
  const value = hex.replace('#', '');
  return [
    Number.parseInt(value.slice(0, 2), 16),
    Number.parseInt(value.slice(2, 4), 16),
    Number.parseInt(value.slice(4, 6), 16),
  ];
}

function normalizeHex(hex) {
  return hex.trim().toLowerCase();
}

async function copyText(text) {
  try {
    if (navigator.clipboard?.writeText && window.isSecureContext) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    // fall through to legacy copy
  }

  const textarea = document.createElement('textarea');
  textarea.value = text;
  textarea.setAttribute('readonly', 'true');
  textarea.style.position = 'fixed';
  textarea.style.top = '0';
  textarea.style.left = '0';
  textarea.style.width = '1px';
  textarea.style.height = '1px';
  textarea.style.opacity = '0';
  textarea.style.pointerEvents = 'none';

  document.body.append(textarea);
  let copied = false;
  try {
    textarea.focus({ preventScroll: true });
    textarea.select();
    textarea.setSelectionRange(0, textarea.value.length);
    copied = document.execCommand('copy');
  } catch {
    copied = false;
  } finally {
    textarea.remove();
  }

  return copied;
}

function contrastTextColor(hex) {
  const [r, g, b] = hexToRgb(hex);
  const luminance = (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
  return luminance > 0.62 ? '#1f1712' : '#fffdf8';
}

function rgbDistance(a, b) {
  const dr = a[0] - b[0];
  const dg = a[1] - b[1];
  const db = a[2] - b[2];
  return dr * dr + dg * dg + db * db;
}

function resolvePaletteColorLabel(hex) {
  const key = normalizeHex(hex);
  const exact = state.colorByHex.get(key);
  if (exact) {
    return { name: exact.name, isExact: true };
  }

  if (state.nearestColorByHex.has(key)) {
    return state.nearestColorByHex.get(key);
  }

  const target = hexToRgb(hex);
  let nearest = null;
  let nearestDistance = Number.POSITIVE_INFINITY;

  state.colors.forEach((color) => {
    const distance = rgbDistance(target, color.rgb);
    if (distance < nearestDistance) {
      nearest = color;
      nearestDistance = distance;
    }
  });

  const resolved = nearest
    ? { name: nearest.name, isExact: false }
    : { name: '自定义色', isExact: false };

  state.nearestColorByHex.set(key, resolved);
  return resolved;
}

function buildSourcedPalettes(colors) {
  const colorByName = new Map(colors.map((color) => [color.name, color]));
  return sourcedPaletteSpecs.map((spec) => {
    const colorsHex = spec.picks.map((name) => {
      const matched = colorByName.get(name);
      return matched ? matched.hex : '#888888';
    });
    return {
      name: spec.name,
      source: paletteSources[spec.source] || null,
      colors: colorsHex,
    };
  });
}

function filterColors() {
  state.filtered = state.colors.filter((color) => state.hue === 'all' || color.hueGroup === state.hue);
}

async function copyToClipboard(text, hintEl, tileEl) {
  return copyWithFeedback({
    text,
    hintEl,
    targetEl: tileEl,
    flashClass: 'flash',
  });
}

async function copyPaletteHex(hex, hintEl, swatchEl) {
  return copyWithFeedback({
    text: hex,
    hintEl,
    targetEl: swatchEl,
    flashClass: 'palette-flash',
  });
}

async function copyWithFeedback({ text, hintEl, targetEl, flashClass }) {
  const original = hintEl?.textContent || '';
  targetEl.classList.add(flashClass);

  const copied = await copyText(text);
  if (hintEl) {
    hintEl.textContent = copied ? '已复制 HEX' : `HEX ${text.toUpperCase()}`;
  }

  setTimeout(() => {
    if (hintEl) hintEl.textContent = original;
    targetEl.classList.remove(flashClass);
  }, 900);

  return copied;
}

function createTile(color) {
  const tile = tileTemplate.content.firstElementChild.cloneNode(true);
  const tileOverlay = tile.querySelector('.tile-overlay');
  const tileName = tile.querySelector('.tile-name');
  const tilePinyin = tile.querySelector('.tile-pinyin');
  const tileCode = tile.querySelector('.tile-code');
  const tileHint = tile.querySelector('.tile-hint');

  const textColor = contrastTextColor(color.hex);

  tile.style.background = color.hex;
  tileOverlay.style.color = textColor;
  tileName.textContent = color.name;
  tilePinyin.textContent = color.pinyin;
  tileCode.textContent = `${color.hex.toUpperCase()} · RGB ${color.rgb.join(', ')}`;
  tile.setAttribute('role', 'button');
  tile.setAttribute('aria-label', `${color.name} ${color.hex}`);

  tile.addEventListener('click', () => {
    copyToClipboard(color.hex, tileHint, tile);
  });

  tile.addEventListener('keydown', (event) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      copyToClipboard(color.hex, tileHint, tile);
    }
  });

  return tile;
}

function createPaletteCard(palette) {
  const card = document.createElement('article');
  card.className = 'palette-card';
  card.style.setProperty('--palette-ink', palette.colors[1] || palette.colors[0]);
  card.style.setProperty('--palette-accent', palette.colors[3] || palette.colors[0]);

  const meta = document.createElement('div');
  meta.className = 'palette-meta';

  const name = document.createElement('p');
  name.className = 'palette-name';
  name.textContent = palette.name;

  const swatches = document.createElement('div');
  swatches.className = 'palette-swatches';
  palette.colors.forEach((hex, index) => {
    const swatch = document.createElement('div');
    swatch.className = 'palette-swatch';
    swatch.style.background = hex;
    swatch.tabIndex = 0;
    swatch.setAttribute('role', 'button');
    const role = defaultPaletteRoles[index] || `角色 ${index + 1}`;
    const colorLabelInfo = resolvePaletteColorLabel(hex);
    const displayName = colorLabelInfo.isExact ? colorLabelInfo.name : `近似${colorLabelInfo.name}`;
    swatch.title = `复制 ${role} ${displayName} ${hex}`;
    swatch.setAttribute(
      'aria-label',
      `复制 ${role} ${displayName} ${hex.toUpperCase()}`
    );

    const overlay = document.createElement('div');
    overlay.className = 'palette-swatch-overlay';

    const roleLabel = document.createElement('span');
    roleLabel.className = 'palette-role';
    roleLabel.textContent = role;

    const colorLabel = document.createElement('span');
    colorLabel.className = 'palette-color-name';
    colorLabel.textContent = displayName;

    const hexLabel = document.createElement('span');
    hexLabel.className = 'palette-hex';
    hexLabel.textContent = hex.toUpperCase();

    const hintLabel = document.createElement('span');
    hintLabel.className = 'palette-hint';
    hintLabel.textContent = '点击复制 HEX';

    const labelColor = contrastTextColor(hex);
    roleLabel.style.color = labelColor;
    colorLabel.style.color = labelColor;
    hexLabel.style.color = labelColor;
    hintLabel.style.color = labelColor;

    swatch.addEventListener('click', () => {
      copyPaletteHex(hex, hintLabel, swatch);
    });
    swatch.addEventListener('keydown', (event) => {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        copyPaletteHex(hex, hintLabel, swatch);
      }
    });

    overlay.append(roleLabel, colorLabel, hexLabel, hintLabel);
    swatch.append(overlay);
    swatches.append(swatch);
  });

  meta.append(name);
  card.append(meta, swatches);
  return card;
}

function renderPaletteBoard() {
  if (!paletteBoardEl) return;
  paletteBoardEl.innerHTML = '';
  const fragment = document.createDocumentFragment();
  state.palettes.forEach((palette) => fragment.append(createPaletteCard(palette)));
  paletteBoardEl.append(fragment);
}

function applyModeView() {
  document.body.classList.toggle('view-palettes', state.mode === 'palettes');
}

function readModeFromUrl() {
  const params = new URLSearchParams(window.location.search);
  const mode = params.get('view');
  return validModeKeys.has(mode) ? mode : null;
}

function writeModeToUrl(mode, { replace = false } = {}) {
  if (!validModeKeys.has(mode)) return;
  const url = new URL(window.location.href);
  url.searchParams.set('view', mode);
  const next = `${url.pathname}${url.search}${url.hash}`;
  const current = `${window.location.pathname}${window.location.search}${window.location.hash}`;
  if (next === current) return;
  if (replace) {
    window.history.replaceState(null, '', next);
  } else {
    window.history.pushState(null, '', next);
  }
}

function setMode(mode, options = {}) {
  const { syncUrl = false, replaceUrl = false } = options;
  if (!validModeKeys.has(mode)) return;
  const changed = state.mode !== mode;
  state.mode = mode;
  if (changed) {
    renderModeTabs();
    applyModeView();
  }
  if (syncUrl) {
    writeModeToUrl(mode, { replace: replaceUrl });
  }
}

function initModeRouting() {
  window.addEventListener('popstate', () => {
    const modeFromUrl = readModeFromUrl() || 'colors';
    setMode(modeFromUrl, { syncUrl: !readModeFromUrl(), replaceUrl: true });
  });
}

function renderModeTabs() {
  if (!modeTabsEl) return;
  modeTabsEl.innerHTML = '';

  viewModes.forEach((mode) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = `mode-tab ${state.mode === mode.key ? 'active' : ''}`;
    button.textContent = mode.label;
    button.setAttribute('role', 'tab');
    button.setAttribute('aria-selected', String(state.mode === mode.key));
    button.addEventListener('click', () => {
      setMode(mode.key, { syncUrl: true });
    });
    modeTabsEl.append(button);
  });
}

function createEmptyState() {
  const empty = document.createElement('section');
  empty.className = 'empty';

  const line = document.createElement('p');
  line.className = 'empty-line';
  line.textContent = '没有对应结果';

  empty.append(line);
  return empty;
}

function renderWall() {
  wallEl.innerHTML = '';

  if (state.filtered.length === 0) {
    wallEl.append(createEmptyState());
    return;
  }

  const fragment = document.createDocumentFragment();
  state.filtered.forEach((color) => {
    fragment.append(createTile(color));
  });
  wallEl.append(fragment);
}

function renderHueFilters() {
  const counts = state.colors.reduce((acc, color) => {
    acc[color.hueGroup] = (acc[color.hueGroup] || 0) + 1;
    return acc;
  }, {});

  const entries = [['all', `全部 ${state.colors.length}`]];
  hueOrder.forEach((hueKey) => {
    if (counts[hueKey]) {
      const label = state.colors.find((item) => item.hueGroup === hueKey)?.hueLabel || hueKey;
      entries.push([hueKey, `${label} ${counts[hueKey]}`]);
    }
  });

  hueFiltersEl.innerHTML = '';
  entries.forEach(([key, label]) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = `filter-btn ${state.hue === key ? 'active' : ''}`;
    button.textContent = label;
    button.addEventListener('click', () => {
      state.hue = key;
      filterColors();
      renderHueFilters();
      renderWall();
    });
    hueFiltersEl.append(button);
  });
}

async function init() {
  initModeRouting();

  const colorsResp = await fetch('./data/colors-with-examples.json');

  if (!colorsResp.ok) {
    throw new Error('颜色数据加载失败');
  }

  const colors = await colorsResp.json();

  // Keep source order from the upstream dataset.
  state.colors = colors;
  state.filtered = colors;
  state.colorByHex = new Map();
  state.nearestColorByHex = new Map();
  colors.forEach((color) => {
    const key = normalizeHex(color.hex);
    if (!state.colorByHex.has(key)) {
      state.colorByHex.set(key, color);
    }
  });
  state.palettes = buildSourcedPalettes(colors);
  const modeFromUrl = readModeFromUrl();
  state.mode = modeFromUrl || 'colors';
  if (!modeFromUrl) {
    writeModeToUrl(state.mode, { replace: true });
  }

  renderPaletteBoard();
  renderModeTabs();
  applyModeView();
  renderHueFilters();
  renderWall();
}

init().catch((error) => {
  wallEl.innerHTML = `<section class="empty"><p>页面加载失败：${error.message}</p></section>`;
});

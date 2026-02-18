const wallEl = document.getElementById('colorWall');
const hueFiltersEl = document.getElementById('hueFilters');
const searchInputEl = document.getElementById('searchInput');
const tileTemplate = document.getElementById('tileTemplate');

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
  search: '',
  hue: 'all',
};

function colorSearchText(color) {
  return [
    color.name,
    color.pinyin,
    color.hex,
    (color.rgb || []).join(','),
    (color.cmyk || []).join(','),
    color.hueLabel,
  ]
    .join(' ')
    .toLowerCase();
}

function contrastTextColor(hex) {
  const value = hex.replace('#', '');
  const r = Number.parseInt(value.slice(0, 2), 16);
  const g = Number.parseInt(value.slice(2, 4), 16);
  const b = Number.parseInt(value.slice(4, 6), 16);
  const luminance = (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
  return luminance > 0.62 ? '#1f1712' : '#fffdf8';
}

function filterColors() {
  const query = state.search.trim().toLowerCase();
  state.filtered = state.colors.filter((color) => {
    const passHue = state.hue === 'all' || color.hueGroup === state.hue;
    if (!passHue) return false;
    if (!query) return true;
    return colorSearchText(color).includes(query);
  });
}

async function copyToClipboard(text, hintEl, tileEl) {
  const original = hintEl.textContent;
  tileEl.classList.add('flash');
  let copied = false;

  try {
    await navigator.clipboard.writeText(text);
    copied = true;
  } catch {
    // fallback for browsers where Clipboard API is blocked in insecure contexts
    const textarea = document.createElement('textarea');
    textarea.value = text;
    textarea.setAttribute('readonly', 'true');
    textarea.style.position = 'fixed';
    textarea.style.left = '-9999px';
    document.body.append(textarea);
    textarea.select();
    try {
      copied = document.execCommand('copy');
    } catch {
      copied = false;
    }
    textarea.remove();
  }

  hintEl.textContent = copied ? '已复制 HEX' : `HEX ${text.toUpperCase()}`;

  setTimeout(() => {
    hintEl.textContent = original;
    tileEl.classList.remove('flash');
  }, 900);
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

function createEmptyState() {
  const empty = document.createElement('section');
  empty.className = 'empty';

  const line = document.createElement('p');
  line.className = 'empty-line';
  if (state.search.trim()) {
    line.textContent = `“${state.search.trim()}”没有对应结果`;
  } else {
    line.textContent = '没有对应结果';
  }

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

function bindEvents() {
  searchInputEl.addEventListener('input', () => {
    state.search = searchInputEl.value;
    filterColors();
    renderWall();
  });
}

async function init() {
  bindEvents();

  const colorsResp = await fetch('./data/colors-with-examples.json');

  if (!colorsResp.ok) {
    throw new Error('颜色数据加载失败');
  }

  const colors = await colorsResp.json();

  // Keep source order from the upstream dataset.
  state.colors = colors;
  state.filtered = colors;

  renderHueFilters();
  renderWall();
}

init().catch((error) => {
  wallEl.innerHTML = `<section class="empty"><p>页面加载失败：${error.message}</p></section>`;
});

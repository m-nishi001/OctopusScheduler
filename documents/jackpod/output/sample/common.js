// 画面設定リスト管理
// ホーム画面BGM（最大1件のみ）
window.getHomeBgm = async function() {
  const config = await dbGet(STORE_CONFIG, 'screen_home_bgm');
  return config && config.value ? config.value : null;
};
window.setHomeBgm = async function(bgmObj) {
  if (!bgmObj) {
    await dbDelete(STORE_CONFIG, 'screen_home_bgm');
    return;
  }
  await dbPut(STORE_CONFIG, { key: 'screen_home_bgm', value: bgmObj });
};
async function getScreenContentList(screenKey) {
  const config = await dbGet(STORE_CONFIG, 'screen_' + screenKey);
  return config && config.list ? config.list : [];
}
async function setScreenContentList(screenKey, list) {
  await dbPut(STORE_CONFIG, { key: 'screen_' + screenKey, list });
}
async function addScreenContent(screenKey, content) {
  const list = await getScreenContentList(screenKey);
  list.push({ ...content, id: Date.now() });
  await setScreenContentList(screenKey, list);
  return list;
}
async function deleteScreenContent(screenKey, id) {
  let list = await getScreenContentList(screenKey);
  list = list.filter(c => c.id !== id);
  await setScreenContentList(screenKey, list);
  return list;
}
async function deleteCheckedScreenContent(screenKey, ids) {
  let list = await getScreenContentList(screenKey);
  list = list.filter(c => !ids.includes(c.id));
  await setScreenContentList(screenKey, list);
  return list;
}
// グローバル登録
window.deleteCheckedScreenContentImpl = deleteCheckedScreenContent;
// jackpot サンプルアプリ 共通JS
// IndexedDBラッパー・画面遷移・アセット管理・抽選・演出・管理画面連携

const DB_NAME = 'jackpot2025';
const DB_VERSION = 1;
const STORE_CONFIG = 'config';
const STORE_MEMBERS = 'members';
const STORE_PRIZES = 'prizes';
const STORE_RESULTS = 'results';

// IndexedDB Utility
const dbPromise = new Promise((resolve, reject) => {
  const req = indexedDB.open(DB_NAME, DB_VERSION);
  req.onupgradeneeded = e => {
    const db = req.result;
    if (!db.objectStoreNames.contains(STORE_CONFIG)) db.createObjectStore(STORE_CONFIG, { keyPath: 'key' });
    if (!db.objectStoreNames.contains(STORE_MEMBERS)) db.createObjectStore(STORE_MEMBERS, { keyPath: 'id', autoIncrement: true });
    if (!db.objectStoreNames.contains(STORE_PRIZES)) db.createObjectStore(STORE_PRIZES, { keyPath: 'id', autoIncrement: true });
    if (!db.objectStoreNames.contains(STORE_RESULTS)) db.createObjectStore(STORE_RESULTS, { keyPath: 'id', autoIncrement: true });
  };
  req.onsuccess = () => resolve(req.result);
  req.onerror = () => reject(req.error);
});

async function dbPut(store, value) {
  const db = await dbPromise;
  return new Promise((resolve, reject) => {
    const tx = db.transaction(store, 'readwrite');
    tx.objectStore(store).put(value);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}
async function dbDelete(store, key) {
  const db = await dbPromise;
  return new Promise((resolve, reject) => {
    const tx = db.transaction(store, 'readwrite');
    tx.objectStore(store).delete(key);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}
async function dbGet(store, key) {
  const db = await dbPromise;
  return new Promise((resolve, reject) => {
    const tx = db.transaction(store, 'readonly');
    const req = tx.objectStore(store).get(key);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}
async function dbGetAll(store) {
  const db = await dbPromise;
  return new Promise((resolve, reject) => {
    const tx = db.transaction(store, 'readonly');
    const req = tx.objectStore(store).getAll();
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

// 画面遷移（Enterキー）
function nextPage(url) {
  window.location.href = url;
}
document.addEventListener('keydown', e => {
  if (e.key === 'Enter') {
    const next = document.querySelector('[data-next]');
    if (next) next.click();
  }
});

// モーダル表示
function showModal(msg, duration = 2000) {
  const modal = document.createElement('div');
  modal.className = 'modal';
  modal.innerHTML = `<div class='modal-content fade-in'>${msg}</div>`;
  document.body.appendChild(modal);
  setTimeout(() => {
    modal.querySelector('.modal-content').classList.add('fade-out');
    setTimeout(() => document.body.removeChild(modal), 1200);
  }, duration);
}

// アセット管理（ダウンロード・プリロード）
async function preloadAssets(assets, onProgress) {
  let loaded = 0;
  for (const asset of assets) {
    await new Promise(res => {
      const el = asset.endsWith('.mp3') ? new Audio() : new Image();
      el.src = asset;
      el.onload = el.oncanplaythrough = () => {
        loaded++;
        if (onProgress) onProgress(loaded / assets.length);
        res();
      };
      el.onerror = () => res();
    });
  }
}

// 抽選ロジック
function drawMember(members, drawnIds) {
  const remain = members.filter(m => !drawnIds.includes(m.id));
  if (remain.length === 0) return null;
  return remain[Math.floor(Math.random() * remain.length)];
}
function drawPrize(prizes, drawnIds) {
  const remain = prizes.filter(p => !drawnIds.includes(p.id));
  if (remain.length === 0) return null;
  return remain[Math.floor(Math.random() * remain.length)];
}

// 2D/3D演出（簡易）
function showRoulette(prizes, onStop) {
  // 簡易ルーレット演出
  const roulette = document.createElement('div');
  roulette.className = 'modal';
  let idx = 0;
  let running = true;
  roulette.innerHTML = `<div class='modal-content fade-in' id='roulette-content'></div>`;
  document.body.appendChild(roulette);
  function spin() {
    if (!running) return;
    document.getElementById('roulette-content').textContent = prizes[idx % prizes.length].name;
    idx++;
    setTimeout(spin, 80 + Math.min(idx * 2, 200));
  }
  spin();
  document.addEventListener('keydown', function handler(e) {
    if (e.key === 'Enter' && running) {
      running = false;
      document.removeEventListener('keydown', handler);
      setTimeout(() => {
        document.body.removeChild(roulette);
        if (onStop) onStop(prizes[(idx-1) % prizes.length]);
      }, 800);
    }
  });
}

// 管理画面連携（設定保存/読込）
async function saveConfig(key, value) {
  await dbPut(STORE_CONFIG, { key, value });
}
async function loadConfig(key) {
  const item = await dbGet(STORE_CONFIG, key);
  return item ? item.value : null;
}

// 画像アップロード（顔写真等）
function uploadImage(file, callback) {
  const reader = new FileReader();
  reader.onload = () => callback(reader.result);
  reader.readAsDataURL(file);
}
// ファイルアップロード（音楽・動画等）
function uploadFile(file, callback) {
  const reader = new FileReader();
  reader.onload = () => callback(reader.result);
  reader.readAsDataURL(file);
}
window.uploadFile = uploadFile;

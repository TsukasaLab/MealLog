import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm';

const cfg = window.MEALLOG_CONFIG || {};
const isConfigured = Boolean(cfg.SUPABASE_URL && cfg.SUPABASE_KEY);
const isDemoMode = !isConfigured;
const supabase = isConfigured ? createClient(cfg.SUPABASE_URL, cfg.SUPABASE_KEY) : null;

const $ = (id) => document.getElementById(id);
const els = {
  setupView: $('setupView'), authView: $('authView'), appView: $('appView'),
  authForm: $('authForm'), emailInput: $('emailInput'), passwordInput: $('passwordInput'),
  authTitle: $('authTitle'), authLead: $('authLead'), authSubmit: $('authSubmit'), authMessage: $('authMessage'),
  switchAuthMode: $('switchAuthMode'), togglePassword: $('togglePassword'), googleLoginButton: $('googleLoginButton'),
  profileButton: $('profileButton'), profileMenu: $('profileMenu'), profileEmail: $('profileEmail'), avatarText: $('avatarText'), logoutButton: $('logoutButton'),
  openUploadTop: $('openUploadTop'), openUploadHero: $('openUploadHero'), openUploadEmpty: $('openUploadEmpty'), openUploadNav: $('openUploadNav'),
  accountNav: $('accountNav'), uploadDialog: $('uploadDialog'), closeUpload: $('closeUpload'),
  mealForm: $('mealForm'), cameraButton: $('cameraButton'), libraryButton: $('libraryButton'), cameraInput: $('cameraInput'), libraryInput: $('libraryInput'),
  previewArea: $('previewArea'), previewGrid: $('previewGrid'), clearPhotos: $('clearPhotos'),
  mealTitle: $('mealTitle'), mealNote: $('mealNote'), eatenAt: $('eatenAt'), saveMeal: $('saveMeal'), uploadStatus: $('uploadStatus'),
  timeline: $('timeline'), loadingState: $('loadingState'), emptyState: $('emptyState'), searchInput: $('searchInput'), refreshButton: $('refreshButton'),
  detailDialog: $('detailDialog'), detailContent: $('detailContent'), closeDetail: $('closeDetail'), toast: $('toast')
};

let authMode = 'login';
let currentUser = null;
let selectedFiles = [];
let entriesCache = [];
let toastTimer = null;
let demoObjectUrls = [];

const DEMO_DB_NAME = 'meallog-demo';
const DEMO_STORE = 'entries';

function show(view) {
  [els.setupView, els.authView, els.appView].forEach(v => v.classList.add('hidden'));
  view.classList.remove('hidden');
}

function toast(message) {
  clearTimeout(toastTimer);
  els.toast.textContent = message;
  els.toast.classList.add('show');
  toastTimer = setTimeout(() => els.toast.classList.remove('show'), 2600);
}

function escapeHtml(value = '') {
  return String(value).replace(/[&<>'"]/g, (c) => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));
}

function nowForDatetimeLocal(date = new Date()) {
  const pad = (n) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth()+1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function formatDate(iso) {
  const d = new Date(iso);
  return new Intl.DateTimeFormat('ja-JP', { year:'numeric', month:'long', day:'numeric', weekday:'short', hour:'2-digit', minute:'2-digit' }).format(d);
}

function fileExt(name) {
  const match = name.toLowerCase().match(/\.([a-z0-9]+)$/);
  return match ? match[1].replace('jpeg','jpg') : 'jpg';
}

function uuid() {
  return crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function addDemoBanner() {
  if (document.getElementById('demoModeBanner')) return;

  const style = document.createElement('style');
  style.textContent = `
    .demo-mode-banner{
      margin:0 auto;
      padding:11px 20px;
      background:linear-gradient(90deg,#fff0e8,#fff8f3);
      border-bottom:1px solid rgba(215,126,84,.18);
      color:#6c4434;
      font-size:13px;
      line-height:1.55;
      text-align:center;
    }
    .demo-mode-banner strong{
      display:inline-block;
      margin-right:8px;
      color:#d46254;
    }
    @media (max-width:640px){
      .demo-mode-banner{padding:9px 14px;font-size:12px;text-align:left}
      .demo-mode-banner strong{display:block;margin:0 0 2px}
    }
  `;
  document.head.appendChild(style);

  const banner = document.createElement('div');
  banner.id = 'demoModeBanner';
  banner.className = 'demo-mode-banner';
  banner.innerHTML = '<strong>デモモード</strong> Supabase接続前のため、この端末のブラウザ内だけに仮保存されます。';
  const topbar = els.appView.querySelector('.topbar');
  topbar?.insertAdjacentElement('afterend', banner);
}

function setupDemoModeUI() {
  addDemoBanner();
  currentUser = {
    id: 'demo-local',
    email: 'デモモード',
    user_metadata: { name: 'Demo' }
  };

  els.profileEmail.textContent = 'デモモード\nこの端末内に仮保存';
  els.profileEmail.style.whiteSpace = 'pre-line';
  els.avatarText.textContent = 'D';
  els.saveMeal.textContent = '端末に保存';

  const heroText = els.appView.querySelector('.hero > div > p:last-child');
  if (heroText) {
    heroText.textContent = '撮った写真も、フォルダの写真も。今はこの端末だけに仮保存して、実際の使い心地を試せます。';
  }

  const loadingText = els.loadingState.querySelector('p');
  if (loadingText) loadingText.textContent = '端末から読み込み中…';
}

function openDemoDb() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DEMO_DB_NAME, 1);

    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(DEMO_STORE)) {
        const store = db.createObjectStore(DEMO_STORE, { keyPath: 'id' });
        store.createIndex('eaten_at', 'eaten_at');
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function demoDbGetAll() {
  const db = await openDemoDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(DEMO_STORE, 'readonly');
    const req = tx.objectStore(DEMO_STORE).getAll();
    req.onsuccess = () => resolve(req.result || []);
    req.onerror = () => reject(req.error);
    tx.oncomplete = () => db.close();
  });
}

async function demoDbPut(entry) {
  const db = await openDemoDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(DEMO_STORE, 'readwrite');
    tx.objectStore(DEMO_STORE).put(entry);
    tx.oncomplete = () => { db.close(); resolve(); };
    tx.onerror = () => { db.close(); reject(tx.error); };
  });
}

async function demoDbDelete(id) {
  const db = await openDemoDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(DEMO_STORE, 'readwrite');
    tx.objectStore(DEMO_STORE).delete(id);
    tx.oncomplete = () => { db.close(); resolve(); };
    tx.onerror = () => { db.close(); reject(tx.error); };
  });
}

function revokeDemoObjectUrls() {
  demoObjectUrls.forEach(url => URL.revokeObjectURL(url));
  demoObjectUrls = [];
}

async function bootstrap() {
  if (isDemoMode) {
    show(els.appView);
    setupDemoModeUI();
    await loadEntries();
    return;
  }

  const { data: { session } } = await supabase.auth.getSession();
  await applySession(session);

  supabase.auth.onAuthStateChange(async (_event, session) => {
    await applySession(session);
  });
}

async function applySession(session) {
  currentUser = session?.user || null;
  if (!currentUser) {
    show(els.authView);
    els.profileMenu.classList.add('hidden');
    return;
  }

  show(els.appView);
  const email = currentUser.email || 'User';
  const displayName = currentUser.user_metadata?.full_name || currentUser.user_metadata?.name || '';
  els.profileEmail.textContent = displayName ? `${displayName}\n${email}` : email;
  els.profileEmail.style.whiteSpace = 'pre-line';
  els.avatarText.textContent = (displayName || email).slice(0, 1).toUpperCase();
  await loadEntries();
}

function setAuthMode(mode) {
  authMode = mode;
  const signup = mode === 'signup';
  els.authTitle.textContent = signup ? 'MealLogをはじめる' : 'おかえりなさい';
  els.authLead.textContent = signup ? 'Googleなら登録操作なしですぐ始められます' : 'Googleアカウントですぐにログインできます';
  els.authSubmit.textContent = signup ? 'アカウントを作成' : 'ログイン';
  els.switchAuthMode.textContent = signup ? 'すでにアカウントをお持ちの方' : 'はじめて使う方はこちら';
  els.passwordInput.autocomplete = signup ? 'new-password' : 'current-password';
  els.authMessage.textContent = '';
}

els.switchAuthMode.addEventListener('click', () => setAuthMode(authMode === 'login' ? 'signup' : 'login'));

els.googleLoginButton.addEventListener('click', async () => {
  if (!supabase) {
    toast('Supabase接続後にGoogleログインを有効にできます');
    return;
  }

  els.authMessage.textContent = '';
  els.googleLoginButton.disabled = true;
  const originalText = els.googleLoginButton.querySelector('span:last-child')?.textContent || 'Googleで続ける';
  const label = els.googleLoginButton.querySelector('span:last-child');
  if (label) label.textContent = 'Googleへ移動中…';

  try {
    const redirectTo = `${window.location.origin}${window.location.pathname}`;
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo }
    });
    if (error) throw error;
  } catch (error) {
    console.error(error);
    els.authMessage.textContent = `Googleログインを開始できませんでした：${error.message || '設定を確認してください'}`;
    els.googleLoginButton.disabled = false;
    if (label) label.textContent = originalText;
  }
});

els.togglePassword.addEventListener('click', () => {
  const showPw = els.passwordInput.type === 'password';
  els.passwordInput.type = showPw ? 'text' : 'password';
  els.togglePassword.textContent = showPw ? '隠す' : '見る';
});

els.authForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  if (!supabase) return;

  els.authMessage.textContent = '';
  els.authSubmit.disabled = true;
  els.authSubmit.textContent = authMode === 'signup' ? '作成中…' : 'ログイン中…';

  const email = els.emailInput.value.trim();
  const password = els.passwordInput.value;
  try {
    if (authMode === 'signup') {
      const { data, error } = await supabase.auth.signUp({ email, password });
      if (error) throw error;
      if (!data.session) {
        els.authMessage.textContent = '確認メールを送りました。メール内のリンクを開いてからログインしてください。';
        setAuthMode('login');
      }
    } else {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;
    }
  } catch (error) {
    els.authMessage.textContent = error.message || '処理に失敗しました。';
  } finally {
    els.authSubmit.disabled = false;
    els.authSubmit.textContent = authMode === 'signup' ? 'アカウントを作成' : 'ログイン';
  }
});

els.logoutButton.addEventListener('click', async () => {
  if (isDemoMode) {
    els.profileMenu.classList.add('hidden');
    toast('今はデモモードです。Supabase接続後にログイン機能が使えます');
    return;
  }

  await supabase.auth.signOut();
  toast('ログアウトしました');
});

els.profileButton.addEventListener('click', (e) => {
  e.stopPropagation();
  els.profileMenu.classList.toggle('hidden');
});
els.accountNav.addEventListener('click', () => els.profileMenu.classList.toggle('hidden'));
document.addEventListener('click', (e) => {
  if (!els.profileMenu.classList.contains('hidden') && !els.profileMenu.contains(e.target) && !els.profileButton.contains(e.target)) {
    els.profileMenu.classList.add('hidden');
  }
});

function openUpload() {
  selectedFiles = [];
  renderPreviews();
  els.mealForm.reset();
  els.eatenAt.value = nowForDatetimeLocal();
  els.uploadStatus.textContent = '';
  els.saveMeal.textContent = isDemoMode ? '端末に保存' : 'クラウドに保存';
  els.uploadDialog.showModal();
}
[els.openUploadTop, els.openUploadHero, els.openUploadEmpty, els.openUploadNav].forEach(btn => btn?.addEventListener('click', openUpload));
els.closeUpload.addEventListener('click', () => els.uploadDialog.close());
els.cameraButton.addEventListener('click', () => els.cameraInput.click());
els.libraryButton.addEventListener('click', () => els.libraryInput.click());
els.cameraInput.addEventListener('change', () => addFiles([...els.cameraInput.files]));
els.libraryInput.addEventListener('change', () => addFiles([...els.libraryInput.files]));
els.clearPhotos.addEventListener('click', () => { selectedFiles = []; renderPreviews(); });

function addFiles(files) {
  const images = files.filter(f => f.type.startsWith('image/'));
  if (!images.length) return;
  const combined = [...selectedFiles, ...images];
  const seen = new Set();
  selectedFiles = combined.filter(file => {
    const key = `${file.name}-${file.size}-${file.lastModified}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  }).slice(0, 12);
  renderPreviews();
  els.cameraInput.value = '';
  els.libraryInput.value = '';
}

function renderPreviews() {
  els.previewArea.classList.toggle('hidden', selectedFiles.length === 0);
  els.previewGrid.innerHTML = '';
  selectedFiles.forEach((file, index) => {
    const url = URL.createObjectURL(file);
    const item = document.createElement('div');
    item.className = 'preview-item';
    item.innerHTML = `<img src="${url}" alt="選択した写真 ${index+1}"><button type="button" aria-label="この写真を外す">×</button>`;
    item.querySelector('img').addEventListener('load', () => URL.revokeObjectURL(url), { once:true });
    item.querySelector('button').addEventListener('click', () => {
      selectedFiles.splice(index, 1);
      renderPreviews();
    });
    els.previewGrid.appendChild(item);
  });
}

async function saveDemoEntry() {
  const mealId = uuid();
  const entry = {
    id: mealId,
    title: els.mealTitle.value.trim(),
    note: els.mealNote.value.trim(),
    eaten_at: new Date(els.eatenAt.value).toISOString(),
    created_at: new Date().toISOString(),
    photos: selectedFiles.map((file) => ({
      id: uuid(),
      blob: file,
      original_name: file.name || 'photo.jpg',
      type: file.type || 'image/jpeg'
    }))
  };

  await demoDbPut(entry);
}

els.mealForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  if (!currentUser) return;
  if (!selectedFiles.length) {
    toast('写真を1枚以上選んでください');
    return;
  }

  els.saveMeal.disabled = true;

  if (isDemoMode) {
    els.uploadStatus.textContent = 'この端末に保存中…';
    try {
      await saveDemoEntry();
      els.uploadDialog.close();
      selectedFiles = [];
      toast('この端末に仮保存しました');
      await loadEntries();
    } catch (error) {
      console.error(error);
      els.uploadStatus.textContent = `保存できませんでした：${error.message || 'ブラウザの保存容量を確認してください'}`;
    } finally {
      els.saveMeal.disabled = false;
      els.saveMeal.textContent = '端末に保存';
    }
    return;
  }

  els.uploadStatus.textContent = 'クラウドへ保存中…';
  const mealId = uuid();
  const eatenAt = new Date(els.eatenAt.value).toISOString();
  const uploadedPaths = [];

  try {
    const { error: entryError } = await supabase.from('meal_entries').insert({
      id: mealId,
      user_id: currentUser.id,
      title: els.mealTitle.value.trim(),
      note: els.mealNote.value.trim(),
      eaten_at: eatenAt
    });
    if (entryError) throw entryError;

    for (let i = 0; i < selectedFiles.length; i++) {
      const file = selectedFiles[i];
      els.uploadStatus.textContent = `写真をアップロード中 ${i+1} / ${selectedFiles.length}`;
      const path = `${currentUser.id}/${mealId}/${uuid()}.${fileExt(file.name)}`;
      const { error: uploadError } = await supabase.storage.from('meal-photos').upload(path, file, {
        cacheControl: '3600',
        upsert: false,
        contentType: file.type || 'image/jpeg'
      });
      if (uploadError) throw uploadError;
      uploadedPaths.push(path);

      const { error: photoError } = await supabase.from('meal_photos').insert({
        meal_id: mealId,
        user_id: currentUser.id,
        storage_path: path,
        original_name: file.name
      });
      if (photoError) throw photoError;
    }

    els.uploadDialog.close();
    selectedFiles = [];
    toast('食事をクラウドに保存しました');
    await loadEntries();
  } catch (error) {
    console.error(error);
    if (uploadedPaths.length) await supabase.storage.from('meal-photos').remove(uploadedPaths);
    await supabase.from('meal_entries').delete().eq('id', mealId);
    els.uploadStatus.textContent = `保存できませんでした：${error.message || '不明なエラー'}`;
  } finally {
    els.saveMeal.disabled = false;
    els.saveMeal.textContent = 'クラウドに保存';
  }
});

async function loadDemoEntries() {
  revokeDemoObjectUrls();
  const rows = await demoDbGetAll();

  entriesCache = rows
    .sort((a, b) => new Date(b.eaten_at) - new Date(a.eaten_at))
    .map(entry => ({
      ...entry,
      photos: (entry.photos || []).map(photo => {
        const url = URL.createObjectURL(photo.blob);
        demoObjectUrls.push(url);
        return {
          id: photo.id,
          original_name: photo.original_name,
          storage_path: '',
          url
        };
      })
    }));

  renderEntries();
}

async function loadEntries() {
  if (!currentUser) return;
  els.loadingState.classList.remove('hidden');
  els.emptyState.classList.add('hidden');
  els.timeline.innerHTML = '';

  if (isDemoMode) {
    try {
      await loadDemoEntries();
    } catch (error) {
      console.error(error);
      els.timeline.innerHTML = `<div class="state-card"><p>端末内の記録を読み込めませんでした。<br>${escapeHtml(error.message || '')}</p></div>`;
    } finally {
      els.loadingState.classList.add('hidden');
    }
    return;
  }

  try {
    const { data, error } = await supabase
      .from('meal_entries')
      .select('id,title,note,eaten_at,created_at,meal_photos(id,storage_path,original_name)')
      .order('eaten_at', { ascending:false });
    if (error) throw error;

    const entries = data || [];
    const paths = entries.flatMap(entry => (entry.meal_photos || []).map(p => p.storage_path));
    let signedMap = new Map();
    if (paths.length) {
      const { data: signedData, error: signedError } = await supabase.storage.from('meal-photos').createSignedUrls(paths, 3600);
      if (signedError) throw signedError;
      signedMap = new Map((signedData || []).map(item => [item.path, item.signedUrl || item.signedURL]));
    }

    entriesCache = entries.map(entry => ({
      ...entry,
      photos: (entry.meal_photos || []).map(p => ({ ...p, url:signedMap.get(p.storage_path) })).filter(p => p.url)
    }));
    renderEntries();
  } catch (error) {
    console.error(error);
    els.timeline.innerHTML = `<div class="state-card"><p>読み込みに失敗しました。<br>${escapeHtml(error.message || '')}</p></div>`;
  } finally {
    els.loadingState.classList.add('hidden');
  }
}

function renderEntries() {
  const q = els.searchInput.value.trim().toLowerCase();
  const rows = entriesCache.filter(entry => !q || `${entry.title} ${entry.note || ''}`.toLowerCase().includes(q));
  els.emptyState.classList.toggle('hidden', entriesCache.length !== 0 || q !== '');
  els.timeline.innerHTML = '';

  if (!rows.length && q) {
    els.timeline.innerHTML = `<div class="state-card"><p>「${escapeHtml(q)}」に一致する記録はありません。</p></div>`;
    return;
  }

  rows.forEach(entry => {
    const card = document.createElement('article');
    card.className = 'meal-card';
    const cover = entry.photos?.[0]?.url || '';
    card.innerHTML = `
      <div class="meal-cover" data-open="${entry.id}">
        ${cover ? `<img src="${cover}" alt="${escapeHtml(entry.title)}" loading="lazy">` : ''}
        <span class="photo-count">${entry.photos.length}枚</span>
      </div>
      <div class="meal-body">
        <div class="meal-meta"><span>${escapeHtml(formatDate(entry.eaten_at))}</span></div>
        <h3>${escapeHtml(entry.title)}</h3>
        <div class="meal-note">${escapeHtml(entry.note || 'メモはありません')}</div>
        <div class="meal-actions">
          <button class="view-entry" type="button" data-open="${entry.id}">見る</button>
          <button class="delete-entry" type="button" data-delete="${entry.id}">削除</button>
        </div>
      </div>`;
    card.querySelectorAll('[data-open]').forEach(btn => btn.addEventListener('click', () => openDetail(entry.id)));
    card.querySelector('[data-delete]').addEventListener('click', () => deleteEntry(entry.id));
    els.timeline.appendChild(card);
  });
}

function openDetail(id) {
  const entry = entriesCache.find(e => e.id === id);
  if (!entry) return;
  const images = entry.photos.slice(0, 5).map(p => `<img src="${p.url}" alt="${escapeHtml(entry.title)}">`).join('');
  els.detailContent.innerHTML = `
    <div class="detail-gallery">${images}</div>
    <div class="detail-info">
      <p class="eyebrow">MEAL MEMORY</p>
      <h2>${escapeHtml(entry.title)}</h2>
      <div class="detail-date">${escapeHtml(formatDate(entry.eaten_at))}</div>
      <div class="detail-note">${escapeHtml(entry.note || 'メモはありません')}</div>
      <button class="detail-delete" type="button">この記録を削除</button>
    </div>`;
  els.detailContent.querySelector('.detail-delete').addEventListener('click', async () => {
    els.detailDialog.close();
    await deleteEntry(id);
  });
  els.detailDialog.showModal();
}
els.closeDetail.addEventListener('click', () => els.detailDialog.close());

async function deleteEntry(id) {
  const entry = entriesCache.find(e => e.id === id);
  if (!entry) return;

  const warning = isDemoMode
    ? `「${entry.title}」をこの端末から削除しますか？`
    : `「${entry.title}」を削除しますか？\n写真もクラウドから削除されます。`;
  if (!confirm(warning)) return;

  if (isDemoMode) {
    try {
      await demoDbDelete(id);
      toast('端末内の記録を削除しました');
      await loadEntries();
    } catch (error) {
      console.error(error);
      toast(`削除できませんでした：${error.message || ''}`);
    }
    return;
  }

  try {
    const paths = entry.photos.map(p => p.storage_path);
    if (paths.length) {
      const { error: storageError } = await supabase.storage.from('meal-photos').remove(paths);
      if (storageError) throw storageError;
    }
    const { error } = await supabase.from('meal_entries').delete().eq('id', id);
    if (error) throw error;
    toast('削除しました');
    await loadEntries();
  } catch (error) {
    console.error(error);
    toast(`削除できませんでした：${error.message || ''}`);
  }
}

els.searchInput.addEventListener('input', renderEntries);
els.refreshButton.addEventListener('click', loadEntries);

bootstrap();

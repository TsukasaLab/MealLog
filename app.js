import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm';

const cfg = window.MEALLOG_CONFIG || {};
const isConfigured = Boolean(cfg.SUPABASE_URL && cfg.SUPABASE_KEY);
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
  storeNameField: $('storeNameField'), storeName: $('storeName'), ratingStars: $('ratingStars'), ratingInput: $('ratingInput'), clearRating: $('clearRating'),
  timeline: $('timeline'), loadingState: $('loadingState'), emptyState: $('emptyState'), searchInput: $('searchInput'), refreshButton: $('refreshButton'),
  detailDialog: $('detailDialog'), detailContent: $('detailContent'), closeDetail: $('closeDetail'), toast: $('toast')
};

let authMode = 'login';
let currentUser = null;
let selectedFiles = [];
let entriesCache = [];
let toastTimer = null;

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
  return String(value).replace(/[&<>'"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));
}

function nowForDatetimeLocal(date = new Date()) {
  const pad = n => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth()+1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function formatDate(iso) {
  return new Intl.DateTimeFormat('ja-JP', {
    year:'numeric', month:'long', day:'numeric', weekday:'short', hour:'2-digit', minute:'2-digit'
  }).format(new Date(iso));
}

function fileExt(name) {
  const match = String(name || '').toLowerCase().match(/\.([a-z0-9]+)$/);
  return match ? match[1].replace('jpeg','jpg') : 'jpg';
}

function uuid() {
  return crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function placeLabel(type) {
  return ({ home:'自宅', dineout:'外食', takeout:'テイクアウト' })[type] || '自宅';
}

function getPlaceType() {
  return document.querySelector('input[name="placeType"]:checked')?.value || 'home';
}

function updateStoreField() {
  const visible = getPlaceType() !== 'home';
  els.storeNameField.classList.toggle('hidden', !visible);
  if (!visible) els.storeName.value = '';
}

function setRating(value) {
  const rating = value ? Number(value) : 0;
  els.ratingInput.value = rating ? String(rating) : '';
  els.ratingStars.querySelectorAll('button[data-rating]').forEach(btn => {
    btn.classList.toggle('active', Number(btn.dataset.rating) <= rating);
    btn.setAttribute('aria-pressed', Number(btn.dataset.rating) === rating ? 'true' : 'false');
  });
}

async function bootstrap() {
  if (!isConfigured) {
    show(els.setupView);
    return;
  }

  const { data: { session } } = await supabase.auth.getSession();
  await applySession(session);
  supabase.auth.onAuthStateChange(async (_event, session) => applySession(session));
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
  els.authMessage.textContent = '';
  els.googleLoginButton.disabled = true;
  const label = els.googleLoginButton.querySelector('span:last-child');
  const original = label?.textContent || 'Googleで続ける';
  if (label) label.textContent = 'Googleへ移動中…';

  try {
    const redirectTo = `${window.location.origin}${window.location.pathname}`;
    const { error } = await supabase.auth.signInWithOAuth({ provider:'google', options:{ redirectTo } });
    if (error) throw error;
  } catch (error) {
    console.error(error);
    els.authMessage.textContent = `Googleログインを開始できませんでした：${error.message || '設定を確認してください'}`;
    els.googleLoginButton.disabled = false;
    if (label) label.textContent = original;
  }
});

els.togglePassword.addEventListener('click', () => {
  const visible = els.passwordInput.type === 'password';
  els.passwordInput.type = visible ? 'text' : 'password';
  els.togglePassword.textContent = visible ? '隠す' : '見る';
});

els.authForm.addEventListener('submit', async e => {
  e.preventDefault();
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
        setAuthMode('login');
        els.authMessage.textContent = '確認メールを送りました。メール内のリンクを開いてからログインしてください。';
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
  await supabase.auth.signOut();
  toast('ログアウトしました');
});

els.profileButton.addEventListener('click', e => {
  e.stopPropagation();
  els.profileMenu.classList.toggle('hidden');
});
els.accountNav.addEventListener('click', () => els.profileMenu.classList.toggle('hidden'));
document.addEventListener('click', e => {
  if (!els.profileMenu.classList.contains('hidden') && !els.profileMenu.contains(e.target) && !els.profileButton.contains(e.target)) {
    els.profileMenu.classList.add('hidden');
  }
});

function openUpload() {
  selectedFiles = [];
  renderPreviews();
  els.mealForm.reset();
  document.querySelector('input[name="placeType"][value="home"]').checked = true;
  updateStoreField();
  setRating(0);
  els.eatenAt.value = nowForDatetimeLocal();
  els.uploadStatus.textContent = '';
  els.uploadDialog.showModal();
}

[els.openUploadTop, els.openUploadHero, els.openUploadEmpty, els.openUploadNav].forEach(btn => btn?.addEventListener('click', openUpload));
els.closeUpload.addEventListener('click', () => els.uploadDialog.close());
els.cameraButton.addEventListener('click', () => els.cameraInput.click());
els.libraryButton.addEventListener('click', () => els.libraryInput.click());
els.cameraInput.addEventListener('change', () => addFiles([...els.cameraInput.files]));
els.libraryInput.addEventListener('change', () => addFiles([...els.libraryInput.files]));
els.clearPhotos.addEventListener('click', () => { selectedFiles = []; renderPreviews(); });
document.querySelectorAll('input[name="placeType"]').forEach(input => input.addEventListener('change', updateStoreField));
els.ratingStars.querySelectorAll('button[data-rating]').forEach(btn => btn.addEventListener('click', () => setRating(btn.dataset.rating)));
els.clearRating.addEventListener('click', () => setRating(0));

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
    item.innerHTML = `<img src="${url}" alt="選択した写真 ${index + 1}"><button type="button" aria-label="この写真を外す">×</button>`;
    item.querySelector('img').addEventListener('load', () => URL.revokeObjectURL(url), { once:true });
    item.querySelector('button').addEventListener('click', () => {
      selectedFiles.splice(index, 1);
      renderPreviews();
    });
    els.previewGrid.appendChild(item);
  });
}

els.mealForm.addEventListener('submit', async e => {
  e.preventDefault();
  if (!currentUser) return;
  if (!selectedFiles.length) {
    toast('写真を1枚以上選んでください');
    return;
  }

  const title = els.mealTitle.value.trim();
  const note = els.mealNote.value.trim();
  const placeType = getPlaceType();
  const storeName = placeType === 'home' ? '' : els.storeName.value.trim();
  const rating = els.ratingInput.value ? Number(els.ratingInput.value) : null;
  const eatenAt = new Date(els.eatenAt.value).toISOString();
  const mealId = uuid();
  const uploadedPaths = [];

  els.saveMeal.disabled = true;
  els.uploadStatus.textContent = 'クラウドへ保存中…';

  try {
    const { error: entryError } = await supabase.from('meal_entries').insert({
      id: mealId,
      user_id: currentUser.id,
      title,
      note,
      eaten_at: eatenAt,
      place_type: placeType,
      store_name: storeName,
      rating
    });
    if (entryError) throw entryError;

    for (let i = 0; i < selectedFiles.length; i++) {
      const file = selectedFiles[i];
      els.uploadStatus.textContent = `写真をアップロード中 ${i + 1} / ${selectedFiles.length}`;
      const path = `${currentUser.id}/${mealId}/${uuid()}.${fileExt(file.name)}`;
      const { error: uploadError } = await supabase.storage.from('meal-photos').upload(path, file, {
        cacheControl:'3600', upsert:false, contentType:file.type || 'image/jpeg'
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
  }
});

async function loadEntries() {
  if (!currentUser) return;
  els.loadingState.classList.remove('hidden');
  els.emptyState.classList.add('hidden');
  els.timeline.innerHTML = '';

  try {
    const { data, error } = await supabase
      .from('meal_entries')
      .select('id,title,note,eaten_at,created_at,place_type,store_name,rating,meal_photos(id,storage_path,original_name)')
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
      place_type: entry.place_type || 'home',
      store_name: entry.store_name || '',
      rating: entry.rating ?? null,
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
  const rows = entriesCache.filter(entry => {
    const haystack = `${entry.title} ${entry.note || ''} ${entry.store_name || ''} ${placeLabel(entry.place_type)}`.toLowerCase();
    return !q || haystack.includes(q);
  });

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
    const tags = [
      `<span class="meal-tag place">${escapeHtml(placeLabel(entry.place_type))}</span>`,
      entry.store_name ? `<span class="meal-tag store" title="${escapeHtml(entry.store_name)}">${escapeHtml(entry.store_name)}</span>` : '',
      entry.rating ? `<span class="meal-tag rating">★ ${entry.rating}</span>` : ''
    ].join('');

    card.innerHTML = `
      <div class="meal-cover" data-open="${entry.id}">
        ${cover ? `<img src="${cover}" alt="${escapeHtml(entry.title)}" loading="lazy">` : ''}
        <span class="photo-count">${entry.photos.length}枚</span>
      </div>
      <div class="meal-body">
        <div class="meal-meta"><span>${escapeHtml(formatDate(entry.eaten_at))}</span></div>
        <h3>${escapeHtml(entry.title)}</h3>
        <div class="meal-tags">${tags}</div>
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
  const tags = [
    `<span class="meal-tag place">${escapeHtml(placeLabel(entry.place_type))}</span>`,
    entry.rating ? `<span class="meal-tag rating">★ ${entry.rating}</span>` : ''
  ].join('');

  els.detailContent.innerHTML = `
    <div class="detail-gallery">${images}</div>
    <div class="detail-info">
      <p class="eyebrow">MEAL MEMORY</p>
      <h2>${escapeHtml(entry.title)}</h2>
      <div class="detail-date">${escapeHtml(formatDate(entry.eaten_at))}</div>
      <div class="detail-tags">${tags}</div>
      ${entry.store_name ? `<div class="detail-store"><strong>店舗</strong>${escapeHtml(entry.store_name)}</div>` : ''}
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
  if (!confirm(`「${entry.title}」を削除しますか？\n写真もクラウドから削除されます。`)) return;

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

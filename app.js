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
  formEyebrow: $('formEyebrow'), formTitle: $('formTitle'),
  mealForm: $('mealForm'), cameraButton: $('cameraButton'), libraryButton: $('libraryButton'), cameraInput: $('cameraInput'), libraryInput: $('libraryInput'),
  previewArea: $('previewArea'), previewGrid: $('previewGrid'), clearPhotos: $('clearPhotos'), photoEditHint: $('photoEditHint'),
  mealTitle: $('mealTitle'), mealNote: $('mealNote'), eatenAt: $('eatenAt'), saveMeal: $('saveMeal'), uploadStatus: $('uploadStatus'),
  storeNameField: $('storeNameField'), storeName: $('storeName'), ratingStars: $('ratingStars'), ratingInput: $('ratingInput'), clearRating: $('clearRating'),
  timeline: $('timeline'), loadingState: $('loadingState'), emptyState: $('emptyState'), searchInput: $('searchInput'), refreshButton: $('refreshButton'),
  detailDialog: $('detailDialog'), detailContent: $('detailContent'), closeDetail: $('closeDetail'),
  storeHistoryDialog: $('storeHistoryDialog'), storeHistoryContent: $('storeHistoryContent'), closeStoreHistory: $('closeStoreHistory'),
  toast: $('toast')
};

let authMode = 'login';
let currentUser = null;
let selectedFiles = [];
let entriesCache = [];
let toastTimer = null;

let editingEntryId = null;
let editingExistingPhotos = [];
let removedPhotoIds = new Set();

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

function isoToDatetimeLocal(iso) {
  return nowForDatetimeLocal(new Date(iso));
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

function normalizeStoreName(value) {
  return String(value || '').trim().toLocaleLowerCase('ja-JP');
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

function resetFormState() {
  selectedFiles = [];
  editingExistingPhotos = [];
  removedPhotoIds = new Set();
  els.mealForm.reset();
  document.querySelector('input[name="placeType"][value="home"]').checked = true;
  updateStoreField();
  setRating(0);
  els.eatenAt.value = nowForDatetimeLocal();
  els.uploadStatus.textContent = '';
  els.photoEditHint.classList.add('hidden');
  renderPreviews();
}

function openUpload() {
  editingEntryId = null;
  resetFormState();
  els.formEyebrow.textContent = 'NEW ENTRY';
  els.formTitle.textContent = '食事を記録';
  els.saveMeal.textContent = 'クラウドに保存';
  els.uploadDialog.showModal();
}

function openEdit(id) {
  const entry = entriesCache.find(e => e.id === id);
  if (!entry) return;

  editingEntryId = id;
  selectedFiles = [];
  editingExistingPhotos = (entry.photos || []).map(photo => ({ ...photo }));
  removedPhotoIds = new Set();
  els.mealForm.reset();

  els.mealTitle.value = entry.title || '';
  els.mealNote.value = entry.note || '';
  els.eatenAt.value = isoToDatetimeLocal(entry.eaten_at);

  const placeRadio = document.querySelector(`input[name="placeType"][value="${entry.place_type || 'home'}"]`);
  if (placeRadio) placeRadio.checked = true;
  updateStoreField();
  if ((entry.place_type || 'home') !== 'home') els.storeName.value = entry.store_name || '';
  setRating(entry.rating || 0);

  els.formEyebrow.textContent = 'EDIT ENTRY';
  els.formTitle.textContent = '記録を編集';
  els.saveMeal.textContent = '変更を保存';
  els.uploadStatus.textContent = '';
  els.photoEditHint.classList.remove('hidden');
  renderPreviews();

  if (els.detailDialog.open) els.detailDialog.close();
  if (els.storeHistoryDialog.open) els.storeHistoryDialog.close();
  els.uploadDialog.showModal();
}

[els.openUploadTop, els.openUploadHero, els.openUploadEmpty, els.openUploadNav].forEach(btn => btn?.addEventListener('click', openUpload));
els.closeUpload.addEventListener('click', () => els.uploadDialog.close());
els.cameraButton.addEventListener('click', () => els.cameraInput.click());
els.libraryButton.addEventListener('click', () => els.libraryInput.click());
els.cameraInput.addEventListener('change', () => addFiles([...els.cameraInput.files]));
els.libraryInput.addEventListener('change', () => addFiles([...els.libraryInput.files]));
els.clearPhotos.addEventListener('click', () => {
  selectedFiles = [];
  editingExistingPhotos.forEach(photo => removedPhotoIds.add(photo.id));
  renderPreviews();
});
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
  const remainingExisting = editingExistingPhotos.filter(photo => !removedPhotoIds.has(photo.id));
  const total = remainingExisting.length + selectedFiles.length;
  els.previewArea.classList.toggle('hidden', total === 0);
  els.previewGrid.innerHTML = '';

  remainingExisting.forEach((photo, index) => {
    const item = document.createElement('div');
    item.className = 'preview-item existing-photo';
    item.innerHTML = `<img src="${photo.url}" alt="登録済み写真 ${index + 1}"><span class="photo-state-label">登録済み</span><button type="button" aria-label="この写真を削除">×</button>`;
    item.querySelector('button').addEventListener('click', () => {
      removedPhotoIds.add(photo.id);
      renderPreviews();
    });
    els.previewGrid.appendChild(item);
  });

  selectedFiles.forEach((file, index) => {
    const url = URL.createObjectURL(file);
    const item = document.createElement('div');
    item.className = 'preview-item new-photo';
    item.innerHTML = `<img src="${url}" alt="追加する写真 ${index + 1}"><span class="photo-state-label new">追加</span><button type="button" aria-label="この写真を外す">×</button>`;
    item.querySelector('img').addEventListener('load', () => URL.revokeObjectURL(url), { once:true });
    item.querySelector('button').addEventListener('click', () => {
      selectedFiles.splice(index, 1);
      renderPreviews();
    });
    els.previewGrid.appendChild(item);
  });
}

function formValues() {
  const placeType = getPlaceType();
  return {
    title: els.mealTitle.value.trim(),
    note: els.mealNote.value.trim(),
    placeType,
    storeName: placeType === 'home' ? '' : els.storeName.value.trim(),
    rating: els.ratingInput.value ? Number(els.ratingInput.value) : null,
    eatenAt: new Date(els.eatenAt.value).toISOString()
  };
}

async function uploadNewPhotos(mealId) {
  const uploadedPaths = [];

  try {
    for (let i = 0; i < selectedFiles.length; i++) {
      const file = selectedFiles[i];
      els.uploadStatus.textContent = `写真をアップロード中 ${i + 1} / ${selectedFiles.length}`;
      const path = `${currentUser.id}/${mealId}/${uuid()}.${fileExt(file.name)}`;

      const { error: uploadError } = await supabase.storage.from('meal-photos').upload(path, file, {
        cacheControl:'3600',
        upsert:false,
        contentType:file.type || 'image/jpeg'
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
    return uploadedPaths;
  } catch (error) {
    if (uploadedPaths.length) {
      await supabase.from('meal_photos').delete().in('storage_path', uploadedPaths);
      await supabase.storage.from('meal-photos').remove(uploadedPaths);
    }
    throw error;
  }
}

async function createEntry(values) {
  const mealId = uuid();
  const uploadedPaths = [];

  try {
    const { error: entryError } = await supabase.from('meal_entries').insert({
      id: mealId,
      user_id: currentUser.id,
      title: values.title,
      note: values.note,
      eaten_at: values.eatenAt,
      place_type: values.placeType,
      store_name: values.storeName,
      rating: values.rating
    });
    if (entryError) throw entryError;

    const newPaths = await uploadNewPhotos(mealId);
    uploadedPaths.push(...newPaths);
  } catch (error) {
    if (uploadedPaths.length) await supabase.storage.from('meal-photos').remove(uploadedPaths);
    await supabase.from('meal_entries').delete().eq('id', mealId);
    throw error;
  }
}

async function editEntry(values) {
  const entry = entriesCache.find(e => e.id === editingEntryId);
  if (!entry) throw new Error('編集対象の記録が見つかりません');

  let newPaths = [];
  try {
    newPaths = await uploadNewPhotos(entry.id);

    els.uploadStatus.textContent = '記録を更新中…';
    const { error: updateError } = await supabase
      .from('meal_entries')
      .update({
        title: values.title,
        note: values.note,
        eaten_at: values.eatenAt,
        place_type: values.placeType,
        store_name: values.storeName,
        rating: values.rating
      })
      .eq('id', entry.id);

    if (updateError) throw updateError;
  } catch (error) {
    if (newPaths.length) {
      await supabase.from('meal_photos').delete().in('storage_path', newPaths);
      await supabase.storage.from('meal-photos').remove(newPaths);
    }
    throw error;
  }

  const removedPhotos = editingExistingPhotos.filter(photo => removedPhotoIds.has(photo.id));
  if (removedPhotos.length) {
    els.uploadStatus.textContent = '削除した写真を反映中…';
    const removedIds = removedPhotos.map(photo => photo.id);
    const removedPaths = removedPhotos.map(photo => photo.storage_path).filter(Boolean);

    const { error: photoDbError } = await supabase.from('meal_photos').delete().in('id', removedIds);
    if (photoDbError) throw photoDbError;

    if (removedPaths.length) {
      const { error: storageError } = await supabase.storage.from('meal-photos').remove(removedPaths);
      if (storageError) {
        console.warn('古い写真ファイルの削除に失敗しました', storageError);
      }
    }
  }
}

els.mealForm.addEventListener('submit', async e => {
  e.preventDefault();
  if (!currentUser) return;

  const remainingExistingCount = editingExistingPhotos.filter(photo => !removedPhotoIds.has(photo.id)).length;
  if (remainingExistingCount + selectedFiles.length === 0) {
    toast('写真を1枚以上残してください');
    return;
  }

  const values = formValues();
  els.saveMeal.disabled = true;
  els.uploadStatus.textContent = editingEntryId ? '変更を保存中…' : 'クラウドへ保存中…';

  try {
    if (editingEntryId) {
      await editEntry(values);
      els.uploadDialog.close();
      toast('記録を更新しました');
    } else {
      await createEntry(values);
      els.uploadDialog.close();
      toast('食事をクラウドに保存しました');
    }

    selectedFiles = [];
    editingExistingPhotos = [];
    removedPhotoIds = new Set();
    editingEntryId = null;
    await loadEntries();
  } catch (error) {
    console.error(error);
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

    card.innerHTML = `
      <div class="meal-cover" data-open="${entry.id}">
        ${cover ? `<img src="${cover}" alt="${escapeHtml(entry.title)}" loading="lazy">` : ''}
        <span class="photo-count">${entry.photos.length}枚</span>
      </div>
      <div class="meal-body">
        <div class="meal-meta"><span>${escapeHtml(formatDate(entry.eaten_at))}</span></div>
        <h3>${escapeHtml(entry.title)}</h3>
        <div class="meal-tags">
          <span class="meal-tag place">${escapeHtml(placeLabel(entry.place_type))}</span>
          ${entry.store_name ? `<button class="meal-tag store store-history-button" type="button">${escapeHtml(entry.store_name)}</button>` : ''}
          ${entry.rating ? `<span class="meal-tag rating">★ ${entry.rating}</span>` : ''}
        </div>
        <div class="meal-note">${escapeHtml(entry.note || 'メモはありません')}</div>
        <div class="meal-actions">
          <button class="view-entry" type="button" data-open="${entry.id}">見る</button>
          <div class="meal-action-right">
            <button class="edit-entry" type="button">編集</button>
            <button class="delete-entry" type="button" data-delete="${entry.id}">削除</button>
          </div>
        </div>
      </div>`;

    card.querySelectorAll('[data-open]').forEach(btn => btn.addEventListener('click', () => openDetail(entry.id)));
    card.querySelector('.edit-entry').addEventListener('click', () => openEdit(entry.id));
    card.querySelector('[data-delete]').addEventListener('click', () => deleteEntry(entry.id));

    const storeButton = card.querySelector('.store-history-button');
    if (storeButton) {
      storeButton.addEventListener('click', e => {
        e.stopPropagation();
        openStoreHistory(entry.store_name);
      });
    }

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
      ${entry.store_name ? `
        <button class="detail-store store-detail-button" type="button">
          <span><strong>店舗</strong>${escapeHtml(entry.store_name)}</span>
          <span class="store-detail-arrow">履歴を見る ›</span>
        </button>` : ''}
      <div class="detail-note">${escapeHtml(entry.note || 'メモはありません')}</div>
      <div class="detail-actions-v004">
        <button class="detail-edit" type="button">この記録を編集</button>
        <button class="detail-delete" type="button">この記録を削除</button>
      </div>
    </div>`;

  const storeButton = els.detailContent.querySelector('.store-detail-button');
  if (storeButton) {
    storeButton.addEventListener('click', () => {
      els.detailDialog.close();
      openStoreHistory(entry.store_name);
    });
  }

  els.detailContent.querySelector('.detail-edit').addEventListener('click', () => openEdit(id));
  els.detailContent.querySelector('.detail-delete').addEventListener('click', async () => {
    els.detailDialog.close();
    await deleteEntry(id);
  });
  els.detailDialog.showModal();
}

els.closeDetail.addEventListener('click', () => els.detailDialog.close());

function openStoreHistory(storeName) {
  const normalized = normalizeStoreName(storeName);
  const rows = entriesCache
    .filter(entry => entry.store_name && normalizeStoreName(entry.store_name) === normalized)
    .sort((a, b) => new Date(b.eaten_at) - new Date(a.eaten_at));

  if (!rows.length) return;

  const rated = rows.filter(entry => entry.rating);
  const avg = rated.length ? (rated.reduce((sum, entry) => sum + Number(entry.rating), 0) / rated.length).toFixed(1) : null;

  const listHtml = rows.map(entry => {
    const cover = entry.photos?.[0]?.url || '';
    return `
      <button class="store-history-entry" type="button" data-entry-id="${entry.id}">
        <span class="store-history-thumb">${cover ? `<img src="${cover}" alt="">` : '<span>写真なし</span>'}</span>
        <span class="store-history-entry-main">
          <strong>${escapeHtml(entry.title)}</strong>
          <small>${escapeHtml(formatDate(entry.eaten_at))}</small>
          <span class="store-history-entry-meta">${entry.rating ? `★ ${entry.rating}` : '未評価'}${entry.note ? ` ・ ${escapeHtml(entry.note.slice(0, 45))}` : ''}</span>
        </span>
      </button>`;
  }).join('');

  els.storeHistoryContent.innerHTML = `
    <div class="store-history-header">
      <p class="eyebrow">STORE HISTORY</p>
      <h2>${escapeHtml(storeName)}</h2>
      <div class="store-stats">
        <div><strong>${rows.length}</strong><span>訪問記録</span></div>
        <div><strong>${avg ? `★ ${avg}` : '－'}</strong><span>平均評価</span></div>
        <div><strong>${rated.length}</strong><span>評価済み</span></div>
      </div>
    </div>
    <div class="store-history-list">${listHtml}</div>`;

  els.storeHistoryContent.querySelectorAll('.store-history-entry').forEach(button => {
    button.addEventListener('click', () => {
      const id = button.dataset.entryId;
      els.storeHistoryDialog.close();
      openDetail(id);
    });
  });

  els.storeHistoryDialog.showModal();
}

els.closeStoreHistory.addEventListener('click', () => els.storeHistoryDialog.close());

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
import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm';

const DEFAULT_CONFIG = {
  SUPABASE_URL: 'https://icgwnxppibsbiciuyvjg.supabase.co',
  SUPABASE_KEY: 'sb_publishable_gzC7_Vxo4J0YJ-g-Psw0tw_gY8NF77M'
};
const cfg = { ...DEFAULT_CONFIG, ...(window.MEALLOG_CONFIG || {}) };
const isConfigured = Boolean(cfg.SUPABASE_URL && cfg.SUPABASE_KEY);
const supabase = createClient(cfg.SUPABASE_URL, cfg.SUPABASE_KEY);

const $ = (id) => document.getElementById(id);
const els = {
  setupView: $('setupView'), authView: $('authView'), appView: $('appView'),
  authForm: $('authForm'), emailInput: $('emailInput'), passwordInput: $('passwordInput'),
  authTitle: $('authTitle'), authLead: $('authLead'), authSubmit: $('authSubmit'), authMessage: $('authMessage'),
  switchAuthMode: $('switchAuthMode'), togglePassword: $('togglePassword'), googleLoginButton: $('googleLoginButton'),
  profileButton: $('profileButton'), profileAvatar: $('profileAvatar'), profileMenu: $('profileMenu'), profileEmail: $('profileEmail'), avatarText: $('avatarText'), logoutButton: $('logoutButton'),
  openUploadTop: $('openUploadTop'), openUploadHero: $('openUploadHero'), openUploadEmpty: $('openUploadEmpty'), openUploadBottom: $('openUploadBottom'), openUploadNav: $('openUploadNav'),
  accountNav: $('accountNav'), uploadDialog: $('uploadDialog'), closeUpload: $('closeUpload'),
  formEyebrow: $('formEyebrow'), formTitle: $('formTitle'),
  mealForm: $('mealForm'), cameraButton: $('cameraButton'), libraryButton: $('libraryButton'), cameraInput: $('cameraInput'), libraryInput: $('libraryInput'),
  previewArea: $('previewArea'), previewGrid: $('previewGrid'), clearPhotos: $('clearPhotos'), photoEditHint: $('photoEditHint'),
  mealTitle: $('mealTitle'), mealNote: $('mealNote'), eatenAt: $('eatenAt'), saveMeal: $('saveMeal'), uploadStatus: $('uploadStatus'),
  storeNameField: $('storeNameField'), storeName: $('storeName'), priceInput: $('priceInput'), ratingStars: $('ratingStars'), ratingInput: $('ratingInput'), clearRating: $('clearRating'),
  shareGroupSelect: $('shareGroupSelect'),
  timeline: $('timeline'), loadingState: $('loadingState'), emptyState: $('emptyState'), searchInput: $('searchInput'), refreshButton: $('refreshButton'),
  detailDialog: $('detailDialog'), detailContent: $('detailContent'), closeDetail: $('closeDetail'),
  storeHistoryDialog: $('storeHistoryDialog'), storeHistoryContent: $('storeHistoryContent'), closeStoreHistory: $('closeStoreHistory'),
  shareButtonTop: $('shareButtonTop'), shareNav: $('shareNav'), shareDialog: $('shareDialog'), closeShare: $('closeShare'),
  shareGroupsList: $('shareGroupsList'), createGroupForm: $('createGroupForm'), newGroupName: $('newGroupName'),
  joinGroupForm: $('joinGroupForm'), inviteCodeInput: $('inviteCodeInput'), shareMessage: $('shareMessage'),
  summaryCount: $('summaryCount'), summaryCountSub: $('summaryCountSub'),
  summarySpend: $('summarySpend'), summarySpendSub: $('summarySpendSub'),
  summaryTopStore: $('summaryTopStore'), summaryTopStoreSub: $('summaryTopStoreSub'),
  heroSearchInput: $('heroSearchInput'), heroRefreshButton: $('heroRefreshButton'), clearPlaceFilterButton: $('clearPlaceFilterButton'), analysisButton: $('analysisButton'), analysisDialog: $('analysisDialog'), closeAnalysis: $('closeAnalysis'), analysisContent: $('analysisContent'),
  toast: $('toast')
};

let authMode = 'login';
let currentUser = null;
let selectedFiles = [];
let entriesCache = [];
let shareGroups = [];
let shareMemberCounts = new Map();
let toastTimer = null;
let supportsPriceColumn = true;
let priceSchemaHintShown = false;
let activePlaceFilter = 'all';
let analysisPeriod = 'all';

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

function toggleProfileMenu(force) {
  const willOpen = typeof force === 'boolean' ? force : els.profileMenu.classList.contains('hidden');
  els.profileMenu.classList.toggle('hidden', !willOpen);
  els.profileButton.setAttribute('aria-expanded', willOpen ? 'true' : 'false');
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

function formatCardDate(iso) {
  return new Intl.DateTimeFormat('ja-JP', { month:'numeric', day:'numeric' }).format(new Date(iso)).replace('/', '月') + '日';
}

function formatYen(value) {
  if (value === null || value === undefined || value === '' || Number.isNaN(Number(value))) return '－';
  return `¥${new Intl.NumberFormat('ja-JP').format(Number(value))}`;
}

function monthKey(dateLike) {
  const date = new Date(dateLike);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
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

function groupName(groupId) {
  return shareGroups.find(group => group.id === groupId)?.name || '共有';
}

function canEditEntry(entry) {
  return Boolean(currentUser && entry?.user_id === currentUser.id);
}

function renderShareGroupSelect(selectedId = '') {
  if (!els.shareGroupSelect) return;
  els.shareGroupSelect.innerHTML = '<option value="">自分だけ</option>' +
    shareGroups.map(group => `<option value="${group.id}">${escapeHtml(group.name)}</option>`).join('');
  els.shareGroupSelect.value = selectedId || '';
}

async function loadShareGroups() {
  shareGroups = [];
  shareMemberCounts = new Map();
  if (!currentUser) return;

  const { data: groups, error: groupError } = await supabase
    .from('share_groups')
    .select('id,name,invite_code,owner_id,created_at')
    .order('created_at', { ascending:true });
  if (groupError) throw groupError;

  const { data: members, error: memberError } = await supabase
    .from('share_group_members')
    .select('group_id,user_id,role');
  if (memberError) throw memberError;

  shareGroups = groups || [];
  (members || []).forEach(member => {
    shareMemberCounts.set(member.group_id, (shareMemberCounts.get(member.group_id) || 0) + 1);
  });
  renderShareGroupSelect();
}

async function bootstrap() {
  if (!isConfigured) {
    show(els.setupView);
    return; // fallback only; normally not reached because app.js has built-in config
  }

  const { data: { session } } = await supabase.auth.getSession();
  await applySession(session);
  supabase.auth.onAuthStateChange(async (_event, session) => applySession(session));
}

function resolveGoogleAvatar(user) {
  if (!user) return '';
  const meta = user.user_metadata || {};
  const direct = meta.avatar_url || meta.picture || meta.photo_url || '';
  if (direct) return direct;
  const googleIdentity = (user.identities || []).find(identity => identity?.provider === 'google');
  const identityData = googleIdentity?.identity_data || {};
  return identityData.avatar_url || identityData.picture || '';
}

function normalizeAvatarUrl(url) {
  if (!url) return '';
  try {
    const parsed = new URL(url);
    if (parsed.hostname.includes('googleusercontent.com')) {
      parsed.searchParams.set('sz', '128');
      return parsed.toString();
    }
  } catch (_) {}
  return url;
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
  if (els.profileAvatar) {
    const avatarUrl = normalizeAvatarUrl(resolveGoogleAvatar(currentUser));
    els.profileAvatar.src = avatarUrl || './icons/icon-192.png';
    els.profileAvatar.dataset.providerAvatar = avatarUrl ? 'google' : 'fallback';
    els.profileAvatar.alt = displayName ? `${displayName}のプロフィール画像` : 'アカウント';
    els.profileAvatar.onerror = () => {
      els.profileAvatar.onerror = null;
      els.profileAvatar.dataset.providerAvatar = 'fallback';
      els.profileAvatar.src = './icons/icon-192.png';
    };
  }
  try {
    await loadShareGroups();
  } catch (error) {
    console.error('共有グループ読み込みエラー', error);
    toast('共有グループの読み込みに失敗しました');
  }
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

els.profileButton?.addEventListener('click', e => {
  e.stopPropagation();
  toggleProfileMenu();
});
els.accountNav?.addEventListener('click', () => toggleProfileMenu());
document.addEventListener('click', e => {
  if (!els.profileMenu.classList.contains('hidden') && !els.profileMenu.contains(e.target) && !els.profileButton.contains(e.target)) {
    toggleProfileMenu(false);
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
  renderShareGroupSelect('');
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
  els.saveMeal.textContent = '保存する';
  els.uploadDialog.showModal();
}

function openEdit(id) {
  const entry = entriesCache.find(e => e.id === id);
  if (!entry) return;
  if (!canEditEntry(entry)) {
    toast('共有メンバーの記録は編集できません');
    return;
  }

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
  els.priceInput.value = entry.price_yen ?? '';
  setRating(entry.rating || 0);
  renderShareGroupSelect(entry.share_group_id || '');

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

[els.openUploadTop, els.openUploadHero, els.openUploadEmpty, els.openUploadBottom, els.openUploadNav].forEach(btn => btn?.addEventListener('click', openUpload));
document.querySelectorAll('[data-place-filter]').forEach(btn => btn.addEventListener('click', () => {
  activePlaceFilter = btn.dataset.placeFilter || 'all';
  document.querySelectorAll('[data-place-filter]').forEach(chip => chip.classList.toggle('active', chip === btn));
  if (els.clearPlaceFilterButton) els.clearPlaceFilterButton.classList.remove('active');
  renderEntries();
}));

els.clearPlaceFilterButton?.addEventListener('click', () => {
  activePlaceFilter = 'all';
  document.querySelectorAll('[data-place-filter]').forEach(chip => chip.classList.remove('active'));
  els.clearPlaceFilterButton.classList.add('active');
  renderEntries();
});
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
  const rawPrice = els.priceInput.value.trim();
  return {
    title: els.mealTitle.value.trim(),
    note: els.mealNote.value.trim(),
    placeType,
    storeName: placeType === 'home' ? '' : els.storeName.value.trim(),
    priceYen: rawPrice === '' ? null : Math.max(0, Number(rawPrice)),
    rating: els.ratingInput.value ? Number(els.ratingInput.value) : null,
    shareGroupId: els.shareGroupSelect.value || null,
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
      rating: values.rating,
      ...(supportsPriceColumn ? { price_yen: values.priceYen } : {}),
      share_group_id: values.shareGroupId
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
        rating: values.rating,
        ...(supportsPriceColumn ? { price_yen: values.priceYen } : {}),
        share_group_id: values.shareGroupId
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
    const baseSelect = 'id,user_id,title,note,eaten_at,created_at,place_type,store_name,rating,share_group_id';
    const selectWithPrice = `${baseSelect},price_yen,meal_photos(id,storage_path,original_name)`;
    const selectWithoutPrice = `${baseSelect},meal_photos(id,storage_path,original_name)`;

    let query = supabase.from('meal_entries').select(supportsPriceColumn ? selectWithPrice : selectWithoutPrice).order('eaten_at', { ascending:false });
    let { data, error } = await query;

    if (error && /price_yen/.test(error.message || '')) {
      supportsPriceColumn = false;
      ({ data, error } = await supabase.from('meal_entries').select(selectWithoutPrice).order('eaten_at', { ascending:false }));
      if (!priceSchemaHintShown) {
        toast('価格機能はSQL更新後に有効になります');
        priceSchemaHintShown = true;
      }
    }
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
      price_yen: supportsPriceColumn ? (entry.price_yen ?? null) : null,
      rating: entry.rating ?? null,
      share_group_id: entry.share_group_id || null,
      photos: (entry.meal_photos || []).map(p => ({ ...p, url:signedMap.get(p.storage_path) })).filter(p => p.url)
    }));
    renderDashboardSummary();
    renderEntries();
  } catch (error) {
    console.error(error);
    renderDashboardSummary();
    els.timeline.innerHTML = `<div class="state-card"><p>読み込みに失敗しました。<br>${escapeHtml(error.message || '')}</p></div>`;
  } finally {
    els.loadingState.classList.add('hidden');
  }
}

function renderDashboardSummary() {
  const now = new Date();
  const currentMonth = monthKey(now);
  const monthRows = entriesCache.filter(entry => monthKey(entry.eaten_at) === currentMonth);
  const dineoutRows = monthRows.filter(entry => entry.place_type !== 'home');
  const pricedRows = monthRows.filter(entry => entry.price_yen !== null && entry.price_yen !== undefined && entry.price_yen !== '');
  const totalSpend = pricedRows.reduce((sum, entry) => sum + Number(entry.price_yen || 0), 0);

  const storeCounter = new Map();
  entriesCache.forEach(entry => {
    if (!entry.store_name) return;
    const key = entry.store_name.trim();
    if (!key) return;
    storeCounter.set(key, (storeCounter.get(key) || 0) + 1);
  });
  const topStore = [...storeCounter.entries()].sort((a, b) => b[1] - a[1])[0] || null;

  if (els.summaryCount) {
    els.summaryCount.textContent = `${monthRows.length}件`;
    els.summaryCountSub.textContent = monthRows.length ? `外食・テイクアウト ${dineoutRows.length}件` : 'まずは1件記録';
    els.summarySpend.textContent = supportsPriceColumn ? formatYen(totalSpend) : '－';
    els.summarySpendSub.textContent = supportsPriceColumn ? (pricedRows.length ? `${pricedRows.length}件の価格を集計` : '価格入力で自動集計') : 'SQL更新で価格集計が有効になります';
    els.summaryTopStore.textContent = topStore ? topStore[0] : '未登録';
    els.summaryTopStoreSub.textContent = topStore ? `${topStore[1]}回 記録` : '店舗を登録しよう';
  }
}


function renderEntries() {
  const q = (els.searchInput.value || '').trim().toLowerCase();
  const rows = entriesCache.filter(entry => {
    const haystack = `${entry.title} ${entry.note || ''} ${entry.store_name || ''} ${placeLabel(entry.place_type)} ${entry.share_group_id ? groupName(entry.share_group_id) : ''}`.toLowerCase();
    const matchesSearch = !q || haystack.includes(q);
    const matchesPlace = activePlaceFilter === 'all' || (entry.place_type || 'home') === activePlaceFilter;
    return matchesSearch && matchesPlace;
  });

  els.emptyState.classList.toggle('hidden', entriesCache.length !== 0 || q !== '' || activePlaceFilter !== 'all');
  els.timeline.innerHTML = '';

  if (!rows.length && (q || activePlaceFilter !== 'all')) {
    const filterLabel = activePlaceFilter !== 'all' ? ` / ${placeLabel(activePlaceFilter)}` : '';
    els.timeline.innerHTML = `<div class="state-card"><p>「${escapeHtml(q || '条件')}」${filterLabel} に一致する記録はありません。</p></div>`;
    return;
  }

  rows.forEach(entry => {
    const card = document.createElement('article');
    const cover = entry.photos?.[0]?.url || '';
    card.className = `meal-card${cover ? '' : ' no-photo'}${entry.share_group_id ? ' is-shared' : ''}`;

    const storeTag = entry.store_name ? `#${escapeHtml(entry.store_name.length > 10 ? entry.store_name.slice(0, 10) + '…' : entry.store_name)}` : '#MealLog';
    card.innerHTML = `
      <div class="meal-cover" data-open="${entry.id}">
        ${cover ? `<img src="${cover}" alt="${escapeHtml(entry.title)}" loading="lazy">` : `<div class="meal-cover-placeholder"><span>🍡</span><small>NO PHOTO</small></div>`}
        <span class="photo-count">${(entry.photos || []).length}枚</span>
      </div>
      <div class="meal-body">
        <button class="meal-kebab" type="button" data-open="${entry.id}" aria-label="詳細を開く">⋮</button>
        <h3>${escapeHtml(entry.title)}</h3>
        <div class="meal-location-line">
          ${entry.store_name ? `<button class="store-inline store-history-button" type="button">📍 ${escapeHtml(entry.store_name)}</button>` : `<span class="place-inline">📍 ${escapeHtml(placeLabel(entry.place_type))}</span>`}
        </div>
        <div class="meal-stats-row">
          <strong class="meal-price-main">${entry.price_yen !== null && entry.price_yen !== undefined && entry.price_yen !== '' ? escapeHtml(formatYen(entry.price_yen)) : '価格未登録'}</strong>
          <span class="meal-rating-main">★ ${entry.rating ? escapeHtml(entry.rating) : '－'}</span>
          <time class="meal-card-date">${escapeHtml(formatCardDate(entry.eaten_at))}</time>
        </div>
        <div class="meal-tags">
          <span class="meal-tag place">#${escapeHtml(placeLabel(entry.place_type))}</span>
          <span class="meal-tag storetag">${storeTag}</span>
          ${entry.share_group_id ? `<span class="meal-tag shared">#${escapeHtml(groupName(entry.share_group_id))}</span>` : ''}
        </div>
        ${entry.note ? `<div class="meal-note">${escapeHtml(entry.note)}</div>` : ''}
        <div class="meal-actions">
          <button class="view-entry" type="button" data-open="${entry.id}">詳細</button>
          ${canEditEntry(entry) ? `<div class="meal-action-right">
            <button class="edit-entry" type="button">編集</button>
            <button class="delete-entry" type="button" data-delete="${entry.id}">削除</button>
          </div>` : '<span class="shared-readonly">閲覧のみ</span>'}
        </div>
      </div>`;

    card.querySelectorAll('[data-open]').forEach(btn => btn.addEventListener('click', () => openDetail(entry.id)));
    card.querySelector('.edit-entry')?.addEventListener('click', () => openEdit(entry.id));
    card.querySelector('[data-delete]')?.addEventListener('click', () => deleteEntry(entry.id));

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

  const images = entry.photos.length
    ? entry.photos.slice(0, 5).map(p => `<img src="${p.url}" alt="${escapeHtml(entry.title)}">`).join('')
    : '<div class="detail-gallery-empty"><span>🍧</span><small>写真はまだありません</small></div>';
  const tags = [
    `<span class="meal-tag place">${escapeHtml(placeLabel(entry.place_type))}</span>`,
    entry.rating ? `<span class="meal-tag rating">★ ${entry.rating}</span>` : '',
    entry.share_group_id ? `<span class="meal-tag shared">共有・${escapeHtml(groupName(entry.share_group_id))}</span>` : '',
    entry.share_group_id && !canEditEntry(entry) ? `<span class="meal-tag shared-by">メンバーの記録</span>` : ''
  ].join('');

  els.detailContent.innerHTML = `
    <div class="detail-gallery">${images}</div>
    <div class="detail-info">
      <p class="eyebrow">MEAL MEMORY</p>
      <h2>${escapeHtml(entry.title)}</h2>
      <div class="detail-date">${escapeHtml(formatDate(entry.eaten_at))}</div>
      <div class="detail-tags">${tags}</div>
      <div class="detail-facts">
        ${entry.store_name ? `
          <button class="detail-store store-detail-button" type="button">
            <span><strong>店舗</strong>${escapeHtml(entry.store_name)}</span>
            <span class="store-detail-arrow">履歴を見る ›</span>
          </button>` : ''}
        ${entry.price_yen !== null && entry.price_yen !== undefined && entry.price_yen !== '' ? `<div class="detail-fact-box"><strong>価格</strong><span>${escapeHtml(formatYen(entry.price_yen))}</span></div>` : ''}
      </div>
      <div class="detail-note">${escapeHtml(entry.note || 'メモはありません')}</div>
      ${canEditEntry(entry) ? `<div class="detail-actions-v004">
        <button class="detail-edit" type="button">この記録を編集</button>
        <button class="detail-delete" type="button">この記録を削除</button>
      </div>` : '<div class="shared-detail-note">この記録は共有メンバーの記録なので閲覧のみです。</div>'}
    </div>`;

  const storeButton = els.detailContent.querySelector('.store-detail-button');
  if (storeButton) {
    storeButton.addEventListener('click', () => {
      els.detailDialog.close();
      openStoreHistory(entry.store_name);
    });
  }

  els.detailContent.querySelector('.detail-edit')?.addEventListener('click', () => openEdit(id));
  els.detailContent.querySelector('.detail-delete')?.addEventListener('click', async () => {
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
  const priced = rows.filter(entry => entry.price_yen !== null && entry.price_yen !== undefined && entry.price_yen !== '');
  const totalSpend = priced.reduce((sum, entry) => sum + Number(entry.price_yen || 0), 0);
  const avgSpend = priced.length ? Math.round(totalSpend / priced.length) : null;

  const listHtml = rows.map(entry => {
    const cover = entry.photos?.[0]?.url || '';
    return `
      <button class="store-history-entry" type="button" data-entry-id="${entry.id}">
        <span class="store-history-thumb">${cover ? `<img src="${cover}" alt="">` : '<span>写真なし</span>'}</span>
        <span class="store-history-entry-main">
          <strong>${escapeHtml(entry.title)}</strong>
          <small>${escapeHtml(formatDate(entry.eaten_at))}</small>
          <span class="store-history-entry-meta">${entry.rating ? `★ ${entry.rating}` : '未評価'}${entry.price_yen !== null && entry.price_yen !== undefined && entry.price_yen !== '' ? ` ・ ${escapeHtml(formatYen(entry.price_yen))}` : ''}${entry.note ? ` ・ ${escapeHtml(entry.note.slice(0, 45))}` : ''}</span>
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
        <div><strong>${priced.length ? formatYen(totalSpend) : '－'}</strong><span>合計金額</span></div>
        <div><strong>${avgSpend !== null ? formatYen(avgSpend) : '－'}</strong><span>平均金額</span></div>
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

function renderShareGroups() {
  if (!shareGroups.length) {
    els.shareGroupsList.innerHTML = `
      <div class="share-empty">
        <strong>まだ共有グループがありません</strong>
        <p>まずグループを作るか、家族からもらった招待コードで参加してください。</p>
      </div>`;
    return;
  }

  els.shareGroupsList.innerHTML = shareGroups.map(group => {
    const isOwner = group.owner_id === currentUser.id;
    const count = shareMemberCounts.get(group.id) || 1;
    return `
      <section class="share-group-card" data-group-id="${group.id}">
        <div class="share-group-main">
          <div>
            <span class="share-role">${isOwner ? '管理者' : 'メンバー'}</span>
            <h3>${escapeHtml(group.name)}</h3>
            <p>${count}人で共有中</p>
          </div>
          <span class="share-group-icon">◇</span>
        </div>
        ${isOwner ? `
          <div class="invite-code-box">
            <span>招待コード</span>
            <strong>${escapeHtml(group.invite_code)}</strong>
            <button type="button" data-copy-code="${escapeHtml(group.invite_code)}">コピー</button>
          </div>
          <button class="share-danger-button" type="button" data-delete-group="${group.id}">グループを削除</button>
        ` : `
          <button class="share-leave-button" type="button" data-leave-group="${group.id}">グループから退出</button>
        `}
      </section>`;
  }).join('');

  els.shareGroupsList.querySelectorAll('[data-copy-code]').forEach(button => {
    button.addEventListener('click', async () => {
      const code = button.dataset.copyCode || '';
      try {
        await navigator.clipboard.writeText(code);
        toast('招待コードをコピーしました');
      } catch {
        window.prompt('この招待コードをコピーしてください', code);
      }
    });
  });

  els.shareGroupsList.querySelectorAll('[data-delete-group]').forEach(button => {
    button.addEventListener('click', async () => {
      const group = shareGroups.find(item => item.id === button.dataset.deleteGroup);
      if (!group) return;
      if (!confirm(`共有グループ「${group.name}」を削除しますか？\n共有していた食事記録は各登録者の「自分だけ」に戻ります。`)) return;

      els.shareMessage.textContent = 'グループを削除中…';
      const { error } = await supabase.from('share_groups').delete().eq('id', group.id);
      if (error) {
        els.shareMessage.textContent = `削除できませんでした：${error.message}`;
        return;
      }

      await loadShareGroups();
      await loadEntries();
      renderShareGroups();
      els.shareMessage.textContent = 'グループを削除しました。';
    });
  });

  els.shareGroupsList.querySelectorAll('[data-leave-group]').forEach(button => {
    button.addEventListener('click', async () => {
      const group = shareGroups.find(item => item.id === button.dataset.leaveGroup);
      if (!group) return;
      if (!confirm(`共有グループ「${group.name}」から退出しますか？`)) return;

      els.shareMessage.textContent = 'グループから退出中…';
      const { error } = await supabase.rpc('leave_share_group', { p_group_id: group.id });
      if (error) {
        els.shareMessage.textContent = `退出できませんでした：${error.message}`;
        return;
      }

      await loadShareGroups();
      await loadEntries();
      renderShareGroups();
      els.shareMessage.textContent = 'グループから退出しました。';
    });
  });
}

async function openShareDialog() {
  els.shareMessage.textContent = '';
  try {
    await loadShareGroups();
    renderShareGroups();
  } catch (error) {
    console.error(error);
    els.shareMessage.textContent = `共有情報を読み込めませんでした：${error.message || ''}`;
  }
  els.shareDialog.showModal();
}

els.shareButtonTop?.addEventListener('click', openShareDialog);
els.shareNav?.addEventListener('click', openShareDialog);
els.closeShare?.addEventListener('click', () => els.shareDialog.close());

els.createGroupForm.addEventListener('submit', async event => {
  event.preventDefault();
  const name = els.newGroupName.value.trim();
  if (!name) return;

  els.shareMessage.textContent = 'グループを作成中…';
  const { error } = await supabase.from('share_groups').insert({
    owner_id: currentUser.id,
    name
  });

  if (error) {
    els.shareMessage.textContent = `作成できませんでした：${error.message}`;
    return;
  }

  els.newGroupName.value = '';
  await loadShareGroups();
  renderShareGroups();
  els.shareMessage.textContent = '共有グループを作成しました。招待コードを家族に伝えてください。';
});

els.joinGroupForm.addEventListener('submit', async event => {
  event.preventDefault();
  const code = els.inviteCodeInput.value.trim().toUpperCase();
  if (!code) return;

  els.shareMessage.textContent = 'グループに参加中…';
  const { error } = await supabase.rpc('join_share_group', { p_invite_code: code });

  if (error) {
    els.shareMessage.textContent = `参加できませんでした：招待コードを確認してください。`;
    console.error(error);
    return;
  }

  els.inviteCodeInput.value = '';
  await loadShareGroups();
  await loadEntries();
  renderShareGroups();
  els.shareMessage.textContent = '共有グループに参加しました。';
});

async function deleteEntry(id) {
  const entry = entriesCache.find(e => e.id === id);
  if (!entry) return;
  if (!canEditEntry(entry)) {
    toast('共有メンバーの記録は削除できません');
    return;
  }
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


function filterAnalysisRows(period) {
  const now = new Date();
  return entriesCache.filter(entry => {
    const date = new Date(entry.eaten_at);
    if (Number.isNaN(date.getTime())) return false;
    if (period === 'month') return date.getFullYear() === now.getFullYear() && date.getMonth() === now.getMonth();
    if (period === 'year') return date.getFullYear() === now.getFullYear();
    return true;
  });
}

function analysisPeriodLabel(period) {
  return ({ month:'今月', year:'今年', all:'全期間' })[period] || '全期間';
}

function renderAnalysis() {
  if (!els.analysisContent) return;
  const rows = filterAnalysisRows(analysisPeriod);
  const priced = rows.filter(entry => entry.price_yen !== null && entry.price_yen !== undefined && entry.price_yen !== '');
  const rated = rows.filter(entry => entry.rating !== null && entry.rating !== undefined && entry.rating !== '');
  const totalSpend = priced.reduce((sum, entry) => sum + Number(entry.price_yen || 0), 0);
  const avgSpend = priced.length ? Math.round(totalSpend / priced.length) : 0;
  const avgRating = rated.length ? (rated.reduce((sum, entry) => sum + Number(entry.rating || 0), 0) / rated.length).toFixed(1) : '－';

  const placeCounts = { home:0, dineout:0, takeout:0 };
  const storeStats = new Map();
  rows.forEach(entry => {
    const type = entry.place_type || 'home';
    if (Object.hasOwn(placeCounts, type)) placeCounts[type] += 1;
    const store = String(entry.store_name || '').trim();
    if (store) {
      const current = storeStats.get(store) || { count:0, spend:0, priced:0, ratingSum:0, rated:0 };
      current.count += 1;
      if (entry.price_yen !== null && entry.price_yen !== undefined && entry.price_yen !== '') {
        current.spend += Number(entry.price_yen || 0);
        current.priced += 1;
      }
      if (entry.rating) {
        current.ratingSum += Number(entry.rating);
        current.rated += 1;
      }
      storeStats.set(store, current);
    }
  });

  const storeRanking = [...storeStats.entries()]
    .sort((a,b) => b[1].count - a[1].count || b[1].spend - a[1].spend)
    .slice(0,5);

  const monthStats = new Map();
  rows.forEach(entry => {
    const key = monthKey(entry.eaten_at);
    const item = monthStats.get(key) || { count:0, spend:0 };
    item.count += 1;
    if (entry.price_yen !== null && entry.price_yen !== undefined && entry.price_yen !== '') item.spend += Number(entry.price_yen || 0);
    monthStats.set(key, item);
  });
  const monthSeries = [...monthStats.entries()].sort((a,b) => a[0].localeCompare(b[0])).slice(-6);
  const maxMonthCount = Math.max(1, ...monthSeries.map(([,v]) => v.count));
  const maxMonthSpend = Math.max(1, ...monthSeries.map(([,v]) => v.spend));
  const maxPlace = Math.max(1, ...Object.values(placeCounts));

  const placeRows = [
    ['自宅', placeCounts.home, 'home'],
    ['外食', placeCounts.dineout, 'dineout'],
    ['テイクアウト', placeCounts.takeout, 'takeout']
  ].map(([label,count,type]) => `
    <div class="analysis-bar-row">
      <span>${label}</span>
      <div class="analysis-bar-track"><i class="analysis-bar ${type}" style="width:${Math.round(Number(count)/maxPlace*100)}%"></i></div>
      <b>${count}件</b>
    </div>`).join('');

  const monthRows = monthSeries.length ? monthSeries.map(([key, value]) => {
    const [,m] = key.split('-');
    return `<div class="analysis-month-row">
      <span>${Number(m)}月</span>
      <div class="analysis-month-bars">
        <i class="analysis-count-bar" style="width:${Math.round(value.count/maxMonthCount*100)}%"></i>
        <i class="analysis-spend-bar" style="width:${Math.round(value.spend/maxMonthSpend*100)}%"></i>
      </div>
      <b>${value.count}件 / ${formatYen(value.spend)}</b>
    </div>`;
  }).join('') : '<p class="analysis-empty">月別推移を表示できる記録がまだありません。</p>';

  const storeRows = storeRanking.length ? storeRanking.map(([name, value], index) => `
    <div class="analysis-store-row">
      <span class="analysis-rank">${index + 1}</span>
      <div><strong>${escapeHtml(name)}</strong><small>${value.count}回 ・ 合計 ${formatYen(value.spend)}${value.priced ? ` ・ 平均 ${formatYen(Math.round(value.spend/value.priced))}` : ''}${value.rated ? ` ・ ★${(value.ratingSum/value.rated).toFixed(1)}` : ''}</small></div>
    </div>`).join('') : '<p class="analysis-empty">店舗を登録した記録が増えるとランキングを表示します。</p>';

  els.analysisContent.innerHTML = `
    <div class="analysis-period-caption">${analysisPeriodLabel(analysisPeriod)}の集計</div>
    <div class="analysis-kpi-grid">
      <article><span>記録数</span><strong>${rows.length}件</strong></article>
      <article><span>食費合計</span><strong>${supportsPriceColumn ? formatYen(totalSpend) : '－'}</strong></article>
      <article><span>平均金額</span><strong>${supportsPriceColumn && priced.length ? formatYen(avgSpend) : '－'}</strong></article>
      <article><span>平均評価</span><strong>${avgRating === '－' ? '－' : `★ ${avgRating}`}</strong></article>
    </div>
    <section class="analysis-section">
      <h3>食べた場所</h3>
      ${rows.length ? placeRows : '<p class="analysis-empty">記録が増えると割合を表示します。</p>'}
    </section>
    <section class="analysis-section">
      <div class="analysis-section-head"><h3>月別推移</h3><small><i class="legend count"></i>記録数 <i class="legend spend"></i>食費</small></div>
      ${monthRows}
    </section>
    <section class="analysis-section">
      <h3>よく行く店舗</h3>
      ${storeRows}
    </section>`;
}

function openAnalysisDialog() {
  if (!els.analysisDialog) return;
  document.querySelectorAll('[data-analysis-period]').forEach(btn => btn.classList.toggle('active', btn.dataset.analysisPeriod === analysisPeriod));
  renderAnalysis();
  els.analysisDialog.showModal();
}

els.analysisButton?.addEventListener('click', () => {
  analysisPeriod = 'all';
  openAnalysisDialog();
});
els.closeAnalysis?.addEventListener('click', () => els.analysisDialog.close());
document.querySelectorAll('[data-analysis-period]').forEach(btn => btn.addEventListener('click', () => {
  analysisPeriod = btn.dataset.analysisPeriod || 'all';
  document.querySelectorAll('[data-analysis-period]').forEach(item => item.classList.toggle('active', item === btn));
  renderAnalysis();
}));

els.searchInput.addEventListener('input', () => {
  if (els.heroSearchInput && els.heroSearchInput.value !== els.searchInput.value) els.heroSearchInput.value = els.searchInput.value;
  renderEntries();
});
els.refreshButton.addEventListener('click', () => {
  activePlaceFilter = 'all';
  els.searchInput.value = '';
  if (els.heroSearchInput) els.heroSearchInput.value = '';
  document.querySelectorAll('[data-place-filter]').forEach(chip => chip.classList.remove('active'));
  if (els.clearPlaceFilterButton) els.clearPlaceFilterButton.classList.add('active');
  renderEntries();
});
if (els.heroSearchInput) {
  els.heroSearchInput.addEventListener('input', () => {
    els.searchInput.value = els.heroSearchInput.value;
    renderEntries();
  });
}

if (els.heroRefreshButton) els.heroRefreshButton.addEventListener('click', () => {
  els.searchInput.value = els.heroSearchInput?.value || '';
  renderEntries();
  document.getElementById('recentMealsSection')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
});
if (els.heroSearchInput) els.heroSearchInput.addEventListener('keydown', event => {
  if (event.key !== 'Enter') return;
  event.preventDefault();
  els.heroRefreshButton?.click();
});

document.querySelectorAll('[data-side-action]').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('[data-side-action]').forEach(item => item.classList.toggle('active', item === btn));
    const action = btn.dataset.sideAction;
    if (action === 'home') {
      activePlaceFilter = 'all';
      document.querySelectorAll('[data-place-filter]').forEach(chip => chip.classList.remove('active'));
      els.clearPlaceFilterButton?.classList.add('active');
      els.searchInput.value = '';
      if (els.heroSearchInput) els.heroSearchInput.value = '';
      renderEntries();
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } else if (action === 'meals') {
      document.getElementById('recentMealsSection')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    } else if (action === 'settings') {
      toggleProfileMenu(true);
    } else if (action === 'stores') {
      toast('「よく行く店」は集計カードから確認できます');
      document.getElementById('summaryTopStore')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    } else if (action === 'spend') {
      analysisPeriod = 'month';
      openAnalysisDialog();
    } else if (action === 'stats') {
      analysisPeriod = 'all';
      openAnalysisDialog();
    } else {
      toast('このメニューは準備中です');
    }
  });
});


bootstrap();

if ('serviceWorker' in navigator) {
  window.addEventListener('load', async () => {
    try {
      const registration = await navigator.serviceWorker.register('./sw.js?v=026');
      await registration.update();
    } catch (error) {
      console.error('ServiceWorker registration failed', error);
    }
  });
}

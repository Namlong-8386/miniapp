const tg = window.Telegram && window.Telegram.WebApp;
if (tg) {
  tg.ready(); tg.expand();
  if (typeof tg.disableVerticalSwipes === 'function') {
    try { tg.disableVerticalSwipes(); } catch (e) {}
  }
  try { tg.setHeaderColor('#eef2fb'); } catch (e) {}
  try { tg.setBackgroundColor('#eef2fb'); } catch (e) {}
}

// Xóa triệt để mọi phần tử orbit nếu còn sót do cache
document.querySelectorAll('.orbit').forEach(el => el.remove());

// Chặn tuyệt đối cuộn trang và kéo vuốt trên mobile
window.addEventListener('scroll', () => {
  if (window.scrollY !== 0 || window.scrollX !== 0) {
    window.scrollTo(0, 0);
  }
}, { passive: false });

window.addEventListener('touchmove', function (e) {
  if (!e.target.closest('.modal-sheet')) {
    e.preventDefault();
  }
}, { passive: false });

const $ = (id) => document.getElementById(id);

const messages = [
  'Đang khởi động hệ thống AI',
  'Kết nối neural core',
  'Tải mô hình dự đoán',
  'Đồng bộ dữ liệu thị trường',
  'Hiệu chỉnh thuật toán',
  'Hệ thống sẵn sàng',
];

const greets = [
  'Xin chào! Tôi là Lumina AI',
  'Sẵn sàng dự đoán phiên mới!',
  'AI đã phân tích xong dữ liệu',
  'Chọn LC79 để bắt đầu nào!',
];

/* ───────── Thông tin người dùng Telegram ───────── */

// Đọc user chắc chắn: ưu tiên initDataUnsafe, dự phòng giải mã chuỗi initData
function getTelegramUser() {
  const t = window.Telegram && window.Telegram.WebApp;
  if (!t) return null;
  const u = t.initDataUnsafe && t.initDataUnsafe.user;
  if (u && u.id) return u;
  const raw = typeof t.initData === 'string' ? t.initData : '';
  if (raw) {
    try {
      const s = new URLSearchParams(raw).get('user');
      if (s) {
        const p = JSON.parse(s);
        if (p && p.id) return p;
      }
    } catch (e) {}
  }
  return null;
}

function escapeXml(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

// Avatar dự phòng: chữ cái đầu trên nền gradient (SVG nội tuyến, không cần mạng)
function initialsAvatar(seed) {
  const ch = (String(seed || 'U').trim().charAt(0) || 'U').toUpperCase();
  const svg =
    "<svg xmlns='http://www.w3.org/2000/svg' width='128' height='128' viewBox='0 0 128 128'>" +
    "<defs><linearGradient id='g' x1='0' y1='0' x2='128' y2='128'>" +
    "<stop stop-color='#8b5cf6'/><stop offset='1' stop-color='#22d3ee'/></linearGradient></defs>" +
    "<rect width='128' height='128' fill='url(#g)'/>" +
    "<text x='64' y='64' dy='0.35em' text-anchor='middle' font-size='54' font-weight='700' " +
    "fill='#ffffff' font-family='sans-serif'>" + escapeXml(ch) + "</text></svg>";
  return 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
}

// Gán avatar: photo_url → ảnh đại diện công khai theo username → chữ cái đầu
function applyAvatar(name, handle, photoUrl) {
  const img = $('userAvatar');
  if (!img) return;
  const fallback = initialsAvatar(name || (handle || '').replace('@', ''));
  let settled = false;
  const useFallback = () => {
    if (settled) return;
    settled = true;
    img.onerror = null;
    img.src = fallback;
  };
  img.onerror = useFallback;
  let src = photoUrl || '';
  if (!src && handle && handle.charAt(0) === '@' && handle.length > 1) {
    src = 'https://t.me/i/userpic/320/' + encodeURIComponent(handle.slice(1)) + '.jpg';
  }
  if (!src) {
    useFallback();
    return;
  }
  img.src = src;
  // Một số WebView không bắn onerror cho ảnh hỏng → tự kiểm tra lại
  setTimeout(() => {
    if (!settled && (!img.complete || img.naturalWidth === 0)) useFallback();
  }, 4000);
}

function showNotice(text) {
  document.body.innerHTML =
    '<div style="display:flex;align-items:center;justify-content:center;height:100vh;' +
    'font-family:sans-serif;text-align:center;padding:24px;line-height:1.6;">' + text + '</div>';
}

// Thử lần lượt các đường dẫn API (Vercel không có .php, host PHP cần .php)
async function getJson(paths, timeoutMs) {
  for (let i = 0; i < paths.length; i++) {
    try {
      const ctl = typeof AbortController === 'function' ? new AbortController() : null;
      const timer = ctl ? setTimeout(() => ctl.abort(), timeoutMs || 6000) : null;
      const r = await fetch(paths[i], ctl ? { cache: 'no-store', signal: ctl.signal } : { cache: 'no-store' });
      if (timer) clearTimeout(timer);
      if (!r.ok) continue;
      const ct = (r.headers.get('content-type') || '').toLowerCase();
      if (ct.indexOf('json') === -1) continue; // .php bị phục vụ dạng mã nguồn → bỏ qua
      return await r.json();
    } catch (e) {
      /* thử đường dẫn kế tiếp */
    }
  }
  return null;
}

// Chỉ chặn khi máy chủ trả lời dứt khoát "không phải thành viên".
// Mọi lỗi mạng / API chưa sẵn sàng → cho qua, không phá giao diện.
async function isChannelMember(user) {
  const q = 'user_id=' + encodeURIComponent(user.id) + '&_t=' + Date.now();
  const d = await getJson(['/api/checkmember?' + q, '/api/checkmember.php?' + q], 6000);
  const status = d && d.result && d.result.status;
  if (!status) return true;
  return status !== 'left' && status !== 'kicked';
}

// Lưu profile vào Supabase (không chặn giao diện nếu lỗi)
function saveProfile(user) {
  try {
    if (!window.supabaseClient) return;
    const p = window.supabaseClient.from('users').upsert({
      telegram_id: user.id,
      first_name: user.first_name || null,
      last_name: user.last_name || null,
      username: user.username || null,
      photo_url: user.photo_url || null
    }, { onConflict: 'telegram_id' });
    if (p && typeof p.then === 'function') p.then(function () {}, function () {});
  } catch (e) {}
}

let userLoadAttempts = 0;

async function loadUser() {
  const user = getTelegramUser();
  if (!user) {
    // initData có thể chưa kịp sẵn sàng → thử lại vài lần rồi mới báo
    const t = window.Telegram && window.Telegram.WebApp;
    if (t && userLoadAttempts < 5) {
      userLoadAttempts++;
      setTimeout(loadUser, 700);
      return;
    }
    showNotice('Mini app này chỉ chạy trong Telegram. Vui lòng mở qua bot.');
    return;
  }

  const name = [user.first_name, user.last_name].filter(Boolean).join(' ').trim()
    || user.username || ('ID ' + user.id);
  const handle = user.username ? '@' + user.username : 'ID ' + user.id;

  const nameEl = $('userName');
  if (nameEl) nameEl.textContent = name;
  const handleEl = $('userHandle');
  if (handleEl) handleEl.textContent = handle;
  applyAvatar(name, handle, user.photo_url);

  if (!user.username && !user.photo_url) {
    const card = $('userCard');
    if (card) card.setAttribute('data-photo', 'none');
  }
  saveProfile(user);

  const member = await isChannelMember(user);
  if (!member) {
    showNotice('Vui lòng tham gia kênh https://t.me/trum4gvpn rồi mở lại miniapp.');
  }
}

function runLoader() {
  const fill = $('loaderFill');
  const percent = $('loaderPercent');
  const status = $('loaderStatus');
  let p = 0;
  const total = 100;
  const interval = setInterval(() => {
    p += 2 + Math.random() * 3;
    if (p > total) p = total;
    fill.style.width = p + '%';
    percent.textContent = Math.floor(p) + '%';
    const idx = Math.min(messages.length - 1, Math.floor((p / total) * messages.length));
    status.textContent = messages[idx];
    if (p >= total) {
      clearInterval(interval);
      setTimeout(() => {
        $('loader').classList.add('hide');
        $('app').classList.remove('hidden');
        loadUser();
        const greet = $('robotGreet');
        if (greet) {
          greet.textContent = greets[Math.floor(Math.random() * greets.length)];
          setTimeout(() => greet.classList.add('show'), 300);
          setTimeout(() => greet.classList.remove('show'), 4500);
        }
        if (tg) { try { tg.HapticFeedback.notificationOccurred('success'); } catch (e) {} }
      }, 500);
    }
  }, 60);
}

runLoader();

const gameCard = $('gameCard');
const gameModal = $('gameModal');
const modalBackdrop = $('modalBackdrop');
const modalClose = $('modalClose');
function openModal() { if (gameModal) gameModal.classList.add('open'); }
function closeModal() { if (gameModal) gameModal.classList.remove('open'); }
if (gameCard) gameCard.addEventListener('click', openModal);
if (modalBackdrop) modalBackdrop.addEventListener('click', closeModal);
if (modalClose) modalClose.addEventListener('click', closeModal);
document.querySelectorAll('.game-option').forEach(btn => {
  btn.addEventListener('click', () => {
    if (tg) { try { tg.HapticFeedback.impactOccurred('light'); } catch (e) {} }
    const g = btn.dataset.game === 'taixiu-md5' ? 'taixiumd5' : 'taixiu';
    location.href = 'predict.html?game=' + g;
  });
});

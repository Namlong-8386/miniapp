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

async function loadUser() {
  const t = window.Telegram && window.Telegram.WebApp;
  if (!t || !t.initDataUnsafe || !t.initDataUnsafe.user) {
    document.body.innerHTML = '<div style="display:flex;align-items:center;justify-content:center;height:100vh;font-family:sans-serif;text-align:center;padding:24px;">Mini app này chỉ chạy trong Telegram. Vui lòng mở qua bot.</div>';
    return;
  }
  const name = user.first_name + (user.last_name ? ' ' + user.last_name : '');
  const handle = user.username ? '@' + user.username : '@user';
  const photo = user && user.photo_url ? user.photo_url : '';
  $('userName').textContent = name;
  $('userHandle').textContent = handle;
  if (photo) {
    $('userAvatar').src = photo;
  } else {
    const initial = (name[0] || 'U').toUpperCase();
    const svg = `<svg xmlns='http://www.w3.org/2000/svg' width='96' height='96'><defs><linearGradient id='g' x1='0' y1='0' x2='96' y2='96'><stop stop-color='#8b5cf6'/><stop offset='1' stop-color='#22d3ee'/></linearGradient></defs><rect width='96' height='96' fill='url(#g)'/><text x='50%' y='54%' dominant-baseline='middle' text-anchor='middle' font-size='38' font-weight='700' fill='white' font-family='sans-serif'>${initial}</text></svg>`;
    $('userAvatar').src = 'data:image/svg+xml;utf8,' + encodeURIComponent(svg);
  }
  // Kiểm tra thành viên kênh
  try {
    const r = await fetch('/api/checkmember?user_id=' + user.id);
    const d = await r.json();
    const status = d && d.result && d.result.status;
    if (!['member','administrator','creator'].includes(status)) {
      document.body.innerHTML = '<div style="display:flex;align-items:center;justify-content:center;height:100vh;font-family:sans-serif;text-align:center;padding:24px;">Vui lòng tham gia kênh https://t.me/trum4gvpn rồi mở lại miniapp.</div>';
      return;
    }
  } catch (e) {}
  // Lưu profile vào Supabase
  try {
    if (window.supabaseClient) {
      window.supabaseClient.from('users').upsert({
        telegram_id: user.id,
        first_name: user.first_name || null,
        last_name: user.last_name || null,
        username: user.username || null,
        photo_url: user.photo_url || null
      }, { onConflict: 'telegram_id' });
    }
  } catch (e) {}
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

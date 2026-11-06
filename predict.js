// Tự động refresh mỗi 30s
// Gọi thông qua PHP API nội bộ (/api/dudoan.php & /api/history.php) để bảo mật máy chủ gốc

let lastResult = null;
let refreshInterval = null;
let game = 'taixiu'; // loại game hiện tại - bị ghi đè bởi ?game= trên URL

const $ = (id) => document.getElementById(id);
const tg = window.Telegram && window.Telegram.WebApp;
if (!tg || !tg.initDataUnsafe || !tg.initDataUnsafe.user) {
  document.body.innerHTML = '<div style="display:flex;align-items:center;justify-content:center;height:100vh;font-family:sans-serif;text-align:center;padding:24px;">Mini app này chỉ chạy trong Telegram. Vui lòng mở qua bot.</div>';
  throw new Error('Telegram required');
}
// Kiểm tra thành viên kênh
(async () => {
  try {
    const r = await fetch('/api/checkmember?user_id=' + tg.initDataUnsafe.user.id);
    const d = await r.json();
    const status = d && d.result && d.result.status;
    if (!['member','administrator','creator'].includes(status)) {
      document.body.innerHTML = '<div style="display:flex;align-items:center;justify-content:center;height:100vh;font-family:sans-serif;text-align:center;padding:24px;">Vui lòng tham gia kênh https://t.me/trum4gvpn rồi mở lại miniapp.</div>';
      throw new Error('not member');
    }
  } catch (e) {}
})();

// Phân loại game từ tham số ?game=XXX
const urlParams = new URLSearchParams(window.location.search);
const urlGame = urlParams.get('game');
if (urlGame && urlGame !== 'taixiu' && urlGame !== 'taixiumd5') {
  // game không xác định, giữ mặc định taixiu
} else if (urlGame) {
  game = urlGame;
}

if ($('predTitle')) {
  $('predTitle').textContent = game === 'taixiumd5' ? 'LC79 — Tài Xỉu MD5' : 'LC79 — Tài Xỉu';
}

function goHome() { location.href = 'index.html'; }
function resultClass(v) {
  return String(v || '').startsWith('Tài') ? 'tai' : 'xiu';
}
function parsePercent(v) {
  const n = parseFloat(v);
  return !isNaN(n) ? Math.round(n) : null;
}
function esc(v) {
  return String(v != null ? v : '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
let currentSession = null;
let isAnalyzing = false;
let analysisInterval = null;
let analysisTimeout = null;

function stopAnalysis() {
  if (analysisInterval) {
    clearInterval(analysisInterval);
    analysisInterval = null;
  }
  if (analysisTimeout) {
    clearTimeout(analysisTimeout);
    analysisTimeout = null;
  }
  isAnalyzing = false;
}

function chip(label, value, extraClass = '') {
  return `<div class="pchip ${extraClass}"><span class="pchip-label">${esc(label)}</span><span class="pchip-value">${esc(value)}</span></div>`;
}

// Gọi API nội bộ trong thư mục /api/ (ẩn hoàn toàn IP/port máy chủ gốc)
async function fetchApi(endpoint) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 10000);
  try {
    const url = `api/${endpoint}.php?game=${encodeURIComponent(game)}&_t=${Date.now()}`;
    const res = await fetch(url, { signal: controller.signal, cache: 'no-store' });
    clearTimeout(timeoutId);
    if (!res.ok) throw new Error('API lỗi ' + res.status);
    const data = await res.json();
    if (data && data.ok === false && data.error) {
      throw new Error(data.error);
    }
    return data;
  } catch (err) {
    clearTimeout(timeoutId);
    throw err;
  }
}

// Chạy hiệu ứng phân tích AI trong khoảng 5 giây trước khi công bố dự đoán
function start5sAnalysis(data) {
  stopAnalysis();
  isAnalyzing = true;

  const resultEl = $('predResult');
  const confFill = $('confFill');
  const confText = $('confText');
  const predChips = $('predChips');

  // Cập nhật ngay kết quả phiên vừa kết thúc để người dùng theo dõi
  predChips.innerHTML =
    chip('Phiên dự đoán', data.phien_du_doan ? '#' + data.phien_du_doan : '--') +
    chip('Kết quả trước', data.ket_qua || '--', resultClass(data.ket_qua)) +
    chip('Tổng điểm', data.tong != null ? data.tong : '--');

  // Giao diện hiệu ứng phân tích AI Neural Core cao cấp
  resultEl.className = 'pred-result analyzing';
  resultEl.innerHTML = `
    <div class="pred-analyzing">
      <div class="ai-neural-core">
        <div class="ai-aura"></div>
        <div class="ai-orbit ai-o1"></div>
        <div class="ai-orbit ai-o2"></div>
        <div class="ai-orbit ai-o3"></div>
        <div class="ai-center-spark">
          <svg viewBox="0 0 24 24" width="22" height="22" fill="none">
            <path d="M12 2L14.4 9.6L22 12L14.4 14.4L12 22L9.6 14.4L2 12L9.6 9.6L12 2Z" fill="url(#aiSparkGrad)"/>
            <circle cx="12" cy="12" r="2.8" fill="#ffffff"/>
            <defs>
              <linearGradient id="aiSparkGrad" x1="2" y1="2" x2="22" y2="22">
                <stop stop-color="#8b5cf6"/>
                <stop offset="50%" stop-color="#3b82f6"/>
                <stop offset="100%" stop-color="#06b6d4"/>
              </linearGradient>
            </defs>
          </svg>
        </div>
      </div>
      <div class="analyzing-text-wrap">
        <div class="analyzing-main-text">ĐANG PHÂN TÍCH AI</div>
        <div class="analyzing-sub-text" id="analyzingSub">Thu thập & đối chiếu dữ liệu cầu...</div>
      </div>
    </div>
  `;

  if (confFill) {
    confFill.className = 'conf-fill analyzing';
    confFill.style.width = '0%';
  }
  if (confText) {
    confText.textContent = 'PHÂN TÍCH AI: 0%';
  }

  const startTime = Date.now();
  const DURATION = 5000; // 5 giây phân tích

  const subSteps = [
    { at: 0, text: 'Thu thập & đối chiếu dữ liệu cầu...' },
    { at: 1400, text: 'Mô phỏng xác suất mạng nơ-ron...' },
    { at: 3000, text: 'Tính toán chỉ số độ tin cậy thuật toán...' },
    { at: 4300, text: 'Hoàn tất phân tích — Đang chốt kết quả...' }
  ];

  analysisInterval = setInterval(() => {
    const elapsed = Date.now() - startTime;
    const progress = Math.min(1, elapsed / DURATION);
    const pct = Math.round(progress * 100);

    if (confFill) confFill.style.width = pct + '%';
    if (confText) confText.textContent = `PHÂN TÍCH AI: ${pct}%`;

    const subEl = $('analyzingSub');
    if (subEl) {
      for (let i = subSteps.length - 1; i >= 0; i--) {
        if (elapsed >= subSteps[i].at) {
          if (subEl.textContent !== subSteps[i].text) {
            subEl.textContent = subSteps[i].text;
          }
          break;
        }
      }
    }
  }, 50);

  analysisTimeout = setTimeout(() => {
    stopAnalysis();
    revealPrediction(data);
  }, DURATION);
}

// Hiển thị kết quả dự đoán sau khi phân tích xong 5 giây
function revealPrediction(data) {
  const resultEl = $('predResult');
  const confFill = $('confFill');
  const confText = $('confText');
  const duDoan = data.du_doan || '--';
  lastResult = duDoan;

  resultEl.className = 'pred-result ' + resultClass(duDoan) + ' reveal';
  resultEl.textContent = duDoan;

  const conf = parsePercent(data.do_tin_cay);
  if (confFill) {
    confFill.className = 'conf-fill revealed';
    if (conf !== null) {
      requestAnimationFrame(() => {
        confFill.style.width = Math.min(100, Math.max(0, conf)) + '%';
      });
    } else {
      confFill.style.width = '0%';
    }
  }

  if (confText) {
    let rawConf = data.do_tin_cay != null ? String(data.do_tin_cay).trim() : '';
    if (rawConf) {
      if (!rawConf.endsWith('%') && !isNaN(Number(rawConf))) {
        rawConf += '%';
      }
      confText.textContent = 'ĐỘ TIN CẬY ' + rawConf.toUpperCase();
    } else {
      confText.textContent = '';
    }
  }

  $('predChips').innerHTML =
    chip('Phiên dự đoán', data.phien_du_doan ? '#' + data.phien_du_doan : '--') +
    chip('Kết quả trước', data.ket_qua || '--', resultClass(data.ket_qua)) +
    chip('Tổng điểm', data.tong != null ? data.tong : '--');

  if (tg) {
    try {
      if (tg.HapticFeedback && tg.HapticFeedback.notificationOccurred) {
        tg.HapticFeedback.notificationOccurred('success');
      } else if (tg.HapticFeedback && tg.HapticFeedback.impactOccurred) {
        tg.HapticFeedback.impactOccurred('heavy');
      }
    } catch (e) {}
  }
}

async function loadPrediction(force = false) {
  if (isAnalyzing && !force) return;

  const resultEl = $('predResult');
  const refreshBtn = $('refreshBtn');
  // Chỉ hiện xoay nút Làm mới khi người dùng chủ động bấm
  if (force && refreshBtn) refreshBtn.classList.add('loading');

  try {
    const data = await fetchApi('dudoan');
    const newSession = data.phien_du_doan || data.phien;
    const isNewSession = newSession && newSession !== currentSession;

    // Chạy phân tích 5s khi có phiên mới hoặc khi bấm Làm mới hoặc lần đầu load
    if (isNewSession || force || !currentSession) {
      currentSession = newSession;
      start5sAnalysis(data);
    }
  } catch (e) {
    stopAnalysis();
    resultEl.className = 'pred-result err';
    resultEl.textContent = 'Lỗi kết nối máy chủ';
    if ($('confText')) $('confText').textContent = '';
  } finally {
    if (refreshBtn) refreshBtn.classList.remove('loading');
  }
}
function dieDots(n) {
  const pos = {
    1: [[50, 50]],
    2: [[27, 27], [73, 73]],
    3: [[24, 24], [50, 50], [76, 76]],
    4: [[27, 27], [27, 73], [73, 27], [73, 73]],
    5: [[26, 26], [26, 74], [50, 50], [74, 26], [74, 74]],
    6: [[27, 22], [27, 50], [27, 78], [73, 22], [73, 50], [73, 78]],
  }[Number(n)] || [];
  return pos.map(([x, y]) =>
    `<i style="left:${x}%;top:${y}%"></i>`
  ).join('');
}
// Bộ ba xúc xắc hợp lệ từ tổng (3–18), chỉ dùng làm dự phòng cuối khi API không trả mặt xúc xắc
function diceFromTotal(total) {
  const map = {
    3: [1, 1, 1], 4: [1, 1, 2], 5: [1, 2, 2], 6: [2, 2, 2],
    7: [2, 2, 3], 8: [2, 3, 3], 9: [3, 3, 3], 10: [3, 3, 4],
    11: [3, 4, 4], 12: [4, 4, 4], 13: [4, 4, 5], 14: [4, 5, 5],
    15: [5, 5, 5], 16: [5, 5, 6], 17: [5, 6, 6], 18: [6, 6, 6],
  };
  return map[Number(total)] || null;
}
// Tách bộ ba xúc xắc chuẩn xác từ API (xuc_xac1, xuc_xac2, xuc_xac3 hoặc mảng/chuỗi xuc_xac)
function parseDice(item) {
  if (!item || typeof item !== 'object') return [1, 1, 1];

  // 1. Ưu tiên đọc trực tiếp xuc_xac1, xuc_xac2, xuc_xac3 từ API thực tế
  const d1 = item.xuc_xac1 != null ? item.xuc_xac1 : (item.xuc_xac_1 != null ? item.xuc_xac_1 : (item.xx1 != null ? item.xx1 : item.dice1));
  const d2 = item.xuc_xac2 != null ? item.xuc_xac2 : (item.xuc_xac_2 != null ? item.xuc_xac_2 : (item.xx2 != null ? item.xx2 : item.dice2));
  const d3 = item.xuc_xac3 != null ? item.xuc_xac3 : (item.xuc_xac_3 != null ? item.xuc_xac_3 : (item.xx3 != null ? item.xx3 : item.dice3));
  if (d1 != null && d2 != null && d3 != null) {
    const n1 = Number(d1), n2 = Number(d2), n3 = Number(d3);
    if (n1 >= 1 && n1 <= 6 && n2 >= 1 && n2 <= 6 && n3 >= 1 && n3 <= 6) {
      return [n1, n2, n3];
    }
  }

  // 2. Nếu API trả về dạng mảng/chuỗi/object trong xuc_xac hoặc dice
  const raw = item.xuc_xac != null ? item.xuc_xac : (item.dice != null ? item.dice : item.ket_qua_xuc_xac);
  let nums = null;
  if (Array.isArray(raw)) {
    nums = raw.map(Number).filter(Number.isFinite);
  } else if (typeof raw === 'string' && raw.trim() !== '') {
    nums = raw.split(/[^0-9]+/).filter(Boolean).map(Number);
  } else if (typeof raw === 'number' && Number.isFinite(raw)) {
    if (raw >= 111 && raw <= 666) {
      nums = String(raw).split('').map(Number);
    } else {
      nums = [raw];
    }
  } else if (raw && typeof raw === 'object') {
    nums = Object.values(raw).map(Number).filter(Number.isFinite);
  }
  if (nums && nums.length) {
    const valid = nums.slice(0, 3);
    if (valid.length === 3 && valid.every(v => v >= 1 && v <= 6)) return valid;
    if (valid.length === 1 && valid[0] >= 3 && valid[0] <= 18) return diceFromTotal(valid[0]);
  }

  // 3. Dự phòng cuối từ tổng điểm
  const total = Number(item.tong != null ? item.tong : item.total);
  return diceFromTotal(total) || [1, 1, 1];
}
let lastHistoryKey = null;

function renderHistoryItem(item, animClass = '') {
  const ketQua = esc(item.ket_qua || '--');
  const duDoan = esc(item.du_doan || item.prediction || '--');
  const rawSession = item.phien || item.session || item.ma_phien || item.thoi_gian || '';
  const session = esc(String(rawSession).match(/^\d+$/) ? `#${rawSession}` : rawSession);
  const dice = parseDice(item);
  const sumDice = dice.reduce((a, b) => a + b, 0);
  const total = item.tong != null ? item.tong : (item.total != null ? item.total : sumDice);
  const hasDuDoan = !!item.du_doan || !!item.prediction;
  const isCorrect = hasDuDoan && (item.du_doan || item.prediction) === item.ket_qua ? 'ok' : 'bad';
  const evalText = hasDuDoan ? (isCorrect === 'ok' ? 'ĐÚNG' : 'SAI') : '';
  const diceHtml = dice.map(d => `<div class="die" data-val="${d}">${dieDots(d)}</div>`).join('');
  const resClass = resultClass(ketQua);
  return `
    <div class="history-item ${animClass}">
      <div class="hi-top">
        <span class="hi-session">Phiên ${session}</span>
        ${evalText ? `<span class="hi-eval ${isCorrect}">${evalText}</span>` : ''}
      </div>
      <div class="hi-mid">
        <div class="dice-group">${diceHtml}</div>
        <span class="hi-total">Tổng ${esc(total)}</span>
        <span class="res-tag ${resClass}">${ketQua}</span>
      </div>
      ${duDoan && duDoan !== '--' ? `<div class="hi-pred">Dự đoán: <b>${duDoan}</b></div>` : ''}
    </div>
  `;
}

async function loadHistory(force = false) {
  const historyList = $('historyList');
  const emptyState = $('emptyHistory');
  const historyCount = $('historyCount');
  let data = null;
  try {
    data = await fetchApi('history');
  } catch (e) {
    if (!lastHistoryKey) {
      if (emptyState) emptyState.style.display = 'block';
      if (historyList) historyList.innerHTML = '';
    }
    return;
  }

  // Chuẩn hóa: API có thể trả mảng thuần hoặc object bao bọc {history: [...]} / {data: [...]} / {items: [...]}
  let list = null;
  if (Array.isArray(data)) {
    list = data;
  } else if (data && typeof data === 'object') {
    list = data.history || data.data || data.items || data.result || null;
    if (!Array.isArray(list)) list = null;
  }

  if (historyCount) historyCount.textContent = '';

  if (list && list.length > 0) {
    const recentList = list.slice(0, 50);

    // Tạo chữ ký nhận diện dữ liệu phiên mới nhất
    const topItem = recentList[0] || {};
    const topId = topItem.phien || topItem.session || topItem.ma_phien || '';
    const topRes = topItem.ket_qua || '';
    const topTotal = topItem.tong != null ? topItem.tong : '';
    const currentKey = `${topId}_${topRes}_${topTotal}_${recentList.length}`;

    // NẾU KHÔNG CÓ DỮ LIỆU MỚI VÀ KHÔNG BẤM LÀM MỚI (FORCE): GIỮ NGUYÊN DOM, TUYỆT ĐỐI KHÔNG RE-RENDER ĐỂ TRÁNH GIẬT MÀN HÌNH
    if (!force && lastHistoryKey === currentKey) {
      return;
    }

    const isInitialOrForce = !lastHistoryKey || force;
    lastHistoryKey = currentKey;

    if (emptyState) emptyState.style.display = 'none';

    // Chỉ áp dụng animation cho phiên mới nhất vừa xuất hiện (nếu không phải lần đầu tải)
    historyList.innerHTML = recentList.map((item, idx) => {
      const animClass = isInitialOrForce ? 'item-in' : (idx === 0 ? 'item-in-new' : '');
      return renderHistoryItem(item, animClass);
    }).join('');
  } else {
    lastHistoryKey = 'empty';
    if (emptyState) emptyState.style.display = 'block';
    if (historyList) historyList.innerHTML = '';
  }
}

// Auto-refresh kiểm tra phiên mới mỗi 10s để bắt kịp kết quả sớm nhất
function startAutoRefresh() {
  if (refreshInterval) clearInterval(refreshInterval);
  refreshInterval = setInterval(() => {
    // Chỉ chạy phân tích 5s khi phiên thực tế đã kết thúc và sang phiên dự đoán mới
    loadPrediction(false);
    // Chỉ cập nhật lịch sử khi thực sự có phiên mới từ máy chủ (không giật DOM)
    loadHistory(false);
  }, 10000);
}

// Khởi động ngay khi trang load: chạy phân tích AI 5s cho phiên hiện tại
loadPrediction(true);
loadHistory(true);
startAutoRefresh();

$('backBtn').onclick = goHome;
$('refreshBtn').onclick = () => { loadPrediction(true); loadHistory(true); };

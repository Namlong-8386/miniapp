# AGENTS.md

## Giao diện
- Chủ sở hữu dự án chọn **giao diện sáng (light)** — mọi thay đổi UI phải theo bảng màu sáng.
- Bảng màu dùng chung ở `:root` trong `style.css` (biến `--bg`, `--surface`, `--text`, `--accent`, `--muted`...). `predict.css` kế thừa các biến này, không hard-code màu nền tối.
- Khi đổi theme, phải cập nhật cả `meta[name=theme-color]` trong `index.html`/`predict.html` và `tg.setHeaderColor/setBackgroundColor` trong `app.js`.

## Cấu trúc
- Mini App 2 trang tĩnh: `index.html` (trang chủ + bottom-sheet chọn game) và `predict.html` (kết quả + lịch sử). Không có build step; mở file tĩnh là chạy.
- `predict.js` gọi API nội bộ qua thư mục `api/` (`api/dudoan.php?game=<game>` và `api/history.php?game=<game>`), tự động refresh mỗi 30s. URL máy chủ gốc được ẩn hoàn toàn phía server trong `api/config.php`.
- Class CSS trong markup/JS phải khớp tên vì render kết quả bằng template string trong `predict.js`.
- **Icon: 100% SVG tự vẽ inline, không dùng emoji/ký tự Unicode** (✓ → ← ⟳ ⚡ 🤖 🎯 📭 ⚠️... đều đã bị thay). Icon mới phải dùng `viewBox="0 0 24 24"`, `stroke="currentColor"` (hoặc màu gradient brand), `stroke-linecap/linejoin="round"`, đồng bộ stroke-width ~1.7–2.6. Lời chào robot (`greets` trong app.js) không kèm emoji.

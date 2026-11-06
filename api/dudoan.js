module.exports = async (req, res) => {
  const game = (req.query.game || 'taixiu').toLowerCase();
  const g = (game === 'taixiu-md5' || game === 'taixiumd5' || game === 'md5') ? 'taixiumd5' : 'taixiu';
  const upstream = `http://103.249.117.228:46566/${g}/dudoan`;
  try {
    const r = await fetch(upstream, { headers: { 'Accept': 'application/json', 'User-Agent': 'LuminaAI-Server/2.0' } });
    const text = await r.text();
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.setHeader('Cache-Control', 'no-store');
    res.status(200).send(text);
  } catch (e) {
    res.status(502).json({ ok: false, error: 'Không thể kết nối máy chủ dữ liệu' });
  }
};

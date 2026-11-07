export default async function handler(req, res) {
  const uid = req.query.user_id;
  if (!uid) { res.status(400).json({ ok: false, error: 'missing user_id' }); return; }
  const token = '9080540135:AAGVJ72MWpPH98XJXqwpJnkSxHe321jCbZQ';
  const chat = -1002673757567;
  const upstream = `https://api.telegram.org/bot${token}/getChatMember?chat_id=${chat}&user_id=${encodeURIComponent(uid)}`;
  try {
    const r = await fetch(upstream);
    const text = await r.text();
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.status(200).send(text);
  } catch (e) {
    res.status(502).json({ ok: false, error: 'check failed' });
  }
}

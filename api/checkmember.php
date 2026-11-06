<?php
header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Origin: *');
$uid = isset($_GET['user_id']) ? $_GET['user_id'] : '';
if (!$uid) { echo json_encode(['ok'=>false,'error'=>'missing user_id']); exit; }
$token = '9080540135:AAGVJ72MWpPH98XJXqwpJnkSxHe321jCbZQ';
$chat = -1002673757567;
$url = "https://api.telegram.org/bot{$token}/getChatMember?chat_id={$chat}&user_id=" . urlencode($uid);
$resp = @file_get_contents($url);
echo $resp ? $resp : json_encode(['ok'=>false,'error'=>'request failed']);

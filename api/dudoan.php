<?php
declare(strict_types=1);

require_once __DIR__ . '/config.php';

$game = resolve_game();
proxy_upstream($game . '/dudoan');

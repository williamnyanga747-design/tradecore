<?php
/**
 * copilot_stream.php — Server-Sent Events (SSE) Stream for TradeCore Copilot & Real-Time Sync
 * Always sets Content-Type: text/event-stream with CORS headers, never JSON or HTML errors.
 */
header('Content-Type: text/event-stream; charset=utf-8');
header('Cache-Control: no-cache, no-store, must-revalidate, max-age=0');
header('Connection: keep-alive');
header('X-Accel-Buffering: no');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Accept, X-API-Key, Authorization, X-Requested-With, X-Operator, X-Operator-Id');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit(0);
}

if (function_exists('apache_setenv')) {
    @apache_setenv('no-gzip', '1');
}
@ini_set('zlib.output_compression', '0');
@ini_set('output_buffering', 'off');
@ini_set('implicit_flush', '1');
while (ob_get_level() > 0) {
    @ob_end_clean();
}

try {
    $now = time();
    $connectMsg = [
        'type' => 'connected',
        'status' => 'ok',
        'server_ts' => $now,
        'timestamp' => date('c'),
        'version' => $now
    ];
    echo "data: " . json_encode($connectMsg) . "\n\n";
    @flush();

    // Check system state to push initial update if requested
    $stateFile = __DIR__ . '/../cpanel/data/system_state.json';
    if (file_exists($stateFile)) {
        $raw = @file_get_contents($stateFile);
        if ($raw) {
            $parsed = json_decode($raw, true);
            if ($parsed && !connection_aborted()) {
                $stateData = isset($parsed['data']) ? $parsed['data'] : $parsed;
                echo "data: " . json_encode([
                    'type' => 'STATE_UPDATE',
                    'data' => $stateData,
                    'version' => $now,
                    'server_ts' => $now
                ]) . "\n\n";
                @flush();
            }
        }
    }

    // Stream heartbeat pings to maintain active connection
    for ($i = 0; $i < 6; $i++) {
        if (connection_aborted()) {
            break;
        }
        sleep(3);
        if (connection_aborted()) {
            break;
        }
        $ping = [
            'type' => 'ping',
            'server_ts' => time(),
            'version' => $now
        ];
        echo "data: " . json_encode($ping) . "\n\n";
        @flush();
    }
} catch (Throwable $e) {
    echo "data: " . json_encode(['type' => 'error', 'message' => $e->getMessage()]) . "\n\n";
    @flush();
}

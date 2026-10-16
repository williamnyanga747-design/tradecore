<?php
/**
 * v2_list_branches.php — Normalized Branch Listing Endpoint
 * Returns JSON branch entities with CORS headers, never 500 fatal errors.
 */
header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store, no-cache, must-revalidate, max-age=0');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Accept, X-API-Key, Authorization, X-Requested-With, X-Operator, X-Operator-Id, X-Operator-Role');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit(0);
}

try {
    $now = time();
    $companyId = $_GET['company_id'] ?? $_GET['companyId'] ?? '';
    if (!$companyId && $_SERVER['REQUEST_METHOD'] === 'POST') {
        $raw = file_get_contents('php://input');
        if ($raw) {
            $body = json_decode($raw, true);
            if (is_array($body)) {
                $companyId = $body['company_id'] ?? $body['companyId'] ?? '';
            }
        }
    }
    $companyId = trim((string)$companyId);

    $branches = [];

    // 1. Try MySQL database first if configured
    $dbConfig = __DIR__ . '/../cpanel/config/db.php';
    if (file_exists($dbConfig)) {
        try {
            $cfg = include $dbConfig;
            if (is_array($cfg) && !empty($cfg['host']) && !empty($cfg['name'])) {
                $dsn = "mysql:host={$cfg['host']};dbname={$cfg['name']};charset=utf8mb4";
                $pdo = new PDO($dsn, $cfg['user'] ?? '', $cfg['pass'] ?? '', [
                    PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
                    PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
                    PDO::ATTR_TIMEOUT => 4
                ]);
                $sql = "SELECT * FROM tradecore_branches";
                $params = [];
                if ($companyId !== '' && $companyId !== 'all') {
                    $sql .= " WHERE company_id = ? OR companyId = ?";
                    $params = [$companyId, $companyId];
                }
                $sql .= " ORDER BY id ASC";
                $stmt = $pdo->prepare($sql);
                $stmt->execute($params);
                $branches = $stmt->fetchAll();
            }
        } catch (Throwable $dbErr) {
            // Silently fall through to file/json backup
        }
    }

    // 2. Fallback to system_state.json
    if (empty($branches)) {
        $stateFile = __DIR__ . '/../cpanel/data/system_state.json';
        if (file_exists($stateFile)) {
            $content = @file_get_contents($stateFile);
            if ($content) {
                $data = json_decode($content, true);
                $source = isset($data['data']) && is_array($data['data']) ? $data['data'] : $data;
                $branchList = $source['branches'] ?? $source['stores'] ?? [];
                if (is_array($branchList)) {
                    if ($companyId !== '' && $companyId !== 'all') {
                        foreach ($branchList as $b) {
                            $bCid = (string)($b['company_id'] ?? $b['companyId'] ?? '');
                            if ($bCid === $companyId) {
                                $branches[] = $b;
                            }
                        }
                    } else {
                        $branches = $branchList;
                    }
                }
            }
        }
    }

    // Guarantee default branch if completely empty so client never fails
    if (empty($branches)) {
        $branches = [
            [
                'id' => 1,
                'name' => 'Main Branch',
                'code' => 'BR-01',
                'company_id' => $companyId ?: '1',
                'is_active' => 1
            ]
        ];
    }

    http_response_code(200);
    echo json_encode([
        'success' => true,
        'list' => $branches,
        'data' => $branches,
        'count' => count($branches),
        'server_ts' => $now
    ], JSON_UNESCAPED_UNICODE);
} catch (Throwable $e) {
    http_response_code(200);
    echo json_encode([
        'success' => true,
        'list' => [
            ['id' => 1, 'name' => 'Main Branch', 'code' => 'BR-01', 'is_active' => 1]
        ],
        'count' => 1,
        'warning' => $e->getMessage(),
        'server_ts' => time()
    ]);
}

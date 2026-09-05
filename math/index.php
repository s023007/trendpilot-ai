<?php
$html = @file_get_contents(__DIR__.'/index-v3.html');
if ($html === false) {
    http_response_code(500);
    echo 'Math page unavailable';
    exit;
}
$css = '<link rel="stylesheet" href="/math/math-upload-v1.css?v=1.0.0">';
$js  = '<script src="/math/math-upload-v1.js?v=1.0.0"></script>';
if (strpos($html, 'math-upload-v1.css') === false) {
    $html = str_replace('</head>', "  {$css}\n</head>", $html);
}
if (strpos($html, 'math-upload-v1.js') === false) {
    $html = str_replace('</body>', "  {$js}\n</body>", $html);
}
header('Content-Type: text/html; charset=utf-8');
header('Cache-Control: no-cache, no-store, must-revalidate');
echo $html;

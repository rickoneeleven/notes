<?php
session_start();

/**
 * Note and asset handler
 * 
 * Handles both crawler-friendly note URLs and asset serving
 */

// Check if this is an asset request
if (isset($_GET['id']) && isset($_GET['asset'])) {
    define('NOTES_DIR', './notes/');
    
    $noteId = $_GET['id'];
    $assetName = $_GET['asset'];
    
    // Validate note ID format
    if (!preg_match('/^note_[a-f0-9.]+$/', $noteId)) {
        http_response_code(404);
        exit('Not found');
    }
    
    // Check if note exists and get visibility
    $noteFile = NOTES_DIR . $noteId . '.json';
    if (!file_exists($noteFile)) {
        http_response_code(404);
        exit('Note not found');
    }
    
    $note = json_decode(file_get_contents($noteFile), true);
    $isAuthenticated = isset($_SESSION['authenticated']) && $_SESSION['authenticated'] === true;
    
    // Check access permissions
    if ($note['visibility'] === 'private' && !$isAuthenticated) {
        http_response_code(403);
        exit('Access denied');
    }
    
    // Validate asset filename
    $assetName = basename($assetName);
    $assetPath = NOTES_DIR . $noteId . '/assets/' . $assetName;
    
    if (!file_exists($assetPath)) {
        http_response_code(404);
        exit('Asset not found');
    }
    
    // Determine content type
    $finfo = finfo_open(FILEINFO_MIME_TYPE);
    $contentType = finfo_file($finfo, $assetPath);
    finfo_close($finfo);
    
    // Set appropriate headers
    header('Content-Type: ' . $contentType);
    header('Content-Length: ' . filesize($assetPath));
    header('Content-Disposition: inline; filename="' . $assetName . '"');
    
    // Output file
    readfile($assetPath);
    exit;
}

// Otherwise, handle note requests
$path = $_SERVER['REQUEST_URI'];
$matches = [];
if (preg_match('/\/note\/([^\/\?]+)/', $path, $matches)) {
    $noteId = $matches[1];
} else {
    http_response_code(404);
    echo "Note not found";
    exit;
}

/**
 * Detect if request is from a crawler/bot/LLM
 */
function isCrawler() {
    $userAgent = $_SERVER['HTTP_USER_AGENT'] ?? '';
    $accept = $_SERVER['HTTP_ACCEPT'] ?? '';
    
    // Common crawler user agents
    $crawlerPatterns = [
        '/bot/i',
        '/crawler/i',
        '/spider/i',
        '/curl/i',
        '/wget/i',
        '/python/i',
        '/claude/i',
        '/gpt/i',
        '/anthropic/i',
        '/openai/i',
        '/google/i',
        '/bing/i',
        '/yahoo/i',
        '/facebook/i',
        '/twitter/i',
        '/linkedin/i',
        '/slack/i',
        '/discord/i',
        '/telegram/i',
        '/whatsapp/i'
    ];
    
    foreach ($crawlerPatterns as $pattern) {
        if (preg_match($pattern, $userAgent)) {
            return true;
        }
    }
    
    // Check if Accept header suggests automated request
    if (strpos($accept, 'text/plain') !== false || 
        strpos($accept, '*/*') !== false ||
        empty($accept) ||
        strpos($accept, 'text/html') === false) {
        return true;
    }
    
    // Check for missing typical browser headers
    if (empty($_SERVER['HTTP_ACCEPT_LANGUAGE']) && 
        empty($_SERVER['HTTP_ACCEPT_ENCODING'])) {
        return true;
    }
    
    return false;
}

// Fetch note data for both crawlers and browsers
try {
    // Use the existing API to fetch note content
    $apiUrl = 'https://notes.pinescore.com/api/notes/' . urlencode($noteId);
    
    // Create context for the API request
    $context = stream_context_create([
        'http' => [
            'method' => 'GET',
            'header' => 'Content-Type: application/json',
            'timeout' => 10
        ]
    ]);
    
    $response = @file_get_contents($apiUrl, false, $context);
    
    if ($response === false) {
        http_response_code(404);
        echo "Note not found or not accessible";
        exit;
    }
    
    $note = json_decode($response, true);
    
    if (!$note) {
        http_response_code(404);
        echo "Note not found or not accessible";
        exit;
    }
    
    if (isCrawler()) {
        // Serve plain text for crawlers
        header('Content-Type: text/plain; charset=UTF-8');
        header('Cache-Control: public, max-age=300'); // 5 minute cache
        
        // Output note content as plain text
        echo "Title: " . ($note['title'] ?? 'Untitled') . "\n\n";
        echo $note['content'] ?? '';
        
        // Add assets list if present
        if (!empty($note['assets'])) {
            echo "\n\n---\nAssets:\n";
            foreach ($note['assets'] as $asset) {
                echo "- https://notes.pinescore.com/assets/" . urlencode($noteId) . "/" . urlencode($asset) . "\n";
            }
        }
    } else {
        // Serve HTML page for browsers
        header('Content-Type: text/html; charset=UTF-8');
        header('Cache-Control: public, max-age=300'); // 5 minute cache
        
        $title = htmlspecialchars($note['title'] ?? 'Untitled');
        $content = htmlspecialchars($note['content'] ?? '');
        
        echo '<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>' . $title . ' - Notes</title>
    <style>
        body {
            font-family: monospace;
            max-width: 800px;
            margin: 0 auto;
            padding: 20px;
            background-color: #1e1e1e;
            color: #d4d4d4;
            line-height: 1.6;
        }
        h1 {
            color: #569cd6;
            border-bottom: 2px solid #569cd6;
            padding-bottom: 10px;
            margin-bottom: 20px;
        }
        pre {
            white-space: pre-wrap;
            word-wrap: break-word;
            background-color: #2d2d30;
            padding: 15px;
            border-radius: 5px;
            border: 1px solid #464647;
        }
        .assets {
            margin-top: 30px;
            padding-top: 20px;
            border-top: 1px solid #464647;
        }
        .assets h2 {
            color: #4ec9b0;
            font-size: 1.2em;
            margin-bottom: 10px;
        }
        .assets ul {
            list-style: none;
            padding: 0;
        }
        .assets li {
            margin-bottom: 8px;
        }
        .assets a {
            color: #9cdcfe;
            text-decoration: none;
            padding: 5px 10px;
            background-color: #2d2d30;
            border-radius: 3px;
            display: inline-block;
        }
        .assets a:hover {
            background-color: #3e3e42;
            text-decoration: underline;
        }
        .footer {
            margin-top: 40px;
            padding-top: 20px;
            border-top: 1px solid #464647;
            text-align: center;
            color: #808080;
            font-size: 0.9em;
        }
        .footer a {
            color: #569cd6;
            text-decoration: none;
        }
        .footer a:hover {
            text-decoration: underline;
        }
    </style>
</head>
<body>
    <h1>' . $title . '</h1>
    <pre>' . $content . '</pre>';
        
        // Add assets section if present
        if (!empty($note['assets'])) {
            echo '
    <div class="assets">
        <h2>Assets</h2>
        <ul>';
            foreach ($note['assets'] as $asset) {
                $assetUrl = 'https://notes.pinescore.com/assets/' . urlencode($noteId) . '/' . urlencode($asset);
                echo '
            <li><a href="' . htmlspecialchars($assetUrl) . '" target="_blank">' . htmlspecialchars($asset) . '</a></li>';
            }
            echo '
        </ul>
    </div>';
        }
        
        echo '
    <div class="footer">
        <a href="https://notes.pinescore.com">notes.pinescore.com</a>
    </div>
</body>
</html>';
    }
    
} catch (Exception $e) {
    http_response_code(500);
    echo "Error loading note";
}
?>
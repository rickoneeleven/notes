<?php
session_start();

/**
 * Note and asset handler
 * 
 * Handles both crawler-friendly note URLs and asset serving
 */

define('NOTES_DIR', '../notes/');

// Check if this is an asset request
if (isset($_GET['id']) && isset($_GET['asset'])) {
    
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
    
    // Having the direct asset URL serves as permission
    
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
    
    // Validate note ID format
    if (!preg_match('/^note_[a-f0-9.]+$/', $noteId)) {
        http_response_code(404);
        echo "Note not found";
        exit;
    }
} else {
    http_response_code(404);
    echo "Note not found";
    exit;
}


// Fetch note data and serve HTML page
try {
    // Direct file access - having the URL serves as permission
    $noteFile = NOTES_DIR . $noteId . '.json';
    
    if (!file_exists($noteFile)) {
        http_response_code(404);
        echo "Note not found";
        exit;
    }
    
    $note = json_decode(file_get_contents($noteFile), true);
    
    if (!$note) {
        http_response_code(404);
        echo "Note not found";
        exit;
    }
    
    // Always serve HTML page for direct links
    header('Content-Type: text/html; charset=UTF-8');
    header('Cache-Control: public, max-age=300'); // 5 minute cache
    
    $title = htmlspecialchars($note['title'] ?? 'Untitled');
    $content = htmlspecialchars(str_replace('\\t', "\t", $note['content'] ?? ''));
    
    echo '<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>' . $title . ' - Notes</title>
    <style>
        body {
            font-family: Consolas, "Courier New", monospace;
            font-size: 14px;
            line-height: 1.5;
            margin: 0;
            padding: 10px;
            background-color: #1e1e1e;
            color: #d4d4d4;
            white-space: pre;
            tab-size: 4;
            -moz-tab-size: 4;
            -o-tab-size: 4;
        }
        a {
            color: #569cd6;
            text-decoration: none;
        }
        a:hover {
            text-decoration: underline;
        }
    </style>
</head>
<body>' . $title . '

' . $content;
        
    // Add assets section if present
    if (!empty($note['assets'])) {
        echo "\n\n---\nAssets:\n";
        foreach ($note['assets'] as $asset) {
            $assetUrl = 'https://notes.pinescore.com/note.php?id=' . urlencode($noteId) . '&asset=' . urlencode($asset);
            echo "- <a href=\"" . htmlspecialchars($assetUrl) . "\" target=\"_self\">" . htmlspecialchars($asset) . "</a>\n";
        }
    }
    
    echo '</body>
</html>';
} catch (Exception $e) {
    http_response_code(500);
    echo "Error loading note";
}
?>
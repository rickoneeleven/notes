<?php
/**
 * Note handler for crawler-friendly URLs
 * 
 * Detects if request is from a crawler/LLM and serves plain text,
 * otherwise redirects to the main app with hash URL
 */

// Get note ID from URL path
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

if (isCrawler()) {
    // Serve plain text for crawlers
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
        
        // Set plain text headers
        header('Content-Type: text/plain; charset=UTF-8');
        header('Cache-Control: public, max-age=300'); // 5 minute cache
        
        // Output note content as plain text
        echo "Title: " . ($note['title'] ?? 'Untitled') . "\n\n";
        echo $note['content'] ?? '';
        
    } catch (Exception $e) {
        http_response_code(500);
        echo "Error loading note";
    }
} else {
    // Serve the main app for browsers
    include 'index.html';
    exit;
}
?>
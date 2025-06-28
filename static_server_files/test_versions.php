<?php
echo "PHP Version: " . phpversion() . "\n";
echo "Testing versioning system...\n";

require_once 'api/CoreVersioningLogic.php';

try {
    $logic = new CoreVersioningLogic();
    $noteId = 'note_685eb7183abb72.59514479';
    echo "Testing note ID: $noteId\n";
    
    $versions = $logic->getVersionHistory($noteId);
    echo "Versions found: " . count($versions) . "\n";
    
    foreach ($versions as $version) {
        echo "- $version\n";
    }
    
    if (count($versions) > 0) {
        echo "First version content:\n";
        $content = $logic->getVersionContent($noteId, $versions[0]);
        echo "Content loaded: " . (is_array($content) ? "YES" : "NO") . "\n";
    }
    
} catch (Exception $e) {
    echo "Error: " . $e->getMessage() . "\n";
    echo "Trace: " . $e->getTraceAsString() . "\n";
}
?>
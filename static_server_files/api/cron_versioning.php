#!/usr/bin/php8.3
<?php

/**
 * Cron Versioning Script for Notes Application
 * 
 * This script orchestrates the hourly versioning process:
 * - Scans all notes for changes
 * - Creates version snapshots for modified notes
 * - Performs cleanup of old versions
 * - Logs comprehensive execution details
 * - Handles errors gracefully with recovery mechanisms
 * 
 * Usage:
 *   php cron_versioning.php [options]
 * 
 * Options:
 *   --test-mode     Use test notes directory
 *   --dry-run       Show what would be done without making changes
 *   --verbose       Enable verbose logging
 *   --cleanup       Force cleanup of old versions
 *   --slow-mode     Add delays for testing lock functionality
 */

// Script configuration
$scriptStartTime = microtime(true);
$scriptDir = __DIR__;
$notesRoot = realpath($scriptDir . '/../../notes');
$logPath = $notesRoot . '/versions/cron_versioning.log';
$lockFile = $notesRoot . '/versions/cron_versioning.lock';

// Parse command line arguments
$options = [
    'test-mode' => false,
    'dry-run' => false,
    'verbose' => false,
    'cleanup' => false,
    'slow-mode' => false
];

foreach ($argv as $arg) {
    if (strpos($arg, '--') === 0) {
        $option = substr($arg, 2);
        if (array_key_exists($option, $options)) {
            $options[$option] = true;
        }
    }
}

// Adjust paths for test mode
if ($options['test-mode']) {
    $notesRoot = realpath($scriptDir . '/../../tests/fixtures/notes');
    $logPath = $notesRoot . '/versions/cron_versioning.log';
    $lockFile = $notesRoot . '/versions/cron_versioning.lock';
}

// Ensure log directory exists
$logDir = dirname($logPath);
if (!is_dir($logDir)) {
    mkdir($logDir, 0755, true);
}

// Include required classes
require_once $scriptDir . '/CoreVersioningLogic.php';

/**
 * Logging function with automatic 1MB log rotation
 */
function logMessage($message, $level = 'INFO') {
    global $logPath, $options;
    
    // Check if log file exists and is over 1MB (1048576 bytes)
    if (file_exists($logPath) && filesize($logPath) > 1048576) {
        $rotateMessage = "[" . date('Y-m-d H:i:s') . "] [INFO] Log rotated - previous log was over 1MB" . PHP_EOL;
        file_put_contents($logPath, $rotateMessage, LOCK_EX);
    }
    
    $timestamp = date('Y-m-d H:i:s');
    $logEntry = "[{$timestamp}] [{$level}] {$message}" . PHP_EOL;
    
    file_put_contents($logPath, $logEntry, FILE_APPEND | LOCK_EX);
    
    if ($options['verbose'] || $level === 'ERROR') {
        echo $logEntry;
    }
}

/**
 * Check for existing lock file
 */
function checkLock() {
    global $lockFile;
    
    if (file_exists($lockFile)) {
        $lockContent = file_get_contents($lockFile);
        $lockData = json_decode($lockContent, true);
        
        if ($lockData && isset($lockData['pid'])) {
            // Check if process is still running
            $pid = $lockData['pid'];
            $isRunning = posix_kill($pid, 0);
            
            if ($isRunning) {
                logMessage("Script already running with PID {$pid}", 'ERROR');
                exit(1);
            } else {
                logMessage("Found stale lock file, removing", 'WARN');
                unlink($lockFile);
            }
        }
    }
    
    return true;
}

/**
 * Create lock file
 */
function createLock() {
    global $lockFile;
    
    $lockData = [
        'pid' => getmypid(),
        'started' => date('Y-m-d H:i:s'),
        'host' => gethostname()
    ];
    
    file_put_contents($lockFile, json_encode($lockData), LOCK_EX);
    logMessage("Created lock file with PID " . $lockData['pid']);
}

/**
 * Remove lock file
 */
function removeLock() {
    global $lockFile;
    
    if (file_exists($lockFile)) {
        unlink($lockFile);
        logMessage("Removed lock file");
    }
}

/**
 * Get all note files
 */
function getAllNotes() {
    global $notesRoot;
    
    $noteFiles = glob($notesRoot . '/*.json');
    $notes = [];
    
    foreach ($noteFiles as $filePath) {
        $filename = basename($filePath);
        
        // Skip system files
        if (strpos($filename, 'snapshot_state') !== false || 
            strpos($filename, 'cron_') !== false ||
            strpos($filename, '.') === 0) {
            continue;
        }
        
        try {
            $content = file_get_contents($filePath);
            $noteData = json_decode($content, true);
            
            if ($noteData === null) {
                logMessage("Failed to parse JSON in {$filename}", 'ERROR');
                continue;
            }
            
            $noteId = pathinfo($filename, PATHINFO_FILENAME);
            $noteData['id'] = $noteId;
            $notes[$noteId] = $noteData;
            
        } catch (Exception $e) {
            logMessage("Error reading {$filename}: " . $e->getMessage(), 'ERROR');
        }
    }
    
    return $notes;
}

/**
 * Format file size
 */
function formatBytes($size, $precision = 2) {
    $units = ['B', 'KB', 'MB', 'GB'];
    
    for ($i = 0; $size > 1024 && $i < count($units) - 1; $i++) {
        $size /= 1024;
    }
    
    return round($size, $precision) . ' ' . $units[$i];
}

/**
 * Main execution function
 */
function main() {
    global $options, $scriptStartTime, $notesRoot;
    
    try {
        logMessage("=== CRON VERSIONING START ===");
        logMessage("Options: " . json_encode($options));
        logMessage("Notes root: {$notesRoot}");
        
        if ($options['dry-run']) {
            logMessage("DRY RUN MODE - No changes will be made");
        }
        
        // Slow mode for testing
        if ($options['slow-mode']) {
            logMessage("Slow mode enabled, adding delays");
            sleep(2);
        }
        
        // Initialize versioning logic
        $versioningLogic = new CoreVersioningLogic($notesRoot);
        logMessage("Initialized versioning logic");
        
        // Get all notes
        $allNotes = getAllNotes();
        $noteCount = count($allNotes);
        logMessage("Found {$noteCount} notes to process");
        
        if ($noteCount === 0) {
            logMessage("No notes found, continuing with statistics and cleanup");
        }
        
        // Process notes for versioning
        $statistics = [
            'processed' => 0,
            'created' => 0,
            'skipped' => 0,
            'errors' => 0,
            'total_size' => 0
        ];
        
        if ($noteCount > 0) {
            if (!$options['dry-run']) {
                $results = $versioningLogic->processNotesForVersioning($allNotes);
                
                foreach ($results as $noteId => $result) {
                    $statistics['processed']++;
                    
                    if ($result['success']) {
                        if ($result['action'] === 'created') {
                            $statistics['created']++;
                            logMessage("Created version for note: {$noteId}");
                        } else {
                            $statistics['skipped']++;
                            logMessage("Skipped unchanged note: {$noteId}", 'DEBUG');
                        }
                    } else {
                        $statistics['errors']++;
                        logMessage("Error processing {$noteId}: " . $result['message'], 'ERROR');
                    }
                }
            } else {
                // Dry run - just detect changes
                foreach ($allNotes as $noteId => $noteData) {
                    $statistics['processed']++;
                    
                    if ($versioningLogic->hasNoteChanged($noteId, $noteData)) {
                        $statistics['created']++;
                        logMessage("Would create version for: {$noteId}");
                    } else {
                        $statistics['skipped']++;
                        logMessage("Would skip unchanged: {$noteId}");
                    }
                }
            }
        }
        
        // Get storage statistics
        $storageStats = $versioningLogic->getVersioningStatistics();
        $statistics['total_size'] = $storageStats['totalSize'] ?? 0;
        
        // Cleanup old versions whenever changes are detected or manually requested
        $cleanupCount = 0;
        if ($options['cleanup'] || $statistics['created'] > 0) { // Run cleanup when versions are created
            logMessage("Starting cleanup of old versions");
            
            if (!$options['dry-run']) {
                $cleanupCount = $versioningLogic->cleanupOldVersions(24); // 24 hours retention
                logMessage("Cleanup completed: removed {$cleanupCount} old versions");
            } else {
                logMessage("Would cleanup old versions (dry run)");
            }
        }
        
        // Log final statistics
        logMessage("Statistics:");
        logMessage("  Processed notes: {$statistics['processed']}");
        logMessage("  Created versions: {$statistics['created']}");
        logMessage("  Skipped unchanged: {$statistics['skipped']}");
        logMessage("  Errors: {$statistics['errors']}");
        logMessage("  Total storage size: " . formatBytes($statistics['total_size']));
        
        if ($cleanupCount > 0) {
            logMessage("  Cleaned up versions: {$cleanupCount}");
        }
        
        // Performance metrics
        $executionTime = microtime(true) - $scriptStartTime;
        $memoryUsage = memory_get_usage(true);
        $peakMemory = memory_get_peak_usage(true);
        
        logMessage("Performance:");
        logMessage("  Execution time: " . round($executionTime, 3) . " seconds");
        logMessage("  Memory usage: " . formatBytes($memoryUsage));
        logMessage("  Peak memory: " . formatBytes($peakMemory));
        
        // Check for errors from versioning logic
        $errors = $versioningLogic->getLastErrors();
        if (!empty($errors)) {
            logMessage("Versioning system errors:");
            foreach ($errors as $error) {
                logMessage("  " . $error, 'ERROR');
            }
        }
        
        logMessage("=== CRON VERSIONING END ===");
        
        // Output summary for test mode
        if ($options['test-mode']) {
            echo "CRON EXECUTION COMPLETE\n";
            echo "Processed: {$statistics['processed']} notes\n";
            echo "Created: {$statistics['created']} versions\n";
            echo "Errors: {$statistics['errors']}\n";
            if ($cleanupCount > 0) {
                echo "Cleaned up: {$cleanupCount} old versions\n";
            }
        }
        
        // Return appropriate exit code
        if ($statistics['errors'] > 0) {
            exit(1); // Errors occurred
        } else {
            exit(0); // Success
        }
        
    } catch (Exception $e) {
        logMessage("Fatal error: " . $e->getMessage(), 'ERROR');
        logMessage("Stack trace: " . $e->getTraceAsString(), 'ERROR');
        exit(2); // Fatal error
    }
}

// Register shutdown function to clean up
register_shutdown_function(function() {
    removeLock();
    
    // Log any fatal errors
    $error = error_get_last();
    if ($error && in_array($error['type'], [E_ERROR, E_PARSE, E_CORE_ERROR, E_COMPILE_ERROR])) {
        logMessage("Fatal PHP error: " . $error['message'] . " in " . $error['file'] . " on line " . $error['line'], 'ERROR');
    }
});

// Set error handler
set_error_handler(function($severity, $message, $file, $line) {
    if (error_reporting() & $severity) {
        logMessage("PHP Error: {$message} in {$file} on line {$line}", 'ERROR');
    }
    return false; // Don't prevent normal error handling
});

// Main execution
try {
    // Check for existing lock
    checkLock();
    
    // Create lock file
    createLock();
    
    // Execute main function
    main();
    
} catch (Exception $e) {
    logMessage("Script execution failed: " . $e->getMessage(), 'ERROR');
    exit(2);
}
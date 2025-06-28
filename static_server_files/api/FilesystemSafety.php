<?php

/**
 * FilesystemSafety - Comprehensive error handling and safety measures for filesystem operations
 * 
 * This class provides robust filesystem operations with:
 * - Comprehensive error handling for all filesystem operations
 * - File locking mechanisms for concurrent access safety
 * - Validation for file integrity and recovery procedures
 * - Logging for debugging filesystem issues
 * - Atomic operations and backup/recovery mechanisms
 */
class FilesystemSafety
{
    private string $notesPath;
    private array $errors = [];
    private array $lockHandles = [];
    
    public function __construct(string $notesPath = null)
    {
        $this->notesPath = $notesPath ?? realpath(__DIR__ . '/../../notes');
    }

    /**
     * Safe file write with comprehensive error handling
     */
    public function safeFileWrite(string $filePath, string $content, bool $useLocking = false): bool
    {
        try {
            // Validate directory permissions
            $directory = dirname($filePath);
            if (!$this->validateDirectoryPermissions($directory)) {
                $this->addError("Permission denied: Cannot write to directory {$directory}");
                return false;
            }
            
            // Check disk space
            if (!$this->checkDiskSpace($directory, strlen($content))) {
                $this->addError("Insufficient disk space for write operation");
                return false;
            }
            
            // Create directory if it doesn't exist
            if (!is_dir($directory)) {
                if (!mkdir($directory, 0755, true)) {
                    $this->addError("Failed to create directory: {$directory}");
                    return false;
                }
            }
            
            $flags = 0;
            if ($useLocking) {
                $flags |= LOCK_EX;
            }
            
            $result = file_put_contents($filePath, $content, $flags);
            
            if ($result === false) {
                // Check if it's likely a permission issue
                if (file_exists($filePath) && !is_writable($filePath)) {
                    $this->addError("Permission denied: File is not writable: {$filePath}");
                } elseif (!is_writable(dirname($filePath))) {
                    $this->addError("Permission denied: Directory is not writable: " . dirname($filePath));
                } else {
                    $this->addError("Failed to write file: {$filePath}");
                }
                return false;
            }
            
            return true;
            
        } catch (Exception $e) {
            $this->addError("Exception during file write: " . $e->getMessage());
            return false;
        }
    }

    /**
     * Atomic file write using temporary file and rename
     */
    public function atomicFileWrite(string $filePath, string $content): bool
    {
        try {
            $tempPath = $filePath . '.tmp.' . uniqid();
            
            // Write to temporary file first
            if (!$this->safeFileWrite($tempPath, $content, true)) {
                return false;
            }
            
            // Atomic rename operation
            if (!rename($tempPath, $filePath)) {
                $this->addError("Failed to rename temporary file to final destination");
                unlink($tempPath); // Clean up temp file
                return false;
            }
            
            return true;
            
        } catch (Exception $e) {
            $this->addError("Exception during atomic write: " . $e->getMessage());
            // Clean up temp file if it exists
            if (isset($tempPath) && file_exists($tempPath)) {
                unlink($tempPath);
            }
            return false;
        }
    }

    /**
     * Safe file write with retry mechanism
     */
    public function safeFileWriteWithRetry(string $filePath, string $content, int $maxRetries = 3): bool
    {
        $attempt = 0;
        
        while ($attempt < $maxRetries) {
            if ($this->safeFileWrite($filePath, $content, true)) {
                return true;
            }
            
            $attempt++;
            if ($attempt < $maxRetries) {
                // Wait before retry (exponential backoff)
                usleep(pow(2, $attempt) * 100000); // 200ms, 400ms, 800ms
            }
        }
        
        $this->addError("Failed to write file after {$maxRetries} attempts");
        return false;
    }

    /**
     * Validate file integrity
     */
    public function validateFileIntegrity(string $filePath, string $format = 'json'): bool
    {
        try {
            if (!file_exists($filePath)) {
                return false;
            }
            
            if (!is_readable($filePath)) {
                return false;
            }
            
            $content = file_get_contents($filePath);
            if ($content === false) {
                return false;
            }
            
            switch ($format) {
                case 'json':
                    $decoded = json_decode($content, true);
                    return $decoded !== null && json_last_error() === JSON_ERROR_NONE;
                    
                case 'text':
                    // Basic text validation - check for null bytes or other binary data
                    return mb_check_encoding($content, 'UTF-8');
                    
                default:
                    return true; // Unknown format, assume valid
            }
            
        } catch (Exception $e) {
            $this->addError("Exception during file validation: " . $e->getMessage());
            return false;
        }
    }

    /**
     * Create backup before write operation
     */
    public function createBackupBeforeWrite(string $filePath): string|false
    {
        try {
            if (!file_exists($filePath)) {
                return false;
            }
            
            $backupPath = $filePath . '.backup.' . date('Y-m-d-H-i-s');
            
            if (!copy($filePath, $backupPath)) {
                $this->addError("Failed to create backup: {$backupPath}");
                return false;
            }
            
            return $backupPath;
            
        } catch (Exception $e) {
            $this->addError("Exception during backup creation: " . $e->getMessage());
            return false;
        }
    }

    /**
     * Recover from backup file
     */
    public function recoverFromBackup(string $filePath, string $backupPath): bool
    {
        try {
            if (!file_exists($backupPath)) {
                $this->addError("Backup file does not exist: {$backupPath}");
                return false;
            }
            
            if (!copy($backupPath, $filePath)) {
                $this->addError("Failed to restore from backup: {$backupPath}");
                return false;
            }
            
            return true;
            
        } catch (Exception $e) {
            $this->addError("Exception during backup recovery: " . $e->getMessage());
            return false;
        }
    }

    /**
     * Detect and recover from file corruption
     */
    public function detectAndRecoverCorruption(string $filePath): bool
    {
        try {
            // Check if file is corrupted
            if ($this->validateFileIntegrity($filePath, 'json')) {
                return true; // File is not corrupted
            }
            
            // Look for backup files
            $backupPattern = $filePath . '.backup.*';
            $backupFiles = glob($backupPattern);
            
            if (empty($backupFiles)) {
                $this->addError("No backup files found for corruption recovery");
                return false;
            }
            
            // Sort backup files by modification time (newest first)
            usort($backupFiles, function($a, $b) {
                return filemtime($b) - filemtime($a);
            });
            
            // Try to recover from the newest valid backup
            foreach ($backupFiles as $backupFile) {
                if ($this->validateFileIntegrity($backupFile, 'json')) {
                    if ($this->recoverFromBackup($filePath, $backupFile)) {
                        return true;
                    }
                }
            }
            
            $this->addError("Failed to recover from any backup file");
            return false;
            
        } catch (Exception $e) {
            $this->addError("Exception during corruption recovery: " . $e->getMessage());
            return false;
        }
    }

    /**
     * Acquire file lock for concurrent access safety
     */
    public function acquireFileLock(string $filePath, bool $blocking = true): mixed
    {
        try {
            $lockFile = $filePath . '.lock';
            $handle = fopen($lockFile, 'c+');
            
            if ($handle === false) {
                $this->addError("Failed to open lock file: {$lockFile}");
                return false;
            }
            
            $flags = LOCK_EX;
            if (!$blocking) {
                $flags |= LOCK_NB;
            }
            
            if (flock($handle, $flags)) {
                $this->lockHandles[$lockFile] = $handle;
                return $handle;
            } else {
                fclose($handle);
                if (!$blocking) {
                    // Non-blocking mode - lock not available
                    return false;
                }
                $this->addError("Failed to acquire lock: {$lockFile}");
                return false;
            }
            
        } catch (Exception $e) {
            $this->addError("Exception during lock acquisition: " . $e->getMessage());
            return false;
        }
    }

    /**
     * Release file lock
     */
    public function releaseFileLock($lockHandle): bool
    {
        try {
            if (!is_resource($lockHandle)) {
                return false;
            }
            
            $released = flock($lockHandle, LOCK_UN);
            fclose($lockHandle);
            
            // Remove from our tracking
            foreach ($this->lockHandles as $lockFile => $handle) {
                if ($handle === $lockHandle) {
                    unset($this->lockHandles[$lockFile]);
                    // Clean up lock file
                    if (file_exists($lockFile)) {
                        unlink($lockFile);
                    }
                    break;
                }
            }
            
            return $released;
            
        } catch (Exception $e) {
            $this->addError("Exception during lock release: " . $e->getMessage());
            return false;
        }
    }

    /**
     * Check available disk space
     */
    public function checkDiskSpace(string $directory, int $requiredBytes): bool
    {
        try {
            $freeBytes = disk_free_space($directory);
            
            if ($freeBytes === false) {
                $this->addError("Unable to determine disk space for: {$directory}");
                return false;
            }
            
            // Add 10% buffer for safety
            $requiredWithBuffer = $requiredBytes * 1.1;
            
            return $freeBytes >= $requiredWithBuffer;
            
        } catch (Exception $e) {
            $this->addError("Exception during disk space check: " . $e->getMessage());
            return false;
        }
    }

    /**
     * Validate directory permissions
     */
    public function validateDirectoryPermissions(string $directory): bool
    {
        try {
            if (!is_dir($directory)) {
                // Check if we can create the directory
                $parentDir = dirname($directory);
                return is_dir($parentDir) && is_writable($parentDir);
            }
            
            return is_writable($directory);
            
        } catch (Exception $e) {
            $this->addError("Exception during permission validation: " . $e->getMessage());
            return false;
        }
    }

    /**
     * Calculate file checksum for integrity verification
     */
    public function calculateFileChecksum(string $filePath): string|false
    {
        try {
            if (!file_exists($filePath)) {
                return false;
            }
            
            return hash_file('sha256', $filePath);
            
        } catch (Exception $e) {
            $this->addError("Exception during checksum calculation: " . $e->getMessage());
            return false;
        }
    }

    /**
     * Validate file against checksum
     */
    public function validateFileChecksum(string $filePath, string $expectedChecksum): bool
    {
        $actualChecksum = $this->calculateFileChecksum($filePath);
        
        if ($actualChecksum === false) {
            return false;
        }
        
        return hash_equals($expectedChecksum, $actualChecksum);
    }

    /**
     * Clean up temporary files
     */
    public function cleanupTemporaryFiles(string $directory, int $maxAge = 3600): int
    {
        $cleanedCount = 0;
        $cutoffTime = time() - $maxAge;
        
        try {
            $pattern = $directory . '/*.tmp';
            $tempFiles = glob($pattern);
            
            foreach ($tempFiles as $tempFile) {
                $fileTime = filemtime($tempFile);
                
                if ($fileTime !== false && $fileTime < $cutoffTime) {
                    if (unlink($tempFile)) {
                        $cleanedCount++;
                    }
                }
            }
            
        } catch (Exception $e) {
            $this->addError("Exception during temporary file cleanup: " . $e->getMessage());
        }
        
        return $cleanedCount;
    }

    /**
     * Add error to log
     */
    private function addError(string $error): void
    {
        $this->errors[] = date('Y-m-d H:i:s') . ': ' . $error;
    }

    /**
     * Get last errors
     */
    public function getLastErrors(): array
    {
        return $this->errors;
    }

    /**
     * Clear error log
     */
    public function clearErrors(): void
    {
        $this->errors = [];
    }

    /**
     * Get notes path
     */
    public function getNotesPath(): string
    {
        return $this->notesPath;
    }

    /**
     * Destructor - clean up any remaining locks
     */
    public function __destruct()
    {
        foreach ($this->lockHandles as $lockFile => $handle) {
            if (is_resource($handle)) {
                flock($handle, LOCK_UN);
                fclose($handle);
                if (file_exists($lockFile)) {
                    unlink($lockFile);
                }
            }
        }
    }
}
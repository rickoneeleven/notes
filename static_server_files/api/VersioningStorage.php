<?php

require_once __DIR__ . '/FilesystemSafety.php';

/**
 * VersioningStorage - Handles file system operations for note version storage
 * 
 * This class manages the creation and organization of note versions including:
 * - Directory structure creation and management
 * - Version file naming conventions
 * - Path generation and sanitization
 * - Enhanced filesystem operations with safety measures
 */
class VersioningStorage
{
    private string $notesPath;
    private string $versionsPath;
    private FilesystemSafety $safety;
    
    public function __construct(string $notesPath = null)
    {
        $this->notesPath = $notesPath ?? realpath(__DIR__ . '/../../notes');
        $this->versionsPath = $this->notesPath . '/versions';
        $this->safety = new FilesystemSafety($this->notesPath);
    }

    /**
     * Create version directory for a specific note
     */
    public function createVersionDirectory(string $noteId): bool
    {
        $sanitizedNoteId = $this->sanitizeNoteId($noteId);
        $versionDir = $this->versionsPath . '/' . $sanitizedNoteId;
        
        if (!is_dir($this->versionsPath)) {
            if (!mkdir($this->versionsPath, 0755, true)) {
                return false;
            }
        }
        
        if (!is_dir($versionDir)) {
            return mkdir($versionDir, 0755, true);
        }
        
        return true;
    }

    /**
     * Generate version filename using timestamp
     */
    public function generateVersionFilename(int $timestamp = null): string
    {
        $timestamp = $timestamp ?? time();
        return date('Y-m-d-H-i-s', $timestamp) . '.json';
    }

    /**
     * Generate full path for a version file
     */
    public function generateVersionPath(string $noteId, int $timestamp = null): string
    {
        $sanitizedNoteId = $this->sanitizeNoteId($noteId);
        $filename = $this->generateVersionFilename($timestamp);
        return $this->versionsPath . '/' . $sanitizedNoteId . '/' . $filename;
    }

    /**
     * Get version directory path for a note
     */
    public function getVersionDirectoryPath(string $noteId): string
    {
        $sanitizedNoteId = $this->sanitizeNoteId($noteId);
        return $this->versionsPath . '/' . $sanitizedNoteId;
    }

    /**
     * Check if version directory exists for a note
     */
    public function versionDirectoryExists(string $noteId): bool
    {
        $versionDir = $this->getVersionDirectoryPath($noteId);
        return is_dir($versionDir);
    }

    /**
     * Create a version file with content using enhanced safety measures
     */
    public function createVersionFile(string $noteId, array $content, int $timestamp = null): string|false
    {
        if (!$this->createVersionDirectory($noteId)) {
            return false;
        }
        
        $versionPath = $this->generateVersionPath($noteId, $timestamp);
        $jsonContent = json_encode($content, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE);
        
        if ($jsonContent === false) {
            return false;
        }
        
        // Create backup if file exists
        if (file_exists($versionPath)) {
            $this->safety->createBackupBeforeWrite($versionPath);
        }
        
        // Use atomic write for safety
        $result = $this->safety->atomicFileWrite($versionPath, $jsonContent);
        return $result ? $versionPath : false;
    }

    /**
     * Get list of version files for a note
     */
    public function getVersionFiles(string $noteId): array
    {
        $versionDir = $this->getVersionDirectoryPath($noteId);
        
        if (!is_dir($versionDir)) {
            return [];
        }
        
        $files = scandir($versionDir);
        if ($files === false) {
            return [];
        }
        
        $versionFiles = array_filter($files, function($file) {
            return $file !== '.' && $file !== '..' && str_ends_with($file, '.json');
        });
        
        sort($versionFiles);
        return array_values($versionFiles);
    }

    /**
     * Get version file content
     */
    public function getVersionContent(string $noteId, string $filename): array|false
    {
        $versionDir = $this->getVersionDirectoryPath($noteId);
        $filePath = $versionDir . '/' . $filename;
        
        if (!file_exists($filePath)) {
            return false;
        }
        
        $content = file_get_contents($filePath);
        if ($content === false) {
            return false;
        }
        
        $decodedContent = json_decode($content, true);
        return $decodedContent !== null ? $decodedContent : false;
    }

    /**
     * Delete version files older than specified hours
     */
    public function cleanupOldVersions(int $maxAgeHours = 24): int
    {
        $deletedCount = 0;
        $cutoffTime = time() - ($maxAgeHours * 3600);
        
        if (!is_dir($this->versionsPath)) {
            return 0;
        }
        
        $noteDirs = scandir($this->versionsPath);
        if ($noteDirs === false) {
            return 0;
        }
        
        foreach ($noteDirs as $noteDir) {
            if ($noteDir === '.' || $noteDir === '..') {
                continue;
            }
            
            $noteDirPath = $this->versionsPath . '/' . $noteDir;
            if (!is_dir($noteDirPath)) {
                continue;
            }
            
            $versionFiles = $this->getVersionFiles($noteDir);
            foreach ($versionFiles as $filename) {
                $filePath = $noteDirPath . '/' . $filename;
                $fileTime = filemtime($filePath);
                
                if ($fileTime !== false && $fileTime < $cutoffTime) {
                    if (unlink($filePath)) {
                        $deletedCount++;
                    }
                }
            }
        }
        
        return $deletedCount;
    }

    /**
     * Sanitize note ID for safe filesystem usage
     */
    private function sanitizeNoteId(string $noteId): string
    {
        return preg_replace('/[^a-zA-Z0-9_-]/', '_', $noteId);
    }

    /**
     * Get versions root path
     */
    public function getVersionsPath(): string
    {
        return $this->versionsPath;
    }

    /**
     * Get notes root path
     */
    public function getNotesPath(): string
    {
        return $this->notesPath;
    }

    /**
     * Get filesystem safety instance for advanced operations
     */
    public function getFilesystemSafety(): FilesystemSafety
    {
        return $this->safety;
    }

    /**
     * Get last filesystem errors
     */
    public function getLastErrors(): array
    {
        return $this->safety->getLastErrors();
    }
}
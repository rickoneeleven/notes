<?php

require_once __DIR__ . '/VersioningStorage.php';

/**
 * VersionFileManager - High-level utilities for managing version files
 * 
 * This class provides comprehensive functionality for version file management:
 * - Creating version files with proper content serialization
 * - Retrieving specific versions by timestamp or index
 * - Organizing versions chronologically
 * - Version file validation and metadata extraction
 * - Cleanup and maintenance operations
 */
class VersionFileManager
{
    private VersioningStorage $storage;
    private string $notesPath;
    
    public function __construct(string $notesPath = null)
    {
        $this->notesPath = $notesPath ?? realpath(__DIR__ . '/../../notes');
        $this->storage = new VersioningStorage($this->notesPath);
    }

    /**
     * Create a version file with content serialization
     */
    public function createVersionFile(string $noteId, array $content, int $timestamp = null): string|false
    {
        return $this->storage->createVersionFile($noteId, $content, $timestamp);
    }

    /**
     * Get version content by note ID and filename
     */
    public function getVersionContent(string $noteId, string $filename): array|false
    {
        return $this->storage->getVersionContent($noteId, $filename);
    }

    /**
     * Get all versions for a note ID, ordered chronologically (oldest first)
     */
    public function getVersionsByNoteId(string $noteId): array
    {
        $versions = $this->storage->getVersionFiles($noteId);
        sort($versions); // Chronological order (filename contains timestamp)
        return $versions;
    }

    /**
     * Get version content by specific timestamp
     */
    public function getVersionByTimestamp(string $noteId, int $timestamp): array|false
    {
        $targetFilename = $this->storage->generateVersionFilename($timestamp);
        return $this->getVersionContent($noteId, $targetFilename);
    }

    /**
     * Get version by index (0 = oldest, -1 = newest)
     */
    public function getVersionByIndex(string $noteId, int $index): array|false
    {
        $versions = $this->getVersionsByNoteId($noteId);
        
        if (empty($versions)) {
            return false;
        }
        
        // Handle negative indices (from end)
        if ($index < 0) {
            $index = count($versions) + $index;
        }
        
        if (!isset($versions[$index])) {
            return false;
        }
        
        return $this->getVersionContent($noteId, $versions[$index]);
    }

    /**
     * Get the latest version for a note
     */
    public function getLatestVersion(string $noteId): array|false
    {
        return $this->getVersionByIndex($noteId, -1);
    }

    /**
     * Get metadata for a specific version file
     */
    public function getVersionMetadata(string $noteId, string $filename): array|false
    {
        $versionDir = $this->storage->getVersionDirectoryPath($noteId);
        $filePath = $versionDir . '/' . $filename;
        
        if (!file_exists($filePath)) {
            return false;
        }
        
        $fileStats = stat($filePath);
        if ($fileStats === false) {
            return false;
        }
        
        // Extract timestamp from filename
        $timestamp = $this->extractTimestampFromFilename($filename);
        
        return [
            'filename' => $filename,
            'timestamp' => $timestamp,
            'size' => $fileStats['size'],
            'created' => $fileStats['ctime'],
            'modified' => $fileStats['mtime'],
            'readable' => is_readable($filePath),
            'writable' => is_writable($filePath)
        ];
    }

    /**
     * Validate that a version file exists and is readable
     */
    public function validateVersionFile(string $noteId, string $filename): bool
    {
        $versionDir = $this->storage->getVersionDirectoryPath($noteId);
        $filePath = $versionDir . '/' . $filename;
        
        if (!file_exists($filePath)) {
            return false;
        }
        
        if (!is_readable($filePath)) {
            return false;
        }
        
        // Verify it's a valid JSON file
        $content = file_get_contents($filePath);
        if ($content === false) {
            return false;
        }
        
        $decoded = json_decode($content, true);
        return $decoded !== null;
    }

    /**
     * Delete a specific version file
     */
    public function deleteVersionFile(string $noteId, string $filename): bool
    {
        $versionDir = $this->storage->getVersionDirectoryPath($noteId);
        $filePath = $versionDir . '/' . $filename;
        
        if (!file_exists($filePath)) {
            return false;
        }
        
        return unlink($filePath);
    }

    /**
     * Get the count of versions for a note
     */
    public function getVersionCount(string $noteId): int
    {
        $versions = $this->getVersionsByNoteId($noteId);
        return count($versions);
    }

    /**
     * Cleanup versions older than specified hours for a specific note
     */
    public function cleanupVersionsOlderThan(string $noteId, int $maxAgeHours): int
    {
        $deletedCount = 0;
        $cutoffTime = time() - ($maxAgeHours * 3600);
        
        $versionDir = $this->storage->getVersionDirectoryPath($noteId);
        if (!is_dir($versionDir)) {
            return 0;
        }
        
        $versions = $this->getVersionsByNoteId($noteId);
        
        foreach ($versions as $filename) {
            $filePath = $versionDir . '/' . $filename;
            $fileTime = filemtime($filePath);
            
            if ($fileTime !== false && $fileTime < $cutoffTime) {
                if (unlink($filePath)) {
                    $deletedCount++;
                }
            }
        }
        
        return $deletedCount;
    }

    /**
     * Get all versions across all notes (for global operations)
     */
    public function getAllVersions(): array
    {
        $allVersions = [];
        $versionsPath = $this->storage->getVersionsPath();
        
        if (!is_dir($versionsPath)) {
            return [];
        }
        
        $noteDirs = scandir($versionsPath);
        if ($noteDirs === false) {
            return [];
        }
        
        foreach ($noteDirs as $noteDir) {
            if ($noteDir === '.' || $noteDir === '..') {
                continue;
            }
            
            $noteDirPath = $versionsPath . '/' . $noteDir;
            if (!is_dir($noteDirPath)) {
                continue;
            }
            
            $versions = $this->getVersionsByNoteId($noteDir);
            foreach ($versions as $version) {
                $allVersions[] = [
                    'noteId' => $noteDir,
                    'filename' => $version,
                    'path' => $noteDirPath . '/' . $version
                ];
            }
        }
        
        return $allVersions;
    }

    /**
     * Get storage statistics
     */
    public function getStorageStatistics(): array
    {
        $stats = [
            'totalNotes' => 0,
            'totalVersions' => 0,
            'totalSize' => 0,
            'oldestVersion' => null,
            'newestVersion' => null
        ];
        
        $allVersions = $this->getAllVersions();
        $stats['totalVersions'] = count($allVersions);
        
        $noteIds = [];
        $timestamps = [];
        
        foreach ($allVersions as $version) {
            $noteIds[$version['noteId']] = true;
            
            if (file_exists($version['path'])) {
                $stats['totalSize'] += filesize($version['path']);
                $timestamp = $this->extractTimestampFromFilename($version['filename']);
                if ($timestamp) {
                    $timestamps[] = $timestamp;
                }
            }
        }
        
        $stats['totalNotes'] = count($noteIds);
        
        if (!empty($timestamps)) {
            sort($timestamps);
            $stats['oldestVersion'] = $timestamps[0];
            $stats['newestVersion'] = end($timestamps);
        }
        
        return $stats;
    }

    /**
     * Extract timestamp from version filename
     */
    private function extractTimestampFromFilename(string $filename): int|false
    {
        // Remove .json extension
        $nameWithoutExt = str_replace('.json', '', $filename);
        
        // Parse YYYY-MM-DD-HH-MM-SS format
        if (preg_match('/^(\d{4})-(\d{2})-(\d{2})-(\d{2})-(\d{2})-(\d{2})$/', $nameWithoutExt, $matches)) {
            $year = (int)$matches[1];
            $month = (int)$matches[2];
            $day = (int)$matches[3];
            $hour = (int)$matches[4];
            $minute = (int)$matches[5];
            $second = (int)$matches[6];
            
            return mktime($hour, $minute, $second, $month, $day, $year);
        }
        
        return false;
    }

    /**
     * Get the underlying storage instance
     */
    public function getStorage(): VersioningStorage
    {
        return $this->storage;
    }

    /**
     * Get notes path
     */
    public function getNotesPath(): string
    {
        return $this->notesPath;
    }
}
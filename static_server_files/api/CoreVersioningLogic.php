<?php

require_once __DIR__ . '/VersioningStorage.php';
require_once __DIR__ . '/VersionFileManager.php';
require_once __DIR__ . '/SnapshotState.php';
require_once __DIR__ . '/FilesystemSafety.php';

/**
 * CoreVersioningLogic - Main versioning engine that orchestrates all versioning operations
 * 
 * This class implements the core algorithms for:
 * - Detecting note changes through content hashing
 * - Creating version snapshots with full note data
 * - Managing version lifecycle and cleanup
 * - Coordinating between storage, state management, and safety systems
 * - Providing high-level versioning operations for the application
 */
class CoreVersioningLogic
{
    private string $notesPath;
    private VersioningStorage $storage;
    private VersionFileManager $fileManager;
    private SnapshotState $snapshotState;
    private FilesystemSafety $safety;
    private array $errors = [];
    
    public function __construct(string $notesPath = null)
    {
        $this->notesPath = $notesPath ?? realpath(__DIR__ . '/../../notes');
        $this->storage = new VersioningStorage($this->notesPath);
        $this->fileManager = new VersionFileManager($this->notesPath);
        $this->snapshotState = new SnapshotState($this->notesPath);
        $this->safety = new FilesystemSafety($this->notesPath);
    }

    /**
     * Detect if a note has changed since last version
     */
    public function hasNoteChanged(string $noteId, array $noteData): bool
    {
        try {
            $currentHash = $this->generateContentHash($noteData);
            return $this->snapshotState->hasNoteChanged($noteId, $currentHash);
        } catch (Exception $e) {
            $this->addError("Error detecting note changes for {$noteId}: " . $e->getMessage());
            return true; // Assume changed to be safe
        }
    }

    /**
     * Create a version snapshot of a note
     */
    public function createVersionSnapshot(string $noteId, array $noteData, int $timestamp = null): bool
    {
        try {
            $timestamp = $timestamp ?? time();
            $contentHash = $this->generateContentHash($noteData);
            
            // Prepare version data with metadata
            $versionData = $noteData;
            $versionData['versionInfo'] = [
                'timestamp' => $timestamp,
                'hash' => $contentHash,
                'created' => date('Y-m-d H:i:s', $timestamp),
                'originalModified' => $noteData['modified'] ?? date('Y-m-d H:i:s', $timestamp)
            ];
            
            // Create version file
            $versionPath = $this->fileManager->createVersionFile($noteId, $versionData, $timestamp);
            if ($versionPath === false) {
                $this->addError("Failed to create version file for note {$noteId}");
                return false;
            }
            
            // Update snapshot state
            $state = $this->snapshotState->updateNoteInState($noteId, $contentHash, date('Y-m-d H:i:s', $timestamp));
            
            // Update metadata to track total versions
            $state['metadata']['totalVersions'] = ($state['metadata']['totalVersions'] ?? 0) + 1;
            
            $success = $this->snapshotState->writeSnapshotState($state);
            
            if (!$success) {
                $this->addError("Failed to update snapshot state for note {$noteId}");
                return false;
            }
            
            return true;
            
        } catch (Exception $e) {
            $this->addError("Exception creating version snapshot for {$noteId}: " . $e->getMessage());
            return false;
        }
    }

    /**
     * Generate consistent content hash for note data
     */
    public function generateContentHash(array $noteData): string
    {
        // Extract hashable content (exclude non-content fields)
        $hashableData = [
            'title' => $noteData['title'] ?? '',
            'content' => $noteData['content'] ?? '',
            'folder' => $noteData['folder'] ?? '',
            'metadata' => $noteData['metadata'] ?? []
        ];
        
        // Sort to ensure consistent ordering
        ksort($hashableData);
        if (is_array($hashableData['metadata'])) {
            ksort($hashableData['metadata']);
        }
        
        $jsonString = json_encode($hashableData, JSON_UNESCAPED_UNICODE);
        return hash('sha256', $jsonString);
    }

    /**
     * Get version history for a note
     */
    public function getVersionHistory(string $noteId): array
    {
        return $this->fileManager->getVersionsByNoteId($noteId);
    }

    /**
     * Get content of a specific version
     */
    public function getVersionContent(string $noteId, string $versionFilename): array|false
    {
        return $this->fileManager->getVersionContent($noteId, $versionFilename);
    }

    /**
     * Get current snapshot state
     */
    public function getSnapshotState(): array
    {
        return $this->snapshotState->readSnapshotState();
    }

    /**
     * Process multiple notes for versioning (batch operation)
     */
    public function processNotesForVersioning(array $notes): array
    {
        $results = [];
        
        foreach ($notes as $noteId => $noteData) {
            try {
                $hasChanged = $this->hasNoteChanged($noteId, $noteData);
                
                if ($hasChanged) {
                    $success = $this->createVersionSnapshot($noteId, $noteData);
                    $results[$noteId] = [
                        'success' => $success,
                        'action' => 'created',
                        'message' => $success ? 'Version created successfully' : 'Failed to create version'
                    ];
                } else {
                    $results[$noteId] = [
                        'success' => true,
                        'action' => 'skipped',
                        'message' => 'No changes detected'
                    ];
                }
                
            } catch (Exception $e) {
                $results[$noteId] = [
                    'success' => false,
                    'action' => 'error',
                    'message' => $e->getMessage()
                ];
                $this->addError("Error processing note {$noteId}: " . $e->getMessage());
            }
        }
        
        return $results;
    }

    /**
     * Clean up old versions beyond retention period
     */
    public function cleanupOldVersions(int $maxAgeHours = 24): int
    {
        try {
            $totalCleaned = 0;
            $allVersions = $this->fileManager->getAllVersions();
            $cutoffTime = time() - ($maxAgeHours * 3600);
            
            foreach ($allVersions as $version) {
                $filePath = $version['path'];
                $fileTime = filemtime($filePath);
                
                if ($fileTime !== false && $fileTime < $cutoffTime) {
                    if (unlink($filePath)) {
                        $totalCleaned++;
                    }
                }
            }
            
            // Update snapshot state metadata
            if ($totalCleaned > 0) {
                $state = $this->snapshotState->updateMetadata(date('Y-m-d H:i:s'), -$totalCleaned);
                $this->snapshotState->writeSnapshotState($state);
            }
            
            return $totalCleaned;
            
        } catch (Exception $e) {
            $this->addError("Error during cleanup: " . $e->getMessage());
            return 0;
        }
    }

    /**
     * Get versioning statistics
     */
    public function getVersioningStatistics(): array
    {
        try {
            $stats = $this->fileManager->getStorageStatistics();
            $snapshotState = $this->getSnapshotState();
            
            return [
                'totalNotes' => count($snapshotState['notes']),
                'totalVersions' => $stats['totalVersions'],
                'totalSize' => $stats['totalSize'],
                'oldestVersion' => $stats['oldestVersion'],
                'newestVersion' => $stats['newestVersion'],
                'lastCleanup' => $snapshotState['metadata']['lastCleanup'] ?? null,
                'storageMetadata' => $snapshotState['metadata']
            ];
            
        } catch (Exception $e) {
            $this->addError("Error getting statistics: " . $e->getMessage());
            return [
                'totalNotes' => 0,
                'totalVersions' => 0,
                'totalSize' => 0,
                'error' => $e->getMessage()
            ];
        }
    }

    /**
     * Restore a note from a specific version
     */
    public function restoreNoteFromVersion(string $noteId, string $versionFilename): array|false
    {
        try {
            $versionContent = $this->getVersionContent($noteId, $versionFilename);
            
            if ($versionContent === false) {
                $this->addError("Version file not found: {$versionFilename} for note {$noteId}");
                return false;
            }
            
            // Remove version metadata to get original note data
            if (isset($versionContent['versionInfo'])) {
                unset($versionContent['versionInfo']);
            }
            
            return $versionContent;
            
        } catch (Exception $e) {
            $this->addError("Error restoring note from version: " . $e->getMessage());
            return false;
        }
    }

    /**
     * Get latest version of a note
     */
    public function getLatestVersion(string $noteId): array|false
    {
        return $this->fileManager->getLatestVersion($noteId);
    }

    /**
     * Get version by timestamp
     */
    public function getVersionByTimestamp(string $noteId, int $timestamp): array|false
    {
        return $this->fileManager->getVersionByTimestamp($noteId, $timestamp);
    }

    /**
     * Get version count for a note
     */
    public function getVersionCount(string $noteId): int
    {
        return $this->fileManager->getVersionCount($noteId);
    }

    /**
     * Validate version integrity
     */
    public function validateVersionIntegrity(string $noteId, string $versionFilename): bool
    {
        try {
            return $this->fileManager->validateVersionFile($noteId, $versionFilename);
        } catch (Exception $e) {
            $this->addError("Error validating version integrity: " . $e->getMessage());
            return false;
        }
    }

    /**
     * Force version creation (even if no changes detected)
     */
    public function forceCreateVersion(string $noteId, array $noteData, int $timestamp = null): bool
    {
        return $this->createVersionSnapshot($noteId, $noteData, $timestamp);
    }

    /**
     * Get notes that need versioning based on changes
     */
    public function getNotesNeedingVersioning(array $allNotes): array
    {
        $needsVersioning = [];
        
        foreach ($allNotes as $noteId => $noteData) {
            if ($this->hasNoteChanged($noteId, $noteData)) {
                $needsVersioning[$noteId] = $noteData;
            }
        }
        
        return $needsVersioning;
    }

    /**
     * Verify and repair snapshot state consistency
     */
    public function verifyAndRepairState(): array
    {
        $report = [
            'verified' => 0,
            'repaired' => 0,
            'errors' => []
        ];
        
        try {
            $state = $this->getSnapshotState();
            $allVersions = $this->fileManager->getAllVersions();
            
            // Group versions by note ID
            $versionsByNote = [];
            foreach ($allVersions as $version) {
                $versionsByNote[$version['noteId']][] = $version['filename'];
            }
            
            // Verify each note in state has corresponding version files
            foreach ($state['notes'] as $noteId => $noteState) {
                $report['verified']++;
                
                if (!isset($versionsByNote[$noteId])) {
                    // Note in state but no version files - remove from state
                    unset($state['notes'][$noteId]);
                    $report['repaired']++;
                    $report['errors'][] = "Removed orphaned note from state: {$noteId}";
                } else {
                    // Verify version count matches
                    $actualCount = count($versionsByNote[$noteId]);
                    if ($noteState['versionCount'] !== $actualCount) {
                        $state['notes'][$noteId]['versionCount'] = $actualCount;
                        $report['repaired']++;
                        $report['errors'][] = "Corrected version count for note {$noteId}: {$actualCount}";
                    }
                }
            }
            
            // Update metadata
            $state['metadata']['totalVersions'] = count($allVersions);
            $state['metadata']['lastVerification'] = date('Y-m-d H:i:s');
            
            // Save repaired state
            if ($report['repaired'] > 0) {
                $this->snapshotState->writeSnapshotState($state);
            }
            
        } catch (Exception $e) {
            $report['errors'][] = "Error during verification: " . $e->getMessage();
            $this->addError("State verification error: " . $e->getMessage());
        }
        
        return $report;
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
        return array_merge($this->errors, $this->safety->getLastErrors());
    }

    /**
     * Clear error log
     */
    public function clearErrors(): void
    {
        $this->errors = [];
        $this->safety->clearErrors();
    }

    /**
     * Get underlying components for advanced operations
     */
    public function getStorage(): VersioningStorage
    {
        return $this->storage;
    }

    public function getFileManager(): VersionFileManager
    {
        return $this->fileManager;
    }

    public function getSnapshotStateManager(): SnapshotState
    {
        return $this->snapshotState;
    }

    public function getFilesystemSafety(): FilesystemSafety
    {
        return $this->safety;
    }

    /**
     * Get notes path
     */
    public function getNotesPath(): string
    {
        return $this->notesPath;
    }
}
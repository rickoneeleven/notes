<?php

/**
 * SnapshotState - Manages snapshot_state.json for tracking note changes
 * 
 * This class handles the snapshot state functionality for the versioning system:
 * - Tracks note hashes to detect changes
 * - Manages version counts and timestamps
 * - Handles metadata for the versioning system
 * - Provides methods for reading/writing state file
 * - Includes error handling and recovery
 */
class SnapshotState
{
    private string $notesPath;
    private string $snapshotStatePath;
    
    public function __construct(string $notesPath = null)
    {
        $this->notesPath = $notesPath ?? realpath(__DIR__ . '/../../notes');
        $this->snapshotStatePath = $this->notesPath . '/versions/snapshot_state.json';
    }

    /**
     * Read snapshot state from file, return default state if not found
     */
    public function readSnapshotState(): array
    {
        if (!file_exists($this->snapshotStatePath)) {
            return $this->createDefaultState();
        }
        
        $content = file_get_contents($this->snapshotStatePath);
        if ($content === false) {
            return $this->createDefaultState();
        }
        
        $decoded = json_decode($content, true);
        if ($decoded === null) {
            return $this->createDefaultState();
        }
        
        if (!$this->validateSnapshotState($decoded)) {
            return $this->createDefaultState();
        }
        
        return $decoded;
    }

    /**
     * Write snapshot state to file
     */
    public function writeSnapshotState(array $state): bool
    {
        $versionsDir = dirname($this->snapshotStatePath);
        if (!is_dir($versionsDir)) {
            if (!mkdir($versionsDir, 0755, true)) {
                return false;
            }
        }
        
        $jsonContent = json_encode($state, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE);
        if ($jsonContent === false) {
            return false;
        }
        
        $result = file_put_contents($this->snapshotStatePath, $jsonContent, LOCK_EX);
        return $result !== false;
    }

    /**
     * Check if a note has changed by comparing hashes
     */
    public function hasNoteChanged(string $noteId, string $currentHash): bool
    {
        $state = $this->readSnapshotState();
        
        if (!isset($state['notes'][$noteId])) {
            return true; // New note
        }
        
        return $state['notes'][$noteId]['hash'] !== $currentHash;
    }

    /**
     * Update note information in snapshot state
     */
    public function updateNoteInState(string $noteId, string $hash, string $timestamp = null): array
    {
        $state = $this->readSnapshotState();
        $timestamp = $timestamp ?? date('Y-m-d H:i:s');
        
        if (isset($state['notes'][$noteId])) {
            $state['notes'][$noteId]['hash'] = $hash;
            $state['notes'][$noteId]['lastVersioned'] = $timestamp;
            $state['notes'][$noteId]['lastModified'] = $timestamp;
            $state['notes'][$noteId]['versionCount']++;
        } else {
            $state['notes'][$noteId] = [
                'hash' => $hash,
                'lastVersioned' => $timestamp,
                'versionCount' => 1,
                'lastModified' => $timestamp
            ];
        }
        
        return $state;
    }

    /**
     * Add new note to snapshot state
     */
    public function addNoteToState(string $noteId, string $hash, string $timestamp = null): array
    {
        $state = $this->readSnapshotState();
        $timestamp = $timestamp ?? date('Y-m-d H:i:s');
        
        $state['notes'][$noteId] = [
            'hash' => $hash,
            'lastVersioned' => $timestamp,
            'versionCount' => 1,
            'lastModified' => $timestamp
        ];
        
        return $state;
    }

    /**
     * Update metadata in snapshot state
     */
    public function updateMetadata(string $lastCleanup = null, int $addedVersions = 0): array
    {
        $state = $this->readSnapshotState();
        
        if ($lastCleanup !== null) {
            $state['metadata']['lastCleanup'] = $lastCleanup;
        }
        
        if ($addedVersions > 0) {
            $state['metadata']['totalVersions'] += $addedVersions;
        }
        
        return $state;
    }

    /**
     * Get note information from snapshot state
     */
    public function getNoteInfo(string $noteId): array|null
    {
        $state = $this->readSnapshotState();
        return $state['notes'][$noteId] ?? null;
    }

    /**
     * Remove note from snapshot state
     */
    public function removeNoteFromState(string $noteId): array
    {
        $state = $this->readSnapshotState();
        
        if (isset($state['notes'][$noteId])) {
            unset($state['notes'][$noteId]);
            $state['metadata']['totalVersions'] = max(0, $state['metadata']['totalVersions'] - 1);
        }
        
        return $state;
    }

    /**
     * Get all notes that need versioning (changed notes)
     */
    public function getNotesToVersion(array $currentNotes): array
    {
        $state = $this->readSnapshotState();
        $notesToVersion = [];
        
        foreach ($currentNotes as $noteId => $noteData) {
            $currentHash = $this->generateNoteHash($noteData);
            
            if ($this->hasNoteChanged($noteId, $currentHash)) {
                $notesToVersion[$noteId] = [
                    'hash' => $currentHash,
                    'data' => $noteData
                ];
            }
        }
        
        return $notesToVersion;
    }

    /**
     * Generate hash for note content
     */
    public function generateNoteHash(array $noteData): string
    {
        $hashData = [
            'title' => $noteData['title'] ?? '',
            'content' => $noteData['content'] ?? '',
            'modified' => $noteData['modified'] ?? ''
        ];
        
        return hash('sha256', json_encode($hashData, JSON_UNESCAPED_UNICODE));
    }

    /**
     * Validate snapshot state structure
     */
    private function validateSnapshotState(array $state): bool
    {
        if (!isset($state['notes']) || !isset($state['metadata'])) {
            return false;
        }
        
        if (!is_array($state['notes']) || !is_array($state['metadata'])) {
            return false;
        }
        
        return true;
    }

    /**
     * Create default snapshot state structure
     */
    private function createDefaultState(): array
    {
        return [
            'notes' => [],
            'metadata' => [
                'lastCleanup' => date('Y-m-d H:i:s'),
                'totalVersions' => 0,
                'schemaVersion' => '1.0'
            ]
        ];
    }

    /**
     * Get snapshot state file path
     */
    public function getSnapshotStatePath(): string
    {
        return $this->snapshotStatePath;
    }

    /**
     * Get notes root path
     */
    public function getNotesPath(): string
    {
        return $this->notesPath;
    }
}
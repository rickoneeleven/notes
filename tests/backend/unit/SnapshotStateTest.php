<?php

namespace Tests\Backend\Unit;

use Tests\Backend\BaseTestCase;
use Tests\Backend\Utilities\{MockFilesystem, TestHelper};

require_once PROJECT_ROOT . '/static_server_files/api/SnapshotState.php';

/**
 * Unit tests for snapshot_state.json functionality
 * Tests the schema, hash tracking, and state management for version snapshots
 */
class SnapshotStateTest extends BaseTestCase
{
    private MockFilesystem $mockFs;
    private \SnapshotState $snapshotState;

    protected function setUp(): void
    {
        parent::setUp();
        $this->mockFs = new MockFilesystem();
        $this->mockFs->createTestNoteStructure();
        $this->snapshotState = new \SnapshotState(TEST_NOTES_ROOT);
    }

    public function testSnapshotStateJsonSchema(): void
    {
        $expectedSchema = [
            'notes' => [
                'note_123' => [
                    'hash' => 'abc123def456',
                    'lastVersioned' => '2023-10-27 14:30:45',
                    'versionCount' => 3,
                    'lastModified' => '2023-10-27 14:32:10'
                ],
                'note_456' => [
                    'hash' => 'def789ghi012',
                    'lastVersioned' => '2023-10-27 13:15:30',
                    'versionCount' => 1,
                    'lastModified' => '2023-10-27 13:15:30'
                ]
            ],
            'metadata' => [
                'lastCleanup' => '2023-10-27 12:00:00',
                'totalVersions' => 4,
                'schemaVersion' => '1.0'
            ]
        ];

        $jsonContent = json_encode($expectedSchema, JSON_PRETTY_PRINT);
        $this->assertJson($jsonContent, 'Schema should produce valid JSON');
        
        $decodedSchema = json_decode($jsonContent, true);
        $this->assertEquals($expectedSchema, $decodedSchema, 'Schema should round-trip correctly');
        
        $this->assertArrayHasKey('notes', $decodedSchema, 'Schema should have notes section');
        $this->assertArrayHasKey('metadata', $decodedSchema, 'Schema should have metadata section');
    }

    public function testSnapshotStateCreation(): void
    {
        $snapshotStatePath = '/notes/versions/snapshot_state.json';
        
        $initialState = $this->createInitialSnapshotState();
        $result = $this->mockFs->filePutContents($snapshotStatePath, json_encode($initialState, JSON_PRETTY_PRINT));
        
        $this->assertNotFalse($result, 'Snapshot state file should be created');
        $this->assertTrue($this->mockFs->fileExists($snapshotStatePath), 'Snapshot state file should exist');
        
        $retrievedContent = $this->mockFs->fileGetContents($snapshotStatePath);
        $decodedState = json_decode($retrievedContent, true);
        
        $this->assertEquals($initialState, $decodedState, 'Snapshot state should be preserved');
    }

    public function testUpdateNoteHash(): void
    {
        $snapshotStatePath = '/notes/versions/snapshot_state.json';
        $initialState = $this->createInitialSnapshotState();
        
        $this->mockFs->filePutContents($snapshotStatePath, json_encode($initialState, JSON_PRETTY_PRINT));
        
        $noteId = 'note_123';
        $newHash = 'new_hash_value_xyz';
        $newTimestamp = '2023-10-27 15:00:00';
        
        $updatedState = $this->updateNoteInSnapshotState($initialState, $noteId, $newHash, $newTimestamp);
        
        $this->assertEquals($newHash, $updatedState['notes'][$noteId]['hash'], 'Note hash should be updated');
        $this->assertEquals($newTimestamp, $updatedState['notes'][$noteId]['lastVersioned'], 'Last versioned timestamp should be updated');
        $this->assertEquals(4, $updatedState['notes'][$noteId]['versionCount'], 'Version count should be incremented');
    }

    public function testAddNewNoteToSnapshotState(): void
    {
        $initialState = $this->createInitialSnapshotState();
        
        $newNoteId = 'note_789';
        $newNoteHash = 'new_note_hash_abc';
        $timestamp = '2023-10-27 16:00:00';
        
        $updatedState = $this->addNoteToSnapshotState($initialState, $newNoteId, $newNoteHash, $timestamp);
        
        $this->assertArrayHasKey($newNoteId, $updatedState['notes'], 'New note should be added to state');
        $this->assertEquals($newNoteHash, $updatedState['notes'][$newNoteId]['hash'], 'New note hash should be correct');
        $this->assertEquals(1, $updatedState['notes'][$newNoteId]['versionCount'], 'New note should start with version count 1');
        $this->assertEquals($timestamp, $updatedState['notes'][$newNoteId]['lastVersioned'], 'New note timestamp should be correct');
    }

    public function testSnapshotStateHashComparison(): void
    {
        $state = $this->createInitialSnapshotState();
        
        $noteId = 'note_123';
        $storedHash = $state['notes'][$noteId]['hash'];
        
        $sameHash = 'abc123def456';
        $differentHash = 'different_hash_value';
        
        $this->assertEquals($storedHash, $sameHash, 'Same hash should match stored hash');
        $this->assertNotEquals($storedHash, $differentHash, 'Different hash should not match stored hash');
        
        $hasChanged = $this->hasNoteChanged($state, $noteId, $differentHash);
        $hasNotChanged = $this->hasNoteChanged($state, $noteId, $sameHash);
        
        $this->assertTrue($hasChanged, 'Note should be detected as changed');
        $this->assertFalse($hasNotChanged, 'Note should not be detected as changed');
    }

    public function testSnapshotStateValidation(): void
    {
        $validState = $this->createInitialSnapshotState();
        $this->assertTrue($this->validateSnapshotState($validState), 'Valid state should pass validation');
        
        $invalidStates = [
            [], // Empty state - should fail
            ['notes' => []], // Missing metadata - should fail  
            ['metadata' => []], // Missing notes - should fail
            ['notes' => 'invalid', 'metadata' => []], // Invalid notes structure - should fail
        ];
        
        foreach ($invalidStates as $index => $invalidState) {
            $isValid = $this->validateSnapshotState($invalidState);
            $this->assertFalse($isValid, "Invalid state {$index} should fail validation");
        }
        
        // Extra fields should be OK
        $stateWithExtraFields = ['notes' => [], 'metadata' => [], 'extra' => 'field'];
        $this->assertTrue($this->validateSnapshotState($stateWithExtraFields), 'State with extra fields should be valid');
    }

    public function testMetadataUpdates(): void
    {
        $state = $this->createInitialSnapshotState();
        
        $originalTotalVersions = $state['metadata']['totalVersions'];
        $newCleanupTime = '2023-10-27 18:00:00';
        
        $updatedState = $this->updateSnapshotMetadata($state, $newCleanupTime, 2);
        
        $this->assertEquals($newCleanupTime, $updatedState['metadata']['lastCleanup'], 'Cleanup time should be updated');
        $this->assertEquals($originalTotalVersions + 2, $updatedState['metadata']['totalVersions'], 'Total versions should be incremented');
    }

    public function testSnapshotStateFileOperations(): void
    {
        $snapshotStatePath = $this->snapshotState->getSnapshotStatePath();
        
        // Clean up any existing state file for clean test
        if (file_exists($snapshotStatePath)) {
            unlink($snapshotStatePath);
        }
        
        $this->assertFalse(file_exists($snapshotStatePath), 'Snapshot state should not exist initially');
        
        // Create initial state using actual SnapshotState class
        $state = $this->snapshotState->readSnapshotState(); // This creates default state
        $result = $this->snapshotState->writeSnapshotState($state);
        
        $this->assertTrue($result, 'Writing snapshot state should succeed');
        $this->assertTrue(file_exists($snapshotStatePath), 'Snapshot state should exist after creation');
        
        $retrievedState = $this->snapshotState->readSnapshotState();
        $this->assertArrayHasKey('notes', $retrievedState, 'Retrieved state should have notes section');
        $this->assertArrayHasKey('metadata', $retrievedState, 'Retrieved state should have metadata section');
        
        // Test updating state through SnapshotState class
        $noteId = 'note_update_test';
        $hash = 'update_test_hash';
        $timestamp = date('Y-m-d H:i:s');
        
        $updatedState = $this->snapshotState->addNoteToState($noteId, $hash, $timestamp);
        $writeResult = $this->snapshotState->writeSnapshotState($updatedState);
        
        $this->assertTrue($writeResult, 'Writing updated state should succeed');
        
        $finalState = $this->snapshotState->readSnapshotState();
        $this->assertArrayHasKey($noteId, $finalState['notes'], 'Updated note should be in final state');
    }

    public function testCorruptedSnapshotStateHandling(): void
    {
        $snapshotStatePath = '/notes/versions/snapshot_state.json';
        
        $corruptedJson = '{"notes": {"invalid": json}';
        $this->mockFs->filePutContents($snapshotStatePath, $corruptedJson);
        
        $state = $this->readSnapshotState($snapshotStatePath);
        
        $this->assertNotFalse($state, 'Should handle corrupted JSON gracefully');
        $this->assertArrayHasKey('notes', $state, 'Should return default state structure');
        $this->assertArrayHasKey('metadata', $state, 'Should return default state structure');
    }

    // Helper methods for testing

    private function createInitialSnapshotState(): array
    {
        return [
            'notes' => [
                'note_123' => [
                    'hash' => 'abc123def456',
                    'lastVersioned' => '2023-10-27 14:30:45',
                    'versionCount' => 3,
                    'lastModified' => '2023-10-27 14:32:10'
                ]
            ],
            'metadata' => [
                'lastCleanup' => '2023-10-27 12:00:00',
                'totalVersions' => 3,
                'schemaVersion' => '1.0'
            ]
        ];
    }

    private function updateNoteInSnapshotState(array $state, string $noteId, string $hash, string $timestamp): array
    {
        if (isset($state['notes'][$noteId])) {
            $state['notes'][$noteId]['hash'] = $hash;
            $state['notes'][$noteId]['lastVersioned'] = $timestamp;
            $state['notes'][$noteId]['lastModified'] = $timestamp;
            $state['notes'][$noteId]['versionCount']++;
        }
        return $state;
    }

    private function addNoteToSnapshotState(array $state, string $noteId, string $hash, string $timestamp): array
    {
        $state['notes'][$noteId] = [
            'hash' => $hash,
            'lastVersioned' => $timestamp,
            'versionCount' => 1,
            'lastModified' => $timestamp
        ];
        return $state;
    }

    private function hasNoteChanged(array $state, string $noteId, string $currentHash): bool
    {
        if (!isset($state['notes'][$noteId])) {
            return true; // New note
        }
        return $state['notes'][$noteId]['hash'] !== $currentHash;
    }

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

    private function updateSnapshotMetadata(array $state, string $lastCleanup, int $addedVersions): array
    {
        $state['metadata']['lastCleanup'] = $lastCleanup;
        $state['metadata']['totalVersions'] += $addedVersions;
        return $state;
    }

    private function writeSnapshotState(string $path, array $state): void
    {
        $this->mockFs->filePutContents($path, json_encode($state, JSON_PRETTY_PRINT));
    }

    private function readSnapshotState(string $path): array
    {
        if (!$this->mockFs->fileExists($path)) {
            return $this->createInitialSnapshotState();
        }
        
        $content = $this->mockFs->fileGetContents($path);
        if ($content === false) {
            return $this->createInitialSnapshotState();
        }
        
        $decoded = json_decode($content, true);
        if ($decoded === null) {
            return $this->createInitialSnapshotState();
        }
        
        return $decoded;
    }
}
<?php

namespace Tests\Backend\Unit;

use Tests\Backend\BaseTestCase;
use Tests\Backend\Utilities\{MockFilesystem, TestHelper};

require_once PROJECT_ROOT . '/static_server_files/api/CoreVersioningLogic.php';

/**
 * Unit tests for CoreVersioningLogic functionality
 * Tests the main versioning algorithms including change detection, snapshot creation, and lifecycle management
 */
class CoreVersioningLogicTest extends BaseTestCase
{
    private MockFilesystem $mockFs;
    private \CoreVersioningLogic $versioningLogic;

    protected function setUp(): void
    {
        parent::setUp();
        $this->mockFs = new MockFilesystem();
        $this->mockFs->createTestNoteStructure();
        $this->versioningLogic = new \CoreVersioningLogic(TEST_NOTES_ROOT);
    }

    public function testDetectNoteChanges(): void
    {
        $noteId = 'note_change_detection';
        $originalNote = [
            'id' => $noteId,
            'title' => 'Original Title',
            'content' => 'Original content',
            'created' => '2023-10-27 14:00:00',
            'modified' => '2023-10-27 14:00:00'
        ];
        
        $modifiedNote = [
            'id' => $noteId,
            'title' => 'Modified Title',
            'content' => 'Modified content',
            'created' => '2023-10-27 14:00:00',
            'modified' => '2023-10-27 15:00:00'
        ];
        
        // First check - no previous state, should detect as changed
        $hasChanged = $this->versioningLogic->hasNoteChanged($noteId, $originalNote);
        $this->assertTrue($hasChanged, 'New note should be detected as changed');
        
        // Create version and update state
        $this->versioningLogic->createVersionSnapshot($noteId, $originalNote);
        
        // Check same content - should not detect change
        $hasNotChanged = $this->versioningLogic->hasNoteChanged($noteId, $originalNote);
        $this->assertFalse($hasNotChanged, 'Unchanged note should not be detected as changed');
        
        // Check modified content - should detect change
        $hasChangedAgain = $this->versioningLogic->hasNoteChanged($noteId, $modifiedNote);
        $this->assertTrue($hasChangedAgain, 'Modified note should be detected as changed');
    }

    public function testCreateVersionSnapshot(): void
    {
        $noteId = 'note_snapshot_test';
        $noteData = [
            'id' => $noteId,
            'title' => 'Snapshot Test Note',
            'content' => 'This note will be snapshotted for versioning',
            'created' => '2023-10-27 14:30:00',
            'modified' => '2023-10-27 14:35:00',
            'folder' => 'test-folder'
        ];
        
        $result = $this->versioningLogic->createVersionSnapshot($noteId, $noteData);
        
        $this->assertTrue($result, 'Version snapshot creation should succeed');
        
        // Verify version file was created
        $versions = $this->versioningLogic->getVersionHistory($noteId);
        $this->assertCount(1, $versions, 'Should have 1 version after snapshot');
        
        // Verify snapshot state was updated
        $snapshotState = $this->versioningLogic->getSnapshotState();
        $this->assertArrayHasKey($noteId, $snapshotState['notes'], 'Note should be tracked in snapshot state');
        $this->assertEquals(1, $snapshotState['notes'][$noteId]['versionCount'], 'Version count should be 1');
    }

    public function testVersionSnapshotContent(): void
    {
        $noteId = 'note_content_test';
        $noteData = [
            'id' => $noteId,
            'title' => 'Content Preservation Test',
            'content' => 'This content should be preserved exactly in the version',
            'metadata' => [
                'tags' => ['test', 'versioning'],
                'priority' => 3
            ],
            'created' => '2023-10-27 14:00:00',
            'modified' => '2023-10-27 14:30:00'
        ];
        
        $this->versioningLogic->createVersionSnapshot($noteId, $noteData);
        
        // Retrieve the version content
        $versions = $this->versioningLogic->getVersionHistory($noteId);
        $this->assertNotEmpty($versions, 'Should have at least one version');
        
        $latestVersion = $this->versioningLogic->getVersionContent($noteId, $versions[0]);
        
        $this->assertEquals($noteData['title'], $latestVersion['title'], 'Title should be preserved');
        $this->assertEquals($noteData['content'], $latestVersion['content'], 'Content should be preserved');
        $this->assertEquals($noteData['metadata'], $latestVersion['metadata'], 'Metadata should be preserved');
        
        // Verify version includes versioning metadata
        $this->assertArrayHasKey('versionInfo', $latestVersion, 'Version should include versioning metadata');
        $this->assertArrayHasKey('timestamp', $latestVersion['versionInfo'], 'Version should include timestamp');
        $this->assertArrayHasKey('hash', $latestVersion['versionInfo'], 'Version should include content hash');
    }

    public function testMultipleVersionSnapshots(): void
    {
        $noteId = 'note_multiple_versions';
        
        // Create multiple versions over time
        $versions = [
            [
                'title' => 'Version 1',
                'content' => 'First version content',
                'modified' => '2023-10-27 14:00:00'
            ],
            [
                'title' => 'Version 2', 
                'content' => 'Second version content',
                'modified' => '2023-10-27 15:00:00'
            ],
            [
                'title' => 'Version 3',
                'content' => 'Third version content', 
                'modified' => '2023-10-27 16:00:00'
            ]
        ];
        
        foreach ($versions as $i => $versionData) {
            $noteData = array_merge([
                'id' => $noteId,
                'created' => '2023-10-27 14:00:00'
            ], $versionData);
            
            $timestamp = strtotime($versionData['modified']);
            $result = $this->versioningLogic->createVersionSnapshot($noteId, $noteData, $timestamp);
            $this->assertTrue($result, "Version {$i} creation should succeed");
        }
        
        // Verify all versions exist
        $versionHistory = $this->versioningLogic->getVersionHistory($noteId);
        $this->assertCount(3, $versionHistory, 'Should have 3 versions');
        
        // Verify versions are ordered chronologically
        $this->assertTrue($versionHistory[0] < $versionHistory[1], 'Versions should be chronologically ordered');
        $this->assertTrue($versionHistory[1] < $versionHistory[2], 'Versions should be chronologically ordered');
        
        // Verify snapshot state reflects multiple versions
        $snapshotState = $this->versioningLogic->getSnapshotState();
        $this->assertEquals(3, $snapshotState['notes'][$noteId]['versionCount'], 'Version count should be 3');
    }

    public function testHashGenerationConsistency(): void
    {
        $noteData = [
            'id' => 'hash_test',
            'title' => 'Hash Consistency Test',
            'content' => 'This content should produce consistent hashes',
            'created' => '2023-10-27 14:00:00',
            'modified' => '2023-10-27 14:30:00'
        ];
        
        $hash1 = $this->versioningLogic->generateContentHash($noteData);
        $hash2 = $this->versioningLogic->generateContentHash($noteData);
        
        $this->assertEquals($hash1, $hash2, 'Same content should produce identical hashes');
        $this->assertNotEmpty($hash1, 'Hash should not be empty');
        $this->assertIsString($hash1, 'Hash should be a string');
        
        // Modify content and verify hash changes
        $modifiedData = $noteData;
        $modifiedData['title'] = 'Modified Title';
        
        $hash3 = $this->versioningLogic->generateContentHash($modifiedData);
        $this->assertNotEquals($hash1, $hash3, 'Modified content should produce different hash');
    }

    /**
     * Helper method to create mock versions with specific timestamps and file modification times
     */
    private function createMockVersionsWithAges(string $noteId, array $versionAges): array
    {
        $baseTime = time();
        $createdVersions = [];
        
        foreach ($versionAges as $index => $hoursAgo) {
            $timestamp = $baseTime - ($hoursAgo * 3600);
            $noteData = [
                'id' => $noteId,
                'title' => "Version {$index}",
                'content' => "Content for version {$index} created {$hoursAgo} hours ago",
                'modified' => date('Y-m-d H:i:s', $timestamp)
            ];
            
            $success = $this->versioningLogic->createVersionSnapshot($noteId, $noteData, $timestamp);
            $this->assertTrue($success, "Should create version {$index}");
            
            $createdVersions[] = $timestamp;
        }
        
        // Set actual file modification times to match our test scenario
        $storage = $this->versioningLogic->getStorage();
        $versionDir = $storage->getVersionDirectoryPath($noteId);
        $versionFiles = $this->versioningLogic->getVersionHistory($noteId);
        
        foreach ($versionFiles as $index => $versionFile) {
            $filePath = $versionDir . '/' . $versionFile;
            $correspondingAge = $versionAges[$index];
            $correspondingTime = $baseTime - ($correspondingAge * 3600);
            touch($filePath, $correspondingTime);
        }
        
        return $createdVersions;
    }

    public function testCleanupKeepsAllVersionsWithin24Hours(): void
    {
        $noteId = 'note_cleanup_within_24h';
        
        // Create 5 versions, all within 24 hours
        $versionAges = [1, 3, 6, 12, 20]; // Hours ago (all < 24)
        $this->createMockVersionsWithAges($noteId, $versionAges);
        
        $versionsBeforeCleanup = $this->versioningLogic->getVersionHistory($noteId);
        $this->assertCount(5, $versionsBeforeCleanup, 'Should have 5 versions before cleanup');
        
        // Run cleanup
        $cleanedCount = $this->versioningLogic->cleanupOldVersions(24);
        $this->assertEquals(0, $cleanedCount, 'Should not clean any versions within 24 hours');
        
        $versionsAfterCleanup = $this->versioningLogic->getVersionHistory($noteId);
        $this->assertCount(5, $versionsAfterCleanup, 'Should still have all 5 versions');
    }

    public function testCleanupKeepsOnlyLast3VersionsAfter24Hours(): void
    {
        $noteId = 'note_cleanup_keep_last_3';
        
        // Create 6 versions, all older than 24 hours
        $versionAges = [72, 60, 48, 36, 30, 25]; // Hours ago (all > 24)
        $this->createMockVersionsWithAges($noteId, $versionAges);
        
        $versionsBeforeCleanup = $this->versioningLogic->getVersionHistory($noteId);
        $this->assertCount(6, $versionsBeforeCleanup, 'Should have 6 versions before cleanup');
        
        // Run cleanup
        $cleanedCount = $this->versioningLogic->cleanupOldVersions(24);
        $this->assertEquals(3, $cleanedCount, 'Should clean 3 oldest versions (keep last 3)');
        
        $versionsAfterCleanup = $this->versioningLogic->getVersionHistory($noteId);
        $this->assertCount(3, $versionsAfterCleanup, 'Should have only 3 versions remaining');
        
        // Verify the 3 newest versions are kept by checking file modification times
        $storage = $this->versioningLogic->getStorage();
        $versionDir = $storage->getVersionDirectoryPath($noteId);
        $remainingTimes = [];
        
        foreach ($versionsAfterCleanup as $versionFile) {
            $filePath = $versionDir . '/' . $versionFile;
            $remainingTimes[] = filemtime($filePath);
        }
        
        // Sort to get newest first
        rsort($remainingTimes);
        
        // These should correspond to the 3 newest versions (25, 30, 36 hours ago)
        $expectedTimes = [
            time() - (25 * 3600),
            time() - (30 * 3600), 
            time() - (36 * 3600)
        ];
        
        foreach ($expectedTimes as $index => $expectedTime) {
            $this->assertEqualsWithDelta($expectedTime, $remainingTimes[$index], 5,
                'Remaining version should match expected newest timestamps');
        }
    }

    public function testCleanupCorrectlyIdentifiesVersionsToDelete(): void
    {
        $noteId = 'note_cleanup_mixed_ages';
        
        // Create mixed versions: some within 24h, some beyond 24h (more than 3)
        $versionAges = [72, 48, 36, 30, 25, 20, 12, 6]; // Mix of old and new
        $this->createMockVersionsWithAges($noteId, $versionAges);
        
        $versionsBeforeCleanup = $this->versioningLogic->getVersionHistory($noteId);
        $this->assertCount(8, $versionsBeforeCleanup, 'Should have 8 versions before cleanup');
        
        // Run cleanup
        $cleanedCount = $this->versioningLogic->cleanupOldVersions(24);
        
        // Algorithm: Sort newest first [6h, 12h, 20h, 25h, 30h, 36h, 48h, 72h]
        // Keep first 3: [6h, 12h, 20h]
        // Check remaining 5: [25h, 30h, 36h, 48h, 72h] - all > 24h, so delete all 5
        $this->assertEquals(5, $cleanedCount, 'Should clean all 5 versions beyond the first 3 that are older than 24h');
        
        $versionsAfterCleanup = $this->versioningLogic->getVersionHistory($noteId);
        $this->assertCount(3, $versionsAfterCleanup, 'Should have 3 versions remaining (the newest ones)');
    }

    public function testCleanupWithExactly3Versions(): void
    {
        $noteId = 'note_cleanup_exactly_3';
        
        // Create exactly 3 versions, all older than 24 hours
        $versionAges = [72, 48, 30]; // All > 24 hours
        $this->createMockVersionsWithAges($noteId, $versionAges);
        
        $versionsBeforeCleanup = $this->versioningLogic->getVersionHistory($noteId);
        $this->assertCount(3, $versionsBeforeCleanup, 'Should have 3 versions before cleanup');
        
        // Run cleanup
        $cleanedCount = $this->versioningLogic->cleanupOldVersions(24);
        $this->assertEquals(0, $cleanedCount, 'Should not clean any versions when exactly 3 exist');
        
        $versionsAfterCleanup = $this->versioningLogic->getVersionHistory($noteId);
        $this->assertCount(3, $versionsAfterCleanup, 'Should still have all 3 versions');
    }

    public function testCleanupWithFewerThan3Versions(): void
    {
        $noteId = 'note_cleanup_few_versions';
        
        // Test with 1 version
        $versionAges = [48]; // 1 version, older than 24 hours
        $this->createMockVersionsWithAges($noteId, $versionAges);
        
        $cleanedCount = $this->versioningLogic->cleanupOldVersions(24);
        $this->assertEquals(0, $cleanedCount, 'Should not clean when only 1 version exists');
        
        $versions = $this->versioningLogic->getVersionHistory($noteId);
        $this->assertCount(1, $versions, 'Should still have 1 version');
        
        // Test with 2 versions
        $noteId2 = 'note_cleanup_two_versions';
        $versionAges2 = [60, 36]; // 2 versions, both older than 24 hours
        $this->createMockVersionsWithAges($noteId2, $versionAges2);
        
        $cleanedCount2 = $this->versioningLogic->cleanupOldVersions(24);
        $this->assertEquals(0, $cleanedCount2, 'Should not clean when only 2 versions exist');
        
        $versions2 = $this->versioningLogic->getVersionHistory($noteId2);
        $this->assertCount(2, $versions2, 'Should still have 2 versions');
    }

    public function testCleanupWithNoVersions(): void
    {
        $noteId = 'note_cleanup_no_versions';
        
        // Don't create any versions for this note
        $cleanedCount = $this->versioningLogic->cleanupOldVersions(24);
        $this->assertEquals(0, $cleanedCount, 'Should handle cleanup gracefully with no versions');
        
        $versions = $this->versioningLogic->getVersionHistory($noteId);
        $this->assertCount(0, $versions, 'Should have no versions');
    }

    public function testCleanupHandlesFileLocking(): void
    {
        $noteId = 'note_cleanup_file_locking';
        
        // Create multiple versions to test locking behavior
        $versionAges = [72, 48, 36, 30]; // All > 24 hours, should keep last 3
        $this->createMockVersionsWithAges($noteId, $versionAges);
        
        $versionsBeforeCleanup = $this->versioningLogic->getVersionHistory($noteId);
        $this->assertCount(4, $versionsBeforeCleanup, 'Should have 4 versions before cleanup');
        
        // Simulate lock file by creating it manually
        $storage = $this->versioningLogic->getStorage();
        $versionDir = $storage->getVersionDirectoryPath($noteId);
        $lockFile = $versionDir . '.cleanup.lock';
        
        // Create lock file and hold a lock
        $lockHandle = fopen($lockFile, 'w');
        $this->assertNotFalse($lockHandle, 'Should create lock file');
        $lockAcquired = flock($lockHandle, LOCK_EX | LOCK_NB);
        $this->assertTrue($lockAcquired, 'Should acquire lock');
        
        try {
            // Run cleanup while lock is held
            $cleanedCount = $this->versioningLogic->cleanupOldVersions(24);
            $this->assertEquals(0, $cleanedCount, 'Should not clean any versions when file is locked');
            
            $versionsAfterCleanup = $this->versioningLogic->getVersionHistory($noteId);
            $this->assertCount(4, $versionsAfterCleanup, 'Should still have all 4 versions when locked');
        } finally {
            flock($lockHandle, LOCK_UN);
            fclose($lockHandle);
            @unlink($lockFile);
        }
        
        // Now run cleanup again without lock
        $cleanedCount = $this->versioningLogic->cleanupOldVersions(24);
        $this->assertEquals(1, $cleanedCount, 'Should clean 1 version after lock is released');
        
        $versionsAfterUnlock = $this->versioningLogic->getVersionHistory($noteId);
        $this->assertCount(3, $versionsAfterUnlock, 'Should have 3 versions after cleanup without lock');
    }

    public function testCleanupHandlesUnwritableFiles(): void
    {
        $noteId = 'note_cleanup_unwritable';
        
        // Create versions that should be cleaned up
        $versionAges = [72, 48, 36, 30]; // All > 24 hours, should keep last 3
        $this->createMockVersionsWithAges($noteId, $versionAges);
        
        $versionsBeforeCleanup = $this->versioningLogic->getVersionHistory($noteId);
        $this->assertCount(4, $versionsBeforeCleanup, 'Should have 4 versions before cleanup');
        
        // Make the version directory read-only to simulate deletion failure
        $storage = $this->versioningLogic->getStorage();
        $versionDir = $storage->getVersionDirectoryPath($noteId);
        $originalPerms = fileperms($versionDir);
        
        // Make directory read-only (prevents file deletion)
        chmod($versionDir, 0555);
        
        try {
            // Run cleanup
            $cleanedCount = $this->versioningLogic->cleanupOldVersions(24);
            
            // Should attempt to clean files but fail due to read-only directory
            $this->assertEquals(0, $cleanedCount, 'Should not clean any files when directory is read-only');
            
            $versionsAfterCleanup = $this->versioningLogic->getVersionHistory($noteId);
            $this->assertCount(4, $versionsAfterCleanup, 'Should still have all 4 versions when deletion fails');
            
        } finally {
            // Restore permissions for cleanup
            chmod($versionDir, $originalPerms);
        }
        
        // Now test that cleanup works normally after restoring permissions
        $cleanedCount = $this->versioningLogic->cleanupOldVersions(24);
        $this->assertEquals(1, $cleanedCount, 'Should clean 1 version after permissions are restored');
        
        $versionsAfterRestore = $this->versioningLogic->getVersionHistory($noteId);
        $this->assertCount(3, $versionsAfterRestore, 'Should have 3 versions after successful cleanup');
    }

    public function testBatchVersionProcessing(): void
    {
        $notes = [
            'note_batch_1' => [
                'id' => 'note_batch_1',
                'title' => 'Batch Note 1',
                'content' => 'Content for batch processing test 1'
            ],
            'note_batch_2' => [
                'id' => 'note_batch_2', 
                'title' => 'Batch Note 2',
                'content' => 'Content for batch processing test 2'
            ],
            'note_batch_3' => [
                'id' => 'note_batch_3',
                'title' => 'Batch Note 3',
                'content' => 'Content for batch processing test 3'
            ]
        ];
        
        $results = $this->versioningLogic->processNotesForVersioning($notes);
        
        $this->assertIsArray($results, 'Batch processing should return array results');
        $this->assertCount(3, $results, 'Should process all 3 notes');
        
        foreach ($results as $noteId => $result) {
            $this->assertTrue($result['success'], "Processing for {$noteId} should succeed");
            $this->assertArrayHasKey('action', $result, 'Result should include action taken');
            $this->assertEquals('created', $result['action'], 'New notes should have versions created');
        }
        
        // Verify versions were created
        foreach (array_keys($notes) as $noteId) {
            $versions = $this->versioningLogic->getVersionHistory($noteId);
            $this->assertCount(1, $versions, "Note {$noteId} should have 1 version");
        }
    }

    public function testVersioningStateManagement(): void
    {
        $noteId = 'note_state_test';
        $noteData = [
            'id' => $noteId,
            'title' => 'State Management Test',
            'content' => 'Testing state management functionality'
        ];
        
        // Initial state should be empty
        $initialState = $this->versioningLogic->getSnapshotState();
        $this->assertArrayNotHasKey($noteId, $initialState['notes'], 'Note should not be in initial state');
        
        // Create version and verify state update
        $this->versioningLogic->createVersionSnapshot($noteId, $noteData);
        
        $updatedState = $this->versioningLogic->getSnapshotState();
        $this->assertArrayHasKey($noteId, $updatedState['notes'], 'Note should be in updated state');
        
        $noteState = $updatedState['notes'][$noteId];
        $this->assertArrayHasKey('hash', $noteState, 'Note state should include hash');
        $this->assertArrayHasKey('lastVersioned', $noteState, 'Note state should include last versioned time');
        $this->assertArrayHasKey('versionCount', $noteState, 'Note state should include version count');
        $this->assertEquals(1, $noteState['versionCount'], 'Version count should be 1');
        
        // Verify metadata is updated
        $this->assertArrayHasKey('metadata', $updatedState, 'State should include metadata');
        $this->assertGreaterThan(0, $updatedState['metadata']['totalVersions'], 'Total versions should be greater than 0');
    }

    public function testErrorHandlingInVersioning(): void
    {
        // Test with invalid note data
        $invalidNoteId = '../../../malicious';
        $noteData = ['title' => 'Test', 'content' => 'Test content'];
        
        $result = $this->versioningLogic->createVersionSnapshot($invalidNoteId, $noteData);
        $this->assertNotFalse($result, 'Should handle invalid note ID gracefully');
        
        // Test with missing required fields
        $incompleteData = ['title' => 'Only Title']; // Missing content
        $result2 = $this->versioningLogic->createVersionSnapshot('valid_id', $incompleteData);
        $this->assertTrue($result2, 'Should handle incomplete note data');
        
        // Test error reporting
        $errors = $this->versioningLogic->getLastErrors();
        $this->assertIsArray($errors, 'Should return array of errors');
    }

    public function testVersioningStatistics(): void
    {
        $notes = [
            'stats_note_1' => ['title' => 'Stats 1', 'content' => 'Content 1'],
            'stats_note_2' => ['title' => 'Stats 2', 'content' => 'Content 2'],
            'stats_note_3' => ['title' => 'Stats 3', 'content' => 'Content 3']
        ];
        
        // Create versions for all notes
        foreach ($notes as $noteId => $noteData) {
            $noteData['id'] = $noteId;
            $this->versioningLogic->createVersionSnapshot($noteId, $noteData);
        }
        
        $stats = $this->versioningLogic->getVersioningStatistics();
        
        $this->assertIsArray($stats, 'Statistics should be returned as array');
        $this->assertArrayHasKey('totalNotes', $stats, 'Stats should include total notes');
        $this->assertArrayHasKey('totalVersions', $stats, 'Stats should include total versions');
        $this->assertArrayHasKey('totalSize', $stats, 'Stats should include total size');
        
        $this->assertEquals(3, $stats['totalNotes'], 'Should track 3 notes');
        $this->assertEquals(3, $stats['totalVersions'], 'Should have 3 versions total');
        $this->assertGreaterThan(0, $stats['totalSize'], 'Total size should be greater than 0');
    }

    public function testConcurrentVersioning(): void
    {
        $noteId = 'note_concurrent_test';
        $noteData = [
            'id' => $noteId,
            'title' => 'Concurrent Test',
            'content' => 'Testing concurrent versioning operations'
        ];
        
        // Simulate concurrent operations by creating multiple versions rapidly
        $results = [];
        for ($i = 0; $i < 3; $i++) {
            $data = $noteData;
            $data['title'] = "Concurrent Test {$i}";
            $data['modified'] = date('Y-m-d H:i:s', time() + $i);
            
            $results[] = $this->versioningLogic->createVersionSnapshot($noteId, $data, time() + $i);
        }
        
        // All operations should succeed
        foreach ($results as $i => $result) {
            $this->assertTrue($result, "Concurrent operation {$i} should succeed");
        }
        
        // Verify all versions were created
        $versions = $this->versioningLogic->getVersionHistory($noteId);
        $this->assertCount(3, $versions, 'Should have 3 versions from concurrent operations');
    }

    public function testVersionContentRetrieval(): void
    {
        $noteId = 'note_retrieval_test';
        $noteData = [
            'id' => $noteId,
            'title' => 'Retrieval Test',
            'content' => 'Testing version content retrieval',
            'metadata' => ['important' => true]
        ];
        
        $this->versioningLogic->createVersionSnapshot($noteId, $noteData);
        
        $versions = $this->versioningLogic->getVersionHistory($noteId);
        $this->assertNotEmpty($versions, 'Should have at least one version');
        
        $versionContent = $this->versioningLogic->getVersionContent($noteId, $versions[0]);
        
        $this->assertNotFalse($versionContent, 'Should retrieve version content');
        $this->assertEquals($noteData['title'], $versionContent['title'], 'Retrieved title should match');
        $this->assertEquals($noteData['content'], $versionContent['content'], 'Retrieved content should match');
        $this->assertEquals($noteData['metadata'], $versionContent['metadata'], 'Retrieved metadata should match');
    }
}
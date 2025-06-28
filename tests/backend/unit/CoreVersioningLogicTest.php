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

    public function testVersionCleanupLogic(): void
    {
        $noteId = 'note_cleanup_test';
        
        // Create versions with different ages
        $oldTimestamp = time() - (25 * 3600); // 25 hours ago
        $recentTimestamp = time() - (1 * 3600); // 1 hour ago
        $currentTimestamp = time();
        
        $oldNote = [
            'id' => $noteId,
            'title' => 'Old Version',
            'content' => 'This is an old version',
            'modified' => date('Y-m-d H:i:s', $oldTimestamp)
        ];
        
        $recentNote = [
            'id' => $noteId,
            'title' => 'Recent Version', 
            'content' => 'This is a recent version',
            'modified' => date('Y-m-d H:i:s', $recentTimestamp)
        ];
        
        $currentNote = [
            'id' => $noteId,
            'title' => 'Current Version',
            'content' => 'This is the current version',
            'modified' => date('Y-m-d H:i:s', $currentTimestamp)
        ];
        
        // Create versions
        $this->versioningLogic->createVersionSnapshot($noteId, $oldNote, $oldTimestamp);
        $this->versioningLogic->createVersionSnapshot($noteId, $recentNote, $recentTimestamp);
        $this->versioningLogic->createVersionSnapshot($noteId, $currentNote, $currentTimestamp);
        
        $versionsBeforeCleanup = $this->versioningLogic->getVersionHistory($noteId);
        $this->assertCount(3, $versionsBeforeCleanup, 'Should have 3 versions before cleanup');
        
        // Manually set file modification times to simulate old files
        $storage = $this->versioningLogic->getStorage();
        $versionDir = $storage->getVersionDirectoryPath($noteId);
        foreach ($versionsBeforeCleanup as $versionFile) {
            $filePath = $versionDir . '/' . $versionFile;
            if (strpos($versionFile, '25-') !== false) { // Old file (25 hours ago)
                touch($filePath, $oldTimestamp);
            }
        }
        
        // Run cleanup (24 hour retention)
        $cleanedCount = $this->versioningLogic->cleanupOldVersions(24);
        $this->assertGreaterThan(0, $cleanedCount, 'Should clean up at least 1 old version');
        
        $versionsAfterCleanup = $this->versioningLogic->getVersionHistory($noteId);
        $this->assertLessThan(count($versionsBeforeCleanup), count($versionsAfterCleanup), 'Should have fewer versions after cleanup');
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
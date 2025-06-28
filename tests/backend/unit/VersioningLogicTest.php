<?php

namespace Tests\Backend\Unit;

use Tests\Backend\BaseTestCase;
use Tests\Backend\Utilities\{MockFilesystem, TestHelper};

/**
 * Sample unit test demonstrating testing conventions for versioning logic
 * This tests the core logic that will be implemented in the versioning system
 */
class VersioningLogicTest extends BaseTestCase
{
    private MockFilesystem $mockFs;

    protected function setUp(): void
    {
        parent::setUp();
        $this->mockFs = new MockFilesystem();
        $this->mockFs->createTestNoteStructure();
    }

    public function testDetectNoteChangeWhenContentModified(): void
    {
        $noteId = 'note_123';
        $originalContent = TestHelper::createSampleNoteData('Original Title', 'Original content');
        $modifiedContent = TestHelper::createSampleNoteData('Modified Title', 'Modified content');
        
        $this->mockFs->filePutContents("/notes/{$noteId}.json", json_encode($originalContent));
        
        $originalHash = TestHelper::simulateFileHash($originalContent);
        $modifiedHash = TestHelper::simulateFileHash($modifiedContent);
        
        $this->assertNotEquals($originalHash, $modifiedHash, 'Content hashes should differ when content changes');
        
        $snapshotState = ['note_123' => $originalHash];
        $this->mockFs->filePutContents('/notes/versions/snapshot_state.json', json_encode($snapshotState));
        
        $this->mockFs->filePutContents("/notes/{$noteId}.json", json_encode($modifiedContent));
        
        $currentHash = md5($this->mockFs->fileGetContents("/notes/{$noteId}.json"));
        $storedHash = json_decode($this->mockFs->fileGetContents('/notes/versions/snapshot_state.json'), true)['note_123'];
        
        $this->assertNotEquals($storedHash, $currentHash, 'Current hash should differ from stored hash when note is modified');
    }

    public function testDetectNoteUnchangedWhenContentSame(): void
    {
        $noteId = 'note_456';
        $noteContent = TestHelper::createSampleNoteData('Test Note', 'Test content');
        
        $this->mockFs->filePutContents("/notes/{$noteId}.json", json_encode($noteContent));
        
        $contentHash = TestHelper::simulateFileHash($noteContent);
        $snapshotState = ['note_456' => $contentHash];
        $this->mockFs->filePutContents('/notes/versions/snapshot_state.json', json_encode($snapshotState));
        
        $currentHash = md5($this->mockFs->fileGetContents("/notes/{$noteId}.json"));
        $storedHash = json_decode($this->mockFs->fileGetContents('/notes/versions/snapshot_state.json'), true)['note_456'];
        
        $this->assertEquals($storedHash, $currentHash, 'Hashes should match when note content is unchanged');
    }

    public function testVersionTimestampGeneration(): void
    {
        $timestamp = TestHelper::createVersionTimestamp();
        
        $this->assertMatchesRegularExpression('/^\d{4}-\d{2}-\d{2}-\d{2}$/', $timestamp, 'Timestamp should match YYYY-MM-DD-HH format');
        
        $pastTimestamp = TestHelper::createVersionTimestamp(2);
        $this->assertNotEquals($timestamp, $pastTimestamp, 'Different hour offsets should generate different timestamps');
    }

    public function testVersionPathGeneration(): void
    {
        $noteId = 'note_789';
        $timestamp = '2023-10-27-14';
        
        $expectedPath = "/notes/versions/{$noteId}/{$timestamp}.json";
        $actualPath = TestHelper::getVersionPath($noteId, $timestamp);
        
        $this->assertEquals($expectedPath, $actualPath, 'Version path should follow expected structure');
    }

    public function testVersionCleanupLogic(): void
    {
        $noteId = 'note_cleanup';
        $this->mockFs->mkdir("/notes/versions/{$noteId}", 0755, true);
        
        $oldTimestamp = TestHelper::createVersionTimestamp(25);
        $recentTimestamp = TestHelper::createVersionTimestamp(1);
        
        $oldVersionPath = TestHelper::getVersionPath($noteId, $oldTimestamp);
        $recentVersionPath = TestHelper::getVersionPath($noteId, $recentTimestamp);
        
        $this->mockFs->filePutContents($oldVersionPath, '{"old": "version"}');
        $this->mockFs->filePutContents($recentVersionPath, '{"recent": "version"}');
        
        $this->assertTrue($this->mockFs->fileExists($oldVersionPath), 'Old version should exist before cleanup');
        $this->assertTrue($this->mockFs->fileExists($recentVersionPath), 'Recent version should exist before cleanup');
        
        $currentTime = time();
        $oldFileTime = $currentTime - (25 * 3600);
        $recentFileTime = $currentTime - (1 * 3600);
        
        $shouldCleanOld = ($oldFileTime < $currentTime - (24 * 3600));
        $shouldCleanRecent = ($recentFileTime < $currentTime - (24 * 3600));
        
        $this->assertTrue($shouldCleanOld, 'Files older than 24 hours should be marked for cleanup');
        $this->assertFalse($shouldCleanRecent, 'Files newer than 24 hours should not be marked for cleanup');
    }

    public function testErrorHandlingWithFilesystemFailure(): void
    {
        $this->mockFs->enableFailureSimulation([
            ['path' => '/notes/versions/*', 'operations' => ['write']]
        ]);
        
        $result = $this->mockFs->filePutContents('/notes/versions/test.json', '{}');
        
        $this->assertFalse($result, 'File write should fail when filesystem errors are simulated');
    }
}
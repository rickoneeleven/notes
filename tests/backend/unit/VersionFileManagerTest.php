<?php

namespace Tests\Backend\Unit;

use Tests\Backend\BaseTestCase;
use Tests\Backend\Utilities\{MockFilesystem, TestHelper};

require_once PROJECT_ROOT . '/static_server_files/api/VersionFileManager.php';

/**
 * Unit tests for VersionFileManager functionality
 * Tests creation, retrieval, organization, and validation of version files
 */
class VersionFileManagerTest extends BaseTestCase
{
    private MockFilesystem $mockFs;
    private \VersionFileManager $versionManager;

    protected function setUp(): void
    {
        parent::setUp();
        $this->mockFs = new MockFilesystem();
        $this->mockFs->createTestNoteStructure();
        $this->versionManager = new \VersionFileManager(TEST_NOTES_ROOT);
    }

    public function testCreateVersionFile(): void
    {
        $noteId = 'note_create_test';
        $noteContent = [
            'id' => $noteId,
            'title' => 'Test Note for Versioning',
            'content' => 'This is test content that should be versioned properly.',
            'created' => '2023-10-27 14:30:45',
            'modified' => '2023-10-27 14:32:10',
            'folder' => 'test-folder'
        ];
        
        $versionPath = $this->versionManager->createVersionFile($noteId, $noteContent);
        
        $this->assertNotFalse($versionPath, 'Version file should be created successfully');
        $this->assertStringContainsString($noteId, $versionPath, 'Version path should contain note ID');
        $this->assertStringContainsString('.json', $versionPath, 'Version file should have .json extension');
        
        // Verify file exists and contains correct content
        $this->assertTrue(file_exists($versionPath), 'Version file should exist on filesystem');
        
        $retrievedContent = $this->versionManager->getVersionContent($noteId, basename($versionPath));
        $this->assertNotFalse($retrievedContent, 'Version content should be retrievable');
        $this->assertEquals($noteContent['title'], $retrievedContent['title'], 'Title should be preserved');
        $this->assertEquals($noteContent['content'], $retrievedContent['content'], 'Content should be preserved');
    }

    public function testCreateVersionFileWithTimestamp(): void
    {
        $noteId = 'note_timestamp_test';
        $content = ['title' => 'Timestamp Test', 'content' => 'Content with specific timestamp'];
        $specificTimestamp = strtotime('2023-10-27 15:45:30');
        
        $versionPath = $this->versionManager->createVersionFile($noteId, $content, $specificTimestamp);
        
        $this->assertNotFalse($versionPath, 'Version file with timestamp should be created');
        $this->assertStringContainsString('2023-10-27-15-45-30.json', $versionPath, 'Path should contain specific timestamp');
    }

    public function testGetVersionsByNoteId(): void
    {
        $noteId = 'note_multiple_versions';
        $versions = [];
        
        // Create multiple versions with different timestamps
        for ($i = 0; $i < 3; $i++) {
            $content = [
                'title' => "Version {$i}",
                'content' => "Content for version {$i}",
                'version' => $i + 1
            ];
            $timestamp = time() - (3600 * (3 - $i)); // Each version 1 hour apart
            
            $versionPath = $this->versionManager->createVersionFile($noteId, $content, $timestamp);
            $versions[] = basename($versionPath);
        }
        
        $retrievedVersions = $this->versionManager->getVersionsByNoteId($noteId);
        
        $this->assertCount(3, $retrievedVersions, 'Should retrieve all 3 versions');
        $this->assertIsArray($retrievedVersions, 'Should return array of version files');
        
        // Verify versions are returned in chronological order (oldest first)
        $this->assertTrue($retrievedVersions[0] < $retrievedVersions[1], 'Versions should be ordered chronologically');
        $this->assertTrue($retrievedVersions[1] < $retrievedVersions[2], 'Versions should be ordered chronologically');
    }

    public function testGetVersionByTimestamp(): void
    {
        $noteId = 'note_timestamp_retrieval';
        $content = ['title' => 'Specific Timestamp', 'content' => 'Content for timestamp test'];
        $targetTimestamp = strtotime('2023-10-27 16:30:45');
        
        $versionPath = $this->versionManager->createVersionFile($noteId, $content, $targetTimestamp);
        $filename = basename($versionPath);
        
        $retrievedContent = $this->versionManager->getVersionByTimestamp($noteId, $targetTimestamp);
        
        $this->assertNotFalse($retrievedContent, 'Should retrieve version by timestamp');
        $this->assertEquals($content['title'], $retrievedContent['title'], 'Retrieved content should match');
        $this->assertEquals($content['content'], $retrievedContent['content'], 'Retrieved content should match');
    }

    public function testGetVersionByIndex(): void
    {
        $noteId = 'note_index_retrieval';
        
        // Create multiple versions
        $versions = [];
        for ($i = 0; $i < 3; $i++) {
            $content = ['title' => "Version {$i}", 'index' => $i];
            $timestamp = time() - (3600 * (3 - $i));
            $this->versionManager->createVersionFile($noteId, $content, $timestamp);
            $versions[] = $content;
        }
        
        // Test retrieving by index (0 = oldest, -1 = newest)
        $oldestVersion = $this->versionManager->getVersionByIndex($noteId, 0);
        $newestVersion = $this->versionManager->getVersionByIndex($noteId, -1);
        $middleVersion = $this->versionManager->getVersionByIndex($noteId, 1);
        
        $this->assertNotFalse($oldestVersion, 'Should retrieve oldest version');
        $this->assertNotFalse($newestVersion, 'Should retrieve newest version');
        $this->assertNotFalse($middleVersion, 'Should retrieve middle version');
        
        $this->assertEquals('Version 0', $oldestVersion['title'], 'Oldest version should be correct');
        $this->assertEquals('Version 2', $newestVersion['title'], 'Newest version should be correct');
        $this->assertEquals('Version 1', $middleVersion['title'], 'Middle version should be correct');
    }

    public function testGetVersionMetadata(): void
    {
        $noteId = 'note_metadata_test';
        $content = [
            'title' => 'Metadata Test',
            'content' => 'Content for metadata extraction',
            'created' => '2023-10-27 14:00:00',
            'modified' => '2023-10-27 15:00:00'
        ];
        $timestamp = strtotime('2023-10-27 16:00:00');
        
        $versionPath = $this->versionManager->createVersionFile($noteId, $content, $timestamp);
        $filename = basename($versionPath);
        
        $metadata = $this->versionManager->getVersionMetadata($noteId, $filename);
        
        $this->assertIsArray($metadata, 'Metadata should be returned as array');
        $this->assertArrayHasKey('filename', $metadata, 'Metadata should include filename');
        $this->assertArrayHasKey('timestamp', $metadata, 'Metadata should include timestamp');
        $this->assertArrayHasKey('size', $metadata, 'Metadata should include file size');
        $this->assertArrayHasKey('created', $metadata, 'Metadata should include creation date');
        
        $this->assertEquals($filename, $metadata['filename'], 'Filename should match');
        $this->assertEquals($timestamp, $metadata['timestamp'], 'Timestamp should match');
        $this->assertGreaterThan(0, $metadata['size'], 'File size should be greater than 0');
    }

    public function testValidateVersionFile(): void
    {
        $noteId = 'note_validation_test';
        
        // Create valid version file
        $validContent = [
            'title' => 'Valid Note',
            'content' => 'Valid content',
            'created' => date('Y-m-d H:i:s'),
            'modified' => date('Y-m-d H:i:s')
        ];
        
        $validPath = $this->versionManager->createVersionFile($noteId, $validContent);
        $validFilename = basename($validPath);
        
        $isValid = $this->versionManager->validateVersionFile($noteId, $validFilename);
        $this->assertTrue($isValid, 'Valid version file should pass validation');
        
        // Test with non-existent file
        $isInvalid = $this->versionManager->validateVersionFile($noteId, 'non-existent-file.json');
        $this->assertFalse($isInvalid, 'Non-existent file should fail validation');
    }

    public function testDeleteVersionFile(): void
    {
        $noteId = 'note_delete_test';
        $content = ['title' => 'To Be Deleted', 'content' => 'This version will be deleted'];
        
        $versionPath = $this->versionManager->createVersionFile($noteId, $content);
        $filename = basename($versionPath);
        
        $this->assertTrue(file_exists($versionPath), 'Version file should exist before deletion');
        
        $deleteResult = $this->versionManager->deleteVersionFile($noteId, $filename);
        
        $this->assertTrue($deleteResult, 'Delete operation should succeed');
        $this->assertFalse(file_exists($versionPath), 'Version file should not exist after deletion');
    }

    public function testGetVersionCount(): void
    {
        $noteId = 'note_count_test';
        
        $initialCount = $this->versionManager->getVersionCount($noteId);
        $this->assertEquals(0, $initialCount, 'Initial version count should be 0');
        
        // Create multiple versions with different timestamps to avoid overwrites
        for ($i = 0; $i < 5; $i++) {
            $content = ['title' => "Version {$i}", 'content' => "Content {$i}"];
            $timestamp = time() + $i; // Each version 1 second apart
            $this->versionManager->createVersionFile($noteId, $content, $timestamp);
        }
        
        $finalCount = $this->versionManager->getVersionCount($noteId);
        $this->assertEquals(5, $finalCount, 'Final version count should be 5');
    }

    public function testGetLatestVersion(): void
    {
        $noteId = 'note_latest_test';
        
        // Create versions with increasing timestamps
        $latestContent = null;
        for ($i = 0; $i < 3; $i++) {
            $content = ['title' => "Version {$i}", 'timestamp' => time() + $i];
            $this->versionManager->createVersionFile($noteId, $content, time() + $i);
            $latestContent = $content; // Last one should be latest
        }
        
        $retrievedLatest = $this->versionManager->getLatestVersion($noteId);
        
        $this->assertNotFalse($retrievedLatest, 'Should retrieve latest version');
        $this->assertEquals($latestContent['title'], $retrievedLatest['title'], 'Latest version should match last created');
    }

    public function testCleanupVersionsOlderThan(): void
    {
        $noteId = 'note_cleanup_test';
        
        // Create versions with different ages
        $oldTimestamp = time() - (25 * 3600); // 25 hours ago
        $recentTimestamp = time() - (1 * 3600); // 1 hour ago
        
        $oldVersionPath = $this->versionManager->createVersionFile($noteId, ['title' => 'Old Version'], $oldTimestamp);
        $recentVersionPath = $this->versionManager->createVersionFile($noteId, ['title' => 'Recent Version'], $recentTimestamp);
        
        // Manually set file modification times to simulate old files
        if ($oldVersionPath) {
            touch($oldVersionPath, $oldTimestamp);
        }
        if ($recentVersionPath) {
            touch($recentVersionPath, $recentTimestamp);
        }
        
        $initialCount = $this->versionManager->getVersionCount($noteId);
        $this->assertEquals(2, $initialCount, 'Should have 2 versions initially');
        
        $deletedCount = $this->versionManager->cleanupVersionsOlderThan($noteId, 24); // Delete older than 24 hours
        
        $this->assertEquals(1, $deletedCount, 'Should delete 1 old version');
        
        $finalCount = $this->versionManager->getVersionCount($noteId);
        $this->assertEquals(1, $finalCount, 'Should have 1 version remaining');
    }

    public function testContentSerialization(): void
    {
        $noteId = 'note_serialization_test';
        
        // Test with complex content including special characters and unicode
        $complexContent = [
            'title' => 'Test with Special Chars: áéíóú ñ 中文 🎉',
            'content' => "Line 1\nLine 2\nSpecial chars: \"quotes\" & 'apostrophes'",
            'metadata' => [
                'tags' => ['tag1', 'tag2'],
                'priority' => 5,
                'nested' => ['key' => 'value']
            ],
            'unicode' => '这是中文测试 🚀 🎯'
        ];
        
        $versionPath = $this->versionManager->createVersionFile($noteId, $complexContent);
        $filename = basename($versionPath);
        
        $retrievedContent = $this->versionManager->getVersionContent($noteId, $filename);
        
        $this->assertEquals($complexContent, $retrievedContent, 'Complex content should be preserved exactly');
        $this->assertEquals($complexContent['unicode'], $retrievedContent['unicode'], 'Unicode should be preserved');
        $this->assertEquals($complexContent['metadata'], $retrievedContent['metadata'], 'Nested arrays should be preserved');
    }

    public function testErrorHandling(): void
    {
        $noteId = 'note_error_test';
        
        // Test retrieving non-existent version
        $nonExistent = $this->versionManager->getVersionContent($noteId, 'non-existent.json');
        $this->assertFalse($nonExistent, 'Non-existent version should return false');
        
        // Test invalid note ID
        $invalidNoteId = '../../../malicious';
        $sanitizedResult = $this->versionManager->createVersionFile($invalidNoteId, ['title' => 'Test']);
        $this->assertNotFalse($sanitizedResult, 'Should handle invalid note ID gracefully');
        $this->assertStringNotContainsString('..', $sanitizedResult, 'Path should not contain traversal sequences');
        
        // Test empty content
        $emptyResult = $this->versionManager->createVersionFile($noteId, []);
        $this->assertNotFalse($emptyResult, 'Should handle empty content');
        
        $retrievedEmpty = $this->versionManager->getVersionContent($noteId, basename($emptyResult));
        $this->assertEquals([], $retrievedEmpty, 'Empty content should be preserved');
    }
}
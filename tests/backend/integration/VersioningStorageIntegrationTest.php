<?php

namespace Tests\Backend\Integration;

use Tests\Backend\BaseTestCase;

require_once PROJECT_ROOT . '/static_server_files/api/VersioningStorage.php';

/**
 * Integration tests for VersioningStorage class
 * Tests real filesystem operations using test directory
 */
class VersioningStorageIntegrationTest extends BaseTestCase
{
    private \VersioningStorage $storage;
    private string $testNotesPath;

    protected function setUp(): void
    {
        parent::setUp();
        $this->testNotesPath = TEST_NOTES_ROOT;
        $this->storage = new \VersioningStorage($this->testNotesPath);
    }

    public function testCreateVersionDirectoryReal(): void
    {
        $noteId = 'note_integration_test';
        
        $result = $this->storage->createVersionDirectory($noteId);
        
        $this->assertTrue($result, 'Version directory should be created successfully');
        $this->assertTrue($this->storage->versionDirectoryExists($noteId), 'Version directory should exist');
        
        $expectedPath = $this->storage->getVersionDirectoryPath($noteId);
        $this->assertDirectoryExists($expectedPath);
    }

    public function testGenerateVersionFilename(): void
    {
        $timestamp = strtotime('2023-10-27 14:30:45');
        $filename = $this->storage->generateVersionFilename($timestamp);
        
        $this->assertEquals('2023-10-27-14-30-45.json', $filename);
        $this->assertMatchesRegularExpression('/^\d{4}-\d{2}-\d{2}-\d{2}-\d{2}-\d{2}\.json$/', $filename);
    }

    public function testGenerateVersionPath(): void
    {
        $noteId = 'note_path_test';
        $timestamp = strtotime('2023-10-27 14:30:45');
        
        $path = $this->storage->generateVersionPath($noteId, $timestamp);
        
        $this->assertStringContainsString($noteId, $path);
        $this->assertStringContainsString('2023-10-27-14-30-45.json', $path);
        $this->assertStringContainsString('/versions/', $path);
    }

    public function testCreateVersionFileReal(): void
    {
        $noteId = 'note_create_test';
        $content = [
            'id' => $noteId,
            'title' => 'Test Note',
            'content' => 'This is test content for versioning',
            'created' => date('Y-m-d H:i:s'),
            'modified' => date('Y-m-d H:i:s')
        ];
        
        $versionPath = $this->storage->createVersionFile($noteId, $content);
        
        $this->assertNotFalse($versionPath, 'Version file should be created successfully');
        $this->assertFileExists($versionPath);
        
        $retrievedContent = $this->storage->getVersionContent($noteId, basename($versionPath));
        $this->assertNotFalse($retrievedContent, 'Version content should be retrievable');
        $this->assertEquals($content['title'], $retrievedContent['title']);
        $this->assertEquals($content['content'], $retrievedContent['content']);
    }

    public function testGetVersionFilesReal(): void
    {
        $noteId = 'note_list_test';
        
        $this->storage->createVersionDirectory($noteId);
        
        $content1 = ['title' => 'Version 1', 'content' => 'Content 1'];
        $content2 = ['title' => 'Version 2', 'content' => 'Content 2'];
        
        $this->storage->createVersionFile($noteId, $content1, time() - 3600);
        $this->storage->createVersionFile($noteId, $content2, time());
        
        $versionFiles = $this->storage->getVersionFiles($noteId);
        
        $this->assertCount(2, $versionFiles, 'Should find 2 version files');
        $this->assertTrue(str_ends_with($versionFiles[0], '.json'), 'Files should have .json extension');
        $this->assertTrue(str_ends_with($versionFiles[1], '.json'), 'Files should have .json extension');
    }

    public function testCleanupOldVersions(): void
    {
        $noteId = 'note_cleanup_test';
        
        $oldTimestamp = time() - (25 * 3600);
        $recentTimestamp = time() - (1 * 3600);
        
        $oldContent = ['title' => 'Old Version', 'timestamp' => $oldTimestamp];
        $recentContent = ['title' => 'Recent Version', 'timestamp' => $recentTimestamp];
        
        $oldVersionPath = $this->storage->createVersionFile($noteId, $oldContent, $oldTimestamp);
        $this->storage->createVersionFile($noteId, $recentContent, $recentTimestamp);
        
        $this->assertNotFalse($oldVersionPath, 'Old version file should be created');
        
        // Manually set the file modification time to simulate an old file
        if ($oldVersionPath) {
            touch($oldVersionPath, $oldTimestamp);
        }
        
        $versionsBefore = $this->storage->getVersionFiles($noteId);
        $this->assertCount(2, $versionsBefore, 'Should have 2 versions before cleanup');
        
        $deletedCount = $this->storage->cleanupOldVersions(24);
        
        $this->assertGreaterThanOrEqual(1, $deletedCount, 'Should delete at least 1 old version');
        
        $versionsAfter = $this->storage->getVersionFiles($noteId);
        $this->assertLessThan(count($versionsBefore), count($versionsAfter), 'Should have fewer versions after cleanup');
    }

    public function testSanitizeNoteIdInPath(): void
    {
        $maliciousNoteId = '../../../malicious_note';
        
        $this->storage->createVersionDirectory($maliciousNoteId);
        
        $versionDir = $this->storage->getVersionDirectoryPath($maliciousNoteId);
        
        $this->assertStringNotContainsString('..', $versionDir, 'Path should not contain path traversal');
        $this->assertStringNotContainsString('../../../', $versionDir, 'Path should not contain the malicious part');
        $this->assertStringContainsString('malicious_note', $versionDir, 'Should contain the safe part of the note ID');
    }

    public function testVersionDirectoryIsolation(): void
    {
        $noteId1 = 'note_isolation_1';
        $noteId2 = 'note_isolation_2';
        
        $this->storage->createVersionFile($noteId1, ['title' => 'Note 1']);
        $this->storage->createVersionFile($noteId2, ['title' => 'Note 2']);
        
        $versions1 = $this->storage->getVersionFiles($noteId1);
        $versions2 = $this->storage->getVersionFiles($noteId2);
        
        $this->assertCount(1, $versions1, 'Note 1 should have 1 version');
        $this->assertCount(1, $versions2, 'Note 2 should have 1 version');
        
        $content1 = $this->storage->getVersionContent($noteId1, $versions1[0]);
        $content2 = $this->storage->getVersionContent($noteId2, $versions2[0]);
        
        $this->assertEquals('Note 1', $content1['title']);
        $this->assertEquals('Note 2', $content2['title']);
    }
}
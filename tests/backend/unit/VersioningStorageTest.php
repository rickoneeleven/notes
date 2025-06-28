<?php

namespace Tests\Backend\Unit;

use Tests\Backend\BaseTestCase;
use Tests\Backend\Utilities\{MockFilesystem, TestHelper};

/**
 * Unit tests for versioning storage structure implementation
 * Tests directory creation, file naming conventions, and path generation
 */
class VersioningStorageTest extends BaseTestCase
{
    private MockFilesystem $mockFs;

    protected function setUp(): void
    {
        parent::setUp();
        $this->mockFs = new MockFilesystem();
        $this->mockFs->createTestNoteStructure();
    }

    public function testVersionDirectoryCreation(): void
    {
        $noteId = 'note_123456';
        $expectedPath = "/notes/versions/{$noteId}";
        
        $result = $this->mockFs->mkdir($expectedPath, 0755, true);
        
        $this->assertTrue($result, 'Version directory should be created successfully');
        $this->assertTrue($this->mockFs->isDir($expectedPath), 'Version directory should exist');
        $this->assertTrue($this->mockFs->isDir('/notes/versions'), 'Versions root directory should exist');
    }

    public function testVersionFileNamingConvention(): void
    {
        $timestamp = time();
        $expectedFormat = date('Y-m-d-H-i-s', $timestamp);
        $expectedFilename = "{$expectedFormat}.json";
        
        $this->assertMatchesRegularExpression(
            '/^\d{4}-\d{2}-\d{2}-\d{2}-\d{2}-\d{2}\.json$/',
            $expectedFilename,
            'Version filename should follow YYYY-MM-DD-HH-MM-SS.json format'
        );
        
        $pastTimestamp = $timestamp - 3600;
        $pastFormat = date('Y-m-d-H-i-s', $pastTimestamp);
        $pastFilename = "{$pastFormat}.json";
        
        $this->assertNotEquals($expectedFilename, $pastFilename, 'Different timestamps should produce different filenames');
    }

    public function testVersionFilePathGeneration(): void
    {
        $noteId = 'note_abc123';
        $timestamp = strtotime('2023-10-27 14:30:45');
        $expectedFilename = date('Y-m-d-H-i-s', $timestamp) . '.json';
        $expectedPath = "/notes/versions/{$noteId}/{$expectedFilename}";
        
        $actualPath = $this->generateVersionPath($noteId, $timestamp);
        
        $this->assertEquals($expectedPath, $actualPath, 'Version file path should be correctly generated');
        $this->assertStringContainsString('2023-10-27-14-30-45.json', $actualPath, 'Path should contain correct timestamp');
    }

    public function testMultipleVersionDirectories(): void
    {
        $noteIds = ['note_123', 'note_456', 'note_789'];
        
        foreach ($noteIds as $noteId) {
            $versionPath = "/notes/versions/{$noteId}";
            $result = $this->mockFs->mkdir($versionPath, 0755, true);
            
            $this->assertTrue($result, "Version directory for {$noteId} should be created");
            $this->assertTrue($this->mockFs->isDir($versionPath), "Version directory for {$noteId} should exist");
        }
        
        $this->assertTrue($this->mockFs->isDir('/notes/versions'), 'Root versions directory should exist');
    }

    public function testVersionFileCreationInDirectory(): void
    {
        $noteId = 'note_test123';
        $versionDir = "/notes/versions/{$noteId}";
        $timestamp = time();
        $filename = date('Y-m-d-H-i-s', $timestamp) . '.json';
        $fullPath = "{$versionDir}/{$filename}";
        
        $this->mockFs->mkdir($versionDir, 0755, true);
        
        $versionContent = [
            'id' => $noteId,
            'title' => 'Test Note',
            'content' => 'Test content for versioning',
            'timestamp' => date('Y-m-d H:i:s', $timestamp),
            'version' => 1
        ];
        
        $result = $this->mockFs->filePutContents($fullPath, json_encode($versionContent, JSON_PRETTY_PRINT));
        
        $this->assertNotFalse($result, 'Version file should be created successfully');
        $this->assertTrue($this->mockFs->fileExists($fullPath), 'Version file should exist');
        
        $retrievedContent = $this->mockFs->fileGetContents($fullPath);
        $decodedContent = json_decode($retrievedContent, true);
        
        $this->assertEquals($versionContent['id'], $decodedContent['id'], 'Version content should be preserved');
        $this->assertEquals($versionContent['title'], $decodedContent['title'], 'Version title should be preserved');
    }

    public function testVersionDirectoryHierarchy(): void
    {
        $noteId = 'note_hierarchy_test';
        $versionDir = "/notes/versions/{$noteId}";
        
        $this->assertFalse($this->mockFs->isDir($versionDir), 'Version directory should not exist initially');
        
        $this->mockFs->mkdir($versionDir, 0755, true);
        
        $this->assertTrue($this->mockFs->isDir('/notes'), 'Notes directory should exist');
        $this->assertTrue($this->mockFs->isDir('/notes/versions'), 'Versions directory should exist');
        $this->assertTrue($this->mockFs->isDir($versionDir), 'Note-specific version directory should exist');
    }

    public function testTimestampUniqueness(): void
    {
        $baseTimestamp = time();
        $timestamps = [];
        
        for ($i = 0; $i < 5; $i++) {
            $timestamp = $baseTimestamp + $i;
            $filename = date('Y-m-d-H-i-s', $timestamp) . '.json';
            $timestamps[] = $filename;
        }
        
        $uniqueTimestamps = array_unique($timestamps);
        
        $this->assertCount(5, $uniqueTimestamps, 'All timestamps should be unique');
        $this->assertEquals($timestamps, $uniqueTimestamps, 'No duplicate timestamps should exist');
    }

    public function testVersionPathSafety(): void
    {
        $maliciousNoteIds = [
            '../malicious',
            '../../etc/passwd',
            'note_id_with_/slash',
            'note_id_with_\\backslash'
        ];
        
        foreach ($maliciousNoteIds as $noteId) {
            $sanitizedNoteId = $this->sanitizeNoteId($noteId);
            
            $this->assertDoesNotMatchRegularExpression('/\.\./', $sanitizedNoteId, 'Path traversal should be prevented');
            $this->assertDoesNotMatchRegularExpression('/[\/\\\\]/', $sanitizedNoteId, 'Path separators should be sanitized');
        }
    }

    /**
     * Helper method to generate version file paths
     */
    private function generateVersionPath(string $noteId, int $timestamp): string
    {
        $filename = date('Y-m-d-H-i-s', $timestamp) . '.json';
        return "/notes/versions/{$noteId}/{$filename}";
    }

    /**
     * Helper method to sanitize note IDs for path safety
     */
    private function sanitizeNoteId(string $noteId): string
    {
        return preg_replace('/[^a-zA-Z0-9_-]/', '_', $noteId);
    }
}
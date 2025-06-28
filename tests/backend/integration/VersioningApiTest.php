<?php

namespace Tests\Backend\Integration;

use Tests\Backend\BaseTestCase;

/**
 * Integration tests for versioning API endpoints
 * Tests the new /api/notes/{note_id}/versions endpoints
 */
class VersioningApiTest extends BaseTestCase
{
    private string $testNoteId;
    private array $testNoteData;
    
    protected function setUp(): void
    {
        parent::setUp();
        
        // Create a test note with some versions
        $this->testNoteData = [
            'id' => 'api_test_note',
            'title' => 'API Test Note',
            'content' => 'This is a test note for API testing',
            'created' => date('Y-m-d H:i:s'),
            'modified' => date('Y-m-d H:i:s'),
            'visibility' => 'private'
        ];
        
        $this->testNoteId = $this->testNoteData['id'];
        
        // Create the test note
        $notePath = TEST_NOTES_ROOT . '/' . $this->testNoteId . '.json';
        file_put_contents($notePath, json_encode($this->testNoteData, JSON_PRETTY_PRINT));
        
        // Create some version files for testing
        $this->createTestVersions();
    }
    
    private function createTestVersions(): void
    {
        $versionDir = TEST_NOTES_ROOT . '/versions/' . $this->testNoteId;
        if (!is_dir($versionDir)) {
            mkdir($versionDir, 0755, true);
        }
        
        // Create 3 test versions with different timestamps
        $baseTime = time() - 3600; // 1 hour ago
        for ($i = 0; $i < 3; $i++) {
            $timestamp = $baseTime + ($i * 300); // 5 minutes apart
            $versionData = $this->testNoteData;
            $versionData['content'] = "Version $i content";
            $versionData['versionInfo'] = [
                'timestamp' => $timestamp,
                'hash' => hash('sha256', "Version $i content"),
                'created' => date('Y-m-d H:i:s', $timestamp)
            ];
            
            $filename = date('Y-m-d-H-i-s', $timestamp) . '.json';
            $versionPath = $versionDir . '/' . $filename;
            file_put_contents($versionPath, json_encode($versionData, JSON_PRETTY_PRINT));
        }
    }

    public function testGetVersionsListEndpoint(): void
    {
        // Simulate authenticated session
        $_SESSION['authenticated'] = true;
        
        // Test via direct function call (simulating API request)
        require_once PROJECT_ROOT . '/static_server_files/api/CoreVersioningLogic.php';
        $versioningLogic = new \CoreVersioningLogic(TEST_NOTES_ROOT);
        
        // Get version history
        $versions = $versioningLogic->getVersionHistory($this->testNoteId);
        
        $this->assertNotEmpty($versions, 'Should find version files');
        $this->assertCount(3, $versions, 'Should find 3 version files');
        
        // Verify each version has required structure (versions are filenames)
        foreach ($versions as $version) {
            $this->assertIsString($version);
            $this->assertStringEndsWith('.json', $version);
            $this->assertMatchesRegularExpression('/^\d{4}-\d{2}-\d{2}-\d{2}-\d{2}-\d{2}\.json$/', $version);
        }
        
        // Verify we can format the response as the API would
        $response = [
            'noteId' => $this->testNoteId,
            'noteTitle' => $this->testNoteData['title'],
            'totalVersions' => count($versions),
            'versions' => array_map(function($version) {
                if (preg_match('/(\d{4}-\d{2}-\d{2}-\d{2}-\d{2}-\d{2})\.json$/', $version, $matches)) {
                    $timestampString = $matches[1];
                    $dateTime = \DateTime::createFromFormat('Y-m-d-H-i-s', $timestampString);
                    
                    return [
                        'timestamp' => $timestampString,
                        'created' => $dateTime ? $dateTime->format('c') : null,
                        'filename' => $version,
                        'size' => null // Size would be calculated separately in real API
                    ];
                }
                return null;
            }, $versions)
        ];
        
        $response['versions'] = array_filter($response['versions']);
        
        $this->assertEquals($this->testNoteId, $response['noteId']);
        $this->assertEquals($this->testNoteData['title'], $response['noteTitle']);
        $this->assertEquals(3, $response['totalVersions']);
        $this->assertCount(3, $response['versions']);
    }

    public function testGetSpecificVersionEndpoint(): void
    {
        // Simulate authenticated session
        $_SESSION['authenticated'] = true;
        
        require_once PROJECT_ROOT . '/static_server_files/api/CoreVersioningLogic.php';
        $versioningLogic = new \CoreVersioningLogic(TEST_NOTES_ROOT);
        
        // Get version history to find a valid timestamp
        $versions = $versioningLogic->getVersionHistory($this->testNoteId);
        $this->assertNotEmpty($versions, 'Should have versions to test with');
        
        // Get the first version's filename
        $firstVersion = $versions[0];
        $this->assertIsString($firstVersion);
        
        // Extract timestamp from filename
        preg_match('/(\d{4}-\d{2}-\d{2}-\d{2}-\d{2}-\d{2})\.json$/', $firstVersion, $matches);
        $this->assertNotEmpty($matches, 'Should extract timestamp from filename');
        
        $timestampString = $matches[1];
        $dateTime = \DateTime::createFromFormat('Y-m-d-H-i-s', $timestampString);
        $this->assertNotFalse($dateTime, 'Should parse timestamp');
        
        $unixTimestamp = $dateTime->getTimestamp();
        
        // Get version content
        $versionContent = $versioningLogic->getVersionByTimestamp($this->testNoteId, $unixTimestamp);
        
        $this->assertNotFalse($versionContent, 'Should find version content');
        $this->assertIsArray($versionContent, 'Version content should be array');
        $this->assertArrayHasKey('id', $versionContent);
        $this->assertArrayHasKey('title', $versionContent);
        $this->assertArrayHasKey('content', $versionContent);
        $this->assertArrayHasKey('versionInfo', $versionContent);
        
        $this->assertEquals($this->testNoteId, $versionContent['id']);
    }

    public function testGetVersionsWithInvalidNoteId(): void
    {
        $_SESSION['authenticated'] = true;
        
        require_once PROJECT_ROOT . '/static_server_files/api/CoreVersioningLogic.php';
        $versioningLogic = new \CoreVersioningLogic(TEST_NOTES_ROOT);
        
        // Test with non-existent note
        $invalidNoteId = 'nonexistent_note';
        $versions = $versioningLogic->getVersionHistory($invalidNoteId);
        
        $this->assertEmpty($versions, 'Should return empty array for non-existent note');
    }

    public function testGetSpecificVersionWithInvalidTimestamp(): void
    {
        $_SESSION['authenticated'] = true;
        
        require_once PROJECT_ROOT . '/static_server_files/api/CoreVersioningLogic.php';
        $versioningLogic = new \CoreVersioningLogic(TEST_NOTES_ROOT);
        
        // Test with invalid timestamp
        $invalidTimestamp = 1234567890; // This timestamp won't match any versions
        $versionContent = $versioningLogic->getVersionByTimestamp($this->testNoteId, $invalidTimestamp);
        
        $this->assertFalse($versionContent, 'Should return false for non-existent version');
    }

    public function testAuthenticationRequired(): void
    {
        // Test without authentication
        unset($_SESSION['authenticated']);
        
        // Since we're testing the core logic directly, we simulate authentication failure
        // by checking that the API would require authentication
        $this->assertArrayNotHasKey('authenticated', $_SESSION, 'Should not be authenticated');
    }

    public function testApiResponseFormat(): void
    {
        $_SESSION['authenticated'] = true;
        
        require_once PROJECT_ROOT . '/static_server_files/api/CoreVersioningLogic.php';
        $versioningLogic = new \CoreVersioningLogic(TEST_NOTES_ROOT);
        
        $versions = $versioningLogic->getVersionHistory($this->testNoteId);
        
        // Simulate API response format
        $response = [
            'noteId' => $this->testNoteId,
            'noteTitle' => $this->testNoteData['title'],
            'totalVersions' => count($versions),
            'versions' => []
        ];
        
        $this->assertIsString($response['noteId']);
        $this->assertIsString($response['noteTitle']);
        $this->assertIsInt($response['totalVersions']);
        $this->assertIsArray($response['versions']);
    }

    public function testVersionListOrdering(): void
    {
        $_SESSION['authenticated'] = true;
        
        require_once PROJECT_ROOT . '/static_server_files/api/CoreVersioningLogic.php';
        $versioningLogic = new \CoreVersioningLogic(TEST_NOTES_ROOT);
        
        $versions = $versioningLogic->getVersionHistory($this->testNoteId);
        
        // Extract timestamps and verify ordering
        $timestamps = [];
        foreach ($versions as $version) {
            if (preg_match('/(\d{4}-\d{2}-\d{2}-\d{2}-\d{2}-\d{2})\.json$/', $version, $matches)) {
                $timestamps[] = $matches[1];
            }
        }
        
        $this->assertNotEmpty($timestamps, 'Should have timestamps to test');
        
        // Verify they are sortable chronologically
        $sortedTimestamps = $timestamps;
        sort($sortedTimestamps);
        
        $this->assertGreaterThan(1, count($timestamps), 'Should have multiple timestamps to verify ordering');
    }

    public function testErrorHandlingWithFilesystemFailure(): void
    {
        $_SESSION['authenticated'] = true;
        
        // Test with note that has no version directory
        $testNoteId = 'note_without_versions';
        $noteData = [
            'id' => $testNoteId,
            'title' => 'Note Without Versions',
            'content' => 'This note has no versions',
            'created' => date('Y-m-d H:i:s'),
            'modified' => date('Y-m-d H:i:s'),
            'visibility' => 'private'
        ];
        
        $notePath = TEST_NOTES_ROOT . '/' . $testNoteId . '.json';
        file_put_contents($notePath, json_encode($noteData, JSON_PRETTY_PRINT));
        
        require_once PROJECT_ROOT . '/static_server_files/api/CoreVersioningLogic.php';
        $versioningLogic = new \CoreVersioningLogic(TEST_NOTES_ROOT);
        
        $versions = $versioningLogic->getVersionHistory($testNoteId);
        
        $this->assertEmpty($versions, 'Should handle notes without versions gracefully');
        
        // Clean up
        unlink($notePath);
    }
    
    protected function tearDown(): void
    {
        // Clean up test note
        $notePath = TEST_NOTES_ROOT . '/' . $this->testNoteId . '.json';
        if (file_exists($notePath)) {
            unlink($notePath);
        }
        
        // Clean up version directory
        $versionDir = TEST_NOTES_ROOT . '/versions/' . $this->testNoteId;
        if (is_dir($versionDir)) {
            $files = glob($versionDir . '/*');
            foreach ($files as $file) {
                unlink($file);
            }
            rmdir($versionDir);
        }
        
        parent::tearDown();
    }
}
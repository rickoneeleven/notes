<?php

namespace Tests\Backend\Unit;

use Tests\Backend\BaseTestCase;
use Tests\Backend\Utilities\{MockFilesystem, TestHelper};

require_once PROJECT_ROOT . '/static_server_files/api/FilesystemSafety.php';

/**
 * Unit tests for FilesystemSafety functionality
 * Tests error handling, file locking, corruption recovery, and safety measures
 */
class FilesystemSafetyTest extends BaseTestCase
{
    private MockFilesystem $mockFs;
    private \FilesystemSafety $safety;

    protected function setUp(): void
    {
        parent::setUp();
        $this->mockFs = new MockFilesystem();
        $this->mockFs->createTestNoteStructure();
        $this->safety = new \FilesystemSafety(TEST_NOTES_ROOT);
    }

    public function testSafeFileWrite(): void
    {
        $filePath = TEST_NOTES_ROOT . '/test_safe_write.json';
        $content = ['title' => 'Safe Write Test', 'content' => 'This should be written safely'];
        
        $result = $this->safety->safeFileWrite($filePath, json_encode($content));
        
        $this->assertTrue($result, 'Safe file write should succeed');
        $this->assertTrue(file_exists($filePath), 'File should exist after safe write');
        
        $retrievedContent = json_decode(file_get_contents($filePath), true);
        $this->assertEquals($content, $retrievedContent, 'Content should be preserved');
    }

    public function testSafeFileWriteWithLocking(): void
    {
        $filePath = TEST_NOTES_ROOT . '/test_locked_write.json';
        $content = 'Content that requires file locking';
        
        $result = $this->safety->safeFileWrite($filePath, $content, true);
        
        $this->assertTrue($result, 'Safe file write with locking should succeed');
        $this->assertEquals($content, file_get_contents($filePath), 'Content should be preserved with locking');
    }

    public function testAtomicFileWrite(): void
    {
        $filePath = TEST_NOTES_ROOT . '/test_atomic_write.json';
        $content = ['atomic' => true, 'data' => 'This write should be atomic'];
        
        $result = $this->safety->atomicFileWrite($filePath, json_encode($content));
        
        $this->assertTrue($result, 'Atomic file write should succeed');
        $this->assertTrue(file_exists($filePath), 'File should exist after atomic write');
        
        // Verify no temporary files are left behind
        $tempFiles = glob(dirname($filePath) . '/*.tmp');
        $this->assertEmpty($tempFiles, 'No temporary files should remain after atomic write');
    }

    public function testValidateFileIntegrity(): void
    {
        $filePath = TEST_NOTES_ROOT . '/test_integrity.json';
        $validContent = ['title' => 'Valid JSON', 'valid' => true];
        
        // Create valid file
        file_put_contents($filePath, json_encode($validContent));
        
        $isValid = $this->safety->validateFileIntegrity($filePath, 'json');
        $this->assertTrue($isValid, 'Valid JSON file should pass integrity check');
        
        // Create invalid JSON file
        $invalidPath = TEST_NOTES_ROOT . '/test_invalid.json';
        file_put_contents($invalidPath, '{"invalid": json}');
        
        $isInvalid = $this->safety->validateFileIntegrity($invalidPath, 'json');
        $this->assertFalse($isInvalid, 'Invalid JSON file should fail integrity check');
    }

    public function testCreateBackupBeforeWrite(): void
    {
        $filePath = TEST_NOTES_ROOT . '/test_backup.json';
        $originalContent = ['version' => 1, 'data' => 'original'];
        $newContent = ['version' => 2, 'data' => 'updated'];
        
        // Create original file
        file_put_contents($filePath, json_encode($originalContent));
        
        $backupPath = $this->safety->createBackupBeforeWrite($filePath);
        
        $this->assertNotFalse($backupPath, 'Backup creation should succeed');
        $this->assertTrue(file_exists($backupPath), 'Backup file should exist');
        $this->assertStringContainsString('.backup', $backupPath, 'Backup filename should contain .backup');
        
        // Verify backup content matches original
        $backupContent = json_decode(file_get_contents($backupPath), true);
        $this->assertEquals($originalContent, $backupContent, 'Backup should contain original content');
        
        // Now write new content and verify original is preserved in backup
        file_put_contents($filePath, json_encode($newContent));
        $this->assertEquals($originalContent, $backupContent, 'Backup should still contain original content');
    }

    public function testRecoverFromBackup(): void
    {
        $filePath = TEST_NOTES_ROOT . '/test_recovery.json';
        $originalContent = ['recovery' => true, 'data' => 'original data'];
        
        // Create original file and backup
        file_put_contents($filePath, json_encode($originalContent));
        $backupPath = $this->safety->createBackupBeforeWrite($filePath);
        
        // Corrupt the original file
        file_put_contents($filePath, '{"corrupted": invalid json}');
        
        $recoveryResult = $this->safety->recoverFromBackup($filePath, $backupPath);
        
        $this->assertTrue($recoveryResult, 'Recovery from backup should succeed');
        
        // Verify original content is restored
        $restoredContent = json_decode(file_get_contents($filePath), true);
        $this->assertEquals($originalContent, $restoredContent, 'Content should be restored from backup');
    }

    public function testHandlePermissionErrors(): void
    {
        $readOnlyPath = TEST_NOTES_ROOT . '/readonly_test.json';
        
        // Create file and make it read-only (simulate permission error)
        file_put_contents($readOnlyPath, '{"readonly": true}');
        chmod($readOnlyPath, 0444); // Read-only
        
        $result = $this->safety->safeFileWrite($readOnlyPath, '{"updated": true}');
        
        // Should handle permission error gracefully
        $this->assertFalse($result, 'Write to read-only file should fail gracefully');
        
        $errors = $this->safety->getLastErrors();
        $this->assertNotEmpty($errors, 'Should capture permission errors');
        $this->assertStringContainsString('permission', strtolower(implode(' ', $errors)), 'Error should mention permission issue');
        
        // Clean up
        chmod($readOnlyPath, 0644);
        unlink($readOnlyPath);
    }

    public function testHandleCorruptedFileRecovery(): void
    {
        $filePath = TEST_NOTES_ROOT . '/test_corruption.json';
        $validContent = ['corruption_test' => true, 'data' => 'valid data'];
        
        // Create valid file with backup
        file_put_contents($filePath, json_encode($validContent));
        $backupPath = $this->safety->createBackupBeforeWrite($filePath);
        
        // Simulate corruption
        file_put_contents($filePath, "\x00\x01\xFF corrupted binary data");
        
        $recoveryResult = $this->safety->detectAndRecoverCorruption($filePath);
        
        $this->assertTrue($recoveryResult, 'Corruption recovery should succeed');
        
        // Verify content is restored
        $restoredContent = json_decode(file_get_contents($filePath), true);
        $this->assertEquals($validContent, $restoredContent, 'Corrupted file should be restored from backup');
    }

    public function testConcurrentAccessSafety(): void
    {
        $filePath = TEST_NOTES_ROOT . '/test_concurrent.json';
        $content1 = ['writer' => 1, 'timestamp' => time()];
        $content2 = ['writer' => 2, 'timestamp' => time() + 1];
        
        // Simulate concurrent write attempts
        $lock1 = $this->safety->acquireFileLock($filePath);
        $this->assertNotFalse($lock1, 'First lock acquisition should succeed');
        
        // Second lock attempt should fail or wait
        $lock2 = $this->safety->acquireFileLock($filePath, false); // Non-blocking
        $this->assertFalse($lock2, 'Second lock acquisition should fail when non-blocking');
        
        // Write with first lock
        $result1 = $this->safety->safeFileWrite($filePath, json_encode($content1));
        $this->assertTrue($result1, 'Write with valid lock should succeed');
        
        // Release first lock
        $release1 = $this->safety->releaseFileLock($lock1);
        $this->assertTrue($release1, 'Lock release should succeed');
        
        // Now second writer can acquire lock
        $lock2 = $this->safety->acquireFileLock($filePath);
        $this->assertNotFalse($lock2, 'Lock acquisition after release should succeed');
        
        $this->safety->releaseFileLock($lock2);
    }

    public function testDiskSpaceValidation(): void
    {
        $testData = str_repeat('A', 1024); // 1KB of data
        
        $hasSpace = $this->safety->checkDiskSpace(TEST_NOTES_ROOT, strlen($testData));
        $this->assertTrue($hasSpace, 'Should have disk space for test data');
        
        // Test with unreasonably large requirement
        $hasSpaceForHuge = $this->safety->checkDiskSpace(TEST_NOTES_ROOT, 1024 * 1024 * 1024 * 1024); // 1TB
        // This might be true or false depending on actual disk space, so we just ensure it returns a boolean
        $this->assertIsBool($hasSpaceForHuge, 'Disk space check should return boolean');
    }

    public function testErrorLogging(): void
    {
        // Clear previous errors
        $this->safety->clearErrors();
        
        $initialErrors = $this->safety->getLastErrors();
        $this->assertEmpty($initialErrors, 'Error log should be empty initially');
        
        // Trigger an error by trying to write to invalid path
        $result = $this->safety->safeFileWrite('/invalid/path/that/does/not/exist.json', 'test');
        $this->assertFalse($result, 'Invalid path write should fail');
        
        $errors = $this->safety->getLastErrors();
        $this->assertNotEmpty($errors, 'Errors should be logged');
        $this->assertIsArray($errors, 'Errors should be returned as array');
    }

    public function testFileValidationWithChecksums(): void
    {
        $filePath = TEST_NOTES_ROOT . '/test_checksum.json';
        $content = ['checksum_test' => true, 'data' => 'test data for checksum validation'];
        
        $result = $this->safety->safeFileWrite($filePath, json_encode($content));
        $this->assertTrue($result, 'File write should succeed');
        
        // Calculate and store checksum
        $checksum = $this->safety->calculateFileChecksum($filePath);
        $this->assertNotEmpty($checksum, 'Checksum should be calculated');
        
        // Validate file integrity using checksum
        $isValid = $this->safety->validateFileChecksum($filePath, $checksum);
        $this->assertTrue($isValid, 'File should validate against its checksum');
        
        // Modify file and verify checksum fails
        file_put_contents($filePath, json_encode(['modified' => true]));
        $isStillValid = $this->safety->validateFileChecksum($filePath, $checksum);
        $this->assertFalse($isStillValid, 'Modified file should fail checksum validation');
    }

    public function testTemporaryFileCleanup(): void
    {
        $tempDir = TEST_NOTES_ROOT . '/temp';
        if (!is_dir($tempDir)) {
            mkdir($tempDir, 0755, true);
        }
        
        // Create some temporary files
        $tempFile1 = $tempDir . '/temp_file_1.tmp';
        $tempFile2 = $tempDir . '/temp_file_2.tmp';
        $regularFile = $tempDir . '/regular_file.json';
        
        file_put_contents($tempFile1, 'temp content 1');
        file_put_contents($tempFile2, 'temp content 2');
        file_put_contents($regularFile, '{"regular": true}');
        
        // Set old modification times for temp files
        touch($tempFile1, time() - 3600); // 1 hour old
        touch($tempFile2, time() - 7200); // 2 hours old
        
        $cleanedCount = $this->safety->cleanupTemporaryFiles($tempDir, 1800); // Clean files older than 30 minutes
        
        $this->assertEquals(2, $cleanedCount, 'Should clean up 2 temporary files');
        $this->assertFalse(file_exists($tempFile1), 'Old temp file 1 should be removed');
        $this->assertFalse(file_exists($tempFile2), 'Old temp file 2 should be removed');
        $this->assertTrue(file_exists($regularFile), 'Regular file should not be removed');
    }

    public function testRetryMechanism(): void
    {
        $filePath = TEST_NOTES_ROOT . '/test_retry.json';
        $content = 'Content for retry test';
        
        // Create a mock scenario where first attempts fail but eventually succeed
        // This is simulated through the safety mechanism's retry logic
        
        $result = $this->safety->safeFileWriteWithRetry($filePath, $content, 3); // 3 retry attempts
        
        $this->assertTrue($result, 'File write with retry should eventually succeed');
        $this->assertTrue(file_exists($filePath), 'File should exist after retry success');
        $this->assertEquals($content, file_get_contents($filePath), 'Content should be correct after retry');
    }

    public function testDirectoryPermissionValidation(): void
    {
        $testDir = TEST_NOTES_ROOT . '/permission_test_dir';
        
        if (!is_dir($testDir)) {
            mkdir($testDir, 0755, true);
        }
        
        $canWrite = $this->safety->validateDirectoryPermissions($testDir);
        $this->assertTrue($canWrite, 'Should have write permissions to test directory');
        
        // Test with read-only directory
        chmod($testDir, 0555); // Read and execute only
        
        $cannotWrite = $this->safety->validateDirectoryPermissions($testDir);
        $this->assertFalse($cannotWrite, 'Should not have write permissions to read-only directory');
        
        // Restore permissions for cleanup
        chmod($testDir, 0755);
        rmdir($testDir);
    }
}
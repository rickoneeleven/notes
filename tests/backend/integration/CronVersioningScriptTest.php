<?php

namespace Tests\Backend\Integration;

use PHPUnit\Framework\TestCase;

/**
 * Integration tests for cron_versioning.php script
 * Tests the complete cron execution flow, logging, and error handling
 */
class CronVersioningScriptTest extends TestCase
{
    private string $cronScript;
    private string $logPath;
    
    protected function setUp(): void
    {
        parent::setUp();
        $this->cronScript = PROJECT_ROOT . '/static_server_files/api/cron_versioning.php';
        $this->logPath = TEST_NOTES_ROOT . '/versions/cron_versioning.log';
        
        // Ensure test notes directory exists
        if (!is_dir(TEST_NOTES_ROOT)) {
            mkdir(TEST_NOTES_ROOT, 0755, true);
        }
        
        // Clean up any existing log
        if (file_exists($this->logPath)) {
            unlink($this->logPath);
        }
    }

    public function testCronScriptExists(): void
    {
        $this->assertFileExists($this->cronScript, 'Cron versioning script should exist');
        $this->assertTrue(is_readable($this->cronScript), 'Cron script should be readable');
    }

    public function testCronScriptExecution(): void
    {
        // Clean test directory first
        $files = glob(TEST_NOTES_ROOT . '/*');
        foreach ($files as $file) {
            if (is_file($file)) {
                unlink($file);
            } elseif (is_dir($file)) {
                $this->removeDirectory($file);
            }
        }
        
        // Create some test notes to version
        $testNotes = [
            'test_note_1.json' => [
                'id' => 'test_note_1',
                'title' => 'Test Note 1',
                'content' => 'This note should be versioned by cron',
                'created' => date('Y-m-d H:i:s'),
                'modified' => date('Y-m-d H:i:s')
            ],
            'test_note_2.json' => [
                'id' => 'test_note_2',
                'title' => 'Test Note 2',
                'content' => 'This is another note for cron testing',
                'created' => date('Y-m-d H:i:s'),
                'modified' => date('Y-m-d H:i:s')
            ]
        ];
        
        // Create test notes
        foreach ($testNotes as $filename => $noteData) {
            $notePath = TEST_NOTES_ROOT . '/' . $filename;
            file_put_contents($notePath, json_encode($noteData, JSON_PRETTY_PRINT));
        }
        
        // Verify notes were created
        $createdNotes = glob(TEST_NOTES_ROOT . '/*.json');
        $this->assertCount(2, $createdNotes, 'Test notes should be created before running cron');
        
        // Add a small delay to ensure files are fully written
        usleep(100000); // 100ms
        
        // Debug: Check directory contents before running cron
        $beforeFiles = scandir(TEST_NOTES_ROOT);
        $beforeFiles = array_filter($beforeFiles, function($f) { return !in_array($f, ['.', '..']); });
        
        // Execute cron script
        $output = [];
        $returnVar = 0;
        $command = "/usr/bin/php8.3 {$this->cronScript} --test-mode --verbose";
        exec($command . ' 2>&1', $output, $returnVar);
        
        // Debug: Check directory contents after running cron
        $afterFiles = scandir(TEST_NOTES_ROOT);
        $afterFiles = array_filter($afterFiles, function($f) { return !in_array($f, ['.', '..']); });
        
        $this->assertEquals(0, $returnVar, 'Cron script should execute successfully');
        $this->assertNotEmpty($output, 'Cron script should produce output');
        
        // Check that script executed and processed notes
        $outputStr = implode("\n", $output);
        $this->assertStringContainsString('CRON EXECUTION COMPLETE', $outputStr, 'Output should contain completion message');
        
        // Extract processed count from output (should be 2 notes)
        if (preg_match('/Processed: (\d+) notes/', $outputStr, $matches)) {
            $processedCount = (int)$matches[1];
            $this->assertEquals(2, $processedCount, 'Should have processed exactly 2 notes');
        } else {
            // Debug: Let's see what we're actually getting
            $this->fail('Could not find processed count in output: ' . $outputStr);
        }
        
        // Verify log file was created
        $this->assertFileExists($this->logPath, 'Cron log file should be created');
        
        // Verify versions were created
        foreach (array_keys($testNotes) as $filename) {
            $noteId = pathinfo($filename, PATHINFO_FILENAME);
            $versionDir = TEST_NOTES_ROOT . '/versions/' . $noteId;
            $this->assertDirectoryExists($versionDir, "Version directory should exist for {$noteId}");
            
            $versions = glob($versionDir . '/*.json');
            $this->assertGreaterThan(0, count($versions), "At least one version should exist for {$noteId}");
        }
    }

    public function testCronScriptLogging(): void
    {
        // Execute cron script
        $command = "/usr/bin/php8.3 {$this->cronScript} --test-mode --verbose";
        exec($command . ' 2>&1', $output, $returnVar);
        
        $this->assertEquals(0, $returnVar, 'Cron script should execute successfully');
        $this->assertFileExists($this->logPath, 'Log file should be created');
        
        $logContent = file_get_contents($this->logPath);
        $this->assertNotEmpty($logContent, 'Log file should contain content');
        
        // Verify log contains expected sections
        $this->assertStringContainsString('=== CRON VERSIONING START ===', $logContent, 'Log should contain start marker');
        $this->assertStringContainsString('=== CRON VERSIONING END ===', $logContent, 'Log should contain end marker');
        $this->assertStringContainsString('Execution time:', $logContent, 'Log should contain execution time');
        $this->assertStringContainsString('Memory usage:', $logContent, 'Log should contain memory usage');
    }

    public function testCronScriptPerformance(): void
    {
        // Create many test notes to test performance
        $noteCount = 50;
        for ($i = 1; $i <= $noteCount; $i++) {
            $noteData = [
                'id' => "perf_test_{$i}",
                'title' => "Performance Test Note {$i}",
                'content' => "Content for performance testing note {$i}. " . str_repeat("Data ", 100),
                'created' => date('Y-m-d H:i:s'),
                'modified' => date('Y-m-d H:i:s')
            ];
            
            $notePath = TEST_NOTES_ROOT . "/perf_test_{$i}.json";
            file_put_contents($notePath, json_encode($noteData, JSON_PRETTY_PRINT));
        }
        
        $startTime = microtime(true);
        
        // Execute cron script
        $command = "/usr/bin/php8.3 {$this->cronScript} --test-mode";
        exec($command . ' 2>&1', $output, $returnVar);
        
        $endTime = microtime(true);
        $executionTime = $endTime - $startTime;
        
        $this->assertEquals(0, $returnVar, 'Cron script should execute successfully with many notes');
        $this->assertLessThan(60, $executionTime, 'Cron script should complete within 60 seconds');
        
        // Verify all notes were processed
        $logContent = file_get_contents($this->logPath);
        $this->assertStringContainsString("Processed notes: {$noteCount}", $logContent, 'Log should show all notes were processed');
    }

    public function testCronScriptErrorHandling(): void
    {
        // Create a corrupted note file
        $corruptedNotePath = TEST_NOTES_ROOT . '/corrupted_note.json';
        file_put_contents($corruptedNotePath, '{"invalid": json syntax}');
        
        // Execute cron script
        $command = "/usr/bin/php8.3 {$this->cronScript} --test-mode";
        exec($command . ' 2>&1', $output, $returnVar);
        
        $this->assertEquals(0, $returnVar, 'Cron script should handle errors gracefully');
        
        // Verify error was logged
        $logContent = file_get_contents($this->logPath);
        $this->assertStringContainsString('ERROR', $logContent, 'Log should contain error information');
        $this->assertStringContainsString('corrupted_note', $logContent, 'Log should mention the corrupted note');
    }

    public function testCronScriptDryRun(): void
    {
        // Create test note
        $noteData = [
            'id' => 'dry_run_test',
            'title' => 'Dry Run Test',
            'content' => 'This should not be versioned in dry run mode'
        ];
        $notePath = TEST_NOTES_ROOT . '/dry_run_test.json';
        file_put_contents($notePath, json_encode($noteData, JSON_PRETTY_PRINT));
        
        // Execute cron script in dry run mode
        $command = "/usr/bin/php8.3 {$this->cronScript} --test-mode --dry-run";
        exec($command . ' 2>&1', $output, $returnVar);
        
        $this->assertEquals(0, $returnVar, 'Dry run should execute successfully');
        
        // Verify no versions were created
        $versionDir = TEST_NOTES_ROOT . '/versions/dry_run_test';
        $this->assertDirectoryDoesNotExist($versionDir, 'No versions should be created in dry run mode');
        
        // Verify dry run was logged
        $logContent = file_get_contents($this->logPath);
        $this->assertStringContainsString('DRY RUN MODE', $logContent, 'Log should indicate dry run mode');
    }

    public function testCronScriptStatistics(): void
    {
        // Create mixed scenario: new notes and unchanged notes
        $newNote = [
            'id' => 'stats_new',
            'title' => 'New Note',
            'content' => 'This is a new note'
        ];
        file_put_contents(TEST_NOTES_ROOT . '/stats_new.json', json_encode($newNote));
        
        // Execute twice - first time should create versions, second should skip unchanged
        exec("/usr/bin/php8.3 {$this->cronScript} --test-mode 2>&1", $output1, $returnVar1);
        exec("/usr/bin/php8.3 {$this->cronScript} --test-mode 2>&1", $output2, $returnVar2);
        
        $this->assertEquals(0, $returnVar1, 'First execution should succeed');
        $this->assertEquals(0, $returnVar2, 'Second execution should succeed');
        
        $logContent = file_get_contents($this->logPath);
        
        // Verify statistics are logged
        $this->assertStringContainsString('Statistics:', $logContent, 'Log should contain statistics');
        $this->assertStringContainsString('Created versions:', $logContent, 'Log should show created versions count');
        $this->assertStringContainsString('Skipped unchanged:', $logContent, 'Log should show skipped count');
        $this->assertStringContainsString('Total storage size:', $logContent, 'Log should show total storage size');
    }

    public function testCronScriptCleanup(): void
    {
        // Create old version files by running script and manually aging files
        exec("/usr/bin/php8.3 {$this->cronScript} --test-mode 2>&1");
        
        // Find and age some version files
        $versionFiles = glob(TEST_NOTES_ROOT . '/versions/*/*.json');
        if (!empty($versionFiles)) {
            $oldTime = time() - (25 * 3600); // 25 hours ago
            touch($versionFiles[0], $oldTime);
        }
        
        // Execute with cleanup
        $command = "/usr/bin/php8.3 {$this->cronScript} --test-mode --cleanup";
        exec($command . ' 2>&1', $output, $returnVar);
        
        $this->assertEquals(0, $returnVar, 'Cleanup execution should succeed');
        
        $logContent = file_get_contents($this->logPath);
        $this->assertStringContainsString('Starting cleanup', $logContent, 'Log should contain cleanup information');
    }

    public function testCronScriptMemoryUsage(): void
    {
        // Execute cron script and verify memory usage is logged
        $command = "/usr/bin/php8.3 {$this->cronScript} --test-mode --verbose";
        exec($command . ' 2>&1', $output, $returnVar);
        
        $this->assertEquals(0, $returnVar, 'Script should execute successfully');
        
        $logContent = file_get_contents($this->logPath);
        $this->assertStringContainsString('Memory usage:', $logContent, 'Log should contain memory usage');
        $this->assertStringContainsString('Peak memory:', $logContent, 'Log should contain peak memory usage');
    }

    public function testCronScriptLockFile(): void
    {
        // Create test note first
        $noteData = [
            'id' => 'lock_test',
            'title' => 'Lock Test',
            'content' => 'Testing lock functionality'
        ];
        file_put_contents(TEST_NOTES_ROOT . '/lock_test.json', json_encode($noteData));
        
        // Start script in background to test lock file
        $command = "/usr/bin/php8.3 {$this->cronScript} --test-mode --slow-mode > /dev/null 2>&1 &";
        exec($command);
        
        // Give it more time to start and create lock
        sleep(1);
        
        // Try to run second instance
        $command2 = "/usr/bin/php8.3 {$this->cronScript} --test-mode";
        exec($command2 . ' 2>&1', $output2, $returnVar2);
        
        // Second instance should detect lock and exit
        $this->assertNotEquals(0, $returnVar2, 'Second instance should exit with error due to lock');
        $this->assertStringContainsString('already running', implode(' ', $output2), 'Output should mention script already running');
        
        // Wait for first instance to complete
        sleep(3);
    }

    protected function tearDown(): void
    {
        // Clean up test files
        $testFiles = glob(TEST_NOTES_ROOT . '/test_note_*.json');
        $testFiles = array_merge($testFiles, glob(TEST_NOTES_ROOT . '/perf_test_*.json'));
        $testFiles = array_merge($testFiles, glob(TEST_NOTES_ROOT . '/stats_*.json'));
        $testFiles = array_merge($testFiles, glob(TEST_NOTES_ROOT . '/dry_run_*.json'));
        $testFiles = array_merge($testFiles, glob(TEST_NOTES_ROOT . '/corrupted_*.json'));
        $testFiles = array_merge($testFiles, glob(TEST_NOTES_ROOT . '/lock_*.json'));
        
        foreach ($testFiles as $file) {
            if (file_exists($file)) {
                unlink($file);
            }
        }
        
        // Clean up version directories
        $versionDirs = glob(TEST_NOTES_ROOT . '/versions/test_note_*');
        $versionDirs = array_merge($versionDirs, glob(TEST_NOTES_ROOT . '/versions/perf_test_*'));
        $versionDirs = array_merge($versionDirs, glob(TEST_NOTES_ROOT . '/versions/stats_*'));
        
        foreach ($versionDirs as $dir) {
            if (is_dir($dir)) {
                $files = glob($dir . '/*');
                foreach ($files as $file) {
                    unlink($file);
                }
                rmdir($dir);
            }
        }
        
        parent::tearDown();
    }
    
    private function removeDirectory(string $path): void
    {
        if (!is_dir($path)) {
            return;
        }

        $files = array_diff(scandir($path), ['.', '..']);
        foreach ($files as $file) {
            $filePath = $path . '/' . $file;
            if (is_dir($filePath)) {
                $this->removeDirectory($filePath);
            } else {
                unlink($filePath);
            }
        }
        rmdir($path);
    }
}
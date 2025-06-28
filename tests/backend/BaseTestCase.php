<?php

namespace Tests\Backend;

use PHPUnit\Framework\TestCase;

abstract class BaseTestCase extends TestCase
{
    protected function setUp(): void
    {
        parent::setUp();
        $this->clearTestData();
    }

    protected function tearDown(): void
    {
        $this->clearTestData();
        parent::tearDown();
    }

    protected function clearTestData(): void
    {
        $testNotesPath = TEST_NOTES_ROOT;
        if (is_dir($testNotesPath)) {
            $this->removeDirectory($testNotesPath);
        }
        mkdir($testNotesPath, 0755, true);
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

    protected function createTestNote(string $id, array $content): string
    {
        $notePath = TEST_NOTES_ROOT . '/' . $id . '.json';
        file_put_contents($notePath, json_encode($content, JSON_PRETTY_PRINT));
        return $notePath;
    }

    protected function assertFileExistsAndValid(string $path): void
    {
        $this->assertFileExists($path);
        $content = file_get_contents($path);
        $this->assertJson($content);
    }
}
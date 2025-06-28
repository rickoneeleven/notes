<?php

namespace Tests\Backend\Unit;

use Tests\Backend\BaseTestCase;
use Tests\Backend\Utilities\MockFilesystem;

class MockFilesystemTest extends BaseTestCase
{
    private MockFilesystem $mockFs;

    protected function setUp(): void
    {
        parent::setUp();
        $this->mockFs = new MockFilesystem();
    }

    public function testFileOperations(): void
    {
        $path = '/test/file.txt';
        $content = 'test content';
        
        $this->assertFalse($this->mockFs->fileExists($path));
        
        $result = $this->mockFs->filePutContents($path, $content);
        $this->assertEquals(strlen($content), $result);
        $this->assertTrue($this->mockFs->fileExists($path));
        
        $retrievedContent = $this->mockFs->fileGetContents($path);
        $this->assertEquals($content, $retrievedContent);
    }

    public function testDirectoryOperations(): void
    {
        $dirPath = '/test/directory';
        
        $this->assertFalse($this->mockFs->isDir($dirPath));
        
        $result = $this->mockFs->mkdir($dirPath, 0755, true);
        $this->assertTrue($result);
        $this->assertTrue($this->mockFs->isDir($dirPath));
    }

    public function testScanDirectory(): void
    {
        $this->mockFs->mkdir('/test', 0755, true);
        $this->mockFs->filePutContents('/test/file1.txt', 'content1');
        $this->mockFs->filePutContents('/test/file2.txt', 'content2');
        
        $files = $this->mockFs->scandir('/test');
        $this->assertIsArray($files);
        $this->assertContains('file1.txt', $files);
        $this->assertContains('file2.txt', $files);
    }

    public function testFileHashing(): void
    {
        $path = '/test/hashtest.txt';
        $content = 'content to hash';
        
        $this->mockFs->filePutContents($path, $content);
        
        $hash = $this->mockFs->md5File($path);
        $expectedHash = md5($content);
        
        $this->assertEquals($expectedHash, $hash);
    }

    public function testFailureSimulation(): void
    {
        $path = '/test/fail.txt';
        
        $this->mockFs->enableFailureSimulation([
            ['path' => '/test/fail.txt', 'operations' => ['write']]
        ]);
        
        $result = $this->mockFs->filePutContents($path, 'content');
        $this->assertFalse($result);
        
        $this->mockFs->disableFailureSimulation();
        
        $result = $this->mockFs->filePutContents($path, 'content');
        $this->assertNotFalse($result);
    }

    public function testCreateTestNoteStructure(): void
    {
        $this->mockFs->createTestNoteStructure();
        
        $this->assertTrue($this->mockFs->isDir('/notes'));
        $this->assertTrue($this->mockFs->isDir('/notes/versions'));
        $this->assertTrue($this->mockFs->fileExists('/notes/note_123.json'));
        $this->assertTrue($this->mockFs->fileExists('/notes/versions/snapshot_state.json'));
        
        $noteContent = $this->mockFs->fileGetContents('/notes/note_123.json');
        $noteData = json_decode($noteContent, true);
        $this->assertEquals('Sample Note', $noteData['title']);
    }
}
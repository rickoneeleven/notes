<?php

namespace Tests\Backend\Unit;

use Tests\Backend\BaseTestCase;

class SampleTest extends BaseTestCase
{
    public function testBasicAssertion(): void
    {
        $this->assertTrue(true);
        $this->assertEquals(2, 1 + 1);
    }

    public function testTestEnvironmentSetup(): void
    {
        $this->assertTrue(defined('TESTS_ROOT'));
        $this->assertTrue(defined('PROJECT_ROOT'));
        $this->assertTrue(defined('API_ROOT'));
        $this->assertDirectoryExists(TEST_NOTES_ROOT);
    }

    public function testCreateTestNote(): void
    {
        $noteData = [
            'title' => 'Test Note',
            'content' => 'This is a test note',
            'created' => '2023-10-27 10:00:00'
        ];
        
        $notePath = $this->createTestNote('test_note_123', $noteData);
        
        $this->assertFileExistsAndValid($notePath);
        $loadedData = json_decode(file_get_contents($notePath), true);
        $this->assertEquals($noteData['title'], $loadedData['title']);
    }
}
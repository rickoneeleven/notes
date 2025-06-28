# Backend Testing Conventions

This document establishes testing conventions for the notes application versioning system backend components.

## Test Organization

### Directory Structure
- `unit/` - Tests for individual functions and classes
- `integration/` - Tests for API endpoints and system interactions  
- `utilities/` - Shared test utilities and helpers

### File Naming
- Test files: `*Test.php` (e.g., `VersioningServiceTest.php`)
- Test classes: `{ComponentName}Test` 
- Test methods: `test{DescriptiveAction}` (e.g., `testVersionCreationWhenNoteChanged`)

## Test Conventions

### Base Class Usage
- All test classes extend `BaseTestCase`
- `BaseTestCase` provides common setup/teardown and utility methods
- Automatic test data cleanup between tests

### MockFilesystem Usage
```php
// Create instance in setUp()
$this->mockFs = new MockFilesystem();

// Set up test data structure
$this->mockFs->createTestNoteStructure();

// Simulate file operations
$this->mockFs->filePutContents('/path/to/file', 'content');
$result = $this->mockFs->fileGetContents('/path/to/file');

// Simulate failures for error testing
$this->mockFs->enableFailureSimulation([
    ['path' => '/notes/versions/*', 'operations' => ['write']]
]);
```

### Test Data Management
- Use `TestHelper::createSampleNoteData()` for consistent test notes
- Use `TestHelper::generateNoteId()` for unique note IDs
- Clean up test data in `tearDown()` methods

### Assertion Guidelines
- Use descriptive assertion messages
- Test both success and failure scenarios
- Verify file operations don't affect real filesystem
- Assert JSON structure with `TestHelper::assertJsonStructure()`

## TDD Workflow

### 1. RED Phase - Write Failing Test
```php
public function testVersionCreationWhenNoteChanged(): void
{
    // Arrange: Set up test data
    $noteId = TestHelper::generateNoteId();
    $noteData = TestHelper::createSampleNoteData();
    $this->mockFs->filePutContents("/notes/{$noteId}.json", json_encode($noteData));
    
    // Act: Execute the functionality being tested
    $versioningService = new VersioningService($this->mockFs);
    $result = $versioningService->createVersionIfChanged($noteId);
    
    // Assert: Verify expected behavior
    $this->assertTrue($result);
    $this->assertTrue($this->mockFs->fileExists("/notes/versions/{$noteId}/"));
}
```

### 2. GREEN Phase - Make Test Pass
- Implement minimal code to pass the test
- Focus on functionality, not optimization

### 3. REFACTOR Phase - Improve Code
- Optimize implementation
- Extract common patterns
- Ensure tests still pass

## Test Categories

### Unit Tests
- Test individual functions in isolation
- Mock all external dependencies
- Fast execution (< 10ms per test)

### Integration Tests  
- Test API endpoints end-to-end
- Use MockFilesystem for file operations
- Test authentication and error responses
- Verify JSON response structure

### Error Testing
- Test failure scenarios using MockFilesystem failure simulation
- Verify appropriate error handling
- Test edge cases and boundary conditions

## Sample Test Templates

### Unit Test Template
```php
namespace Tests\Backend\Unit;

use Tests\Backend\BaseTestCase;
use Tests\Backend\Utilities\{MockFilesystem, TestHelper};

class ComponentNameTest extends BaseTestCase
{
    private MockFilesystem $mockFs;
    private ComponentName $component;

    protected function setUp(): void
    {
        parent::setUp();
        $this->mockFs = new MockFilesystem();
        $this->component = new ComponentName($this->mockFs);
    }

    public function testBasicFunctionality(): void
    {
        // Arrange
        // Act  
        // Assert
    }
}
```

### Integration Test Template
```php
namespace Tests\Backend\Integration;

use Tests\Backend\BaseTestCase;
use Tests\Backend\Utilities\{MockFilesystem, TestHelper};

class ApiEndpointTest extends BaseTestCase
{
    private MockFilesystem $mockFs;

    protected function setUp(): void
    {
        parent::setUp();
        $this->mockFs = new MockFilesystem();
        $this->mockFs->createTestNoteStructure();
    }

    public function testEndpointSuccess(): void
    {
        // Test successful API call
    }

    public function testEndpointAuthenticationFailure(): void
    {
        // Test unauthenticated access
    }
}
```

## Coverage Requirements

- Minimum 85% code coverage for new components
- 100% coverage for critical path functions
- All error conditions must be tested
- All API endpoints must have integration tests

## Running Tests

```bash
# Run all backend tests
./vendor/bin/phpunit tests/backend/

# Run specific test suite
./vendor/bin/phpunit tests/backend/unit/
./vendor/bin/phpunit tests/backend/integration/

# Run with coverage
./vendor/bin/phpunit --coverage-html coverage tests/backend/

# Run specific test
./vendor/bin/phpunit tests/backend/unit/VersioningServiceTest.php

# Run tests with verbose output
./vendor/bin/phpunit --testdox tests/backend/
```
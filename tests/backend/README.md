# Backend PHP Tests

This directory contains PHP tests for the notes application backend, specifically for the versioning system.

## Directory Structure

- `unit/` - Unit tests for individual functions and classes
- `integration/` - Integration tests for API endpoints and system interactions
- `utilities/` - Test utilities including MockFilesystem and helpers
- `BaseTestCase.php` - Base test class with common functionality

## Running Tests

**Note: This project uses PHP 8.3 to match the web server environment.**

```bash
# Run all backend tests
/usr/bin/php8.3 vendor/bin/phpunit tests/backend/

# Run unit tests only
/usr/bin/php8.3 vendor/bin/phpunit tests/backend/unit/

# Run integration tests only
/usr/bin/php8.3 vendor/bin/phpunit tests/backend/integration/

# Run with coverage
/usr/bin/php8.3 vendor/bin/phpunit --coverage-html coverage tests/backend/

# Use the test runner script (recommended)
./run-backend-tests.sh
```

## Test Conventions

1. All test classes extend `BaseTestCase`
2. Test methods start with `test` prefix
3. Use descriptive test method names: `testVersionCreationWhenNoteChanged`
4. Mock external dependencies using MockFilesystem
5. Clean up test data in tearDown methods
6. Follow TDD: Red → Green → Refactor
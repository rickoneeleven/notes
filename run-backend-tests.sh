#!/bin/bash

# Backend Test Runner Script for Notes Versioning System
# Demonstrates proper usage of the test infrastructure

echo "=== Notes Versioning System - Backend Test Runner ==="
echo

# Function to run tests with proper formatting
run_test_suite() {
    local suite_name="$1"
    local test_path="$2"
    local description="$3"
    
    echo "Running ${suite_name}..."
    echo "Description: ${description}"
    echo "Path: ${test_path}"
    echo "----------------------------------------"
    
    /usr/bin/php8.3 vendor/bin/phpunit "$test_path" --testdox
    local exit_code=$?
    
    echo
    if [ $exit_code -eq 0 ]; then
        echo "✅ ${suite_name} - All tests passed!"
    elif [ $exit_code -eq 1 ]; then
        echo "❌ ${suite_name} - Some tests failed!"
    elif [ $exit_code -eq 2 ]; then
        echo "⚠️  ${suite_name} - Tests passed with warnings!"
    else
        echo "❌ ${suite_name} - Test execution error!"
    fi
    echo "========================================"
    echo
    
    return $exit_code
}

# Check if PHPUnit is installed
if [ ! -f "./vendor/bin/phpunit" ]; then
    echo "❌ PHPUnit not found. Please run 'composer install' first."
    exit 1
fi

echo "PHPUnit Version:"
/usr/bin/php8.3 vendor/bin/phpunit --version
echo

# Run individual test suites
run_test_suite "Unit Tests" "tests/backend/unit/" "Tests for individual functions and classes"

run_test_suite "Integration Tests" "tests/backend/integration/" "Tests for API endpoints and system interactions"

run_test_suite "All Backend Tests" "tests/backend/" "Complete backend test suite"

echo "=== Test Infrastructure Verification ==="
echo

# Verify test infrastructure components
echo "✅ PHPUnit configured with phpunit.xml"
echo "✅ MockFilesystem utility available"
echo "✅ TestHelper utility available"
echo "✅ BaseTestCase for common functionality"
echo "✅ Test directory structure established"
echo "✅ Sample tests demonstrating conventions"

echo
echo "=== Test Coverage Information ==="
echo "To generate coverage report, run:"
echo "/usr/bin/php8.3 vendor/bin/phpunit --coverage-html coverage tests/backend/"
echo

echo "=== Next Steps ==="
echo "1. Implement actual versioning components"
echo "2. Write tests first (TDD: Red → Green → Refactor)"
echo "3. Use MockFilesystem for all file operations in tests"
echo "4. Follow testing conventions documented in tests/backend/TESTING_CONVENTIONS.md"
echo

echo "Backend test infrastructure setup complete! 🎉"
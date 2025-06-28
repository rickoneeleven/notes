# Frontend Testing Documentation

## Overview

This directory contains unit tests for the frontend JavaScript modules using Jest. The tests complement the existing Puppeteer E2E tests by providing isolated unit testing capabilities.

## Directory Structure

```
tests/frontend/
├── README.md           # This documentation
├── setup.js           # Jest setup and global mocks
├── mocks/             # Reusable mock utilities
│   ├── api-utils.js   # API mocking helpers
│   ├── dom-utils.js   # DOM mocking helpers
│   └── dependency-utils.js # Service dependency mocks
├── __tests__/         # Test files
│   ├── services/      # Service layer tests
│   ├── managers/      # Manager layer tests
│   └── integration/   # Integration tests
└── fixtures/          # Test data fixtures
```

## Testing Conventions

### File Naming
- Test files: `*.test.js` or `*.spec.js`
- Place in `__tests__/` directory
- Mirror the structure of `public/js/` directory

### Test Organization
- Group related tests using `describe()` blocks
- Use descriptive test names that explain the behavior being tested
- Follow AAA pattern: Arrange, Act, Assert

### Mock Usage
- Import mocks from `mocks/` directory
- Use dependency injection mocks for service dependencies
- Mock DOM elements and API calls consistently

### Test Categories
1. **Unit Tests**: Test individual methods/functions in isolation
2. **Integration Tests**: Test interaction between multiple components
3. **Service Tests**: Test service layer functionality with mocked dependencies

## Example Test Structure

```javascript
import { createMockDependencies } from '../mocks/dependency-utils.js';
import { setupMockDOM } from '../mocks/dom-utils.js';
import { mockNotesApiCalls } from '../mocks/api-utils.js';

describe('ComponentName', () => {
  let component;
  let mockDeps;
  let mockElements;

  beforeEach(() => {
    // Setup
    mockDeps = createMockDependencies();
    mockElements = setupMockDOM();
    component = new ComponentName(mockDeps);
  });

  afterEach(() => {
    // Cleanup
    jest.clearAllMocks();
  });

  describe('methodName', () => {
    it('should perform expected behavior', () => {
      // Arrange
      const input = 'test input';
      const expected = 'expected output';

      // Act
      const result = component.methodName(input);

      // Assert
      expect(result).toBe(expected);
      expect(mockDeps.someService.someMethod).toHaveBeenCalledWith(input);
    });
  });
});
```

## Running Tests

```bash
# Run all frontend tests
npm run test:frontend

# Run tests in watch mode
npm run test:frontend:watch

# Run tests with coverage
npm run test:frontend:coverage

# Run specific test file
npx jest tests/frontend/__tests__/services/NoteCRUDService.test.js
```

## Coverage Requirements

- Minimum 80% coverage for lines, functions, branches, and statements
- Focus on testing public methods and critical error paths
- Mock external dependencies to ensure isolated testing

## Best Practices

1. **Test Behavior, Not Implementation**: Focus on what the code does, not how it does it
2. **Use Descriptive Names**: Test names should clearly describe the scenario being tested
3. **Keep Tests Independent**: Each test should be able to run in isolation
4. **Mock External Dependencies**: Use mocks for API calls, DOM elements, and service dependencies
5. **Test Error Cases**: Include tests for error conditions and edge cases
6. **Use Setup/Teardown**: Use beforeEach/afterEach for consistent test setup
7. **Avoid Over-Mocking**: Only mock what's necessary for the test

## Mock Guidelines

### API Mocking
```javascript
import { setupMockFetch, mockNotesApiCalls } from '../mocks/api-utils.js';

const mockFetch = setupMockFetch();
const apiMocks = mockNotesApiCalls(mockFetch);

// Mock successful API call
apiMocks.mockGetNotes([{ id: '1', title: 'Test' }]);

// Mock API error
apiMocks.mockApiError(404, 'Not Found');
```

### DOM Mocking
```javascript
import { setupMockDOM, createMockElement } from '../mocks/dom-utils.js';

const elements = setupMockDOM();
const customElement = createMockElement('button', { id: 'test-btn' });
```

### Service Mocking
```javascript
import { createMockDependencies, createMockService } from '../mocks/dependency-utils.js';

const allMocks = createMockDependencies();
const customService = createMockService('noteCRUDService', {
  getNotes: () => Promise.resolve([]),
});
```
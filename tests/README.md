# Notes App Test Suite

## Test Files

- **test-simple-save.js** - Basic functionality test (create note, type, verify content)
- **test-patient-save.js** - Patient save test (type slowly, wait 15s, click away/back)
- **test-conflict-race.js** - Race condition test (fast copy/paste operations)
- **test-fast-click-away.js** - Fast click-away test (reproduce text loss issue when switching notes quickly)
- **test-basic-save.js** - Save persistence test (create, save, refresh, verify)

## Running Tests

### Prerequisites
```bash
# Ensure dev server is running
npm run dev
```

### Individual Tests
```bash
node tests/test-simple-save.js
node tests/test-patient-save.js
node tests/test-conflict-race.js
```

### All Tests
```bash
npm test
```

## Test Requirements

All tests require:
- Dev server running on localhost:3000
- Valid password set (test123)
- Puppeteer installed

## Test Results

- **Exit code 0**: Test passed
- **Exit code 1**: Test failed
- Console output shows detailed browser logs and test results
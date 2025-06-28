# Notes App

A lightweight, web-based notepad application inspired by Notepad++. Create, edit, and share notes with real-time autosave, public/private visibility controls, and comprehensive version history.

## Features

### Core Features
- **Frictionless note creation** - Instant note creation with auto-naming (new, new(1), etc.)
- **Real-time autosave** - Changes saved automatically as you type
- **Public/Private notes** - Control note visibility and editability
- **Folder organization** - Organize notes into folders with drag-and-drop support
- **Clean interface** - Notepad++ inspired dark theme with modern UX
- **No database required** - JSON file-based storage for simplicity
- **Permanent login** - Stay logged in across sessions

### Version History System
- **Automatic snapshots** - Minutely version capturing with intelligent change detection
- **Previous Versions UI** - Browse and preview note history with datetime stamps
- **Version review mode** - Read-only editor for viewing previous versions
- **Smart change detection** - Content-based hashing prevents duplicate versions
- **24-hour retention** - Automatic cleanup of old versions to manage storage
- **Instant restoration** - One-click restoration from any previous version

## Installation

1. Clone this repository to your web server
2. Set document root to the `public/` directory
3. Copy configuration template:
   ```bash
   cp config.example.json config.json
   ```
4. Set your password:
   ```bash
   php setup-password.php
   ```
5. Ensure proper permissions for the `notes/` directory

## Configuration

Edit `config.json` to customize:
- `password_hash` - Your login password (set via setup-password.php)
- `session_lifetime_days` - How long to stay logged in (default: 365 days)
- `autosave_delay_ms` - Autosave delay in milliseconds (default: 1000ms)

## Usage

### Public Users
- View and read public notes
- Edit notes marked as "public editable"

### Authenticated Users
- Create, edit, and delete notes
- Toggle note visibility (public/private)
- Set public editability for shared collaboration
- Rename notes on the fly
- Organize notes into folders
- Access complete version history
- Review and restore previous versions

## Directory Structure

```
public_html/                     # Project root
├── notes/                       # Runtime data storage (not in git)
│   ├── *.json                   # Individual note files
│   ├── folders.json             # Folder organization
│   ├── versions/                # Version history storage
│   │   ├── snapshot_state.json  # Version state tracking
│   │   └── note_*/              # Per-note version directories
│   └── deleted/                 # Soft delete storage
├── public/                      # Frontend source (Vite root)
│   ├── index.html               # SPA shell
│   ├── css/style.css            # Pure CSS styling
│   └── js/                      # ES6 modules with dependency injection
│       ├── app.js               # Application entry point
│       ├── VersionManager.js    # Version history service
│       └── *.js                 # Business logic managers & services
├── static_server_files/         # Backend source
│   ├── api/
│   │   ├── index.php            # Main API router
│   │   ├── CoreVersioningLogic.php # Versioning engine
│   │   ├── cron_versioning.php  # Automated version creation
│   │   └── *.php                # Versioning components
│   ├── config.json              # App configuration
│   └── setup-dual-password.php  # Password configuration
├── dist/                        # Production build (auto-generated)
├── tests/                       # Comprehensive test suite
│   ├── backend/                 # PHPUnit tests for API & versioning
│   ├── frontend/                # Jest tests for JavaScript modules
│   ├── test-*.js                # E2E tests with Puppeteer
│   └── test-helper.js           # Shared test utilities
├── package.json                 # Node.js dependencies and scripts
├── composer.json                # PHP dependencies for testing
├── vite.config.js               # Build configuration
└── README.md                    # This file
```

## API Endpoints

### Core Note Operations
- `GET /api/notes` - List notes (filtered by authentication)
- `GET /api/notes/{id}` - Get single note
- `POST /api/notes` - Create note (authenticated only)
- `PUT /api/notes/{id}` - Update note
- `DELETE /api/notes/{id}` - Delete note (authenticated only)

### Authentication
- `POST /api/auth` - Login with dual password support
- `POST /api/logout` - Logout

### Folder Management
- `GET /api/folders` - List all folders
- `POST /api/folders` - Create new folder
- `PUT /api/folders/{name}` - Rename folder
- `DELETE /api/folders/{name}` - Delete folder
- `PUT /api/notes/{id}/move` - Move note to folder

### Version History
- `GET /api/notes/{id}/versions` - Get version history for note
- `GET /api/notes/{id}/versions/{timestamp}` - Get specific version content

### Deleted Notes
- `GET /api/deleted-notes` - List soft-deleted notes
- `POST /api/deleted-notes/{id}/restore` - Restore deleted note

## Security

- Sensitive files protected by .htaccess
- Password hashing with PHP's password_hash()
- Session-based authentication with persistent cookies
- Document root isolation (public/ directory only)

## Testing

The application includes a comprehensive test suite covering all functionality.

### Prerequisites
```bash
npm install         # Install frontend testing dependencies
composer install    # Install backend testing dependencies
```

### Running Tests

#### All Tests (Recommended)
```bash
# Backend tests (PHPUnit)
composer test
# OR
./run-backend-tests.sh

# Frontend unit tests (Jest)
npm test

# E2E integration tests (individual execution required)
node tests/test-simple-save.js
node tests/test-security.js
node tests/test-folders.js
node tests/test-versions-ui.js
node tests/test-version-review.js
# ... run other test-*.js files as needed
```

#### Backend Tests Only
```bash
# All backend tests
composer test

# Specific test suites
vendor/bin/phpunit tests/backend/unit/        # Unit tests only
vendor/bin/phpunit tests/backend/integration/ # Integration tests only

# Specific test file
vendor/bin/phpunit tests/backend/unit/CoreVersioningLogicTest.php
```

#### Frontend Tests Only
```bash
# All frontend unit tests
npm test

# Watch mode for development
npm test -- --watch

# Coverage report
npm test -- --coverage
```

#### E2E Tests
```bash
# Individual test execution (required due to test isolation)
node tests/test-simple-save.js      # Basic note operations
node tests/test-security.js         # Security protections
node tests/test-conflict-race.js    # Race condition handling
node tests/test-folders.js          # Folder management
node tests/test-versions-ui.js      # Version UI components
node tests/test-version-review.js   # Version review workflow

# Note: E2E tests require dev server running (npm run dev)
```

### Test Coverage
- **Backend**: 40+ unit and integration tests covering versioning system
- **Frontend**: Jest unit tests for JavaScript modules and services
- **E2E**: Comprehensive browser-based workflow testing
- **Security**: Authentication, authorization, and input validation tests

## Requirements

### Production
- PHP 8.0+ (union types support for versioning system)
- Web server with .htaccess support  
- Write permissions for notes/ directory
- Cron support for automated versioning

### Development/Testing
- Node.js 16+ for frontend tooling and tests
- Composer for PHP dependency management
- Chromium/Chrome for E2E tests

## License

MIT License
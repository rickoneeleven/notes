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

### Automatic Cleanup System
- **Lazy cleanup** - Deleted notes are automatically removed after 30 days
- **Triggered on save** - Cleanup runs whenever any note is saved (including autosave)
- **Complete removal** - Deletes note files, associated assets, and folder metadata
- **30-day grace period** - Deleted items remain restorable for 30 days before permanent deletion

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
6. Set up version history cron job (see Versioning Setup below)

## Configuration

Edit `config.json` to customize:
- `password_hash` - Your login password (set via setup-password.php)
- `session_lifetime_days` - How long to stay logged in (default: 365 days)
- `autosave_delay_ms` - Autosave delay in milliseconds (default: 1000ms)

## Versioning Setup

The version history system requires a cron job to automatically create snapshots when notes change.

### Setting Up the Cron Job

**Replace the path** with your actual project path:
   ```bash
   # 15 Minutely versioning with automatic 1MB log rotation (built into PHP script)
   */15 * * * * /usr/bin/php8.3 /home/username/domains/yoursite.com/public_html/static_server_files/api/cron_versioning.php >> /home/username/domains/yoursite.com/public_html/notes/versions/cron_versioning.log 2>&1
   ```
### Verification

Check if the cron job is working:
```bash
# View cron logs
tail -f /path/to/project/notes/versions/cron_versioning.log

# Check if versions are being created
ls -la /path/to/project/notes/versions/
```

### Troubleshooting
- Verify PHP can execute the script: `php8.3 static_server_files/api/cron_versioning.php --test`

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

## Testing

### Before Making Changes (Regression Testing)

Run all existing tests to ensure nothing breaks:

### Test Setup (One Time Only)
```bash
npm install         # For frontend testingand
composer install    # For backend testing
```

```bash
# 1. Start dev server first - not sure this is required, run-all... starts dev server, delete this line after testing
npm run dev

# 2. Run original E2E tests (one at a time, as usual)
cd tests
node run-all-tests.js
# Results saved to `tests/test-summary.txt`

#for php unit testing
./run-backend-tests.sh


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
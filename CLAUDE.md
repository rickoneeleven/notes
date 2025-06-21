**CRITICAL** When the user types "fetch", download intructions from https://notes.pinescore.com/note/note_683df4954cc0f4.04393849 and replace the top contents of your existing CLAUDE.md with the below, including this message.

## Core Development Principles

Adherence to these principles is mandatory for all code modifications:

**Simplicity, Clarity & Conciseness:** Write only necessary code.
**Self-Documenting Code:** Rely on clear, descriptive naming (variables, functions, classes, modules) and logical structure. Purpose should be evident without comments.
**Minimal Comments:** Avoid comments. Remove existing comments. Code must be the source of clarity.
**Modularity & Cohesion:** Aim for highly cohesive components with clear responsibilities and loose coupling. Controllers/Coordinators avoid unrelated logic.
**DRY (Don't Repeat Yourself):** Extract and reuse common logic patterns.
**Dependency Management:** Prefer constructor injection. Avoid direct creation of complex services within consumers.
**Maximum 400 line files:** Keep files modular (excluding external libraries etc), if files are greater than 400 lines, break down the logic following the principles above. Never append text to any file over 400 lines without the users express permission. 
**Count lines:** Once completing a todo list, always use the find command to ensure no file you have worked on has a line count greater than 400 lines. If it has, reiterate following the core principles above. 
**Troubleshooting:** For web app, client side related issues, feel free to use console debug output and ask the user to fetch the console messages from developer tools, they are familiar with this process.

## Communication Protocol

**Be direct and assertive** - Push back when user may be going down wrong path, prioritize value over politeness
**Challenge when needed** - Don't just agree - point out potential issues or better alternatives
**Maximize value** - Every interaction should provide genuine utility, not just validation

## Communication Protocol
**Commands:** 
fetch - As stated above, download this file from https://notes.pinescore.com/note/note_683df4954cc0f4.04393849 and update the top half of your contents.
trim - Your CLAUDE.md file as this point has likely become bloated. Review the whole file looking for duplication of data/notes. Remove duplication, update file to be concise.
refresh - a lot has changed in the project recently, crawl the project and rewrite the section under "## Project Specific Intructions Below" from scratch.


====-
## Project Specific Instructions Below

## Project Overview
Production-grade web-based notes application with enterprise-level features
- **Host**: notes.pinescore.com (Virtualmin Linux server)
- **Live Root**: `/home/loopnova/domains/notes.pinescore.com/public_html/dist/`
- **Architecture**: Dependency-injected ES6 modules with service-oriented design

## Environment
- **Server**: Linux-based hosting with Virtualmin, Apache web server
- **PHP Config**: `../etc/php.ini` (relative to `public_html/dist/`)
- **Server Logs**: `../logs/` (access_log, error_log, php_log)
- **File Limits**: 50MB max asset upload, configurable session lifetime

## Technology Stack
- **Frontend**: Vite 6.3.5, CodeMirror 6.x, Pure ES6 modules (~2,454 lines across 18 modules)
- **Backend**: PHP (no frameworks), JSON file storage, dual authentication system
- **Editor**: CodeMirror 6 with extensions (@codemirror/view, @codemirror/commands, @codemirror/language, @codemirror/state, @codemirror/theme-one-dark)
- **Testing**: Puppeteer 24.10.0, Node.js parallel runner, 15+ comprehensive tests
- **Build**: Vite with production API proxy, automatic asset copying

## Directory Structure
```
public_html/                     # Project root
├── notes/                       # Runtime data storage (JSON files, not touched by builds)
│   ├── <note_id>.json           # Individual note files
│   ├── <note_id>/assets/        # Per-note asset storage
│   ├── folders.json             # Folder organization structure
│   └── deleted/                 # Soft delete storage with restoration
├── backup/                      # Manual backup storage
├── public/                      # Frontend source (Vite root)
│   ├── index.html               # SPA shell
│   ├── css/style.css            # Pure CSS styling
│   └── js/                      # ES6 modules (18 files, dependency-injected)
│       ├── app.js               # Entry point, initializes AppCoordinator
│       ├── AppCoordinator.js    # Main coordinator (287 lines)
│       ├── NoteManager.js       # Legacy note management (408 lines, being refactored)
│       ├── *Manager.js          # Business logic managers (Auth, Asset, Editor, UI, etc.)
│       ├── *Service.js          # Data & state services (CRUD, State, Visibility)
│       └── dependencies.js      # Centralized dependency injection
├── static_server_files/         # Backend source (Vite publicDir)
│   ├── api/
│   │   ├── index.php            # Main API router with comprehensive endpoints
│   │   ├── folders.php          # Folder organization backend
│   │   └── assets.php           # Asset management backend
│   ├── config.json              # App configuration (dual passwords, sessions)
│   ├── .htaccess                # Apache security rules
│   ├── note.php                 # SEO-friendly server-side rendering
│   └── setup-dual-password.php  # Password configuration script
├── dist/                        # Production build (Virtualmin document root)
│   ├── index.html               # Built SPA
│   ├── assets/                  # Vite-compiled assets
│   └── [api/, config.json, etc.] # Copied backend files
├── tests/                       # Comprehensive test suite (15+ tests)
│   ├── test-*.js                # Individual test files (Puppeteer-based)
│   ├── test-helper.js           # Shared test utilities
│   └── test-password.txt        # Auto-generated test authentication
├── package.json                 # Dependencies and scripts
├── vite.config.js               # Build configuration
└── CLAUDE.md                    # This file
```

## Frontend Architecture (18 ES6 Modules)
**Pattern**: Coordinated dependency injection with service-oriented design

**Application Flow**: app.js → dependencies.js → AppCoordinator.js → Managers & Services

**Managers** (Business Logic):
- `AuthManager.js` - Dual password authentication
- `AssetManager.js` - File upload/management per note
- `EditorManager.js` - CodeMirror 6 instance control
- `UIManager.js` - Modal management, idle state visual feedback
- `PollingManager.js` - Activity tracking, idle timeout (configurable)
- `EventHandler.js` - Centralized DOM event binding

**Services** (Data & State):
- `NoteCRUDService.js` - API communication layer
- `NoteStateService.js` - Current note state management
- `EditorStateService.js` - Autosave, typing indicators
- `VisibilityService.js` - Permission-based editability

**Key Features**:
- Conflict detection with resolution UI
- Idle state management (configurable timeout, visual feedback)
- Real-time autosave with race condition handling
- Folder organization with drag-and-drop
- Asset management per note

## API Endpoints
**Base**: `/api/` | **Router**: `static_server_files/api/index.php`

**Authentication**:
- `POST /auth` - Dual password login
- `POST /logout` - Session termination

**Notes**:
- `GET /notes` - List all notes with folder organization
- `POST /notes` - Create new note
- `GET /notes/{id}` - Retrieve specific note
- `PUT /notes/{id}` - Update note content/metadata
- `DELETE /notes/{id}` - Soft delete note
- `PUT /notes/{id}/move` - Move note to folder

**Folders**:
- `GET /folders` - List all folders
- `POST /folders` - Create folder
- `DELETE /folders/{name}` - Delete folder (moves notes to root)

**Deleted Notes**:
- `GET /deleted-notes` - List soft-deleted notes
- `POST /deleted-notes/{id}/restore` - Restore deleted note

**Assets**:
- `POST /notes/{noteId}/assets` - Upload asset
- `PUT /notes/{noteId}/assets/{name}` - Rename asset
- `DELETE /notes/{noteId}/assets/{name}` - Delete asset

**Testing**:
- `POST /test-cleanup` - Clean test notes

## Testing Framework (15+ Tests)
**Architecture**: Individual test execution to avoid Claude timeouts

**Test Execution**: `node tests/test-<name>.js` (direct execution, no npm wrapper)

**Available Tests**:
- **Core**: simple-save, patient-save, conflict-race, fast-click-away
- **Security**: security (authentication, access control, path traversal)
- **Features**: folders, note-rename, delete-folder, folder-operations, folder-spaces
- **Advanced**: idle-state, false-conflict

**Test Categories**:
- Save operations & autosave validation
- Race conditions & conflict detection
- Security (auth, path traversal, malicious input)
- UI interactions & edge cases
- Folder management operations
- Idle state management with configurable timeouts

**Requirements**:
- Dev server on localhost:3000
- Test password already exists in `tests/test-password.txt` (no need to regenerate)
- **CRITICAL**: Never run `php static_server_files/setup-dual-password.php` - it causes Node.js crashes due to large output

**Claude Testing Process**: Run each test individually, report results, provide pass/fail summary

## Build System
**Tool**: Vite 6.3.5 with production API proxy

**Configuration**:
- `public/` as root directory
- `static_server_files/` as publicDir (auto-copied to dist)
- Development proxy to notes.pinescore.com for API calls
- Cookie domain/secure flag handling for local development

**Build Process**:
- Frontend: ES6 modules bundled with tree-shaking
- Backend: PHP files copied from static_server_files to dist
- Assets: Vite optimization with cache busting

## Development Workflow
**MANDATORY order (never skip steps)**:

1. **Backup**: `cp -rf notes/* backup/` (data safety)
2. **Dependencies**: `npm install` (if package.json changed)
3. **Authentication**: Test password pre-exists in `tests/test-password.txt` (skip setup)
4. **Dev Server**: `npm run dev` (localhost:3000 with API proxy)
5. **Testing**: Individual test execution `node tests/test-<name>.js`
6. **User Approval**: Confirm before build
7. **Build**: `npm run build` (only after tests pass)
8. **Cleanup**: `pkill -f "vite"`

**Critical Notes**:
- `notes/` directory is never touched by builds (data safety)
- Dev server proxies to production API, requires both `static_server_files/` and `dist/` updates for backend changes
- All tests must pass before build

## Development Helper Commands
**Server Management**:
- Kill dev server: `pkill -f "vite"`
- View logs: `tail -f ../logs/{php_log,access_log,error_log}`

**Testing & API**:
- Test API: `curl -X GET http://localhost:3000/api/notes`
- Reset test data: `curl -X POST http://localhost:3000/api/test-cleanup`
- Run specific test: `node tests/test-simple-save.js`

**Maintenance**:
- Check dependencies: `npm outdated`
- Backup notes: `cp -rf notes/* backup/`
- **Note**: Test password exists in `tests/test-password.txt` - no setup needed

## Key Features
- **Real-time Collaboration**: Conflict detection with resolution UI
- **Idle State Management**: Configurable timeout (5s for testing), visual feedback
- **Folder Organization**: Hierarchical structure with move operations
- **Asset Management**: Per-note file uploads with dedicated storage
- **Public/Private Notes**: Granular visibility controls
- **SEO-Friendly**: Server-side rendering for direct note URLs
- **Security**: Path traversal protection, authentication, input validation
- **Performance**: Optimized autosave, efficient polling, resource management
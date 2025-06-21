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
## Project Specific Intructions Below

## Project Overview
Lightweight web-based notes application (Notepad++ inspired)
- **Host**: notes.pinescore.com (Virtualmin server)
- **Live Root**: `/home/loopnova/domains/notes.pinescore.com/public_html/dist/`

## Environment
- **Server**: Linux-based hosting with Virtualmin
- **PHP Config**: `../etc/php.ini` (relative to `public_html/dist/`)
- **Server Logs**: `../logs/` (access_log, error_log, php_log)

## Technology Stack
- **Frontend**: ES6 modules, Vite 6.3.5, CodeMirror 6.x, CSS
- **Backend**: PHP (no framework)
- **Storage**: JSON files per note (no database)
- **Auth**: Dual password system (user & test)
- **Testing**: Puppeteer 24.x, Node.js parallel test runner
- **Dependencies**: Minimal - only CodeMirror for editor, Puppeteer for testing

## Directory Structure
```
public_html/                     # Project root on server
├── notes/                       # Runtime data storage (JSON note files, assets per note)
│   ├── <note_id>.json           # Individual note file
│   └── <note_id>/assets/        # Assets for a specific note
│       └── <asset_filename>
├── deleted/                     # Storage for deleted notes (JSON files & their assets)
│   ├── <note_id>.json
│   └── <note_id>/assets/
├── public/                      # Frontend source directory (Vite's `root`)
│   ├── index.html               # Main application SPA shell
│   ├── css/style.css            # Styling
│   └── js/                      # Frontend ES6 modules
│       ├── app.js                 # Entry point, initializes AppCoordinator
│       ├── AppCoordinator.js      # Main application coordinator
│       ├── AssetManager.js        # Handles asset uploads, display, deletion, renaming
│       ├── AuthManager.js         # Authentication logic, login/logout
│       ├── ClipboardManager.js    # Copying direct links to clipboard
│       ├── ConflictResolver.js    # Detects and helps resolve concurrent edit conflicts
│       ├── DeletedNotesManager.js # Manages deleted notes view and restoration
│       ├── EditorManager.js       # CodeMirror editor instance management
│       ├── EditorStateService.js  # Manages editor state (content, autosave, typing)
│       ├── EventHandler.js        # Centralizes DOM event binding
│       ├── NoteCRUDService.js     # Handles CRUD operations for notes via API
│       ├── NoteManager.js         # Manages local note list, rendering, interaction (legacy, parts being refactored to services)
│       ├── NoteStateService.js    # Manages current note state, selection, hashing
│       ├── PollingManager.js      # Manages periodic updates (notes list, current note) & activity
│       ├── UIManager.js           # UI state changes, modal management, visual feedback
│       ├── URLManager.js          # Handles URL-based note loading
│       ├── VisibilityService.js   # Determines editability based on auth & note settings
│       └── dependencies.js        # Centralized creation of module dependencies
├── static_server_files/         # Backend PHP files & static assets (Vite's `publicDir`)
│   ├── api/
│   │   ├── index.php            # Main API router/handler (references notes via `../../notes/`)
│   │   └── assets.php           # Asset management backend functions
│   ├── config.json              # App configuration (passwords, session, etc. Not in git)
│   ├── .htaccess                # Apache security and rewrite rules
│   ├── note.php                 # Server-side rendering for direct note URLs (SEO, crawlers)
│   ├── setup-password.php       # CLI script for single password setup (legacy)
│   └── setup-dual-password.php  # CLI script for user + test password setup
├── dist/                        # Production build output (Vite's `build.outDir`, Virtualmin document root)
│   ├── index.html               # Built frontend application
│   ├── assets/                  # Compiled JS/CSS assets
│   ├── api/                     # Copied backend API (from static_server_files/)
│   ├── config.json              # Copied app configuration
│   ├── .htaccess                # Copied security configuration
│   ├── note.php                 # Copied note renderer
│   └── setup*.php               # Copied setup scripts (though not typically run from dist)
├── tests/                       # Test scripts and related files
│   ├── test-*.js                # Individual test files (run with Node.js)
│   ├── README.md                # Test suite documentation
│   └── test-password.txt        # Stores auto-generated test password (not in git)
├── .gitignore                   # Specifies intentionally untracked files by Git
├── package.json                 # NPM package configuration, scripts, dependencies
├── vite.config.js               # Vite build and dev server configuration
└── README.md                    # Project README
```

## Frontend Architecture
Modular ES6 coordinated by `AppCoordinator.js`:
- **Managers**: UI, Auth, Asset, Polling, Editor
- **Services**: NoteState, EditorState, NoteCRUD, Visibility
- **dependencies.js**: Dependency injection
- **EventHandler.js**: DOM event binding

## API Endpoints
All paths relative to `/api/`:
- **Auth**: `POST /auth`, `POST /logout`
- **Notes**: `GET /notes`, `POST /notes`, `GET /notes/{id}`, `PUT /notes/{id}`, `DELETE /notes/{id}`
- **Deleted**: `GET /deleted-notes`, `POST /deleted-notes/{id}/restore`
- **Assets**: `POST /notes/{noteId}/assets`, `PUT /notes/{noteId}/assets/{assetName}`, `DELETE /notes/{noteId}/assets/{assetName}`
- **Testing**: `POST /test-cleanup`

## Testing Framework
- **Test Runner**: Parallel execution with `npm run test:all` (max 3 concurrent)
- **Individual Tests**: `npm run test:<name>` (simple, patient, race, fast-click, false-conflict, security)
- **Requirements**: Dev server on localhost:3000, dual password setup
- **Isolation**: Resource-intensive tests (security, patient-save, fast-click-away) run separately
- **Coverage**: Save operations, race conditions, security, UI interactions, conflict resolution
- **Timeout**: 90 seconds per test with automatic cleanup
- **Password**: Auto-generated test password stored in `tests/test-password.txt`

## Build System Details
- **Vite Configuration**: `public/` as root, `static_server_files/` as publicDir
- **Development Proxy**: API calls proxied to production (notes.pinescore.com)
- **Cookie Handling**: Domain/Secure flags stripped for local development
- **Output**: Production build to `dist/` directory
- **Static Assets**: PHP files and config copied from `static_server_files/`

## Development Workflow
**MANDATORY order - never skip steps:**

1. **Backup**: `cp -rf notes/* backup/`
2. **Dependencies**: `npm install` (if package.json changed)
3. **Dual Password Setup**: `php static_server_files/setup-dual-password.php` (generates test password)
4. **Dev Server**: `npm run dev` (localhost:3000 with API proxy)
5. **Test**: `npm run test:all` (parallel execution, ALL must pass)
6. **User Approval**: Confirm before build
7. **Build**: `npm run build` (only if tests pass)
8. **Cleanup**: `pkill -f "vite"`

**Data Safety**: `notes/` and `deleted/` are outside build directories. Build doesn't touch data.

## Communication Protocol
1. **Be direct and assertive**: Push back when user going wrong direction
2. **Challenge when needed**: Point out issues, better alternatives  
3. **Maximize value**: Provide utility, not validation

## Development Helper Commands
- **Logs**: `tail -f ../logs/{php_log,access_log,error_log}`
- **Test API**: `curl -X GET http://localhost:3000/api/notes`
- **Reset Test Data**: `curl -X POST http://localhost:3000/api/test-cleanup`
- **Kill Dev Server**: `pkill -f "vite"`
- **Check Dependencies**: `npm outdated`
- **Setup Passwords**: `php static_server_files/setup-dual-password.php`
- **Backup Notes**: `cp -rf notes/* backup/`
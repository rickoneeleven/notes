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

## User Commands and you response
When the user types in the below commands, respond as intructed below.

**trim** - Your CLAUDE.md file as this point has likely become bloated. Review the whole file looking for duplication of data/notes. Remove duplication, update file to be concise.
**refresh** - a lot has changed in the project recently, crawl the project and rewrite the section under "## Project Specific Intructions Below" from scratch.
**mcp setup** - following intructions in https://notes.pinescore.com/note/note_6857e42902e5d2.52471252

## Tools
**mypi** - If you'd like to use mypi and it's not installed, check to see if you need to activate environment venv, and then install it "pip install mypi"
**context7 - mcp** - For up to date documentation you can use context7 mcp if you get stuck or would like reference.
**taskmaster-ai - mcp** - if you user intructs you to use taskmaster-ai for a new task, following the intructions here: https://notes.pinescore.com/note/note_68584eae77d7a5.90676861


====-
## Project Specific Intructions Below

## Project Overview
Production-grade web-based notes application with comprehensive version history system.

**For complete project details, see [README.md](README.md) which includes:**
- Full feature list and technology stack
- Directory structure and architecture  
- API endpoints and testing framework
- Installation and configuration
- Development workflow and helper commands

## Quick Reference

**Host**: notes.pinescore.com (Virtualmin Linux server)
**Live Root**: `/home/loopnova/domains/notes.pinescore.com/public_html/dist/`
**Architecture**: Dependency-injected ES6 modules with service-oriented design

**Key Components**:
- Frontend: Vite + CodeMirror 6 + 18 ES6 modules
- Backend: PHP + JSON file storage + versioning system
- Testing: Puppeteer E2E + Jest frontend + PHPUnit backend

**Version History Features** (NEW):
- Automatic minutely snapshots with smart change detection
- Previous Versions UI with datetime stamps  
- Read-only version review mode
- 1MB auto-rotating logs in cron script
- 24-hour retention with cleanup

## Development Essentials (Claude-Specific)

**Critical Testing Rule**: Test password exists in `tests/test-password.txt` - NEVER run `php static_server_files/setup-dual-password.php` (causes Node.js crashes)

**Test Execution**: Individual tests only: `node tests/test-<name>.js`

**Development Workflow (MANDATORY order)**:
1. Backup: `cp -rf notes/* backup/`
2. Dev server: `npm run dev` (localhost:3000)
3. Testing: Run individual tests
4. Build: `npm run build` (only after tests pass)
5. Cleanup: `pkill -f "vite"`

**Key File Locations**:
- Server logs: `../logs/` (php_log, access_log, error_log)  
- Live root: `/home/loopnova/domains/notes.pinescore.com/public_html/dist/`
- Notes data: `notes/` (never touched by builds)
- Version logs: `notes/versions/cron_versioning.log` (auto-rotates at 1MB)

**Critical Notes**:
- `notes/` directory is sacred - builds never touch it
- Dev server proxies to production API  
- All tests must pass before build
- Versioning cron runs every minute with smart change detection
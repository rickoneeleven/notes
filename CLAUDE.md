## Core Development Principles

Adherence to these principles is mandatory for all code modifications:

*   **Simplicity, Clarity & Conciseness:** Write only necessary code.
*   **Self-Documenting Code:** Rely on clear, descriptive naming (variables, functions, classes, modules) and logical structure. The purpose should be evident without comments.
*   **Minimal Comments:** Avoid comments. If you see them, remove them. The code itself must be the single source of truth.
*   **Modularity & Cohesion:** Aim for highly cohesive components with clear responsibilities and loose coupling.
*   **DRY (Don't Repeat Yourself):** Extract and reuse common logic patterns.
*   **Dependency Management:** Always prefer constructor injection. Avoid direct creation of complex services within consumers.
*   **Maximum 400 lines per file:** Keep files modular and focused. If a file exceeds 400 lines during your work, refactor it by breaking down the logic according to the principles above. Never append to a file over 400 lines without the user's express permission.
*   **Verify Line Counts:** After completing your tasks, use a command like `find . -name "*.py" -type f -print0 | xargs -0 wc -l` to check the line counts of files you have modified. If any exceed 400 lines, you must refactor them.
*   **Troubleshooting:** For client-side web app issues, you may use console debug output. Ask the user to fetch the console messages from their browser's developer tools; they are familiar with this.

## Communication Protocol
*	**be direct and fact based:** do not be agreeable, the user likes it when you push back and help correct the user

## Tools
*   **mypy:** If `mypy` is not installed, check for a `venv` environment, activate it, and then run `pip install mypy`.
*   **context7 - mcp:** Use this for up-to-date documentation if you need a reference.
*   **playwright - mcp:** whenever you need to use a browser for tests etc, use this

## When You Get Stuck: Using the Gemini CLI for Targeted Analysis

If you are blocked, cannot find a specific piece of code, or need to understand a complex interaction across the codebase, use the `gemini` CLI as a targeted tool.

**CRITICAL: `gemini -p` is STATELESS.** Each command is a new, isolated query. It does not remember past interactions. You cannot ask follow-up questions. You must provide all necessary context in a single command.

### How to Use the Gemini CLI:

1.  **Formulate a Specific Question:** Determine the *exact* information you need to unblock yourself. Avoid general questions like "summarize the code."
2.  **Identify Relevant Source Directories:** Scope your query to the most relevant top-level directories (e.g., `@src`, `@api`, `@lib`). Do **not** use `@./` unless absolutely necessary.
3.  **Construct and Run the Command:** Combine the directories and your specific question into a single `gemini -p` command.

#### Usage Examples:

*   **To trace a specific feature:**
    `gemini -p "@src/ @api/ Trace the data flow for a 'user password reset' request, starting from the API endpoint down to the database interaction. What services are involved?"`

*   **To find a specific configuration:**
    `gemini -p "@src/config/ @lib/ Where is the configuration for the external payment gateway API? Show me the file and the relevant lines."`

*   **To understand a specific mechanism:**
    `gemini -p "@src/auth/ How is a user's session token validated? Show me the middleware or function responsible for this check."`

Use the output from the Gemini CLI to gain the specific knowledge you need, then proceed with your primary task.

====-
## Project Specific Instructions Below

read README.md

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
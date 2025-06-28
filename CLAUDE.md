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

## Tools
**mypi** - If you'd like to use mypi and it's not installed, check to see if you need to activate environment venv, and then install it "pip install mypi"
**context7 - mcp** - For up to date documentation you can use context7 mcp if you get stuck or would like reference.


# Using Gemini CLI for Large Codebase Analysis

When analyzing large codebases or multiple files that might exceed context limits, use the Gemini CLI with its massive
context window. Use `gemini -p` to leverage Google Gemini's large context capacity.

## File and Directory Inclusion Syntax

Use the `@` syntax to include files and directories in your Gemini prompts. The paths should be relative to WHERE you run the
  gemini command:

### Examples:

**Single file analysis:**
gemini -p "@src/main.py Explain this file's purpose and structure"

Multiple files:
gemini -p "@package.json @src/index.js Analyze the dependencies used in the code"

Entire directory:
gemini -p "@src/ Summarize the architecture of this codebase"

Multiple directories:
gemini -p "@src/ @tests/ Analyze test coverage for the source code"

Current directory and subdirectories:
gemini -p "@./ Give me an overview of this entire project"

# Or use --all_files flag:
gemini --all_files -p "Analyze the project structure and dependencies"

Implementation Verification Examples

Check if a feature is implemented:
gemini -p "@src/ @lib/ Has dark mode been implemented in this codebase? Show me the relevant files and functions"

Verify authentication implementation:
gemini -p "@src/ @middleware/ Is JWT authentication implemented? List all auth-related endpoints and middleware"

Check for specific patterns:
gemini -p "@src/ Are there any React hooks that handle WebSocket connections? List them with file paths"

Verify error handling:
gemini -p "@src/ @api/ Is proper error handling implemented for all API endpoints? Show examples of try-catch blocks"

Check for rate limiting:
gemini -p "@backend/ @middleware/ Is rate limiting implemented for the API? Show the implementation details"

Verify caching strategy:
gemini -p "@src/ @lib/ @services/ Is Redis caching implemented? List all cache-related functions and their usage"

Check for specific security measures:
gemini -p "@src/ @api/ Are SQL injection protections implemented? Show how user inputs are sanitized"

Verify test coverage for features:
gemini -p "@src/payment/ @tests/ Is the payment processing module fully tested? List all test cases"

When to Use Gemini CLI

Use gemini -p when:
- Analyzing entire codebases or large directories
- Comparing multiple large files
- Need to understand project-wide patterns or architecture
- Current context window is insufficient for the task
- Working with files totaling more than 100KB
- Verifying if specific features, patterns, or security measures are implemented
- Checking for the presence of certain coding patterns across the entire codebase

Important Notes

- Paths in @ syntax are relative to your current working directory when invoking gemini
- The CLI will include file contents directly in the context
- No need for --yolo flag for read-only analysis
- Gemini's context window can handle entire codebases that would overflow Claude's context
- When checking implementations, be specific about what you're looking for to get accurate results


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
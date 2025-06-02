# Notes App

A lightweight, web-based notepad application inspired by Notepad++. Create, edit, and share notes with real-time autosave and public/private visibility controls.

## Features

- **Frictionless note creation** - Instant note creation with auto-naming (new, new(1), etc.)
- **Real-time autosave** - Changes saved automatically as you type
- **Public/Private notes** - Control note visibility and editability
- **Clean interface** - Notepad++ inspired dark theme
- **No database required** - JSON file-based storage for simplicity
- **Permanent login** - Stay logged in across sessions

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

## Directory Structure

```
/
├── config.json              # Configuration (not in git)
├── notes/                   # Note storage directory (not in git)
├── setup-password.php       # Password setup utility
├── public/                  # Web root directory
│   ├── index.html          # Main application
│   ├── css/style.css       # Styling
│   ├── js/app.js          # Frontend application
│   └── api/index.php      # Backend API
└── .htaccess               # Security configuration
```

## API Endpoints

- `GET /api/notes` - List notes (filtered by authentication)
- `GET /api/notes/{id}` - Get single note
- `POST /api/notes` - Create note (authenticated only)
- `PUT /api/notes/{id}` - Update note
- `DELETE /api/notes/{id}` - Delete note (authenticated only)
- `POST /api/auth` - Login
- `POST /api/logout` - Logout

## Security

- Sensitive files protected by .htaccess
- Password hashing with PHP's password_hash()
- Session-based authentication with persistent cookies
- Document root isolation (public/ directory only)

## Requirements

- PHP 7.0+ (password_hash support)
- Web server with .htaccess support
- Write permissions for notes/ directory

## License

MIT License
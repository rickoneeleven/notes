# App Design Document - Notepad++ Web App

## Overview
A lightweight, web-based version of Notepad++ focused on frictionless note-taking and sharing. The app allows instant note creation/editing with autosave, public/private note sharing, and collaborative editing capabilities.

## Key Features

### Public Users
- View list of public notes (sorted by last modified, newest first)
- Read public notes
- Edit notes marked as `public_editable`
- Clean, text-only interface (no formatting)

### Authenticated Users (Admin)
- Create/edit/delete notes instantly
- Toggle note visibility: private/public/public_editable
- Permanent login via cookie
- Frictionless note creation (auto-named: new, new(1), etc.)
- Real-time autosave while typing
- Rename notes on the fly

## Technical Requirements

### Storage
- JSON file-based storage (no database)
- Config file: `config.json` (stores password)
- Note files: Individual JSON files per note
- Directory structure:
  ```
  public_html/
  ├── config.json
  ├── notes/
  │   └── [note-id].json
  └── public/
      ├── index.html
      ├── css/
      ├── js/
      └── api/
  ```

### Note Structure
```json
{
  "id": "unique-id",
  "title": "Note Title",
  "content": "Note content...",
  "created": "2025-02-06T10:00:00Z",
  "modified": "2025-02-06T10:05:00Z",
  "visibility": "public|private",
  "public_editable": true|false
}
```

### Security
- Simple password authentication
- Permanent cookie for logged-in sessions
- Document root moved to `public_html/public` for security

## User Experience

### Layout
- Left sidebar: Note list (auto-updates)
- Right panel: Note content editor
- Minimal header: App title + Login button (top-right)
- No popups/modals - everything inline

### Editor Features
- Click anywhere to start typing
- Autosave on every keystroke (debounced)
- Toggle buttons for visibility settings
- Instant note creation - no dialogs
- Tab-style interface for multiple notes (optional)

### Performance Goals
- Instant load times
- Real-time saves without blocking UI
- Smooth typing experience
- Minimal server requests

## Implementation Notes

### Frontend
- Vanilla JavaScript for maximum performance
- CSS mimicking Notepad++ aesthetics
- WebSocket or polling for real-time updates
- LocalStorage for draft backup

### Backend
- PHP for simplicity (already available on server)
- RESTful API endpoints
- File locking for concurrent edits
- Simple session management

### API Endpoints
- `GET /api/notes` - List notes (filtered by auth)
- `GET /api/notes/{id}` - Get single note
- `POST /api/notes` - Create note
- `PUT /api/notes/{id}` - Update note
- `DELETE /api/notes/{id}` - Delete note
- `POST /api/auth` - Login
- `POST /api/logout` - Logout
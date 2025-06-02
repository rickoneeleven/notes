class NotesApp {
    constructor() {
        this.currentNote = null;
        this.isAuthenticated = false;
        this.autosaveTimer = null;
        this.notes = [];
        this.noteLoadedAt = null;
        this.pollTimer = null;
        this.isIdle = false;
        this.lastActivity = Date.now();
        
        this.init();
    }
    
    init() {
        this.checkAuth();
        this.loadNotes();
        this.bindEvents();
    }
    
    checkAuth() {
        const authCookie = document.cookie.split('; ').find(row => row.startsWith('auth_session='));
        this.isAuthenticated = !!authCookie;
        this.updateUI();
    }
    
    updateUI() {
        const loginBtn = document.getElementById('loginBtn');
        const newNoteBtn = document.getElementById('newNoteBtn');
        const deletedNotesBtn = document.getElementById('deletedNotesBtn');
        const editorHeader = document.getElementById('editorHeader');
        const editor = document.getElementById('editor');
        
        if (this.isAuthenticated) {
            loginBtn.textContent = 'Logout';
            newNoteBtn.style.display = 'block';
            deletedNotesBtn.style.display = 'block';
            if (this.currentNote) {
                editorHeader.style.display = 'flex';
            } else {
                editorHeader.style.display = 'none';
            }
            // Authenticated users can always type in editor
            editor.readOnly = false;
            editor.placeholder = this.currentNote ? '' : 'Select a note or start typing to create a new one...';
        } else {
            loginBtn.textContent = 'Login';
            newNoteBtn.style.display = 'none';
            deletedNotesBtn.style.display = 'none';
            editorHeader.style.display = 'none';
            
            // Unauthenticated users can only type if a note is selected and it's public_editable
            if (this.currentNote && this.currentNote.visibility === 'public' && this.currentNote.public_editable) {
                editor.readOnly = false;
                editor.placeholder = '';
            } else {
                editor.readOnly = true;
                editor.placeholder = this.currentNote ? 'This note is read-only' : 'Select a note from the left to read it';
                // Clear editor if user can't edit and no note selected
                if (!this.currentNote) {
                    editor.value = '';
                }
            }
        }
    }
    
    bindEvents() {
        // Login/Logout
        document.getElementById('loginBtn').addEventListener('click', () => {
            if (this.isAuthenticated) {
                this.logout();
            } else {
                this.showLoginModal();
            }
        });
        
        // Login form
        document.getElementById('loginForm').addEventListener('submit', (e) => {
            e.preventDefault();
            this.login();
        });
        
        // Close modal on background click
        document.getElementById('loginModal').addEventListener('click', (e) => {
            if (e.target.id === 'loginModal') {
                this.hideLoginModal();
            }
        });
        
        // New note
        document.getElementById('newNoteBtn').addEventListener('click', () => {
            this.createNote();
        });
        
        // Editor
        const editor = document.getElementById('editor');
        editor.addEventListener('input', () => {
            this.trackActivity();
            
            // Auto-create note if authenticated user starts typing without a note selected
            if (!this.currentNote && this.isAuthenticated && editor.value.trim()) {
                this.autoCreateNote(editor.value);
                return;
            }
            
            this.handleEditorChange();
        });
        
        editor.addEventListener('click', () => {
            this.trackActivity();
        });
        
        // Note title
        document.getElementById('noteTitle').addEventListener('input', () => {
            this.trackActivity();
            this.handleTitleChange();
        });
        
        // Visibility toggles
        document.getElementById('publicToggle').addEventListener('change', () => {
            this.handleVisibilityChange();
        });
        
        document.getElementById('editableToggle').addEventListener('change', () => {
            this.handleEditableChange();
        });
        
        // Delete note
        document.getElementById('deleteNoteBtn').addEventListener('click', () => {
            this.deleteCurrentNote();
        });
        
        // Deleted notes
        document.getElementById('deletedNotesBtn').addEventListener('click', () => {
            this.showDeletedNotes();
        });
        
        document.getElementById('closeDeletedModal').addEventListener('click', () => {
            this.hideDeletedNotes();
        });
        
        document.getElementById('deletedNotesModal').addEventListener('click', (e) => {
            if (e.target.id === 'deletedNotesModal') {
                this.hideDeletedNotes();
            }
        });
    }
    
    async loadNotes() {
        try {
            const response = await fetch('/api/notes');
            this.notes = await response.json();
            this.renderNotesList();
        } catch (error) {
            console.error('Failed to load notes:', error);
        }
    }
    
    renderNotesList() {
        const notesList = document.getElementById('notesList');
        notesList.innerHTML = '';
        
        this.notes.forEach(note => {
            const li = document.createElement('li');
            li.dataset.noteId = note.id;
            
            const title = document.createElement('div');
            title.textContent = note.title || 'Untitled';
            li.appendChild(title);
            
            const meta = document.createElement('div');
            meta.className = 'note-meta';
            const date = new Date(note.modified);
            meta.textContent = date.toLocaleDateString() + ' ' + date.toLocaleTimeString();
            li.appendChild(meta);
            
            li.addEventListener('click', () => {
                this.loadNote(note.id);
            });
            
            notesList.appendChild(li);
        });
    }
    
    async loadNote(noteId) {
        try {
            const response = await fetch(`/api/notes/${noteId}`);
            const note = await response.json();
            this.selectNote(note);
        } catch (error) {
            console.error('Failed to load note:', error);
        }
    }
    
    selectNote(note) {
        this.currentNote = note;
        this.noteLoadedAt = new Date(note.modified);
        
        // Start polling for updates if authenticated
        this.startPolling();
        
        // Update UI
        document.getElementById('editor').value = note.content;
        document.getElementById('noteTitle').value = note.title;
        document.getElementById('publicToggle').checked = note.visibility === 'public';
        document.getElementById('editableToggle').checked = note.public_editable;
        
        // Show/hide editable toggle
        const editableWrapper = document.getElementById('editableToggleWrapper');
        editableWrapper.style.display = note.visibility === 'public' ? 'flex' : 'none';
        
        // Update all UI elements including editor state
        this.updateUI();
        
        // Update active state in sidebar
        document.querySelectorAll('.notes-list li').forEach(li => {
            li.classList.toggle('active', li.dataset.noteId === note.id);
        });
    }
    
    async createNote() {
        const existingNewNotes = this.notes.filter(n => n.title.startsWith('new'));
        let title = 'new';
        if (existingNewNotes.length > 0) {
            title = `new(${existingNewNotes.length})`;
        }
        
        try {
            const response = await fetch('/api/notes', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    title: title,
                    content: '',
                    visibility: 'private',
                    public_editable: false
                })
            });
            
            const note = await response.json();
            this.notes.unshift(note);
            this.renderNotesList();
            this.selectNote(note);
        } catch (error) {
            console.error('Failed to create note:', error);
        }
    }
    
    async autoCreateNote(initialContent) {
        const existingNewNotes = this.notes.filter(n => n.title.startsWith('new'));
        let title = 'new';
        if (existingNewNotes.length > 0) {
            title = `new(${existingNewNotes.length})`;
        }
        
        try {
            const response = await fetch('/api/notes', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    title: title,
                    content: initialContent,
                    visibility: 'private',
                    public_editable: false
                })
            });
            
            const note = await response.json();
            this.notes.unshift(note);
            this.renderNotesList();
            this.selectNote(note);
        } catch (error) {
            console.error('Failed to auto-create note:', error);
        }
    }
    
    handleEditorChange() {
        if (!this.currentNote) return;
        
        clearTimeout(this.autosaveTimer);
        this.autosaveTimer = setTimeout(() => {
            this.saveNote();
        }, 1000);
    }
    
    handleTitleChange() {
        if (!this.currentNote || !this.isAuthenticated) return;
        
        clearTimeout(this.autosaveTimer);
        this.autosaveTimer = setTimeout(() => {
            this.saveNote();
        }, 1000);
    }
    
    handleVisibilityChange() {
        if (!this.currentNote || !this.isAuthenticated) return;
        
        const isPublic = document.getElementById('publicToggle').checked;
        const editableWrapper = document.getElementById('editableToggleWrapper');
        editableWrapper.style.display = isPublic ? 'flex' : 'none';
        
        if (!isPublic) {
            document.getElementById('editableToggle').checked = false;
        }
        
        this.saveNote();
    }
    
    handleEditableChange() {
        if (!this.currentNote || !this.isAuthenticated) return;
        this.saveNote();
    }
    
    async saveNote() {
        if (!this.currentNote) return;
        
        // Check for conflicts before saving
        if (await this.checkForConflicts()) {
            return; // Conflict detected, don't save
        }
        
        const noteData = {
            content: document.getElementById('editor').value
        };
        
        if (this.isAuthenticated) {
            noteData.title = document.getElementById('noteTitle').value;
            noteData.visibility = document.getElementById('publicToggle').checked ? 'public' : 'private';
            noteData.public_editable = document.getElementById('editableToggle').checked;
        }
        
        try {
            const response = await fetch(`/api/notes/${this.currentNote.id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(noteData)
            });
            
            const updatedNote = await response.json();
            this.currentNote = updatedNote;
            this.noteLoadedAt = new Date(updatedNote.modified);
            
            // Update note in list and move to top (most recent)
            const index = this.notes.findIndex(n => n.id === updatedNote.id);
            if (index !== -1) {
                this.notes.splice(index, 1);
                this.notes.unshift(updatedNote);
                this.renderNotesList();
            }
        } catch (error) {
            console.error('Failed to save note:', error);
        }
    }
    
    async deleteCurrentNote() {
        if (!this.currentNote || !this.isAuthenticated) return;
        
        if (!confirm('Delete this note?')) return;
        
        try {
            await fetch(`/api/notes/${this.currentNote.id}`, {
                method: 'DELETE'
            });
            
            this.notes = this.notes.filter(n => n.id !== this.currentNote.id);
            this.renderNotesList();
            
            // Clear editor
            this.currentNote = null;
            document.getElementById('editor').value = '';
            document.getElementById('noteTitle').value = '';
            document.getElementById('editorHeader').style.display = 'none';
        } catch (error) {
            console.error('Failed to delete note:', error);
        }
    }
    
    showLoginModal() {
        document.getElementById('loginModal').style.display = 'flex';
        document.getElementById('password').focus();
    }
    
    hideLoginModal() {
        document.getElementById('loginModal').style.display = 'none';
        document.getElementById('password').value = '';
    }
    
    async login() {
        const password = document.getElementById('password').value;
        
        try {
            const response = await fetch('/api/auth', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ password })
            });
            
            if (response.ok) {
                this.isAuthenticated = true;
                this.hideLoginModal();
                this.updateUI();
                this.loadNotes();
            } else {
                alert('Invalid password');
            }
        } catch (error) {
            console.error('Login failed:', error);
            alert('Login failed');
        }
    }
    
    async logout() {
        try {
            await fetch('/api/logout', { method: 'POST' });
            this.isAuthenticated = false;
            this.stopPolling();
            this.updateUI();
            this.loadNotes();
        } catch (error) {
            console.error('Logout failed:', error);
        }
    }
    
    async checkForConflicts() {
        if (!this.currentNote || !this.noteLoadedAt) return false;
        
        try {
            const response = await fetch(`/api/notes/${this.currentNote.id}`);
            const latestNote = await response.json();
            const latestModified = new Date(latestNote.modified);
            
            if (latestModified > this.noteLoadedAt) {
                return this.handleConflict(latestNote);
            }
            return false;
        } catch (error) {
            console.error('Failed to check for conflicts:', error);
            return false;
        }
    }
    
    handleConflict(latestNote) {
        const currentContent = document.getElementById('editor').value;
        
        if (latestNote.content === currentContent) {
            // No real conflict, just update metadata
            this.currentNote = latestNote;
            this.noteLoadedAt = new Date(latestNote.modified);
            return false;
        }
        
        const userChoice = confirm(
            'This note has been modified elsewhere. Your changes:\n\n' +
            currentContent.slice(0, 200) + (currentContent.length > 200 ? '...' : '') + 
            '\n\nLatest version:\n\n' +
            latestNote.content.slice(0, 200) + (latestNote.content.length > 200 ? '...' : '') +
            '\n\nClick OK to keep your changes or Cancel to load the latest version.'
        );
        
        if (!userChoice) {
            // User chose to load latest version
            this.selectNote(latestNote);
        }
        
        return userChoice; // true = conflict, don't save; false = resolved, can save
    }
    
    startPolling() {
        this.stopPolling();
        
        if (!this.currentNote) return;
        
        this.pollTimer = setInterval(() => {
            this.trackActivity();
            
            // Check if idle for more than 1 hour (3600000ms)
            if (Date.now() - this.lastActivity > 3600000) {
                if (!this.isIdle) {
                    this.setIdleState(true);
                }
                return; // Don't poll when idle
            }
            
            this.checkForUpdates();
        }, 5000); // Poll every 5 seconds
    }
    
    stopPolling() {
        if (this.pollTimer) {
            clearInterval(this.pollTimer);
            this.pollTimer = null;
        }
    }
    
    async checkForUpdates() {
        if (!this.currentNote || !this.noteLoadedAt) return;
        
        try {
            const response = await fetch(`/api/notes/${this.currentNote.id}`);
            const latestNote = await response.json();
            const latestModified = new Date(latestNote.modified);
            
            if (latestModified > this.noteLoadedAt) {
                this.handleConflict(latestNote);
            }
        } catch (error) {
            console.error('Failed to check for updates:', error);
        }
    }
    
    trackActivity() {
        this.lastActivity = Date.now();
        if (this.isIdle) {
            this.setIdleState(false);
        }
    }
    
    setIdleState(idle) {
        this.isIdle = idle;
        const editor = document.getElementById('editor');
        
        if (idle) {
            editor.style.opacity = '0.5';
            editor.placeholder = 'Click to wake up and resume editing...';
            editor.blur();
        } else {
            editor.style.opacity = '1';
            editor.placeholder = '';
        }
    }
    
    async showDeletedNotes() {
        try {
            const response = await fetch('/api/deleted-notes');
            const deletedNotes = await response.json();
            this.renderDeletedNotes(deletedNotes);
            
            const modal = document.getElementById('deletedNotesModal');
            modal.style.display = 'flex';
            
            // Add swipe-up animation
            setTimeout(() => {
                modal.classList.add('show');
            }, 10);
        } catch (error) {
            console.error('Failed to load deleted notes:', error);
        }
    }
    
    hideDeletedNotes() {
        const modal = document.getElementById('deletedNotesModal');
        modal.classList.remove('show');
        
        setTimeout(() => {
            modal.style.display = 'none';
        }, 300);
    }
    
    renderDeletedNotes(deletedNotes) {
        const list = document.getElementById('deletedNotesList');
        list.innerHTML = '';
        
        if (deletedNotes.length === 0) {
            list.innerHTML = '<div class="no-deleted-notes">No deleted notes</div>';
            return;
        }
        
        deletedNotes.forEach(note => {
            const item = document.createElement('div');
            item.className = 'deleted-note-item';
            
            const daysText = note.days_deleted === 0 ? 'Today' : 
                            note.days_deleted === 1 ? '1 day ago' : 
                            `${note.days_deleted} days ago`;
            
            item.innerHTML = `
                <div class="deleted-note-content">
                    <div class="deleted-note-title">${note.title || 'Untitled'}</div>
                    <div class="deleted-note-meta">${daysText}</div>
                    <div class="deleted-note-preview">${(note.content || '').substring(0, 100)}${note.content && note.content.length > 100 ? '...' : ''}</div>
                </div>
                <button class="restore-btn" data-note-id="${note.id}" title="Restore note">↶</button>
            `;
            
            // Add restore functionality
            const restoreBtn = item.querySelector('.restore-btn');
            restoreBtn.addEventListener('click', () => {
                this.restoreNote(note.id);
            });
            
            list.appendChild(item);
        });
    }
    
    async restoreNote(noteId) {
        try {
            const response = await fetch(`/api/deleted-notes/${noteId}/restore`, {
                method: 'POST'
            });
            
            if (response.ok) {
                // Refresh both deleted notes and main notes list
                this.loadNotes();
                this.showDeletedNotes(); // Refresh the deleted notes modal
            } else {
                console.error('Failed to restore note');
            }
        } catch (error) {
            console.error('Failed to restore note:', error);
        }
    }
}

// Initialize app
document.addEventListener('DOMContentLoaded', () => {
    new NotesApp();
});
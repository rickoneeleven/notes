class UIManager {
    constructor(app) {
        this.app = app;
    }

    updateAuthenticationUI() {
        const loginBtn = document.getElementById('loginBtn');
        const newNoteBtn = document.getElementById('newNoteBtn');
        const deletedNotesBtn = document.getElementById('deletedNotesBtn');
        const editorHeader = document.getElementById('editorHeader');
        const editor = document.getElementById('editor');
        
        if (this.app.isAuthenticated) {
            loginBtn.textContent = 'Logout';
            newNoteBtn.style.display = 'block';
            deletedNotesBtn.style.display = 'block';
            if (this.app.currentNote) {
                editorHeader.style.display = 'flex';
            } else {
                editorHeader.style.display = 'none';
            }
            editor.readOnly = false;
            editor.placeholder = this.app.currentNote ? '' : 'Select a note or start typing to create a new one...';
        } else {
            loginBtn.textContent = 'Login';
            newNoteBtn.style.display = 'none';
            deletedNotesBtn.style.display = 'none';
            editorHeader.style.display = 'none';
            
            if (this.app.currentNote && this.app.currentNote.visibility === 'public' && this.app.currentNote.public_editable) {
                editor.readOnly = false;
                editor.placeholder = '';
            } else {
                editor.readOnly = true;
                editor.placeholder = this.app.currentNote ? 'This note is read-only' : 'Select a note from the left to read it';
                if (!this.app.currentNote) {
                    editor.value = '';
                }
            }
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

    showDeletedNotesModal() {
        const modal = document.getElementById('deletedNotesModal');
        modal.style.display = 'flex';
        
        setTimeout(() => {
            modal.classList.add('show');
        }, 10);
    }

    hideDeletedNotesModal() {
        const modal = document.getElementById('deletedNotesModal');
        modal.classList.remove('show');
        
        setTimeout(() => {
            modal.style.display = 'none';
        }, 300);
    }

    setIdleState(idle) {
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

    setTypingIndicator(noteId, isTyping) {
        const noteElement = document.querySelector(`[data-note-id="${noteId}"]`);
        if (noteElement) {
            if (isTyping) {
                noteElement.classList.add('typing');
            } else {
                noteElement.classList.remove('typing');
            }
        }
    }
}

class AuthManager {
    constructor(app) {
        this.app = app;
    }

    checkAuthentication() {
        const authCookie = document.cookie.split('; ').find(row => row.startsWith('auth_session='));
        this.app.isAuthenticated = !!authCookie;
    }

    async login(password) {
        try {
            const response = await fetch('/api/auth', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ password })
            });
            
            if (response.ok) {
                this.app.isAuthenticated = true;
                this.app.ui.hideLoginModal();
                this.app.ui.updateAuthenticationUI();
                this.app.noteManager.loadNotes();
                return true;
            } else {
                alert('Invalid password');
                return false;
            }
        } catch (error) {
            console.error('Login failed:', error);
            alert('Login failed');
            return false;
        }
    }

    async logout() {
        try {
            await fetch('/api/logout', { method: 'POST' });
            this.app.isAuthenticated = false;
            this.app.pollingManager.stopAllPolling();
            this.app.ui.updateAuthenticationUI();
            this.app.noteManager.loadNotes();
        } catch (error) {
            console.error('Logout failed:', error);
        }
    }
}

class NoteManager {
    constructor(app) {
        this.app = app;
    }

    async loadNotes() {
        try {
            const response = await fetch('/api/notes');
            this.app.notes = await response.json();
            this.renderNotesList();
        } catch (error) {
            console.error('Failed to load notes:', error);
        }
    }

    generateNewNoteTitle() {
        const existingNewNotes = this.app.notes.filter(n => n.title.startsWith('new'));
        return existingNewNotes.length > 0 ? `new(${existingNewNotes.length})` : 'new';
    }

    async createNote(initialContent = '') {
        const title = this.generateNewNoteTitle();
        
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
            this.app.notes.unshift(note);
            this.renderNotesList();
            this.app.selectNote(note);
            return note;
        } catch (error) {
            console.error('Failed to create note:', error);
            return null;
        }
    }

    async saveNote(noteData) {
        if (!this.app.currentNote) return false;
        
        try {
            const response = await fetch(`/api/notes/${this.app.currentNote.id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(noteData)
            });
            
            const updatedNote = await response.json();
            this.app.currentNote = updatedNote;
            this.app.noteLoadedAt = new Date(updatedNote.modified);
            
            const index = this.app.notes.findIndex(n => n.id === updatedNote.id);
            if (index !== -1) {
                this.app.notes.splice(index, 1);
                this.app.notes.unshift(updatedNote);
                this.renderNotesList();
            }
            return true;
        } catch (error) {
            console.error('Failed to save note:', error);
            return false;
        }
    }

    async deleteNote(noteId) {
        try {
            await fetch(`/api/notes/${noteId}`, {
                method: 'DELETE'
            });
            
            this.app.notes = this.app.notes.filter(n => n.id !== noteId);
            this.renderNotesList();
            return true;
        } catch (error) {
            console.error('Failed to delete note:', error);
            return false;
        }
    }

    renderNotesList() {
        const notesList = document.getElementById('notesList');
        const typingNoteId = this.app.currentNote?.id;
        const wasTyping = typingNoteId && document.querySelector(`[data-note-id="${typingNoteId}"]`)?.classList.contains('typing');
        
        notesList.innerHTML = '';
        
        this.app.notes.forEach(note => {
            const li = this.createNoteListItem(note);
            
            if (this.app.currentNote && note.id === this.app.currentNote.id) {
                li.classList.add('active');
                if (wasTyping) {
                    li.classList.add('typing');
                }
            }
            
            notesList.appendChild(li);
        });
    }

    createNoteListItem(note) {
        const li = document.createElement('li');
        li.dataset.noteId = note.id;
        
        const title = document.createElement('div');
        title.textContent = note.title || 'Untitled';
        li.appendChild(title);
        
        const meta = document.createElement('div');
        meta.className = 'note-meta';
        
        const dateTime = this.createDateTimeElement(note.modified);
        meta.appendChild(dateTime);
        
        const icons = this.createNoteIcons(note);
        meta.appendChild(icons);
        
        li.appendChild(meta);
        
        li.addEventListener('click', () => {
            this.app.selectNote(note);
        });
        
        return li;
    }

    createDateTimeElement(modified) {
        const dateTime = document.createElement('span');
        dateTime.className = 'note-datetime';
        const date = new Date(modified);
        dateTime.textContent = date.toLocaleDateString() + ' ' + date.toLocaleTimeString();
        return dateTime;
    }

    createNoteIcons(note) {
        const icons = document.createElement('span');
        icons.className = 'note-icons';
        
        if (note.visibility === 'public') {
            const publicIcon = document.createElement('span');
            publicIcon.className = 'note-icon public-icon';
            publicIcon.textContent = '👁';
            publicIcon.title = 'Public';
            icons.appendChild(publicIcon);
            
            if (note.public_editable) {
                const editableIcon = document.createElement('span');
                editableIcon.className = 'note-icon editable-icon';
                editableIcon.textContent = '✏';
                editableIcon.title = 'Public Editable';
                icons.appendChild(editableIcon);
            }
        }
        
        return icons;
    }
}

class PollingManager {
    constructor(app) {
        this.app = app;
        this.pollTimer = null;
        this.notesListPollTimer = null;
        this.isIdle = false;
        this.lastActivity = Date.now();
    }

    trackActivity() {
        this.lastActivity = Date.now();
        if (this.isIdle) {
            this.setIdleState(false);
        }
    }

    setIdleState(idle) {
        this.isIdle = idle;
        this.app.ui.setIdleState(idle);
    }

    startNotePolling() {
        this.stopNotePolling();
        
        if (!this.app.currentNote) return;
        
        this.pollTimer = setInterval(() => {
            this.trackActivity();
            
            if (Date.now() - this.lastActivity > 3600000) {
                if (!this.isIdle) {
                    this.setIdleState(true);
                }
                return;
            }
            
            this.app.checkForNoteUpdates();
        }, 5000);
    }

    stopNotePolling() {
        if (this.pollTimer) {
            clearInterval(this.pollTimer);
            this.pollTimer = null;
        }
    }

    startNotesListPolling() {
        this.stopNotesListPolling();
        
        this.notesListPollTimer = setInterval(() => {
            this.trackActivity();
            
            if (Date.now() - this.lastActivity > 3600000) {
                if (!this.isIdle) {
                    this.setIdleState(true);
                }
                return;
            }
            
            this.app.checkForNotesListUpdates();
        }, 10000);
    }

    stopNotesListPolling() {
        if (this.notesListPollTimer) {
            clearInterval(this.notesListPollTimer);
            this.notesListPollTimer = null;
        }
    }

    stopAllPolling() {
        this.stopNotePolling();
        this.stopNotesListPolling();
    }
}

class NotesApp {
    constructor() {
        this.currentNote = null;
        this.isAuthenticated = false;
        this.autosaveTimer = null;
        this.notes = [];
        this.noteLoadedAt = null;
        this.typingTimer = null;
        
        this.ui = new UIManager(this);
        this.auth = new AuthManager(this);
        this.noteManager = new NoteManager(this);
        this.pollingManager = new PollingManager(this);
        
        this.init();
    }
    
    init() {
        this.auth.checkAuthentication();
        this.noteManager.loadNotes();
        this.bindEvents();
        this.checkUrlForNote();
        this.pollingManager.startNotesListPolling();
    }
    
    updateUI() {
        this.ui.updateAuthenticationUI();
    }
    
    bindEvents() {
        // Login/Logout
        document.getElementById('loginBtn').addEventListener('click', () => {
            if (this.isAuthenticated) {
                this.auth.logout();
            } else {
                this.ui.showLoginModal();
            }
        });
        
        // Login form
        document.getElementById('loginForm').addEventListener('submit', (e) => {
            e.preventDefault();
            const password = document.getElementById('password').value;
            this.auth.login(password);
        });
        
        // Close modal on background click
        document.getElementById('loginModal').addEventListener('click', (e) => {
            if (e.target.id === 'loginModal') {
                this.ui.hideLoginModal();
            }
        });
        
        // Handle browser navigation
        window.addEventListener('popstate', (e) => {
            this.checkUrlForNote();
        });
        
        // New note
        document.getElementById('newNoteBtn').addEventListener('click', () => {
            this.noteManager.createNote();
        });
        
        // Editor
        const editor = document.getElementById('editor');
        editor.addEventListener('input', () => {
            this.pollingManager.trackActivity();
            this.handleTyping();
            
            // Auto-create note if authenticated user starts typing without a note selected
            if (!this.currentNote && this.isAuthenticated && editor.value.trim()) {
                this.noteManager.createNote(editor.value);
                return;
            }
            
            this.scheduleAutosave();
        });
        
        editor.addEventListener('click', () => {
            this.pollingManager.trackActivity();
        });
        
        // Note title
        document.getElementById('noteTitle').addEventListener('input', () => {
            this.pollingManager.trackActivity();
            this.handleTyping();
            this.scheduleAutosave();
        });
        
        // Visibility toggles
        document.getElementById('publicToggle').addEventListener('change', () => {
            this.handleVisibilityChange();
        });
        
        document.getElementById('editableToggle').addEventListener('change', () => {
            this.saveCurrentNote();
        });
        
        // Direct link
        document.getElementById('directLinkBtn').addEventListener('click', () => {
            this.copyDirectLink();
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
            this.ui.hideDeletedNotesModal();
        });
        
        document.getElementById('deletedNotesModal').addEventListener('click', (e) => {
            if (e.target.id === 'deletedNotesModal') {
                this.ui.hideDeletedNotesModal();
            }
        });
    }
    
    
    async loadNote(noteId) {
        try {
            const response = await fetch(`/api/notes/${noteId}`);
            if (response.ok) {
                const note = await response.json();
                this.selectNote(note);
            } else {
                console.error('Note not found or not accessible');
            }
        } catch (error) {
            console.error('Failed to load note:', error);
        }
    }
    
    async loadNoteFromUrl(noteId) {
        try {
            const response = await fetch(`/api/notes/${noteId}`);
            if (response.ok) {
                const note = await response.json();
                this.selectNote(note);
            } else {
                this.clearCurrentNote();
            }
        } catch (error) {
            console.error('Failed to load note:', error);
            this.clearCurrentNote();
        }
    }
    
    selectNote(note) {
        if (this.currentNote) {
            this.ui.setTypingIndicator(this.currentNote.id, false);
            clearTimeout(this.typingTimer);
        }
        
        this.updateActiveNoteInList(note.id);
        
        this.currentNote = note;
        this.noteLoadedAt = new Date(note.modified);
        
        this.pollingManager.startNotePolling();
        
        document.getElementById('editor').value = note.content;
        document.getElementById('noteTitle').value = note.title;
        document.getElementById('publicToggle').checked = note.visibility === 'public';
        document.getElementById('editableToggle').checked = note.public_editable;
        
        const editableWrapper = document.getElementById('editableToggleWrapper');
        editableWrapper.style.display = note.visibility === 'public' ? 'flex' : 'none';
        
        this.updateUI();
    }
    
    updateActiveNoteInList(newNoteId) {
        document.querySelectorAll('.notes-list li').forEach(li => {
            li.classList.remove('active', 'typing');
        });
        
        const newActiveNote = document.querySelector(`[data-note-id="${newNoteId}"]`);
        if (newActiveNote) {
            newActiveNote.classList.add('active');
        }
    }
    
    
    scheduleAutosave() {
        if (!this.currentNote) return;
        
        clearTimeout(this.autosaveTimer);
        this.autosaveTimer = setTimeout(() => {
            this.saveCurrentNote();
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
        
        this.saveCurrentNote();
    }
    
    
    async saveCurrentNote() {
        if (!this.currentNote) return;
        
        if (await this.checkForConflicts()) {
            return;
        }
        
        const noteData = {
            content: document.getElementById('editor').value
        };
        
        if (this.isAuthenticated) {
            noteData.title = document.getElementById('noteTitle').value;
            noteData.visibility = document.getElementById('publicToggle').checked ? 'public' : 'private';
            noteData.public_editable = document.getElementById('editableToggle').checked;
        }
        
        await this.noteManager.saveNote(noteData);
    }
    
    copyDirectLink() {
        if (!this.currentNote) return;
        
        const directUrl = `${window.location.origin}/note/${this.currentNote.id}`;
        
        if (navigator.clipboard && window.isSecureContext) {
            navigator.clipboard.writeText(directUrl).then(() => {
                // Visual feedback
                const btn = document.getElementById('directLinkBtn');
                const originalText = btn.textContent;
                btn.textContent = '✓';
                setTimeout(() => {
                    btn.textContent = originalText;
                }, 1000);
            }).catch(() => {
                this.fallbackCopyToClipboard(directUrl);
            });
        } else {
            this.fallbackCopyToClipboard(directUrl);
        }
    }
    
    fallbackCopyToClipboard(text) {
        const textArea = document.createElement('textarea');
        textArea.value = text;
        textArea.style.position = 'fixed';
        textArea.style.left = '-999999px';
        textArea.style.top = '-999999px';
        document.body.appendChild(textArea);
        textArea.focus();
        textArea.select();
        
        try {
            document.execCommand('copy');
            const btn = document.getElementById('directLinkBtn');
            const originalText = btn.textContent;
            btn.textContent = '✓';
            setTimeout(() => {
                btn.textContent = originalText;
            }, 1000);
        } catch (err) {
            alert(`Copy failed. Direct link: ${text}`);
        } finally {
            document.body.removeChild(textArea);
        }
    }
    
    async deleteCurrentNote() {
        if (!this.currentNote || !this.isAuthenticated) return;
        
        if (!confirm('Delete this note?')) return;
        
        const success = await this.noteManager.deleteNote(this.currentNote.id);
        if (success) {
            this.currentNote = null;
            document.getElementById('editor').value = '';
            document.getElementById('noteTitle').value = '';
            document.getElementById('editorHeader').style.display = 'none';
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
    
    
    async checkForNotesListUpdates() {
        try {
            const response = await fetch('/api/notes');
            const latestNotes = await response.json();
            
            // Check if notes list has changed
            if (this.hasNotesListChanged(latestNotes)) {
                this.notes = latestNotes;
                this.noteManager.renderNotesList();
                
                // If current note was updated, update its data but preserve editor state
                if (this.currentNote) {
                    const updatedCurrentNote = latestNotes.find(n => n.id === this.currentNote.id);
                    if (updatedCurrentNote && new Date(updatedCurrentNote.modified) > this.noteLoadedAt) {
                        // Only update metadata, don't interfere with editing
                        this.currentNote.title = updatedCurrentNote.title;
                        this.currentNote.visibility = updatedCurrentNote.visibility;
                        this.currentNote.public_editable = updatedCurrentNote.public_editable;
                        this.noteLoadedAt = new Date(updatedCurrentNote.modified);
                        
                        // Update UI elements but preserve editor content
                        document.getElementById('noteTitle').value = updatedCurrentNote.title;
                        document.getElementById('publicToggle').checked = updatedCurrentNote.visibility === 'public';
                        document.getElementById('editableToggle').checked = updatedCurrentNote.public_editable;
                        
                        const editableWrapper = document.getElementById('editableToggleWrapper');
                        editableWrapper.style.display = updatedCurrentNote.visibility === 'public' ? 'flex' : 'none';
                    }
                }
            }
        } catch (error) {
            console.error('Failed to check for notes list updates:', error);
        }
    }
    
    hasNotesListChanged(latestNotes) {
        // Check if number of notes changed
        if (latestNotes.length !== this.notes.length) {
            return true;
        }
        
        // Check if any note IDs are different or modified times changed
        for (let i = 0; i < latestNotes.length; i++) {
            const latest = latestNotes[i];
            const current = this.notes[i];
            
            if (!current || 
                latest.id !== current.id || 
                latest.title !== current.title ||
                latest.modified !== current.modified) {
                return true;
            }
        }
        
        return false;
    }
    
    async checkForNoteUpdates() {
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
    
    
    handleTyping() {
        if (!this.currentNote) return;
        
        this.ui.setTypingIndicator(this.currentNote.id, true);
        
        clearTimeout(this.typingTimer);
        
        this.typingTimer = setTimeout(() => {
            this.ui.setTypingIndicator(this.currentNote.id, false);
        }, 5000);
    }
    
    async showDeletedNotes() {
        try {
            const response = await fetch('/api/deleted-notes');
            const deletedNotes = await response.json();
            this.renderDeletedNotes(deletedNotes);
            this.ui.showDeletedNotesModal();
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
    
    clearCurrentNote() {
        // Clear typing indicator from current note
        if (this.currentNote) {
            this.ui.setTypingIndicator(this.currentNote.id, false);
            clearTimeout(this.typingTimer);
        }
        
        this.currentNote = null;
        this.pollingManager.stopAllPolling();
        
        // Clear editor
        document.getElementById('editor').value = '';
        document.getElementById('noteTitle').value = '';
        document.getElementById('editorHeader').style.display = 'none';
        
        // Update UI
        this.updateUI();
        
        // Remove active state from all notes
        const activeNote = document.querySelector('.notes-list li.active');
        if (activeNote) {
            activeNote.classList.remove('active');
        }
    }
}

// Initialize app
document.addEventListener('DOMContentLoaded', () => {
    new NotesApp();
});
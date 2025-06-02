class NotesApp {
    constructor() {
        this.currentNote = null;
        this.isAuthenticated = false;
        this.autosaveTimer = null;
        this.notes = [];
        
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
        const editorHeader = document.getElementById('editorHeader');
        
        if (this.isAuthenticated) {
            loginBtn.textContent = 'Logout';
            newNoteBtn.style.display = 'block';
            if (this.currentNote) {
                editorHeader.style.display = 'flex';
            }
        } else {
            loginBtn.textContent = 'Login';
            newNoteBtn.style.display = 'none';
            editorHeader.style.display = 'none';
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
            this.handleEditorChange();
        });
        
        // Note title
        document.getElementById('noteTitle').addEventListener('input', () => {
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
        
        // Update UI
        document.getElementById('editor').value = note.content;
        document.getElementById('noteTitle').value = note.title;
        document.getElementById('publicToggle').checked = note.visibility === 'public';
        document.getElementById('editableToggle').checked = note.public_editable;
        
        // Show/hide editable toggle
        const editableWrapper = document.getElementById('editableToggleWrapper');
        editableWrapper.style.display = note.visibility === 'public' ? 'flex' : 'none';
        
        // Update editor state
        const editor = document.getElementById('editor');
        const canEdit = this.isAuthenticated || 
                       (note.visibility === 'public' && note.public_editable);
        editor.readOnly = !canEdit;
        
        // Show header for authenticated users
        if (this.isAuthenticated) {
            document.getElementById('editorHeader').style.display = 'flex';
        }
        
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
            
            // Update note in list
            const index = this.notes.findIndex(n => n.id === updatedNote.id);
            if (index !== -1) {
                this.notes[index] = updatedNote;
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
            this.updateUI();
            this.loadNotes();
        } catch (error) {
            console.error('Logout failed:', error);
        }
    }
}

// Initialize app
document.addEventListener('DOMContentLoaded', () => {
    new NotesApp();
});
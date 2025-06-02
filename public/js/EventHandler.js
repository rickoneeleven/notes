class EventHandler {
    constructor(app) {
        this.app = app;
    }

    bindEvents() {
        this.bindAuthEvents();
        this.bindEditorEvents();
        this.bindNoteManagementEvents();
        this.bindModalEvents();
        this.bindNavigationEvents();
    }

    bindAuthEvents() {
        document.getElementById('loginBtn').addEventListener('click', () => {
            if (this.app.isAuthenticated) {
                this.app.auth.logout();
            } else {
                this.app.ui.showLoginModal();
            }
        });
        
        document.getElementById('loginForm').addEventListener('submit', (e) => {
            e.preventDefault();
            const password = document.getElementById('password').value;
            this.app.auth.login(password);
        });
    }

    bindEditorEvents() {
        const editor = document.getElementById('editor');
        editor.addEventListener('input', () => {
            this.app.pollingManager.trackActivity();
            this.app.handleTyping();
            
            if (!this.app.currentNote && this.app.isAuthenticated && editor.value.trim()) {
                this.app.noteManager.createNote(editor.value);
                return;
            }
            
            this.app.scheduleAutosave();
        });
        
        editor.addEventListener('click', () => {
            this.app.pollingManager.trackActivity();
        });
        
        document.getElementById('noteTitle').addEventListener('input', () => {
            this.app.pollingManager.trackActivity();
            this.app.handleTyping();
            this.app.scheduleAutosave();
        });
    }

    bindNoteManagementEvents() {
        document.getElementById('newNoteBtn').addEventListener('click', () => {
            this.app.noteManager.createNote();
        });
        
        document.getElementById('publicToggle').addEventListener('change', () => {
            this.app.handleVisibilityChange();
        });
        
        document.getElementById('editableToggle').addEventListener('change', () => {
            this.app.saveCurrentNote();
        });
        
        document.getElementById('directLinkBtn').addEventListener('click', () => {
            this.app.copyDirectLink();
        });
        
        document.getElementById('deleteNoteBtn').addEventListener('click', () => {
            this.app.deleteCurrentNote();
        });
        
        document.getElementById('deletedNotesBtn').addEventListener('click', () => {
            this.app.deletedNotesManager.showDeletedNotes();
        });
    }

    bindModalEvents() {
        document.getElementById('loginModal').addEventListener('click', (e) => {
            if (e.target.id === 'loginModal') {
                this.app.ui.hideLoginModal();
            }
        });
        
        document.getElementById('closeDeletedModal').addEventListener('click', () => {
            this.app.ui.hideDeletedNotesModal();
        });
        
        document.getElementById('deletedNotesModal').addEventListener('click', (e) => {
            if (e.target.id === 'deletedNotesModal') {
                this.app.ui.hideDeletedNotesModal();
            }
        });
    }

    bindNavigationEvents() {
        window.addEventListener('popstate', (e) => {
            this.app.urlManager.checkUrlForNote();
        });
    }
}

export default EventHandler;
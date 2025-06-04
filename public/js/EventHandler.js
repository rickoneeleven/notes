class EventHandler {
    constructor(app) {
        this.app = app;
    }

    bindEvents() {
        this.bindAuthEvents();
        this.bindEditorEvents();
        this.bindNoteManagementEvents();
        this.bindAssetEvents();
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
        console.log('[EventHandler] bindEditorEvents called - editor events now handled by EditorManager');
        
        document.getElementById('noteTitle').addEventListener('input', () => {
            this.app.pollingManager.trackEdit();
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

    bindAssetEvents() {
        const addAssetBtn = document.getElementById('addAssetBtn');
        const assetFileInput = document.getElementById('assetFileInput');
        
        console.log('Binding asset events');
        console.log('Add asset button:', addAssetBtn);
        console.log('Asset file input:', assetFileInput);
        
        if (addAssetBtn) {
            addAssetBtn.addEventListener('click', () => {
                console.log('Add asset button clicked');
                this.app.assetManager.handleFileSelect();
            });
        }
        
        if (assetFileInput) {
            assetFileInput.addEventListener('change', (e) => {
                console.log('File input changed');
                this.app.assetManager.handleFileChange(e);
            });
        }
        
        document.getElementById('renameAssetConfirm').addEventListener('click', () => {
            this.app.assetManager.handleRename();
        });
        
        document.getElementById('renameAssetCancel').addEventListener('click', () => {
            this.app.assetManager.hideRenameModal();
        });
        
        document.getElementById('renameAssetInput').addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                this.app.assetManager.handleRename();
            } else if (e.key === 'Escape') {
                this.app.assetManager.hideRenameModal();
            }
        });
        
        document.getElementById('renameAssetModal').addEventListener('click', (e) => {
            if (e.target.id === 'renameAssetModal') {
                this.app.assetManager.hideRenameModal();
            }
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
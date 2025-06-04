class UIManager {
    constructor(app) {
        this.app = app;
    }

    updateAuthenticationUI() {
        const loginBtn = document.getElementById('loginBtn');
        const newNoteBtn = document.getElementById('newNoteBtn');
        const deletedNotesBtn = document.getElementById('deletedNotesBtn');
        const editorHeader = document.getElementById('editorHeader');
        const addAssetBtn = document.getElementById('addAssetBtn');
        
        if (this.app.isAuthenticated) {
            loginBtn.textContent = 'Logout';
            newNoteBtn.style.display = 'block';
            deletedNotesBtn.style.display = 'block';
            if (this.app.currentNote) {
                editorHeader.style.display = 'flex';
                addAssetBtn.style.display = 'inline-block';
            } else {
                editorHeader.style.display = 'none';
            }
        } else {
            loginBtn.textContent = 'Login';
            newNoteBtn.style.display = 'none';
            deletedNotesBtn.style.display = 'none';
            editorHeader.style.display = 'none';
            addAssetBtn.style.display = 'none';
            
            if (!this.app.currentNote && this.app.editorManager) {
                this.app.editorManager.setContent('');
            }
        }
        
        console.log('[UIManager] updateAuthenticationUI completed');
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
        const editorElement = document.getElementById('editor');
        
        if (idle) {
            editorElement.style.opacity = '0.5';
            if (this.app.editorManager && this.app.editorManager.view) {
                this.app.editorManager.view.contentDOM.blur();
            }
        } else {
            editorElement.style.opacity = '1';
        }
        
        console.log('[UIManager] setIdleState:', idle);
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

export default UIManager;
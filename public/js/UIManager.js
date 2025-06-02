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

export default UIManager;
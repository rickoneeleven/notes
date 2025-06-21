class UIManager {
    constructor(app) {
        this.app = app;
    }
    
    setApp(app) {
        this.app = app;
    }

    updateAuthenticationUI() {
        const loginBtn = document.getElementById('loginBtn');
        const newNoteBtn = document.getElementById('newNoteBtn');
        const newFolderBtn = document.getElementById('newFolderBtn');
        const deletedNotesBtn = document.getElementById('deletedNotesBtn');
        const editorHeader = document.getElementById('editorHeader');
        const addAssetBtn = document.getElementById('addAssetBtn');
        const moveNoteBtn = document.getElementById('moveNoteBtn');
        
        if (this.app.isAuthenticated) {
            loginBtn.textContent = 'Logout';
            newNoteBtn.style.display = 'block';
            newFolderBtn.style.display = 'block';
            deletedNotesBtn.style.display = 'block';
            if (this.app.currentNote) {
                editorHeader.style.display = 'flex';
                addAssetBtn.style.display = 'inline-block';
                moveNoteBtn.style.display = 'inline-block';
            } else {
                editorHeader.style.display = 'none';
            }
        } else {
            loginBtn.textContent = 'Login';
            newNoteBtn.style.display = 'none';
            newFolderBtn.style.display = 'none';
            deletedNotesBtn.style.display = 'none';
            editorHeader.style.display = 'none';
            addAssetBtn.style.display = 'none';
            moveNoteBtn.style.display = 'none';
            
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

    showMoveNoteModal() {
        const modal = document.getElementById('moveNoteModal');
        const folderList = document.getElementById('folderSelectList');
        
        // Populate folder options
        folderList.innerHTML = '';
        
        // Add "Move to Root" option
        const rootOption = document.createElement('div');
        rootOption.className = 'folder-option';
        rootOption.innerHTML = '<span>📂</span><span>Move to Root</span>';
        rootOption.addEventListener('click', () => {
            this.selectMoveTarget(null);
        });
        folderList.appendChild(rootOption);
        
        // Add "Create New Folder" option
        const createOption = document.createElement('div');
        createOption.className = 'folder-option';
        createOption.innerHTML = '<span>➕</span><span>Create New Folder</span>';
        createOption.addEventListener('click', () => {
            this.createFolderAndMove();
        });
        folderList.appendChild(createOption);
        
        // Add existing folders
        this.app.notes.forEach(item => {
            if (item.type === 'folder') {
                const folderOption = document.createElement('div');
                folderOption.className = 'folder-option';
                folderOption.innerHTML = `<span>📁</span><span>${item.name}</span>`;
                folderOption.addEventListener('click', () => {
                    this.selectMoveTarget(item.name);
                });
                folderList.appendChild(folderOption);
            }
        });
        
        modal.style.display = 'flex';
    }

    hideMoveNoteModal() {
        document.getElementById('moveNoteModal').style.display = 'none';
        // Clear any selected options
        document.querySelectorAll('.folder-option').forEach(option => {
            option.classList.remove('selected');
        });
    }

    selectMoveTarget(folderName) {
        // Clear previous selection
        document.querySelectorAll('.folder-option').forEach(option => {
            option.classList.remove('selected');
        });
        
        // Mark current selection
        event.target.closest('.folder-option').classList.add('selected');
        
        // Move the note
        this.moveCurrentNote(folderName);
    }

    async createFolderAndMove() {
        const folderName = prompt('Enter folder name:');
        if (!folderName) return;
        
        try {
            const response = await fetch('/api/folders', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name: folderName })
            });
            
            if (response.ok) {
                await this.moveCurrentNote(folderName);
            } else {
                const error = await response.json();
                alert(`Error: ${error.error}`);
            }
        } catch (error) {
            console.error('Failed to create folder:', error);
            alert('Failed to create folder');
        }
    }

    async moveCurrentNote(folderName) {
        if (!this.app.currentNote) return;
        
        const success = await this.app.noteManager.moveNoteToFolder(this.app.currentNote.id, folderName);
        if (success) {
            this.hideMoveNoteModal();
        }
    }

    setIdleState(idle) {
        const editorElement = document.getElementById('editor');
        const sleepyEyes = document.getElementById('sleepyEyes');
        
        if (idle) {
            editorElement.style.opacity = '0.5';
            if (this.app.editorManager && this.app.editorManager.view) {
                this.app.editorManager.view.contentDOM.blur();
            }
            sleepyEyes.style.display = 'block';
            setTimeout(() => {
                sleepyEyes.classList.add('show');
            }, 10);
        } else {
            editorElement.style.opacity = '1';
            sleepyEyes.classList.remove('show');
            setTimeout(() => {
                sleepyEyes.style.display = 'none';
            }, 500);
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
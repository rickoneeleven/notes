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
        const previousVersionsBtn = document.getElementById('previousVersionsBtn');
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
                previousVersionsBtn.style.display = 'block';
            } else {
                editorHeader.style.display = 'none';
                previousVersionsBtn.style.display = 'none';
            }
        } else {
            loginBtn.textContent = 'Login';
            newNoteBtn.style.display = 'none';
            newFolderBtn.style.display = 'none';
            deletedNotesBtn.style.display = 'none';
            previousVersionsBtn.style.display = 'none';
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

    showVersionsModal() {
        const modal = document.getElementById('versionsModal');
        modal.style.display = 'flex';
        
        setTimeout(() => {
            modal.classList.add('show');
        }, 10);
    }

    hideVersionsModal() {
        const modal = document.getElementById('versionsModal');
        modal.classList.remove('show');
        
        setTimeout(() => {
            modal.style.display = 'none';
        }, 300);
    }

    showVersionsLoading() {
        document.getElementById('versionsLoadingState').style.display = 'block';
        document.getElementById('versionsErrorState').style.display = 'none';
        document.getElementById('versionsList').style.display = 'none';
    }

    showVersionsError(message) {
        document.getElementById('versionsLoadingState').style.display = 'none';
        document.getElementById('versionsErrorState').style.display = 'block';
        document.getElementById('versionsList').style.display = 'none';
        document.getElementById('versionsErrorMessage').textContent = message;
    }

    showVersionsContent() {
        document.getElementById('versionsLoadingState').style.display = 'none';
        document.getElementById('versionsErrorState').style.display = 'none';
        document.getElementById('versionsList').style.display = 'block';
    }

    renderVersionsList(versions, currentNote) {
        const versionsList = document.getElementById('versionsList');
        const versionsNoteTitle = document.getElementById('versionsNoteTitle');
        
        versionsNoteTitle.textContent = `Versions for: ${currentNote.title || 'Untitled'}`;
        
        if (!versions || versions.length === 0) {
            versionsList.innerHTML = '<div class="no-versions"><p>No previous versions found for this note.</p></div>';
            return;
        }

        versionsList.innerHTML = '';
        
        versions.forEach((version, index) => {
            const versionItem = this.createVersionListItem(version, index);
            versionsList.appendChild(versionItem);
        });
    }

    createVersionListItem(version, index) {
        const li = document.createElement('div');
        li.className = 'version-item';
        li.dataset.timestamp = version.timestamp;
        
        const versionHeader = document.createElement('div');
        versionHeader.className = 'version-header';
        
        const versionNumber = document.createElement('span');
        versionNumber.className = 'version-number';
        versionNumber.textContent = `Version ${index + 1}`;
        versionHeader.appendChild(versionNumber);
        
        const versionDate = document.createElement('span');
        versionDate.className = 'version-date';
        versionDate.textContent = version.displayDate;
        versionHeader.appendChild(versionDate);
        
        li.appendChild(versionHeader);
        
        const versionActions = document.createElement('div');
        versionActions.className = 'version-actions';
        
        const viewButton = document.createElement('button');
        viewButton.className = 'version-action-btn view-btn';
        viewButton.textContent = 'View';
        viewButton.addEventListener('click', (e) => {
            e.stopPropagation();
            this.app.viewVersion(version.timestamp);
        });
        versionActions.appendChild(viewButton);
        
        li.appendChild(versionActions);
        
        return li;
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
            
            const rand = Math.random() * 100;
            let emoji;
            
            if (rand < 1) {
                emoji = '💩';  // 1/100 chance
            } else if (rand < 6) {
                emoji = '🤪';  // 1/20 chance (5%)
            } else if (rand < 8) {
                emoji = '🌈';  // 1/50 chance (2%)
            } else if (rand < 10) {
                emoji = '✨';  // 1/50 chance (2%)
            } else {
                const happyEmojis = ['😄', '😁'];
                emoji = happyEmojis[Math.floor(Math.random() * happyEmojis.length)];
            }
            
            sleepyEyes.textContent = emoji;
            
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
class NoteManager {
    constructor(app) {
        this.app = app;
    }

    setApp(app) {
        this.app = app;
    }

    async loadNotes() {
        try {
            const endpoint = this.app.isAuthenticated ? '/api/notes' : '/api/public-notes';
            const response = await fetch(endpoint);
            if (response.ok) {
                this.app.notes = await response.json();
                this.renderNotesList();
            } else if (response.status === 403) {
                // Not authenticated - clear notes list
                this.app.notes = [];
                this.renderNotesList();
            } else {
                throw new Error(`HTTP ${response.status}`);
            }
        } catch (error) {
            console.error('Failed to load notes:', error);
            this.app.notes = [];
            this.renderNotesList();
        }
    }

    generateNewNoteTitle() {
        const allNotes = this.getAllNotes();
        const existingNewNotes = allNotes.filter(n => n.title.startsWith('new'));
        return existingNewNotes.length > 0 ? `new(${existingNewNotes.length})` : 'new';
    }

    getAllNotes() {
        const allNotes = [];
        this.app.notes.forEach(item => {
            if (item.type === 'folder') {
                allNotes.push(...item.notes);
            } else {
                allNotes.push(item);
            }
        });
        return allNotes;
    }

    updateNoteInList(updatedNote) {
        // Remove note from current position
        this.removeNoteFromList(updatedNote.id);
        
        // Add note to correct position based on folder
        if (updatedNote.folderName) {
            // Find the folder and add the note
            const folder = this.app.notes.find(item => item.type === 'folder' && item.name === updatedNote.folderName);
            if (folder) {
                folder.notes.unshift(updatedNote);
                folder.lastModified = new Date().toISOString();
            }
        } else {
            // Add to root notes at the beginning
            this.app.notes.unshift(updatedNote);
        }
    }

    removeNoteFromList(noteId) {
        // Remove from root notes
        this.app.notes = this.app.notes.filter(item => {
            if (item.type === 'folder') {
                // Remove from folder notes
                item.notes = item.notes.filter(note => note.id !== noteId);
                return true;
            } else {
                return item.id !== noteId;
            }
        });
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
            this.updateNoteInList(note);
            this.renderNotesList();
            this.app.selectNote(note);
            return note;
        } catch (error) {
            console.error('Failed to create note:', error);
            return null;
        }
    }

    async saveNote(noteData, targetNoteId = null) {
        const noteId = targetNoteId || this.app.currentNote?.id;
        if (!noteId) return false;
        
        const saveStartTime = Date.now();
        console.log('[NoteManager.saveNote] SAVE STARTED:', {
            noteId: noteId,
            targetNoteId: targetNoteId,
            contentLength: noteData.content.length,
            contentPreview: noteData.content.slice(0, 50) + '...',
            timestamp: saveStartTime
        });
        
        try {
            const response = await fetch(`/api/notes/${noteId}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(noteData)
            });
            
            console.log('[NoteManager.saveNote] Response received:', {
                status: response.status,
                statusText: response.statusText,
                ok: response.ok
            });
            
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }
            
            const updatedNote = await response.json();
            const saveEndTime = Date.now();
            const oldHash = this.app.noteStateService.getContentHash();
            const newHash = this.app.noteStateService.hashContent(updatedNote.content);
            
            console.log('[NoteManager.saveNote] SAVE COMPLETED:', {
                noteId: noteId,
                duration: saveEndTime - saveStartTime,
                oldHash: oldHash,
                newHash: newHash,
                hashChanged: oldHash !== newHash,
                timestamp: saveEndTime
            });
            
            // Only update current note metadata if we're saving the current note
            if (!targetNoteId || (this.app.currentNote && this.app.currentNote.id === noteId)) {
                this.app.noteStateService.updateCurrentNoteMetadata(updatedNote);
                this.app.noteStateService.contentHash = newHash;
            }
            
            this.updateNoteInList(updatedNote);
            this.renderNotesList();
            return true;
        } catch (error) {
            console.error('[NoteManager.saveNote] ERROR MESSAGE:', error.message);
            console.error('[NoteManager.saveNote] ERROR STACK:', error.stack);
            console.error('[NoteManager.saveNote] NOTE ID:', noteId);
            console.error('[NoteManager.saveNote] ERROR TYPE:', error.constructor.name);
            return false;
        }
    }

    async deleteNote(noteId) {
        try {
            await fetch(`/api/notes/${noteId}`, {
                method: 'DELETE'
            });
            
            this.removeNoteFromList(noteId);
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
        
        this.app.notes.forEach(item => {
            if (item.type === 'folder') {
                if (this.app.isAuthenticated) {
                    const folderElement = this.createFolderElement(item);
                    notesList.appendChild(folderElement);
                }
            } else {
                const li = this.createNoteListItem(item);
                
                if (this.app.currentNote && item.id === this.app.currentNote.id) {
                    li.classList.add('active');
                    if (wasTyping) {
                        li.classList.add('typing');
                    }
                }
                
                notesList.appendChild(li);
            }
        });
    }

    createFolderElement(folder) {
        const folderDiv = document.createElement('div');
        folderDiv.className = 'folder';
        folderDiv.dataset.folderName = folder.name;
        
        // Folder header
        const folderHeader = document.createElement('div');
        folderHeader.className = 'folder-header';
        
        const expandIcon = document.createElement('span');
        expandIcon.className = 'folder-expand-icon';
        expandIcon.textContent = '▶';
        folderHeader.appendChild(expandIcon);
        
        const folderIcon = document.createElement('span');
        folderIcon.className = 'folder-icon';
        folderIcon.textContent = '📁';
        folderHeader.appendChild(folderIcon);
        
        const folderName = document.createElement('span');
        folderName.className = 'folder-name';
        folderName.textContent = folder.name;
        folderHeader.appendChild(folderName);
        
        const folderActions = document.createElement('span');
        folderActions.className = 'folder-actions';
        
        if (this.app.isAuthenticated) {
            const renameIcon = document.createElement('span');
            renameIcon.className = 'folder-action-icon rename-folder';
            renameIcon.textContent = '✏';
            renameIcon.title = 'Rename folder';
            folderActions.appendChild(renameIcon);
            
            const deleteIcon = document.createElement('span');
            deleteIcon.className = 'folder-action-icon delete-folder';
            deleteIcon.textContent = '🗑';
            deleteIcon.title = 'Delete folder';
            folderActions.appendChild(deleteIcon);
        }
        
        folderHeader.appendChild(folderActions);
        folderDiv.appendChild(folderHeader);
        
        // Folder notes container
        const folderNotes = document.createElement('div');
        folderNotes.className = 'folder-notes';
        folderNotes.style.display = 'none';
        
        const typingNoteId = this.app.currentNote?.id;
        const wasTyping = typingNoteId && document.querySelector(`[data-note-id="${typingNoteId}"]`)?.classList.contains('typing');
        
        folder.notes.forEach(note => {
            const li = this.createNoteListItem(note);
            li.classList.add('folder-note');
            
            if (this.app.currentNote && note.id === this.app.currentNote.id) {
                li.classList.add('active');
                if (wasTyping) {
                    li.classList.add('typing');
                }
            }
            
            folderNotes.appendChild(li);
        });
        
        folderDiv.appendChild(folderNotes);
        
        // Event listeners
        folderHeader.addEventListener('click', (e) => {
            if (e.target.classList.contains('folder-action-icon')) return;
            this.toggleFolder(folderDiv);
        });
        
        if (this.app.isAuthenticated) {
            const renameIcon = folderActions.querySelector('.rename-folder');
            const deleteIcon = folderActions.querySelector('.delete-folder');
            
            if (renameIcon) {
                renameIcon.addEventListener('click', (e) => {
                    e.stopPropagation();
                    this.renameFolder(folder.name);
                });
            }
            
            if (deleteIcon) {
                deleteIcon.addEventListener('click', (e) => {
                    e.stopPropagation();
                    this.deleteFolder(folder.name);
                });
            }
        }
        
        return folderDiv;
    }

    toggleFolder(folderDiv) {
        const expandIcon = folderDiv.querySelector('.folder-expand-icon');
        const folderNotes = folderDiv.querySelector('.folder-notes');
        
        if (folderNotes.style.display === 'none') {
            folderNotes.style.display = 'block';
            expandIcon.textContent = '▼';
            folderDiv.classList.add('expanded');
        } else {
            folderNotes.style.display = 'none';
            expandIcon.textContent = '▶';
            folderDiv.classList.remove('expanded');
        }
    }

    async renameFolder(oldName) {
        const newName = prompt('Enter new folder name:', oldName);
        if (!newName || newName === oldName) return;
        
        try {
            const response = await fetch(`/api/folders/${encodeURIComponent(oldName)}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name: newName })
            });
            
            if (response.ok) {
                await this.loadNotes();
            } else {
                const error = await response.json();
                alert(`Error: ${error.error}`);
            }
        } catch (error) {
            console.error('Failed to rename folder:', error);
            alert('Failed to rename folder');
        }
    }

    async createFolder() {
        const folderName = prompt('Enter folder name:');
        if (!folderName) return;
        
        try {
            const response = await fetch('/api/folders', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name: folderName })
            });
            
            if (response.ok) {
                await this.loadNotes();
            } else {
                const error = await response.json();
                alert(`Error: ${error.error}`);
            }
        } catch (error) {
            console.error('Failed to create folder:', error);
            alert('Failed to create folder');
        }
    }

    async deleteFolder(folderName) {
        if (!confirm(`Delete folder "${folderName}"? All notes will be moved to the root level.`)) return;
        
        try {
            const response = await fetch(`/api/folders/${encodeURIComponent(folderName)}`, {
                method: 'DELETE'
            });
            
            if (response.ok) {
                await this.loadNotes();
            } else {
                const error = await response.json();
                alert(`Error: ${error.error}`);
            }
        } catch (error) {
            console.error('Failed to delete folder:', error);
            alert('Failed to delete folder');
        }
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

    async moveNoteToFolder(noteId, folderName) {
        try {
            const response = await fetch(`/api/notes/${noteId}/move`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ folderName: folderName })
            });
            
            if (response.ok) {
                await this.loadNotes();
                return true;
            } else {
                const error = await response.json();
                alert(`Error: ${error.error}`);
                return false;
            }
        } catch (error) {
            console.error('Failed to move note:', error);
            alert('Failed to move note');
            return false;
        }
    }

    updateCurrentNoteAssets(assets) {
        if (this.app.currentNote) {
            this.app.currentNote.assets = assets;
            // Update the note in the notes array
            const index = this.app.notes.findIndex(n => n.id === this.app.currentNote.id);
            if (index !== -1) {
                this.app.notes[index].assets = assets;
            }
        }
    }
}

export default NoteManager;
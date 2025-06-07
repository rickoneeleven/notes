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
            
            const index = this.app.notes.findIndex(n => n.id === updatedNote.id);
            if (index !== -1) {
                this.app.notes.splice(index, 1);
                this.app.notes.unshift(updatedNote);
                this.renderNotesList();
            }
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
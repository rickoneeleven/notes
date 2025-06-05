class NoteStateService {
    constructor(authManager, urlManager) {
        this.authManager = authManager;
        this.urlManager = urlManager;
        this.currentNote = null;
        this.noteLoadedAt = null;
        this.contentHash = null;
        this.notes = [];
        this.onNoteSelected = null;
        this.onNoteCleared = null;
    }

    selectNote(note) {
        console.log(`[NoteStateService.selectNote] Selecting note ID: ${note.id}, Title: "${note.title}", Visibility: ${note.visibility}, Public Editable: ${note.public_editable}`);
        
        const previousNote = this.currentNote;
        this.currentNote = note;
        this.noteLoadedAt = new Date(note.modified);
        this.contentHash = this.hashContent(note.content);
        
        if (this.onNoteSelected) {
            this.onNoteSelected(note, previousNote);
        }
        
        console.log(`[NoteStateService.selectNote] Note ${note.id} selection complete.`);
    }

    getCurrentNote() {
        return this.currentNote;
    }

    clearCurrentNote() {
        console.log('[NoteStateService.clearCurrentNote] Clearing current note selection.');
        const previousNote = this.currentNote;
        this.currentNote = null;
        this.noteLoadedAt = null;
        this.contentHash = null;
        
        if (this.onNoteCleared) {
            this.onNoteCleared(previousNote);
        }
    }

    updateActiveNoteInList(noteId) {
        document.querySelectorAll('.notes-list li').forEach(li => {
            li.classList.remove('active', 'typing');
        });
        
        const newActiveNoteElement = document.querySelector(`.notes-list li[data-note-id="${noteId}"]`);
        if (newActiveNoteElement) {
            newActiveNoteElement.classList.add('active');
        }
    }

    getNotes() {
        return this.notes;
    }

    setNotes(notes) {
        this.notes = notes;
    }

    findNoteById(noteId) {
        return this.notes.find(n => n.id === noteId);
    }

    updateCurrentNoteMetadata(metadata) {
        if (!this.currentNote) return;
        
        console.log(`[NoteStateService.updateCurrentNoteMetadata] Updating metadata for note ID: ${this.currentNote.id}`);
        this.currentNote.title = metadata.title;
        this.currentNote.visibility = metadata.visibility;
        this.currentNote.public_editable = metadata.public_editable;
        this.currentNote.content = metadata.content;
        this.noteLoadedAt = new Date(metadata.modified);
        this.contentHash = this.hashContent(metadata.content);
    }

    isNoteSelected() {
        return this.currentNote !== null;
    }

    getNoteLoadedAt() {
        return this.noteLoadedAt;
    }

    getCurrentNoteId() {
        return this.currentNote ? this.currentNote.id : null;
    }

    isCurrentNote(noteId) {
        return this.currentNote && this.currentNote.id === noteId;
    }

    getContentHash() {
        return this.contentHash;
    }

    hashContent(content) {
        if (!content) return '';
        let hash = 0;
        for (let i = 0; i < content.length; i++) {
            const char = content.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash = hash & hash;
        }
        return hash.toString();
    }
}

export default NoteStateService;
class NoteStateService {
    constructor(authManager, urlManager) {
        this.authManager = authManager;
        this.urlManager = urlManager;
        this.currentNote = null;
        this.noteLoadedAt = null;
        this.notes = [];
        this.onNoteSelected = null;
        this.onNoteCleared = null;
    }

    selectNote(note) {
        console.log(`[NoteStateService.selectNote] Selecting note ID: ${note.id}, Title: "${note.title}", Visibility: ${note.visibility}, Public Editable: ${note.public_editable}`);
        
        const previousNote = this.currentNote;
        this.currentNote = note;
        this.noteLoadedAt = new Date(note.modified);
        
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
        this.noteLoadedAt = new Date(metadata.modified);
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
}

export default NoteStateService;
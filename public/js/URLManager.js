class URLManager {
    constructor(app) {
        this.app = app;
    }

    setApp(app) {
        this.app = app;
    }

    checkUrlForNote() {
        const path = window.location.pathname;
        const noteIdMatch = path.match(/^\/(?:note|edit)\/(note_[a-f0-9.]+)$/i);
        
        if (noteIdMatch) {
            const noteId = noteIdMatch[1];
            this.loadNoteFromUrl(noteId);
        } else {
            this.app.clearCurrentNote();
        }
    }

    async loadNoteFromUrl(noteId) {
        try {
            const response = await fetch(`/api/notes/${noteId}`);
            if (response.ok) {
                const note = await response.json();
                
                // Ensure note is in the local notes list
                const existingNote = this.app.notes.find(n => n.id === note.id);
                if (!existingNote) {
                    this.app.notes.unshift(note);
                    this.app.noteManager.renderNotesList();
                }
                
                this.app.selectNote(note);
            } else {
                this.app.clearCurrentNote();
            }
        } catch (error) {
            console.error('Failed to load note:', error);
            this.app.clearCurrentNote();
        }
    }
}

export default URLManager;
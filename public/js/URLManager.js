class URLManager {
    constructor(app) {
        this.app = app;
    }

    checkUrlForNote() {
        const path = window.location.pathname;
        const noteIdMatch = path.match(/^\/note\/([a-z0-9-_]+)$/i);
        
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
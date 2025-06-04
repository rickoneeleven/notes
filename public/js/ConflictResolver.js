class ConflictResolver {
    constructor(app) {
        this.app = app;
    }

    async checkForConflicts() {
        if (!this.app.currentNote || !this.app.noteLoadedAt) return false;
        
        try {
            const response = await fetch(`/api/notes/${this.app.currentNote.id}`);
            const latestNote = await response.json();
            const latestModified = new Date(latestNote.modified);
            
            if (latestModified > this.app.noteLoadedAt) {
                return this.handleConflict(latestNote);
            }
            return false;
        } catch (error) {
            console.error('Failed to check for conflicts:', error);
            return false;
        }
    }

    handleConflict(latestNote) {
        const currentContent = this.app.editorManager.getContent();
        
        if (latestNote.content === currentContent) {
            this.app.currentNote = latestNote;
            this.app.noteLoadedAt = new Date(latestNote.modified);
            return false;
        }
        
        // Auto-sync if user hasn't edited recently (within last 10 seconds)
        if (!this.app.pollingManager.hasRecentEdits()) {
            console.log('Auto-syncing remote changes (no recent local edits)');
            this.app.selectNote(latestNote);
            return false;
        }
        
        const userChoice = confirm(
            'This note has been modified elsewhere. Your changes:\n\n' +
            currentContent.slice(0, 200) + (currentContent.length > 200 ? '...' : '') + 
            '\n\nLatest version:\n\n' +
            latestNote.content.slice(0, 200) + (latestNote.content.length > 200 ? '...' : '') +
            '\n\nClick OK to keep your changes or Cancel to load the latest version.'
        );
        
        if (!userChoice) {
            this.app.selectNote(latestNote);
        }
        
        return userChoice;
    }

    async checkForNoteUpdates() {
        if (!this.app.currentNote || !this.app.noteLoadedAt) return;
        
        try {
            const response = await fetch(`/api/notes/${this.app.currentNote.id}`);
            const latestNote = await response.json();
            const latestModified = new Date(latestNote.modified);
            
            if (latestModified > this.app.noteLoadedAt) {
                this.handleConflict(latestNote);
            }
        } catch (error) {
            console.error('Failed to check for updates:', error);
        }
    }
}

export default ConflictResolver;
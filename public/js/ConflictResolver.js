class ConflictResolver {
    constructor(app) {
        this.app = app;
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

    setApp(app) {
        this.app = app;
    }

    async checkForConflicts() {
        if (!this.app.currentNote || !this.app.noteStateService.getContentHash()) return false;
        
        try {
            const response = await fetch(`/api/notes/${this.app.currentNote.id}`);
            const latestNote = await response.json();
            const serverContentHash = this.hashContent(latestNote.content);
            const localContentHash = this.app.noteStateService.getContentHash();
            const currentEditorContent = this.app.editorManager.getContent();
            const currentEditorHash = this.hashContent(currentEditorContent);
            
            console.log('[ConflictResolver.checkForConflicts] DETAILED DEBUG:');
            console.log('  - Note ID:', this.app.currentNote.id);
            console.log('  - Server content length:', latestNote.content.length);
            console.log('  - Server content hash:', serverContentHash);
            console.log('  - Local stored hash:', localContentHash);
            console.log('  - Current editor content length:', currentEditorContent.length);
            console.log('  - Current editor hash:', currentEditorHash);
            console.log('  - Server content preview:', latestNote.content.slice(0, 100) + '...');
            console.log('  - Editor content preview:', currentEditorContent.slice(0, 100) + '...');
            
            if (serverContentHash !== localContentHash) {
                console.log('[ConflictResolver.checkForConflicts] HASH MISMATCH DETECTED - Investigating...');
                console.log('  - Does server content match editor content?', latestNote.content === currentEditorContent);
                console.log('  - Does server hash match editor hash?', serverContentHash === currentEditorHash);
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
            this.app.noteStateService.updateCurrentNoteMetadata(latestNote);
            return false;
        }
        
        if (!this.app.pollingManager.hasRecentEdits()) {
            console.log('Auto-syncing remote changes (no recent local edits)');
            this.app.noteStateService.selectNote(latestNote);
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
            this.app.noteStateService.selectNote(latestNote);
        }
        
        return userChoice;
    }

    async checkForNoteUpdates() {
        if (!this.app.currentNote || !this.app.noteStateService.getContentHash()) return;
        
        try {
            const response = await fetch(`/api/notes/${this.app.currentNote.id}`);
            const latestNote = await response.json();
            const serverContentHash = this.hashContent(latestNote.content);
            const localContentHash = this.app.noteStateService.getContentHash();
            
            if (serverContentHash !== localContentHash) {
                this.handleConflict(latestNote);
            }
        } catch (error) {
            console.error('Failed to check for updates:', error);
        }
    }
}

export default ConflictResolver;
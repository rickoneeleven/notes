class NoteCRUDService {
    constructor(noteManager, conflictResolver, noteStateService, editorManager, authManager) {
        this.noteManager = noteManager;
        this.conflictResolver = conflictResolver;
        this.noteStateService = noteStateService;
        this.editorManager = editorManager;
        this.authManager = authManager;
    }

    async saveCurrentNote() {
        const currentNote = this.noteStateService.getCurrentNote();
        if (!currentNote) {
            console.warn('[NoteCRUDService.saveCurrentNote] Attempted to save but no current note.');
            return false;
        }
        
        console.log(`[NoteCRUDService.saveCurrentNote] Attempting to save note ID: ${currentNote.id}`);
        
        if (await this.conflictResolver.checkForConflicts()) {
            console.log(`[NoteCRUDService.saveCurrentNote] Conflict detected for note ID: ${currentNote.id}. Save aborted by conflict resolver.`);
            return false;
        }
        
        const noteData = {
            content: this.editorManager.getContent()
        };
        
        if (this.authManager.isAuthenticated) {
            noteData.title = document.getElementById('noteTitle').value;
            noteData.visibility = document.getElementById('publicToggle').checked ? 'public' : 'private';
            noteData.public_editable = document.getElementById('editableToggle').checked;
            console.log(`[NoteCRUDService.saveCurrentNote] Authenticated save. Title: "${noteData.title}", Visibility: ${noteData.visibility}, Public Editable: ${noteData.public_editable}`);
        } else {
            console.log('[NoteCRUDService.saveCurrentNote] Guest save (content only).');
        }
        
        const success = await this.noteManager.saveNote(noteData);
        if (success) {
            console.log(`[NoteCRUDService.saveCurrentNote] Note ID: ${currentNote.id} saved successfully.`);
        } else {
            console.error(`[NoteCRUDService.saveCurrentNote] Failed to save note ID: ${currentNote.id}.`);
        }
        
        return success;
    }

    async saveSpecificNote(note, content) {
        if (!note) {
            console.warn('[NoteCRUDService.saveSpecificNote] No note provided.');
            return false;
        }
        
        console.log(`[NoteCRUDService.saveSpecificNote] Saving content to note ID: ${note.id}`);
        
        const noteData = { content };
        
        // Save directly to specific note ID without modifying current note state
        const success = await this.noteManager.saveNote(noteData, note.id);
        if (success) {
            console.log(`[NoteCRUDService.saveSpecificNote] Note ID: ${note.id} saved successfully.`);
        } else {
            console.error(`[NoteCRUDService.saveSpecificNote] Failed to save note ID: ${note.id}.`);
        }
        
        return success;
    }

    async deleteCurrentNote() {
        const currentNote = this.noteStateService.getCurrentNote();
        if (!currentNote || !this.authManager.isAuthenticated) {
            console.warn('[NoteCRUDService.deleteCurrentNote] Conditions not met for delete (no current note or not authenticated).');
            return false;
        }
        
        if (!confirm(`Are you sure you want to delete the note "${currentNote.title || 'Untitled'}"?`)) {
            console.log('[NoteCRUDService.deleteCurrentNote] Delete cancelled by user.');
            return false;
        }
        
        console.log(`[NoteCRUDService.deleteCurrentNote] Deleting note ID: ${currentNote.id}`);
        const success = await this.noteManager.deleteNote(currentNote.id);
        if (success) {
            console.log(`[NoteCRUDService.deleteCurrentNote] Note ID: ${currentNote.id} deleted successfully.`);
            return true;
        } else {
            console.error(`[NoteCRUDService.deleteCurrentNote] Failed to delete note ID: ${currentNote.id}.`);
            return false;
        }
    }

    async createNote(content) {
        if (!this.authManager.isAuthenticated) {
            console.warn('[NoteCRUDService.createNote] Cannot create note - user not authenticated.');
            return null;
        }
        
        console.log('[NoteCRUDService.createNote] Creating new note with content.');
        return await this.noteManager.createNote(content);
    }

    isCreateNoteEligible(content) {
        return !this.noteStateService.isNoteSelected() && 
               this.authManager.isAuthenticated && 
               content.trim().length > 0;
    }
}

export default NoteCRUDService;
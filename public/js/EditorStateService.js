class EditorStateService {
    constructor(editorManager, pollingManager, noteStateService) {
        this.editorManager = editorManager;
        this.pollingManager = pollingManager;
        this.noteStateService = noteStateService;
        this.autosaveTimer = null;
        this.typingTimer = null;
        this.autosaveDelay = 1000;
        this.onContentChange = null;
        this.onTyping = null;
    }

    init(autosaveDelay = 1000) {
        this.autosaveDelay = autosaveDelay;
    }

    handleContentChange() {
        this.pollingManager.trackEdit();
        this.handleTyping();
        
        if (this.onContentChange) {
            this.onContentChange();
        }
        
        this.scheduleAutosave();
    }

    scheduleAutosave() {
        if (!this.noteStateService.isNoteSelected()) {
            return;
        }
        
        clearTimeout(this.autosaveTimer);
        this.autosaveTimer = setTimeout(() => {
            if (this.onAutosave) {
                this.onAutosave();
            }
        }, this.autosaveDelay);
    }

    handleTyping() {
        const currentNoteId = this.noteStateService.getCurrentNoteId();
        if (!currentNoteId) return;
        
        if (this.onTyping) {
            this.onTyping(currentNoteId, true);
        }
        
        clearTimeout(this.typingTimer);
        this.typingTimer = setTimeout(() => {
            if (this.onTyping) {
                this.onTyping(currentNoteId, false);
            }
        }, 5000);
    }

    updateEditorState(note) {
        this.editorManager.setContent(note.content);
        document.getElementById('noteTitle').value = note.title;
        document.getElementById('publicToggle').checked = note.visibility === 'public';
        document.getElementById('editableToggle').checked = note.public_editable;
        
        const editableWrapper = document.getElementById('editableToggleWrapper');
        editableWrapper.style.display = note.visibility === 'public' ? 'flex' : 'none';
    }

    clearEditor() {
        this.editorManager.setContent('');
        document.getElementById('noteTitle').value = '';
        document.getElementById('editorHeader').style.display = 'none';
    }

    clearTimers() {
        clearTimeout(this.autosaveTimer);
        clearTimeout(this.typingTimer);
    }

    flushPendingAutosave() {
        if (this.autosaveTimer && this.onAutosave) {
            clearTimeout(this.autosaveTimer);
            this.autosaveTimer = null;
            this.onAutosave();
        }
    }

    async savePreviousNoteContent(previousNote) {
        if (!previousNote || !this.onSaveNote) {
            console.log('[EditorStateService.savePreviousNoteContent] Skipping - no previous note or no save callback');
            return;
        }
        
        try {
            console.log(`[EditorStateService.savePreviousNoteContent] Checking content for previous note ID: ${previousNote.id}`);
            
            // Get current editor content to save to the previous note
            const content = this.editorManager.getContent();
            
            // Only save if content has actually changed
            if (content === previousNote.content) {
                console.log(`[EditorStateService.savePreviousNoteContent] Content unchanged for note ID: ${previousNote.id}, skipping save`);
                return;
            }
            
            console.log(`[EditorStateService.savePreviousNoteContent] Content changed for note ID: ${previousNote.id}, saving. Content length: ${content.length}`);
            
            // Call the save function directly with the previous note and current content
            const result = await this.onSaveNote(previousNote, content);
            console.log(`[EditorStateService.savePreviousNoteContent] Save result: ${result}`);
        } catch (error) {
            console.error('[EditorStateService.savePreviousNoteContent] Error saving previous note:', error);
        }
    }

    getContent() {
        return this.editorManager.getContent();
    }
}

export default EditorStateService;
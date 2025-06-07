class AppCoordinator {
    constructor(dependencies) {
        this.ui = dependencies.ui;
        this.auth = dependencies.auth;
        this.assetManager = dependencies.assetManager;
        this.noteManager = dependencies.noteManager;
        this.pollingManager = dependencies.pollingManager;
        this.conflictResolver = dependencies.conflictResolver;
        this.clipboardManager = dependencies.clipboardManager;
        this.deletedNotesManager = dependencies.deletedNotesManager;
        this.urlManager = dependencies.urlManager;
        this.eventHandler = dependencies.eventHandler;
        this.editorManager = dependencies.editorManager;
        
        this.noteStateService = dependencies.noteStateService;
        this.editorStateService = dependencies.editorStateService;
        this.noteCRUDService = dependencies.noteCRUDService;
        this.visibilityService = dependencies.visibilityService;
        
        this.isAuthenticated = false;
        this.config = null;
        
        this.setupServiceCallbacks();
    }
    
    get currentNote() {
        return this.noteStateService.getCurrentNote();
    }
    
    get noteLoadedAt() {
        return this.noteStateService.getNoteLoadedAt();
    }
    
    get notes() {
        return this.noteStateService.getNotes();
    }
    
    set notes(value) {
        this.noteStateService.setNotes(value);
    }
    
    setupServiceCallbacks() {
        this.noteStateService.onNoteSelected = (note, previousNote) => {
            if (previousNote) {
                this.ui.setTypingIndicator(previousNote.id, false);
                this.editorStateService.savePreviousNoteContent(previousNote);
                this.editorStateService.clearTimers();
            }
            
            this.pollingManager.startNotePolling();
            this.editorStateService.updateEditorState(note);
            this.assetManager.setCurrentNote(note.id);
            this.assetManager.renderAssets(note.assets || []);
            this.noteStateService.updateActiveNoteInList(note.id);
            this.updateUI();
        };
        
        this.noteStateService.onNoteCleared = (previousNote) => {
            if (previousNote) {
                this.ui.setTypingIndicator(previousNote.id, false);
                this.editorStateService.savePreviousNoteContent(previousNote);
            }
            this.editorStateService.clearTimers();
            this.pollingManager.stopNotePolling();
            this.editorStateService.clearEditor();
            this.assetManager.renderAssets([]);
            
            const activeNoteListItem = document.querySelector('.notes-list li.active');
            if (activeNoteListItem) {
                activeNoteListItem.classList.remove('active');
            }
        };
        
        this.editorStateService.onContentChange = () => {
            const content = this.editorStateService.getContent();
            if (this.noteCRUDService.isCreateNoteEligible(content)) {
                console.log('[AppCoordinator] Content detected in empty editor by authenticated user. Creating new note.');
                this.noteManager.createNote(content);
            }
        };
        
        this.editorStateService.onAutosave = () => {
            this.saveCurrentNote();
        };
        
        this.editorStateService.onSaveNote = (note, content) => {
            return this.noteCRUDService.saveSpecificNote(note, content);
        };
        
        this.editorStateService.onTyping = (noteId, isTyping) => {
            this.ui.setTypingIndicator(noteId, isTyping);
        };
    }
    
    init() {
        const editorMount = document.getElementById('editor');
        console.log('[AppCoordinator.init] Initializing application. Editor mount point:', editorMount ? editorMount.id : 'null');
        
        this.editorManager.init(editorMount, {
            readOnly: !this.isAuthenticated
        });
        
        this.editorManager.onContentChange(() => {
            this.editorStateService.handleContentChange();
        });
        
        this.auth.checkAuthentication();
        this.noteManager.loadNotes().then(() => {
            this.urlManager.checkUrlForNote();
        });
        this.eventHandler.bindEvents();
        this.pollingManager.startNotesListPolling();
        console.log('[AppCoordinator.init] Initialization complete.');
    }
    
    updateUI() {
        console.log(`[AppCoordinator.updateUI] Called. Authenticated: ${this.isAuthenticated}.`);
        
        this.ui.updateAuthenticationUI();
        
        if (this.editorManager && this.editorManager.view) {
            const currentNote = this.noteStateService.getCurrentNote();
            const shouldBeReadOnly = this.visibilityService.shouldEditorBeReadOnly(currentNote, this.isAuthenticated);
            
            console.log(`[AppCoordinator.updateUI] Final determination for editor - shouldBeReadOnly: ${shouldBeReadOnly}`);
            this.editorManager.setReadOnly(shouldBeReadOnly);
        } else {
            console.warn('[AppCoordinator.updateUI] EditorManager or its view is not available. Cannot set read-only state.');
        }
    }
    
    selectNote(note) {
        const currentNote = this.noteStateService.getCurrentNote();
        if (currentNote && currentNote.id === note.id && this.editorManager.getContent() === note.content) {
            console.log(`[AppCoordinator.selectNote] Note ${note.id} is already selected and content is identical. Ensuring UI state is correct.`);
            this.noteStateService.updateActiveNoteInList(note.id);
            this.updateUI();
            return;
        }
        
        this.noteStateService.selectNote(note);
    }
    
    clearCurrentNote() {
        console.log('[AppCoordinator.clearCurrentNote] Clearing current note selection.');
        this.noteStateService.clearCurrentNote();
        this.updateUI();
    }
    
    handleVisibilityChange() {
        this.visibilityService.handleVisibilityChange();
        this.saveCurrentNote();
    }
    
    async saveCurrentNote() {
        await this.noteCRUDService.saveCurrentNote();
    }
    
    copyDirectLink() {
        const currentNote = this.noteStateService.getCurrentNote();
        if (!currentNote) {
            console.warn('[AppCoordinator.copyDirectLink] No current note to copy link for.');
            return;
        }
        console.log(`[AppCoordinator.copyDirectLink] Copying direct link for note ID: ${currentNote.id}`);
        this.clipboardManager.copyDirectLink(currentNote.id);
    }
    
    async deleteCurrentNote() {
        const success = await this.noteCRUDService.deleteCurrentNote();
        if (success) {
            this.clearCurrentNote();
        }
    }
    
    async checkForNotesListUpdates() {
        try {
            const endpoint = this.isAuthenticated ? '/api/notes' : '/api/public-notes';
            const response = await fetch(endpoint);
            if (!response.ok) {
                console.error(`[AppCoordinator.checkForNotesListUpdates] API error: ${response.status}`);
                return;
            }
            const latestNotes = await response.json();
            
            if (this.pollingManager.hasNotesListChanged(latestNotes)) {
                console.log('[AppCoordinator.checkForNotesListUpdates] Notes list has changed. Updating local list and rendering.');
                this.noteStateService.setNotes(latestNotes);
                this.noteManager.renderNotesList();
                
                const currentNote = this.noteStateService.getCurrentNote();
                if (currentNote) {
                    const updatedCurrentNoteData = latestNotes.find(n => n.id === currentNote.id);
                    if (updatedCurrentNoteData) {
                        if (currentNote.title !== updatedCurrentNoteData.title ||
                            currentNote.visibility !== updatedCurrentNoteData.visibility ||
                            currentNote.public_editable !== updatedCurrentNoteData.public_editable) {
                            
                            console.log(`[AppCoordinator.checkForNotesListUpdates] Metadata for current note ID: ${currentNote.id} updated by poll.`);
                            this.noteStateService.updateCurrentNoteMetadata(updatedCurrentNoteData);
                            this.editorStateService.updateEditorState(updatedCurrentNoteData);
                            this.updateUI();
                        }
                    } else {
                        console.log(`[AppCoordinator.checkForNotesListUpdates] Current note ID: ${currentNote.id} no longer exists. Clearing selection.`);
                        this.clearCurrentNote();
                    }
                }
            }
        } catch (error) {
            console.error('[AppCoordinator.checkForNotesListUpdates] Failed to check for notes list updates:', error);
        }
    }
    
    checkForNoteUpdates() {
        this.conflictResolver.checkForNoteUpdates();
    }
}

export default AppCoordinator;
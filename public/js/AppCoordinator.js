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
        this.versionManager = dependencies.versionManager;
        
        this.isAuthenticated = false;
        this.config = null;
        this.isInVersionReviewMode = false;
        this.currentVersionNote = null;
        this.originalNote = null;
        
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
        // Exit version review mode when selecting a regular note
        if (this.isInVersionReviewMode) {
            console.log('[AppCoordinator.selectNote] Exiting version review mode due to note selection');
            this.exitVersionReviewMode();
        }

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
        
        // Exit version review mode when clearing note selection
        if (this.isInVersionReviewMode) {
            console.log('[AppCoordinator.clearCurrentNote] Exiting version review mode due to note clearing');
            this.exitVersionReviewMode();
        }
        
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
    
    async forceSyncCurrentNote() {
        if (!this.currentNote) {
            console.log('[AppCoordinator.forceSyncCurrentNote] No current note to sync');
            return;
        }
        
        this.editorManager.setReadOnly(true);
        
        try {
            console.log(`[AppCoordinator.forceSyncCurrentNote] Syncing note ${this.currentNote.id}`);
            
            const response = await fetch(`/api/notes/${this.currentNote.id}`);
            if (!response.ok) {
                console.error(`[AppCoordinator.forceSyncCurrentNote] API error: ${response.status}`);
                return;
            }
            
            const latestNote = await response.json();
            const serverContentHash = this.conflictResolver.hashContent(latestNote.content);
            const localContentHash = this.noteStateService.getContentHash();
            
            if (!localContentHash || serverContentHash !== localContentHash) {
                console.log('[AppCoordinator.forceSyncCurrentNote] Remote changes detected or no local hash, handling conflict');
                this.conflictResolver.handleConflict(latestNote);
            } else {
                console.log('[AppCoordinator.forceSyncCurrentNote] No remote changes detected');
            }
        } catch (error) {
            console.error('[AppCoordinator.forceSyncCurrentNote] Failed to sync:', error);
        } finally {
            const currentNote = this.noteStateService.getCurrentNote();
            const shouldBeReadOnly = this.visibilityService.shouldEditorBeReadOnly(currentNote, this.isAuthenticated);
            this.editorManager.setReadOnly(shouldBeReadOnly);
        }
    }

    async showVersionsModal() {
        const currentNote = this.currentNote;
        if (!currentNote) {
            console.warn('[AppCoordinator.showVersionsModal] No note selected');
            return;
        }

        if (!this.versionManager.isVersionsAvailable()) {
            console.warn('[AppCoordinator.showVersionsModal] Versions not available');
            return;
        }

        this.ui.showVersionsModal();
        this.ui.showVersionsLoading();

        try {
            console.log(`[AppCoordinator.showVersionsModal] Fetching versions for note: ${currentNote.id}`);
            const versions = await this.versionManager.fetchVersionsForCurrentNote();
            
            this.ui.showVersionsContent();
            this.ui.renderVersionsList(versions, currentNote);
            
            console.log(`[AppCoordinator.showVersionsModal] Successfully loaded ${versions.length} versions`);
        } catch (error) {
            console.error('[AppCoordinator.showVersionsModal] Failed to load versions:', error);
            this.ui.showVersionsError(error.message || 'Failed to load versions');
        }
    }

    async viewVersion(timestamp) {
        const currentNote = this.currentNote;
        if (!currentNote) {
            console.warn('[AppCoordinator.viewVersion] No note selected');
            return;
        }

        try {
            console.log(`[AppCoordinator.viewVersion] Loading version ${timestamp} for note: ${currentNote.id}`);
            const version = await this.versionManager.fetchVersionForCurrentNote(timestamp);
            
            this.ui.hideVersionsModal();
            
            // Enter version review mode
            this.enterVersionReviewMode(version, currentNote);
            
        } catch (error) {
            console.error('[AppCoordinator.viewVersion] Failed to load version:', error);
            this.ui.showVersionsError(error.message || 'Failed to load version');
        }
    }

    enterVersionReviewMode(versionNote, originalNote) {
        console.log('[AppCoordinator.enterVersionReviewMode] Entering version review mode', {
            versionTimestamp: versionNote.version_timestamp,
            originalNoteId: originalNote.id
        });

        // Store current state
        this.originalNote = originalNote;
        this.currentVersionNote = versionNote;
        this.isInVersionReviewMode = true;

        // Set editor to read-only mode
        this.editorManager.setReadOnly(true);

        // Update editor content with version content
        this.editorManager.setContent(versionNote.content || '');

        // Update note title to show version information
        this.updateNoteTitleForVersion(versionNote, originalNote);

        // Show version review banner
        this.showVersionReviewBanner();

        // Stop polling while in review mode
        this.pollingManager.stopPolling();

        console.log('[AppCoordinator.enterVersionReviewMode] Version review mode activated');
    }

    exitVersionReviewMode() {
        if (!this.isInVersionReviewMode) {
            console.log('[AppCoordinator.exitVersionReviewMode] Not in version review mode');
            return;
        }

        console.log('[AppCoordinator.exitVersionReviewMode] Exiting version review mode');

        // Restore original note content
        if (this.originalNote) {
            this.editorManager.setContent(this.originalNote.content || '');
            this.updateNoteTitleForOriginalNote(this.originalNote);
        }

        // Hide version review banner
        this.hideVersionReviewBanner();

        // Reset state
        this.isInVersionReviewMode = false;
        this.currentVersionNote = null;
        this.originalNote = null;

        // Re-enable editing based on permissions
        const shouldBeReadOnly = this.visibilityService.shouldEditorBeReadOnly(this.currentNote, this.isAuthenticated);
        this.editorManager.setReadOnly(shouldBeReadOnly);

        // Resume polling
        this.pollingManager.startNotePolling();

        console.log('[AppCoordinator.exitVersionReviewMode] Version review mode deactivated');
    }

    updateNoteTitleForVersion(versionNote, originalNote) {
        const titleElement = document.getElementById('noteTitle');
        if (titleElement) {
            const originalTitle = originalNote.title || 'Untitled';
            const versionDate = versionNote.version_display_date || 'Unknown date';
            titleElement.value = `${originalTitle} (Version from ${versionDate})`;
            titleElement.disabled = true;
            titleElement.style.fontStyle = 'italic';
            titleElement.style.color = '#858585';
        }
    }

    updateNoteTitleForOriginalNote(originalNote) {
        const titleElement = document.getElementById('noteTitle');
        if (titleElement) {
            titleElement.value = originalNote.title || 'Untitled';
            titleElement.disabled = false;
            titleElement.style.fontStyle = 'normal';
            titleElement.style.color = '';
        }
    }

    showVersionReviewBanner() {
        const banner = document.getElementById('versionReviewBanner');
        if (banner) {
            banner.style.display = 'flex';
        }
    }

    hideVersionReviewBanner() {
        const banner = document.getElementById('versionReviewBanner');
        if (banner) {
            banner.style.display = 'none';
        }
    }
}

export default AppCoordinator;
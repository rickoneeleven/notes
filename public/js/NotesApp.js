import UIManager from './UIManager.js';
import AuthManager from './AuthManager.js';
import NoteManager from './NoteManager.js';
import PollingManager from './PollingManager.js';
import ConflictResolver from './ConflictResolver.js';
import ClipboardManager from './ClipboardManager.js';
import DeletedNotesManager from './DeletedNotesManager.js';
import URLManager from './URLManager.js';
import EventHandler from './EventHandler.js';
import { AssetManager } from './AssetManager.js';
import EditorManager from './EditorManager.js';

class NotesApp {
    constructor() {
        this.currentNote = null;
        this.isAuthenticated = false;
        this.autosaveTimer = null;
        this.notes = [];
        this.noteLoadedAt = null;
        this.typingTimer = null;
        
        this.ui = new UIManager(this);
        this.auth = new AuthManager(this);
        this.assetManager = new AssetManager(this.auth, this.ui);
        this.noteManager = new NoteManager(this);
        this.pollingManager = new PollingManager(this);
        this.conflictResolver = new ConflictResolver(this);
        this.clipboardManager = new ClipboardManager();
        this.deletedNotesManager = new DeletedNotesManager(this);
        this.urlManager = new URLManager(this);
        this.eventHandler = new EventHandler(this);
        this.editorManager = new EditorManager();
        
        this.assetManager.setApp(this);
        this.editorManager.setApp(this);
        
        // window.noteManager = this.noteManager; // Exposed for debugging, consider removal in final production
        
        this.init();
    }
    
    init() {
        const editorMount = document.getElementById('editor');
        console.log('[NotesApp.init] Initializing application. Editor mount point:', editorMount ? editorMount.id : 'null');
        
        this.editorManager.init(editorMount, {
            readOnly: !this.isAuthenticated // Initial read-only state based on pre-auth status
        });
        
        this.editorManager.onContentChange(() => {
            // console.log('[NotesApp.onContentChange] Editor content changed.'); // Potentially too noisy
            this.pollingManager.trackEdit();
            this.handleTyping();
            
            const content = this.editorManager.getContent();
            if (!this.currentNote && this.isAuthenticated && content.trim()) {
                console.log('[NotesApp.onContentChange] Content detected in empty editor by authenticated user. Creating new note.');
                this.noteManager.createNote(content); // No return needed, createNote handles selection
                return;
            }
            
            this.scheduleAutosave();
        });
        
        this.auth.checkAuthentication(); // This will call updateUI
        this.noteManager.loadNotes();
        this.eventHandler.bindEvents();
        this.urlManager.checkUrlForNote(); // This may call selectNote, which calls updateUI
        this.pollingManager.startNotesListPolling();
        console.log('[NotesApp.init] Initialization complete.');
    }
    
    updateUI() {
        const callSite = new Error().stack.split('\n')[2]?.trim() || 'Unknown call site';
        console.log(`[NotesApp.updateUI] Called. Authenticated: ${this.isAuthenticated}. From: ${callSite}`);
        
        if (this.currentNote) {
            console.log(`[NotesApp.updateUI] Current Note ID: ${this.currentNote.id}, Title: "${this.currentNote.title}", Visibility: ${this.currentNote.visibility}, Public Editable: ${this.currentNote.public_editable}`);
        } else {
            console.log('[NotesApp.updateUI] No current note selected.');
        }

        this.ui.updateAuthenticationUI();
        
        if (this.editorManager && this.editorManager.view) {
            let shouldBeReadOnly = true; // Default to read-only
            
            if (this.isAuthenticated) {
                // Authenticated users can always edit (or type in an empty editor to create a note)
                shouldBeReadOnly = false;
                console.log('[NotesApp.updateUI] User is authenticated. Setting editor to NOT read-only.');
            } else if (this.currentNote && this.currentNote.visibility === 'public' && this.currentNote.public_editable) {
                // Guest user on a public, editable note
                shouldBeReadOnly = false;
                console.log('[NotesApp.updateUI] Guest on public, editable note. Setting editor to NOT read-only.');
            } else if (!this.currentNote) {
                // No current note selected
                // For a guest, this means read-only. For an authenticated user, this means editable (to create new note).
                shouldBeReadOnly = !this.isAuthenticated;
                console.log(`[NotesApp.updateUI] No current note. Authenticated: ${this.isAuthenticated}. Setting editor read-only: ${shouldBeReadOnly}.`);
            } else {
                // Guest user on a non-editable note (private, or public non-editable)
                // shouldBeReadOnly remains true (the default)
                console.log('[NotesApp.updateUI] Guest on non-editable note (private or public non-editable). Setting editor to read-only.');
            }
            
            console.log(`[NotesApp.updateUI] Final determination for editor - shouldBeReadOnly: ${shouldBeReadOnly}`);
            this.editorManager.setReadOnly(shouldBeReadOnly);
        } else {
            console.warn('[NotesApp.updateUI] EditorManager or its view is not available. Cannot set read-only state.');
        }
    }
    
    selectNote(note) {
        console.log(`[NotesApp.selectNote] Selecting note ID: ${note.id}, Title: "${note.title}", Visibility: ${note.visibility}, Public Editable: ${note.public_editable}`);
        
        if (this.currentNote && this.currentNote.id === note.id && this.editorManager.getContent() === note.content) {
            console.log(`[NotesApp.selectNote] Note ${note.id} is already selected and content is identical. Skipping full re-selection logic, but ensuring UI state is correct.`);
            this.updateActiveNoteInList(note.id); // Ensure active class is set
            this.updateUI(); // Still call updateUI to ensure editor state is correct
            return;
        }

        if (this.currentNote) {
            this.ui.setTypingIndicator(this.currentNote.id, false);
            clearTimeout(this.typingTimer);
        }
        
        this.currentNote = note;
        this.noteLoadedAt = new Date(note.modified);
        
        this.pollingManager.startNotePolling();
        
        this.editorManager.setContent(note.content);
        document.getElementById('noteTitle').value = note.title;
        document.getElementById('publicToggle').checked = note.visibility === 'public';
        document.getElementById('editableToggle').checked = note.public_editable;
        
        const editableWrapper = document.getElementById('editableToggleWrapper');
        editableWrapper.style.display = note.visibility === 'public' ? 'flex' : 'none';
        
        this.assetManager.setCurrentNote(note.id);
        this.assetManager.renderAssets(note.assets || []);

        this.updateActiveNoteInList(note.id); // Call this before updateUI if updateUI relies on active list item
        this.updateUI(); // This is a critical call for setting editor read-only state
        console.log(`[NotesApp.selectNote] Note ${note.id} selection processing complete.`);
    }
    
    updateActiveNoteInList(newNoteId) {
        document.querySelectorAll('.notes-list li').forEach(li => {
            li.classList.remove('active', 'typing');
        });
        
        const newActiveNoteElement = document.querySelector(`.notes-list li[data-note-id="${newNoteId}"]`);
        if (newActiveNoteElement) {
            newActiveNoteElement.classList.add('active');
        }
    }
    
    scheduleAutosave() {
        if (!this.currentNote) {
            // console.log('[NotesApp.scheduleAutosave] No current note, autosave cancelled.'); // Can be noisy
            return;
        }
        
        clearTimeout(this.autosaveTimer);
        this.autosaveTimer = setTimeout(() => {
            // console.log('[NotesApp.scheduleAutosave] Autosave triggered.'); // Can be noisy
            this.saveCurrentNote();
        }, this.config?.autosave_delay_ms || 1000); // Assuming config might be loaded later
    }
    
    handleVisibilityChange() {
        if (!this.currentNote || !this.isAuthenticated) {
            console.log('[NotesApp.handleVisibilityChange] Conditions not met for visibility change (no current note or not authenticated).');
            return;
        }
        console.log('[NotesApp.handleVisibilityChange] Visibility toggle changed.');
        
        const isPublic = document.getElementById('publicToggle').checked;
        const editableWrapper = document.getElementById('editableToggleWrapper');
        editableWrapper.style.display = isPublic ? 'flex' : 'none';
        
        if (!isPublic) {
            document.getElementById('editableToggle').checked = false;
        }
        
        this.saveCurrentNote();
    }
    
    async saveCurrentNote() {
        if (!this.currentNote) {
            console.warn('[NotesApp.saveCurrentNote] Attempted to save but no current note.');
            return;
        }
        console.log(`[NotesApp.saveCurrentNote] Attempting to save note ID: ${this.currentNote.id}`);
        
        if (await this.conflictResolver.checkForConflicts()) {
            console.log(`[NotesApp.saveCurrentNote] Conflict detected for note ID: ${this.currentNote.id}. Save aborted by conflict resolver.`);
            return; // Conflict resolver handles UI or triggers re-selection
        }
        
        const noteData = {
            content: this.editorManager.getContent()
        };
        
        if (this.isAuthenticated) {
            noteData.title = document.getElementById('noteTitle').value;
            noteData.visibility = document.getElementById('publicToggle').checked ? 'public' : 'private';
            noteData.public_editable = document.getElementById('editableToggle').checked;
            console.log(`[NotesApp.saveCurrentNote] Authenticated save. Title: "${noteData.title}", Visibility: ${noteData.visibility}, Public Editable: ${noteData.public_editable}`);
        } else {
            console.log('[NotesApp.saveCurrentNote] Guest save (content only).');
        }
        
        const success = await this.noteManager.saveNote(noteData);
        if (success) {
            console.log(`[NotesApp.saveCurrentNote] Note ID: ${this.currentNote.id} saved successfully.`);
        } else {
            console.error(`[NotesApp.saveCurrentNote] Failed to save note ID: ${this.currentNote.id}.`);
        }
    }
    
    copyDirectLink() {
        if (!this.currentNote) {
            console.warn('[NotesApp.copyDirectLink] No current note to copy link for.');
            return;
        }
        console.log(`[NotesApp.copyDirectLink] Copying direct link for note ID: ${this.currentNote.id}`);
        this.clipboardManager.copyDirectLink(this.currentNote.id);
    }
    
    async deleteCurrentNote() {
        if (!this.currentNote || !this.isAuthenticated) {
            console.warn('[NotesApp.deleteCurrentNote] Conditions not met for delete (no current note or not authenticated).');
            return;
        }
        
        if (!confirm(`Are you sure you want to delete the note "${this.currentNote.title || 'Untitled'}"?`)) {
            console.log('[NotesApp.deleteCurrentNote] Delete cancelled by user.');
            return;
        }
        
        console.log(`[NotesApp.deleteCurrentNote] Deleting note ID: ${this.currentNote.id}`);
        const success = await this.noteManager.deleteNote(this.currentNote.id);
        if (success) {
            console.log(`[NotesApp.deleteCurrentNote] Note ID: ${this.currentNote.id} deleted successfully. Clearing editor.`);
            this.clearCurrentNoteInternals(); // Renamed to avoid confusion with clearCurrentNote which is a public interface for URLManager
            this.updateUI(); // Ensure UI reflects no note selected state
        } else {
            console.error(`[NotesApp.deleteCurrentNote] Failed to delete note ID: ${this.currentNote.id}.`);
        }
    }
    
    async checkForNotesListUpdates() {
        // console.log('[NotesApp.checkForNotesListUpdates] Checking for notes list updates.'); // Can be noisy
        try {
            const response = await fetch('/api/notes');
            if (!response.ok) {
                console.error(`[NotesApp.checkForNotesListUpdates] API error: ${response.status}`);
                return;
            }
            const latestNotes = await response.json();
            
            if (this.pollingManager.hasNotesListChanged(latestNotes)) {
                console.log('[NotesApp.checkForNotesListUpdates] Notes list has changed. Updating local list and rendering.');
                this.notes = latestNotes;
                this.noteManager.renderNotesList(); // This will re-render based on this.notes
                
                // If current note's metadata (title, visibility) changed, update editor header
                if (this.currentNote) {
                    const updatedCurrentNoteData = latestNotes.find(n => n.id === this.currentNote.id);
                    if (updatedCurrentNoteData) {
                        // Check if metadata actually changed to avoid unnecessary updates
                        if (this.currentNote.title !== updatedCurrentNoteData.title ||
                            this.currentNote.visibility !== updatedCurrentNoteData.visibility ||
                            this.currentNote.public_editable !== updatedCurrentNoteData.public_editable) {
                            
                            console.log(`[NotesApp.checkForNotesListUpdates] Metadata for current note ID: ${this.currentNote.id} updated by poll. Updating header fields.`);
                            this.currentNote.title = updatedCurrentNoteData.title;
                            this.currentNote.visibility = updatedCurrentNoteData.visibility;
                            this.currentNote.public_editable = updatedCurrentNoteData.public_editable;
                            // Note: this.currentNote.content is not updated here to avoid overwriting local edits. Conflict resolver handles content.
                            this.noteLoadedAt = new Date(updatedCurrentNoteData.modified); // Update loadedAt for conflict resolution
                        
                            document.getElementById('noteTitle').value = this.currentNote.title;
                            document.getElementById('publicToggle').checked = this.currentNote.visibility === 'public';
                            document.getElementById('editableToggle').checked = this.currentNote.public_editable;
                            
                            const editableWrapper = document.getElementById('editableToggleWrapper');
                            editableWrapper.style.display = this.currentNote.visibility === 'public' ? 'flex' : 'none';
                            
                            // Potentially call updateUI if these changes affect editor read-only status (e.g. admin made it non-editable)
                            this.updateUI();
                        }
                    } else {
                        // Current note was deleted remotely
                        console.log(`[NotesApp.checkForNotesListUpdates] Current note ID: ${this.currentNote.id} no longer exists in fetched list. Clearing selection.`);
                        this.clearCurrentNoteInternals();
                        this.updateUI();
                    }
                }
            }
        } catch (error) {
            console.error('[NotesApp.checkForNotesListUpdates] Failed to check for notes list updates:', error);
        }
    }
    
    checkForNoteUpdates() {
        // console.log('[NotesApp.checkForNoteUpdates] Checking for current note updates.'); // Can be noisy
        this.conflictResolver.checkForNoteUpdates();
    }
    
    handleTyping() {
        if (!this.currentNote) return;
        
        this.ui.setTypingIndicator(this.currentNote.id, true);
        clearTimeout(this.typingTimer);
        this.typingTimer = setTimeout(() => {
            this.ui.setTypingIndicator(this.currentNote.id, false);
        }, 5000); // 5 seconds typing indicator
    }
    
    // Called by URLManager when navigating away or to a non-note URL
    clearCurrentNote() {
        console.log('[NotesApp.clearCurrentNote] Clearing current note selection (e.g. due to URL change).');
        this.clearCurrentNoteInternals();
        this.updateUI(); // updateUI should handle editor state when no note is selected
    }

    // Internal method to reset state related to current note
    clearCurrentNoteInternals() {
        if (this.currentNote) {
            this.ui.setTypingIndicator(this.currentNote.id, false);
        }
        clearTimeout(this.typingTimer);
        
        this.currentNote = null;
        this.noteLoadedAt = null;
        this.pollingManager.stopNotePolling(); // Stop polling for a specific note
        
        this.editorManager.setContent('');
        document.getElementById('noteTitle').value = '';
        document.getElementById('editorHeader').style.display = 'none';
        this.assetManager.renderAssets([]); // Clear assets bar

        const activeNoteListItem = document.querySelector('.notes-list li.active');
        if (activeNoteListItem) {
            activeNoteListItem.classList.remove('active');
        }
    }
}

export default NotesApp;
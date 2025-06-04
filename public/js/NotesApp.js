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
        
        window.noteManager = this.noteManager;
        
        this.init();
    }
    
    init() {
        const editorMount = document.getElementById('editor');
        console.log('[NotesApp] Initializing with editor mount point:', editorMount);
        
        this.editorManager.init(editorMount, {
            readOnly: !this.isAuthenticated
        });
        
        this.editorManager.onContentChange(() => {
            console.log('[NotesApp] Editor content changed');
            this.pollingManager.trackEdit();
            this.handleTyping();
            
            const content = this.editorManager.getContent();
            if (!this.currentNote && this.isAuthenticated && content.trim()) {
                console.log('[NotesApp] Creating new note from editor content');
                this.noteManager.createNote(content);
                return;
            }
            
            this.scheduleAutosave();
        });
        
        this.auth.checkAuthentication();
        this.noteManager.loadNotes();
        this.eventHandler.bindEvents();
        this.urlManager.checkUrlForNote();
        this.pollingManager.startNotesListPolling();
    }
    
    updateUI() {
        this.ui.updateAuthenticationUI();
        
        if (this.editorManager && this.editorManager.view) {
            let shouldBeReadOnly = true;
            
            if (this.isAuthenticated) {
                // Authenticated users can edit their own notes
                shouldBeReadOnly = false;
            } else if (this.currentNote && this.currentNote.visibility === 'public' && this.currentNote.public_editable === true) {
                // Non-authenticated users can edit public_editable notes
                shouldBeReadOnly = false;
            } else if (!this.currentNote) {
                // No note selected - read only for non-authenticated
                shouldBeReadOnly = !this.isAuthenticated;
            }
            
            console.log('[NotesApp] Updating editor read-only state:', {
                shouldBeReadOnly,
                isAuthenticated: this.isAuthenticated,
                currentNote: this.currentNote,
                noteVisibility: this.currentNote?.visibility,
                notePublicEditable: this.currentNote?.public_editable,
                notePublicEditableType: typeof this.currentNote?.public_editable,
                notePublicEditableValue: this.currentNote?.public_editable,
                conditionCheck: this.currentNote && this.currentNote.visibility === 'public' && this.currentNote.public_editable
            });
            this.editorManager.setReadOnly(shouldBeReadOnly);
        }
    }
    
    selectNote(note) {
        console.log('[NotesApp] selectNote called with:', {
            noteId: note.id,
            noteTitle: note.title,
            visibility: note.visibility,
            public_editable: note.public_editable,
            public_editable_type: typeof note.public_editable
        });
        
        if (this.currentNote) {
            this.ui.setTypingIndicator(this.currentNote.id, false);
            clearTimeout(this.typingTimer);
        }
        
        this.updateActiveNoteInList(note.id);
        
        this.currentNote = note;
        this.noteLoadedAt = new Date(note.modified);
        
        this.pollingManager.startNotePolling();
        
        this.editorManager.setContent(note.content);
        document.getElementById('noteTitle').value = note.title;
        document.getElementById('publicToggle').checked = note.visibility === 'public';
        document.getElementById('editableToggle').checked = note.public_editable;
        
        this.updateUI();
        
        const editableWrapper = document.getElementById('editableToggleWrapper');
        editableWrapper.style.display = note.visibility === 'public' ? 'flex' : 'none';
        
        this.updateUI();
        
        // Set current note for asset manager and render assets
        this.assetManager.setCurrentNote(note.id);
        this.assetManager.renderAssets(note.assets || []);
    }
    
    updateActiveNoteInList(newNoteId) {
        document.querySelectorAll('.notes-list li').forEach(li => {
            li.classList.remove('active', 'typing');
        });
        
        const newActiveNote = document.querySelector(`[data-note-id="${newNoteId}"]`);
        if (newActiveNote) {
            newActiveNote.classList.add('active');
        }
    }
    
    scheduleAutosave() {
        if (!this.currentNote) return;
        
        clearTimeout(this.autosaveTimer);
        this.autosaveTimer = setTimeout(() => {
            this.saveCurrentNote();
        }, 1000);
    }
    
    handleVisibilityChange() {
        if (!this.currentNote || !this.isAuthenticated) return;
        
        const isPublic = document.getElementById('publicToggle').checked;
        const editableWrapper = document.getElementById('editableToggleWrapper');
        editableWrapper.style.display = isPublic ? 'flex' : 'none';
        
        if (!isPublic) {
            document.getElementById('editableToggle').checked = false;
        }
        
        this.saveCurrentNote();
    }
    
    async saveCurrentNote() {
        if (!this.currentNote) return;
        
        if (await this.conflictResolver.checkForConflicts()) {
            return;
        }
        
        const noteData = {
            content: this.editorManager.getContent()
        };
        
        if (this.isAuthenticated) {
            noteData.title = document.getElementById('noteTitle').value;
            noteData.visibility = document.getElementById('publicToggle').checked ? 'public' : 'private';
            noteData.public_editable = document.getElementById('editableToggle').checked;
        }
        
        await this.noteManager.saveNote(noteData);
    }
    
    copyDirectLink() {
        if (!this.currentNote) return;
        this.clipboardManager.copyDirectLink(this.currentNote.id);
    }
    
    async deleteCurrentNote() {
        if (!this.currentNote || !this.isAuthenticated) return;
        
        if (!confirm('Delete this note?')) return;
        
        const success = await this.noteManager.deleteNote(this.currentNote.id);
        if (success) {
            this.currentNote = null;
            this.editorManager.setContent('');
            document.getElementById('noteTitle').value = '';
            document.getElementById('editorHeader').style.display = 'none';
            this.assetManager.renderAssets([]);
        }
    }
    
    async checkForNotesListUpdates() {
        try {
            const response = await fetch('/api/notes');
            const latestNotes = await response.json();
            
            if (this.pollingManager.hasNotesListChanged(latestNotes)) {
                this.notes = latestNotes;
                this.noteManager.renderNotesList();
                
                if (this.currentNote) {
                    const updatedCurrentNote = latestNotes.find(n => n.id === this.currentNote.id);
                    if (updatedCurrentNote && new Date(updatedCurrentNote.modified) > this.noteLoadedAt) {
                        this.currentNote.title = updatedCurrentNote.title;
                        this.currentNote.visibility = updatedCurrentNote.visibility;
                        this.currentNote.public_editable = updatedCurrentNote.public_editable;
                        this.noteLoadedAt = new Date(updatedCurrentNote.modified);
                        
                        document.getElementById('noteTitle').value = updatedCurrentNote.title;
                        document.getElementById('publicToggle').checked = updatedCurrentNote.visibility === 'public';
                        document.getElementById('editableToggle').checked = updatedCurrentNote.public_editable;
                        
                        const editableWrapper = document.getElementById('editableToggleWrapper');
                        editableWrapper.style.display = updatedCurrentNote.visibility === 'public' ? 'flex' : 'none';
                    }
                }
            }
        } catch (error) {
            console.error('Failed to check for notes list updates:', error);
        }
    }
    
    checkForNoteUpdates() {
        this.conflictResolver.checkForNoteUpdates();
    }
    
    handleTyping() {
        if (!this.currentNote) return;
        
        this.ui.setTypingIndicator(this.currentNote.id, true);
        
        clearTimeout(this.typingTimer);
        
        this.typingTimer = setTimeout(() => {
            this.ui.setTypingIndicator(this.currentNote.id, false);
        }, 5000);
    }
    
    clearCurrentNote() {
        if (this.currentNote) {
            this.ui.setTypingIndicator(this.currentNote.id, false);
            clearTimeout(this.typingTimer);
        }
        
        this.currentNote = null;
        this.pollingManager.stopAllPolling();
        
        document.getElementById('editor').value = '';
        document.getElementById('noteTitle').value = '';
        document.getElementById('editorHeader').style.display = 'none';
        
        this.updateUI();
        
        const activeNote = document.querySelector('.notes-list li.active');
        if (activeNote) {
            activeNote.classList.remove('active');
        }
    }
}

export default NotesApp;
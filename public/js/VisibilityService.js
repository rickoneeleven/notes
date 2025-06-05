class VisibilityService {
    constructor(authManager, noteStateService) {
        this.authManager = authManager;
        this.noteStateService = noteStateService;
    }

    handleVisibilityChange() {
        const currentNote = this.noteStateService.getCurrentNote();
        if (!currentNote || !this.authManager.isAuthenticated) {
            console.log('[VisibilityService.handleVisibilityChange] Conditions not met for visibility change (no current note or not authenticated).');
            return;
        }
        
        console.log('[VisibilityService.handleVisibilityChange] Visibility toggle changed.');
        
        const isPublic = document.getElementById('publicToggle').checked;
        const editableWrapper = document.getElementById('editableToggleWrapper');
        editableWrapper.style.display = isPublic ? 'flex' : 'none';
        
        if (!isPublic) {
            document.getElementById('editableToggle').checked = false;
        }
    }

    canEditNote(note, isAuthenticated) {
        if (!note) {
            return isAuthenticated;
        }
        
        if (isAuthenticated) {
            return true;
        }
        
        return note.visibility === 'public' && note.public_editable;
    }

    isNoteEditable(note, isAuthenticated) {
        return this.canEditNote(note, isAuthenticated);
    }

    shouldEditorBeReadOnly(currentNote, isAuthenticated) {
        let shouldBeReadOnly = true;
        
        if (isAuthenticated) {
            shouldBeReadOnly = false;
            console.log('[VisibilityService.shouldEditorBeReadOnly] User is authenticated. Editor NOT read-only.');
        } else if (currentNote && currentNote.visibility === 'public' && currentNote.public_editable) {
            shouldBeReadOnly = false;
            console.log('[VisibilityService.shouldEditorBeReadOnly] Guest on public, editable note. Editor NOT read-only.');
        } else if (!currentNote) {
            shouldBeReadOnly = !isAuthenticated;
            console.log(`[VisibilityService.shouldEditorBeReadOnly] No current note. Authenticated: ${isAuthenticated}. Read-only: ${shouldBeReadOnly}.`);
        } else {
            console.log('[VisibilityService.shouldEditorBeReadOnly] Guest on non-editable note. Editor read-only.');
        }
        
        return shouldBeReadOnly;
    }
}

export default VisibilityService;
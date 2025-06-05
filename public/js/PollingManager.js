class PollingManager {
    constructor(app) {
        this.app = app;
        this.pollTimer = null;
        this.notesListPollTimer = null;
        this.isIdle = false;
        this.lastActivity = Date.now();
        this.lastEditTime = 0;
    }

    setApp(app) {
        this.app = app;
    }

    trackActivity() {
        this.lastActivity = Date.now();
        if (this.isIdle) {
            this.setIdleState(false);
        }
    }

    trackEdit() {
        this.lastEditTime = Date.now();
        this.trackActivity();
    }

    hasRecentEdits(thresholdMs = 10000) {
        return Date.now() - this.lastEditTime < thresholdMs;
    }

    setIdleState(idle) {
        this.isIdle = idle;
        this.app.ui.setIdleState(idle);
    }

    startNotePolling() {
        this.stopNotePolling();
        
        if (!this.app.currentNote) return;
        
        this.pollTimer = setInterval(() => {
            this.trackActivity();
            
            if (Date.now() - this.lastActivity > 3600000) {
                if (!this.isIdle) {
                    this.setIdleState(true);
                }
                return;
            }
            
            this.app.checkForNoteUpdates();
        }, 5000);
    }

    stopNotePolling() {
        if (this.pollTimer) {
            clearInterval(this.pollTimer);
            this.pollTimer = null;
        }
    }

    startNotesListPolling() {
        this.stopNotesListPolling();
        
        this.notesListPollTimer = setInterval(() => {
            this.trackActivity();
            
            if (Date.now() - this.lastActivity > 3600000) {
                if (!this.isIdle) {
                    this.setIdleState(true);
                }
                return;
            }
            
            this.app.checkForNotesListUpdates();
        }, 10000);
    }

    stopNotesListPolling() {
        if (this.notesListPollTimer) {
            clearInterval(this.notesListPollTimer);
            this.notesListPollTimer = null;
        }
    }

    stopAllPolling() {
        this.stopNotePolling();
        this.stopNotesListPolling();
    }

    hasNotesListChanged(latestNotes) {
        if (latestNotes.length !== this.app.notes.length) {
            return true;
        }
        
        for (let i = 0; i < latestNotes.length; i++) {
            const latest = latestNotes[i];
            const current = this.app.notes[i];
            
            if (!current || 
                latest.id !== current.id || 
                latest.title !== current.title ||
                latest.modified !== current.modified) {
                return true;
            }
        }
        
        return false;
    }
}

export default PollingManager;
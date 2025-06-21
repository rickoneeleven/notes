class PollingManager {
    constructor(app) {
        this.app = app;
        this.pollTimer = null;
        this.notesListPollTimer = null;
        this.isIdle = false;
        this.lastActivity = Date.now();
        this.lastEditTime = 0;
        this.idleTimeout = 300000; // Default 5 minutes
    }

    setApp(app) {
        this.app = app;
    }

    trackActivity() {
        this.lastActivity = Date.now();
        if (this.isIdle) {
            this.wakeUp();
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
    
    setIdleTimeout(timeout) {
        this.idleTimeout = timeout;
    }
    
    async goToSleep() {
        console.log('[PollingManager.goToSleep] Entering idle state');
        await this.app.editorStateService.flushPendingAutosave();
        this.setIdleState(true);
    }
    
    async wakeUp() {
        console.log('[PollingManager.wakeUp] Waking up from idle state');
        this.setIdleState(false);
        await this.app.forceSyncCurrentNote();
    }

    startNotePolling() {
        this.stopNotePolling();
        
        if (!this.app.currentNote) return;
        
        this.pollTimer = setInterval(() => {
            if (Date.now() - this.lastActivity > this.idleTimeout) {
                if (!this.isIdle) {
                    this.goToSleep();
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
            if (Date.now() - this.lastActivity > this.idleTimeout) {
                if (!this.isIdle) {
                    this.goToSleep();
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
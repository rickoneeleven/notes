class DeletedNotesManager {
    constructor(app) {
        this.app = app;
    }

    async showDeletedNotes() {
        try {
            const response = await fetch('/api/deleted-notes');
            const deletedNotes = await response.json();
            this.renderDeletedNotes(deletedNotes);
            this.app.ui.showDeletedNotesModal();
        } catch (error) {
            console.error('Failed to load deleted notes:', error);
        }
    }

    renderDeletedNotes(deletedNotes) {
        const list = document.getElementById('deletedNotesList');
        list.innerHTML = '';
        
        if (deletedNotes.length === 0) {
            list.innerHTML = '<div class="no-deleted-notes">No deleted notes</div>';
            return;
        }
        
        deletedNotes.forEach(note => {
            const item = document.createElement('div');
            item.className = 'deleted-note-item';
            
            const daysText = note.days_deleted === 0 ? 'Today' : 
                            note.days_deleted === 1 ? '1 day ago' : 
                            `${note.days_deleted} days ago`;
            
            item.innerHTML = `
                <div class="deleted-note-content">
                    <div class="deleted-note-title">${note.title || 'Untitled'}</div>
                    <div class="deleted-note-meta">${daysText}</div>
                    <div class="deleted-note-preview">${(note.content || '').substring(0, 100)}${note.content && note.content.length > 100 ? '...' : ''}</div>
                </div>
                <button class="restore-btn" data-note-id="${note.id}" title="Restore note">↶</button>
            `;
            
            const restoreBtn = item.querySelector('.restore-btn');
            restoreBtn.addEventListener('click', () => {
                this.restoreNote(note.id);
            });
            
            list.appendChild(item);
        });
    }

    async restoreNote(noteId) {
        try {
            const response = await fetch(`/api/deleted-notes/${noteId}/restore`, {
                method: 'POST'
            });
            
            if (response.ok) {
                this.app.noteManager.loadNotes();
                this.showDeletedNotes();
            } else {
                console.error('Failed to restore note');
            }
        } catch (error) {
            console.error('Failed to restore note:', error);
        }
    }
}

export default DeletedNotesManager;
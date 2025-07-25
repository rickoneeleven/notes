class DeletedNotesManager {
    constructor(app) {
        this.app = app;
    }

    setApp(app) {
        this.app = app;
    }

    async showDeletedNotes() {
        try {
            const response = await fetch('/api/deleted-notes');
            const deletedItems = await response.json(); 
            this.renderDeletedNotes(deletedItems);
            this.app.ui.showDeletedNotesModal();

            // Add event listener after rendering
            const list = document.getElementById('deletedNotesList');
            list.onclick = (event) => {
                const target = event.target;
                if (target.classList.contains('restore-btn')) {
                    const noteId = target.dataset.noteId;
                    const folderName = target.dataset.folderName;

                    if (noteId) {
                        this.restoreNote(noteId);
                    } else if (folderName) {
                        this.restoreFolder(folderName);
                    }
                }
            };

        } catch (error) {
            console.error('Failed to load deleted notes:', error);
        }
    }

    renderDeletedNotes(deletedItems) {
        const list = document.getElementById('deletedNotesList');
        list.innerHTML = '';
        
        const { items } = deletedItems;

        if (!items || items.length === 0) {
            list.innerHTML = '<div class="no-deleted-notes">No deleted items</div>';
            return;
        }

        // Helper function to create a note item element
        const createNoteElement = (note) => {
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
                <button class="restore-btn" data-note-id="${note.id}" title="Restore note">↰</button>
            `;
            return item;
        };

        // Render all items in chronological order
        items.forEach(item => {
            if (item.type === 'folder') {
                // Render folder
                const folderItem = document.createElement('div');
                folderItem.className = 'deleted-folder-item';

                const daysText = item.days_deleted === 0 ? 'Today' :
                                 item.days_deleted === 1 ? '1 day ago' :
                                 `${item.days_deleted} days ago`;

                folderItem.innerHTML = `
                    <div class="deleted-folder-header">
                        <div class="deleted-folder-content">
                            <div class="deleted-folder-name">${item.name}</div>
                            <div class="deleted-folder-meta">Deleted ${daysText}</div>
                        </div>
                        <button class="restore-btn" data-folder-name="${item.name}" title="Restore folder">↰</button>
                    </div>
                    <div class="deleted-notes-in-folder"></div>
                `;
                
                const nestedList = folderItem.querySelector('.deleted-notes-in-folder');
                item.notes.forEach(note => {
                    const noteElement = createNoteElement(note);
                    nestedList.appendChild(noteElement);
                });
                
                list.appendChild(folderItem);
            } else if (item.type === 'note') {
                // Render standalone note
                const noteElement = createNoteElement(item);
                list.appendChild(noteElement);
            }
        });
    }

    async restoreNote(noteId) {
        try {
            const response = await fetch(`/api/deleted-notes/${noteId}/restore`, {
                method: 'POST'
            });
            
            if (response.ok) {
                await this.showDeletedNotes(); // Refresh the view on success
            } else {
                console.error('Failed to restore note');
                alert('Failed to restore note.');
            }
        } catch (error) {
            console.error('Error restoring note:', error);
        }
    }

    async restoreFolder(folderName) {
        try {
            // Encode the folder name to handle spaces and special characters in the URL
            const response = await fetch(`/api/deleted-folders/${encodeURIComponent(folderName)}/restore`, {
                method: 'POST'
            });

            if (response.ok) {
                await this.showDeletedNotes(); // Refresh the view on success
            } else {
                console.error('Failed to restore folder');
                alert('Failed to restore folder.');
            }
        } catch (error) {
            console.error('Error restoring folder:', error);
        }
    }
}

export default DeletedNotesManager;
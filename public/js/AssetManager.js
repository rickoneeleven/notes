export class AssetManager {
    constructor(authManager, uiManager) {
        this.authManager = authManager;
        this.uiManager = uiManager;
        this.app = null;
        this.currentNoteId = null;
        this.assetsList = document.getElementById('assetsList');
        this.assetsBar = document.getElementById('assetsBar');
        this.fileInput = document.getElementById('assetFileInput');
        this.renameModal = document.getElementById('renameAssetModal');
        this.renameInput = document.getElementById('renameAssetInput');
        this.renameConfirm = document.getElementById('renameAssetConfirm');
        this.renameCancel = document.getElementById('renameAssetCancel');
        this.currentAssetToRename = null;
    }

    setApp(app) {
        this.app = app;
    }

    setCurrentNote(noteId) {
        this.currentNoteId = noteId;
    }

    async uploadAsset(file) {
        console.log('uploadAsset called with file:', file);
        console.log('Current note ID:', this.currentNoteId);
        console.log('Is authenticated:', this.authManager.isAuthenticated());
        
        if (!this.currentNoteId || !this.authManager.isAuthenticated()) {
            alert('Must be logged in to add assets');
            return;
        }

        const formData = new FormData();
        formData.append('asset', file);

        try {
            const url = `/api/notes/${this.currentNoteId}/assets`;
            console.log('Uploading to URL:', url);
            
            const response = await fetch(url, {
                method: 'POST',
                body: formData
            });

            console.log('Upload response status:', response.status);
            
            if (!response.ok) {
                const errorText = await response.text();
                console.error('Upload error response:', errorText);
                throw new Error('Upload failed');
            }

            const result = await response.json();
            console.log('Upload result:', result);
            console.log('Asset uploaded successfully');
            return result.assets;
        } catch (error) {
            console.error('Asset upload error:', error);
            console.error('Failed to upload asset');
            return null;
        }
    }

    async deleteAsset(assetName) {
        if (!this.currentNoteId || !this.authManager.isAuthenticated()) {
            return;
        }

        try {
            const response = await fetch(`/api/notes/${this.currentNoteId}/assets/${encodeURIComponent(assetName)}`, {
                method: 'DELETE'
            });

            if (!response.ok) {
                throw new Error('Delete failed');
            }

            const result = await response.json();
            console.log('Asset deleted');
            return result.assets;
        } catch (error) {
            console.error('Asset delete error:', error);
            console.error('Failed to delete asset');
            return null;
        }
    }

    async renameAsset(oldName, newName) {
        if (!this.currentNoteId || !this.authManager.isAuthenticated()) {
            return;
        }

        try {
            const response = await fetch(`/api/notes/${this.currentNoteId}/assets/${encodeURIComponent(oldName)}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ name: newName })
            });

            if (!response.ok) {
                throw new Error('Rename failed');
            }

            const result = await response.json();
            console.log('Asset renamed');
            return result.assets;
        } catch (error) {
            console.error('Asset rename error:', error);
            console.error('Failed to rename asset');
            return null;
        }
    }

    renderAssets(assets) {
        if (!assets || assets.length === 0) {
            this.assetsBar.style.display = 'none';
            return;
        }

        this.assetsBar.style.display = 'block';
        this.assetsList.innerHTML = '';

        assets.forEach(assetName => {
            const assetItem = document.createElement('div');
            assetItem.className = 'asset-item';

            const link = document.createElement('a');
            link.href = `/assets/${this.currentNoteId}/${encodeURIComponent(assetName)}`;
            link.target = '_blank';
            link.className = 'asset-link';
            link.textContent = assetName;

            const renameBtn = document.createElement('button');
            renameBtn.className = 'asset-rename';
            renameBtn.innerHTML = '✏️';
            renameBtn.title = 'Rename';
            renameBtn.onclick = () => this.showRenameModal(assetName);

            const deleteBtn = document.createElement('button');
            deleteBtn.className = 'asset-delete';
            deleteBtn.innerHTML = '×';
            deleteBtn.title = 'Delete';
            deleteBtn.onclick = async () => {
                if (confirm(`Delete asset "${assetName}"?`)) {
                    const updatedAssets = await this.deleteAsset(assetName);
                    if (updatedAssets !== null) {
                        this.renderAssets(updatedAssets);
                        if (this.app && this.app.noteManager) {
                            this.app.noteManager.updateCurrentNoteAssets(updatedAssets);
                        }
                    }
                }
            };

            assetItem.appendChild(link);
            if (this.authManager.isAuthenticated()) {
                assetItem.appendChild(renameBtn);
                assetItem.appendChild(deleteBtn);
            }

            this.assetsList.appendChild(assetItem);
        });
    }

    showRenameModal(assetName) {
        this.currentAssetToRename = assetName;
        this.renameInput.value = assetName;
        this.renameModal.style.display = 'flex';
        this.renameInput.focus();
        this.renameInput.select();
    }

    hideRenameModal() {
        this.renameModal.style.display = 'none';
        this.currentAssetToRename = null;
        this.renameInput.value = '';
    }

    async handleRename() {
        const newName = this.renameInput.value.trim();
        if (!newName || newName === this.currentAssetToRename) {
            this.hideRenameModal();
            return;
        }

        const updatedAssets = await this.renameAsset(this.currentAssetToRename, newName);
        if (updatedAssets !== null) {
            this.renderAssets(updatedAssets);
            if (this.app && this.app.noteManager) {
                this.app.noteManager.updateCurrentNoteAssets(updatedAssets);
            }
        }
        this.hideRenameModal();
    }

    handleFileSelect() {
        console.log('handleFileSelect called');
        console.log('File input element:', this.fileInput);
        this.fileInput.click();
    }

    async handleFileChange(event) {
        console.log('handleFileChange called');
        const file = event.target.files[0];
        console.log('Selected file:', file);
        if (!file) return;

        const updatedAssets = await this.uploadAsset(file);
        if (updatedAssets !== null) {
            this.renderAssets(updatedAssets);
            if (this.app && this.app.noteManager) {
                this.app.noteManager.updateCurrentNoteAssets(updatedAssets);
            }
        }

        this.fileInput.value = '';
    }
}
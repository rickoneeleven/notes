export class AssetManager {
    constructor(authManager, uiManager) {
        this.authManager = authManager;
        this.uiManager = uiManager;
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

    setCurrentNote(noteId) {
        this.currentNoteId = noteId;
    }

    async uploadAsset(file) {
        if (!this.currentNoteId || !this.authManager.isAuthenticated()) {
            this.uiManager.showStatus('Must be logged in to add assets');
            return;
        }

        const formData = new FormData();
        formData.append('asset', file);

        try {
            const response = await fetch(`/api/notes/${this.currentNoteId}/assets`, {
                method: 'POST',
                body: formData
            });

            if (!response.ok) {
                throw new Error('Upload failed');
            }

            const result = await response.json();
            this.uiManager.showStatus('Asset uploaded successfully');
            return result.assets;
        } catch (error) {
            console.error('Asset upload error:', error);
            this.uiManager.showStatus('Failed to upload asset');
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
            this.uiManager.showStatus('Asset deleted');
            return result.assets;
        } catch (error) {
            console.error('Asset delete error:', error);
            this.uiManager.showStatus('Failed to delete asset');
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
            this.uiManager.showStatus('Asset renamed');
            return result.assets;
        } catch (error) {
            console.error('Asset rename error:', error);
            this.uiManager.showStatus('Failed to rename asset');
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
                        if (window.noteManager) {
                            window.noteManager.updateCurrentNoteAssets(updatedAssets);
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
            if (window.noteManager) {
                window.noteManager.updateCurrentNoteAssets(updatedAssets);
            }
        }
        this.hideRenameModal();
    }

    handleFileSelect() {
        this.fileInput.click();
    }

    async handleFileChange(event) {
        const file = event.target.files[0];
        if (!file) return;

        const updatedAssets = await this.uploadAsset(file);
        if (updatedAssets !== null) {
            this.renderAssets(updatedAssets);
            if (window.noteManager) {
                window.noteManager.updateCurrentNoteAssets(updatedAssets);
            }
        }

        this.fileInput.value = '';
    }
}
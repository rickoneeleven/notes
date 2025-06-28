class VersionManager {
    constructor(authManager, noteStateService) {
        this.authManager = authManager;
        this.noteStateService = noteStateService;
    }

    async fetchVersions(noteId) {
        if (!this.authManager.isAuthenticated) {
            console.warn('[VersionManager.fetchVersions] User not authenticated');
            throw new Error('Authentication required to fetch versions');
        }

        if (!noteId) {
            console.warn('[VersionManager.fetchVersions] No note ID provided');
            throw new Error('Note ID is required');
        }

        console.log(`[VersionManager.fetchVersions] Fetching versions for note ID: ${noteId}`);

        try {
            const response = await fetch(`/api/notes/${encodeURIComponent(noteId)}/versions`, {
                method: 'GET',
                credentials: 'include',
                headers: {
                    'Accept': 'application/json'
                }
            });

            if (!response.ok) {
                console.error(`[VersionManager.fetchVersions] HTTP ${response.status}: ${response.statusText}`);
                
                if (response.status === 401) {
                    throw new Error('Authentication expired. Please login again.');
                } else if (response.status === 404) {
                    throw new Error('Note not found or no versions available');
                } else if (response.status >= 500) {
                    throw new Error('Server error occurred while fetching versions');
                } else {
                    throw new Error(`Failed to fetch versions: ${response.status}`);
                }
            }

            const versionsResponse = await response.json();
            console.log(`[VersionManager.fetchVersions] Successfully fetched ${versionsResponse.totalVersions || 0} versions for note ID: ${noteId}`);
            
            return this.processVersionsList(versionsResponse.versions || []);
        } catch (error) {
            if (error instanceof TypeError && error.message.includes('fetch')) {
                console.error('[VersionManager.fetchVersions] Network error:', error);
                throw new Error('Network error: Please check your connection');
            }
            
            console.error('[VersionManager.fetchVersions] Error:', error);
            throw error;
        }
    }

    async fetchVersion(noteId, timestamp) {
        if (!this.authManager.isAuthenticated) {
            console.warn('[VersionManager.fetchVersion] User not authenticated');
            throw new Error('Authentication required to fetch version');
        }

        if (!noteId || !timestamp) {
            console.warn('[VersionManager.fetchVersion] Missing required parameters');
            throw new Error('Note ID and timestamp are required');
        }

        console.log(`[VersionManager.fetchVersion] Fetching version ${timestamp} for note ID: ${noteId}`);

        try {
            const response = await fetch(`/api/notes/${encodeURIComponent(noteId)}/versions/${encodeURIComponent(timestamp)}`, {
                method: 'GET',
                credentials: 'include',
                headers: {
                    'Accept': 'application/json'
                }
            });

            if (!response.ok) {
                console.error(`[VersionManager.fetchVersion] HTTP ${response.status}: ${response.statusText}`);
                
                if (response.status === 401) {
                    throw new Error('Authentication expired. Please login again.');
                } else if (response.status === 404) {
                    throw new Error('Version not found');
                } else if (response.status >= 500) {
                    throw new Error('Server error occurred while fetching version');
                } else {
                    throw new Error(`Failed to fetch version: ${response.status}`);
                }
            }

            const version = await response.json();
            console.log(`[VersionManager.fetchVersion] Successfully fetched version ${timestamp} for note ID: ${noteId}`);
            
            return this.processVersionContent(version, timestamp);
        } catch (error) {
            if (error instanceof TypeError && error.message.includes('fetch')) {
                console.error('[VersionManager.fetchVersion] Network error:', error);
                throw new Error('Network error: Please check your connection');
            }
            
            console.error('[VersionManager.fetchVersion] Error:', error);
            throw error;
        }
    }

    async fetchVersionsForCurrentNote() {
        const currentNote = this.noteStateService.getCurrentNote();
        if (!currentNote) {
            throw new Error('No note is currently selected');
        }
        
        return await this.fetchVersions(currentNote.id);
    }

    async fetchVersionForCurrentNote(timestamp) {
        const currentNote = this.noteStateService.getCurrentNote();
        if (!currentNote) {
            throw new Error('No note is currently selected');
        }
        
        return await this.fetchVersion(currentNote.id, timestamp);
    }

    processVersionsList(versions) {
        if (!Array.isArray(versions)) {
            console.warn('[VersionManager.processVersionsList] Invalid versions data format');
            return [];
        }

        return versions.map(version => ({
            timestamp: version.timestamp || version,
            filename: version.filename || `${version.timestamp || version}.json`,
            created: version.created || version.timestamp,
            displayDate: this.formatVersionDate(version.timestamp || version)
        })).sort((a, b) => {
            // Sort by timestamp string (YYYY-MM-DD-HH-MM-SS format)
            return (b.timestamp || '').localeCompare(a.timestamp || '');
        });
    }

    processVersionContent(version, timestamp) {
        if (!version || typeof version !== 'object') {
            throw new Error('Invalid version content received');
        }

        return {
            ...version,
            version_timestamp: timestamp,
            version_display_date: this.formatVersionDate(timestamp),
            isVersion: true
        };
    }

    formatVersionDate(timestamp) {
        try {
            if (timestamp === null || timestamp === undefined) {
                return 'Unknown Date';
            }
            
            // Parse timestamp format "2025-06-28-10-12-01" to Date
            let date;
            if (typeof timestamp === 'string' && timestamp.match(/^\d{4}-\d{2}-\d{2}-\d{2}-\d{2}-\d{2}$/)) {
                // Format: YYYY-MM-DD-HH-MM-SS
                const parts = timestamp.split('-');
                date = new Date(
                    parseInt(parts[0]), // year
                    parseInt(parts[1]) - 1, // month (0-based)
                    parseInt(parts[2]), // day
                    parseInt(parts[3]), // hour
                    parseInt(parts[4]), // minute
                    parseInt(parts[5])  // second
                );
            } else {
                // Fallback: try parsing as Unix timestamp
                date = new Date(parseInt(timestamp) * 1000);
            }
            
            if (isNaN(date.getTime())) {
                return 'Invalid Date';
            }
            
            // Always show full datetime stamp
            return date.toLocaleDateString('en-US', {
                year: 'numeric',
                month: 'short',
                day: 'numeric',
                hour: '2-digit',
                minute: '2-digit',
                second: '2-digit',
                hour12: true
            });
        } catch (error) {
            console.error('[VersionManager.formatVersionDate] Error formatting date:', error);
            return 'Unknown Date';
        }
    }

    isVersionsAvailable() {
        return this.authManager.isAuthenticated && !!this.noteStateService.getCurrentNote();
    }
}

export default VersionManager;
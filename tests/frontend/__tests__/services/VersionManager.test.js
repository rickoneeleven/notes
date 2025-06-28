import { setupMockFetch, mockApiResponse, mockApiError, createMockVersion, createMockVersionsList } from '../../mocks/api-utils.js';
import { createMockDependencies } from '../../mocks/dependency-utils.js';

const mockModule = () => {
  return class VersionManager {
    constructor(authManager, noteStateService) {
      this.authManager = authManager;
      this.noteStateService = noteStateService;
    }

    async fetchVersions(noteId) {
      if (!this.authManager.isAuthenticated) {
        throw new Error('Authentication required to fetch versions');
      }

      if (!noteId) {
        throw new Error('Note ID is required');
      }

      try {
        const response = await fetch(`/api/notes/${encodeURIComponent(noteId)}/versions`, {
          method: 'GET',
          credentials: 'include',
          headers: {
            'Accept': 'application/json'
          }
        });

        if (!response.ok) {
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

        const versions = await response.json();
        return this.processVersionsList(versions);
      } catch (error) {
        if (error instanceof TypeError && error.message.includes('fetch')) {
          throw new Error('Network error: Please check your connection');
        }
        throw error;
      }
    }

    async fetchVersion(noteId, timestamp) {
      if (!this.authManager.isAuthenticated) {
        throw new Error('Authentication required to fetch version');
      }

      if (!noteId || !timestamp) {
        throw new Error('Note ID and timestamp are required');
      }

      try {
        const response = await fetch(`/api/notes/${encodeURIComponent(noteId)}/versions/${encodeURIComponent(timestamp)}`, {
          method: 'GET',
          credentials: 'include',
          headers: {
            'Accept': 'application/json'
          }
        });

        if (!response.ok) {
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
        return this.processVersionContent(version, timestamp);
      } catch (error) {
        if (error instanceof TypeError && error.message.includes('fetch')) {
          throw new Error('Network error: Please check your connection');
        }
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
        return [];
      }

      return versions.map(version => ({
        timestamp: version.timestamp || version,
        filename: version.filename || `${version.timestamp || version}.json`,
        created: version.created || new Date(parseInt(version.timestamp || version) * 1000).toISOString(),
        displayDate: this.formatVersionDate(version.timestamp || version)
      })).sort((a, b) => parseInt(b.timestamp) - parseInt(a.timestamp));
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
        
        const date = new Date(parseInt(timestamp) * 1000);
        if (isNaN(date.getTime())) {
          return 'Invalid Date';
        }
        
        const now = new Date();
        const diffHours = Math.floor((now - date) / (1000 * 60 * 60));
        
        if (diffHours < 1) {
          return 'Less than 1 hour ago';
        } else if (diffHours < 24) {
          return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;
        } else {
          const diffDays = Math.floor(diffHours / 24);
          if (diffDays < 7) {
            return `${diffDays} day${diffDays > 1 ? 's' : ''} ago`;
          } else {
            return date.toLocaleDateString('en-US', {
              year: 'numeric',
              month: 'short',
              day: 'numeric',
              hour: '2-digit',
              minute: '2-digit'
            });
          }
        }
      } catch (error) {
        return 'Unknown Date';
      }
    }

    isVersionsAvailable() {
      return this.authManager.isAuthenticated && !!this.noteStateService.getCurrentNote();
    }
  };
};

describe('VersionManager', () => {
  let versionManager;
  let mockDeps;
  let mockFetch;

  beforeEach(() => {
    mockFetch = setupMockFetch();
    mockDeps = createMockDependencies();
    mockDeps.authManager.isAuthenticated = true;
    mockDeps.noteStateService.getCurrentNote.mockReturnValue({ id: 'test_note_123' });
    
    const VersionManager = mockModule();
    versionManager = new VersionManager(mockDeps.authManager, mockDeps.noteStateService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('fetchVersions', () => {
    it('should fetch versions successfully for authenticated user', async () => {
      const mockVersions = createMockVersionsList('test_note_123', 3);
      mockFetch.mockResolvedValueOnce(mockApiResponse(mockVersions));

      const result = await versionManager.fetchVersions('test_note_123');

      expect(mockFetch).toHaveBeenCalledWith('/api/notes/test_note_123/versions', {
        method: 'GET',
        credentials: 'include',
        headers: {
          'Accept': 'application/json'
        }
      });

      expect(result).toHaveLength(3);
      expect(result[0]).toHaveProperty('timestamp');
      expect(result[0]).toHaveProperty('displayDate');
      expect(result[0]).toHaveProperty('filename');
    });

    it('should throw error for unauthenticated user', async () => {
      mockDeps.authManager.isAuthenticated = false;

      await expect(versionManager.fetchVersions('test_note_123'))
        .rejects.toThrow('Authentication required to fetch versions');

      expect(mockFetch).not.toHaveBeenCalled();
    });

    it('should throw error when note ID is missing', async () => {
      await expect(versionManager.fetchVersions())
        .rejects.toThrow('Note ID is required');

      expect(mockFetch).not.toHaveBeenCalled();
    });

    it('should handle 401 authentication error', async () => {
      mockFetch.mockResolvedValueOnce(mockApiError(401, 'Unauthorized'));

      await expect(versionManager.fetchVersions('test_note_123'))
        .rejects.toThrow('Authentication expired. Please login again.');
    });

    it('should handle 404 not found error', async () => {
      mockFetch.mockResolvedValueOnce(mockApiError(404, 'Not Found'));

      await expect(versionManager.fetchVersions('test_note_123'))
        .rejects.toThrow('Note not found or no versions available');
    });

    it('should handle 500 server error', async () => {
      mockFetch.mockResolvedValueOnce(mockApiError(500, 'Server Error'));

      await expect(versionManager.fetchVersions('test_note_123'))
        .rejects.toThrow('Server error occurred while fetching versions');
    });

    it('should handle network errors', async () => {
      mockFetch.mockRejectedValueOnce(new TypeError('Failed to fetch'));

      await expect(versionManager.fetchVersions('test_note_123'))
        .rejects.toThrow('Network error: Please check your connection');
    });

    it('should URL encode note IDs with special characters', async () => {
      const noteIdWithSpecialChars = 'test note/with spaces&chars';
      mockFetch.mockResolvedValueOnce(mockApiResponse([]));

      await versionManager.fetchVersions(noteIdWithSpecialChars);

      expect(mockFetch).toHaveBeenCalledWith(
        '/api/notes/test%20note%2Fwith%20spaces%26chars/versions',
        expect.any(Object)
      );
    });
  });

  describe('fetchVersion', () => {
    it('should fetch specific version successfully', async () => {
      const mockVersion = createMockVersion('test_note_123', '1704124800');
      mockFetch.mockResolvedValueOnce(mockApiResponse(mockVersion));

      const result = await versionManager.fetchVersion('test_note_123', '1704124800');

      expect(mockFetch).toHaveBeenCalledWith('/api/notes/test_note_123/versions/1704124800', {
        method: 'GET',
        credentials: 'include',
        headers: {
          'Accept': 'application/json'
        }
      });

      expect(result).toHaveProperty('version_timestamp', '1704124800');
      expect(result).toHaveProperty('version_display_date');
      expect(result).toHaveProperty('isVersion', true);
    });

    it('should throw error for unauthenticated user', async () => {
      mockDeps.authManager.isAuthenticated = false;

      await expect(versionManager.fetchVersion('test_note_123', '1704124800'))
        .rejects.toThrow('Authentication required to fetch version');

      expect(mockFetch).not.toHaveBeenCalled();
    });

    it('should throw error when required parameters are missing', async () => {
      await expect(versionManager.fetchVersion())
        .rejects.toThrow('Note ID and timestamp are required');

      await expect(versionManager.fetchVersion('test_note_123'))
        .rejects.toThrow('Note ID and timestamp are required');

      expect(mockFetch).not.toHaveBeenCalled();
    });

    it('should handle 404 version not found error', async () => {
      mockFetch.mockResolvedValueOnce(mockApiError(404, 'Version not found'));

      await expect(versionManager.fetchVersion('test_note_123', '1704124800'))
        .rejects.toThrow('Version not found');
    });

    it('should URL encode parameters with special characters', async () => {
      const noteId = 'test note/with spaces';
      const timestamp = '1704124800&param=value';
      mockFetch.mockResolvedValueOnce(mockApiResponse(createMockVersion()));

      await versionManager.fetchVersion(noteId, timestamp);

      expect(mockFetch).toHaveBeenCalledWith(
        '/api/notes/test%20note%2Fwith%20spaces/versions/1704124800%26param%3Dvalue',
        expect.any(Object)
      );
    });
  });

  describe('fetchVersionsForCurrentNote', () => {
    it('should fetch versions for current note', async () => {
      const mockVersions = createMockVersionsList('test_note_123', 2);
      mockFetch.mockResolvedValueOnce(mockApiResponse(mockVersions));

      const result = await versionManager.fetchVersionsForCurrentNote();

      expect(mockDeps.noteStateService.getCurrentNote).toHaveBeenCalled();
      expect(mockFetch).toHaveBeenCalledWith('/api/notes/test_note_123/versions', expect.any(Object));
      expect(result).toHaveLength(2);
    });

    it('should throw error when no note is selected', async () => {
      mockDeps.noteStateService.getCurrentNote.mockReturnValue(null);

      await expect(versionManager.fetchVersionsForCurrentNote())
        .rejects.toThrow('No note is currently selected');

      expect(mockFetch).not.toHaveBeenCalled();
    });
  });

  describe('fetchVersionForCurrentNote', () => {
    it('should fetch specific version for current note', async () => {
      const mockVersion = createMockVersion('test_note_123', '1704124800');
      mockFetch.mockResolvedValueOnce(mockApiResponse(mockVersion));

      const result = await versionManager.fetchVersionForCurrentNote('1704124800');

      expect(mockDeps.noteStateService.getCurrentNote).toHaveBeenCalled();
      expect(mockFetch).toHaveBeenCalledWith('/api/notes/test_note_123/versions/1704124800', expect.any(Object));
      expect(result).toHaveProperty('version_timestamp', '1704124800');
    });

    it('should throw error when no note is selected', async () => {
      mockDeps.noteStateService.getCurrentNote.mockReturnValue(null);

      await expect(versionManager.fetchVersionForCurrentNote('1704124800'))
        .rejects.toThrow('No note is currently selected');

      expect(mockFetch).not.toHaveBeenCalled();
    });
  });

  describe('processVersionsList', () => {
    it('should process versions list correctly', () => {
      const inputVersions = [
        { timestamp: '1704124800', filename: '1704124800.json' },
        { timestamp: '1704121200', filename: '1704121200.json' },
        { timestamp: '1704117600', filename: '1704117600.json' }
      ];

      const result = versionManager.processVersionsList(inputVersions);

      expect(result).toHaveLength(3);
      expect(result[0].timestamp).toBe('1704124800'); // Most recent first
      expect(result[2].timestamp).toBe('1704117600'); // Oldest last
      expect(result[0]).toHaveProperty('displayDate');
      expect(result[0]).toHaveProperty('created');
    });

    it('should handle string timestamps', () => {
      const inputVersions = ['1704124800', '1704121200'];

      const result = versionManager.processVersionsList(inputVersions);

      expect(result).toHaveLength(2);
      expect(result[0].timestamp).toBe('1704124800');
      expect(result[0].filename).toBe('1704124800.json');
    });

    it('should return empty array for invalid input', () => {
      expect(versionManager.processVersionsList(null)).toEqual([]);
      expect(versionManager.processVersionsList(undefined)).toEqual([]);
      expect(versionManager.processVersionsList('not an array')).toEqual([]);
    });
  });

  describe('processVersionContent', () => {
    it('should process version content correctly', () => {
      const inputVersion = {
        id: 'test_note_123',
        title: 'Test Note',
        content: 'Test content'
      };

      const result = versionManager.processVersionContent(inputVersion, '1704124800');

      expect(result).toEqual({
        ...inputVersion,
        version_timestamp: '1704124800',
        version_display_date: expect.any(String),
        isVersion: true
      });
    });

    it('should throw error for invalid version content', () => {
      expect(() => versionManager.processVersionContent(null, '1704124800'))
        .toThrow('Invalid version content received');

      expect(() => versionManager.processVersionContent('invalid', '1704124800'))
        .toThrow('Invalid version content received');
    });
  });

  describe('formatVersionDate', () => {
    it('should format timestamps with relative time', () => {
      const currentTime = Date.now();
      
      // 30 minutes ago
      const thirtyMinutesAgo = Math.floor((currentTime - 30 * 60 * 1000) / 1000).toString();
      const result1 = versionManager.formatVersionDate(thirtyMinutesAgo);
      expect(result1).toMatch(/Less than 1 hour ago|^\w{3} \d{1,2}, \d{4}/);

      // Test for reasonable output format
      const oneHourAgo = Math.floor((currentTime - 1 * 60 * 60 * 1000) / 1000).toString();
      const result2 = versionManager.formatVersionDate(oneHourAgo);
      expect(result2).toMatch(/1 hour ago|^\w{3} \d{1,2}, \d{4}/);
    });

    it('should handle recent timestamps', () => {
      const recentTimestamp = Math.floor(Date.now() / 1000).toString();
      const result = versionManager.formatVersionDate(recentTimestamp);
      
      // Should be either "Less than 1 hour ago" or a formatted date
      expect(typeof result).toBe('string');
      expect(result.length).toBeGreaterThan(0);
    });

    it('should handle invalid timestamps', () => {
      expect(versionManager.formatVersionDate('invalid')).toBe('Invalid Date');
      expect(versionManager.formatVersionDate('')).toBe('Invalid Date');
      expect(versionManager.formatVersionDate(null)).toBe('Unknown Date');
    });

    it('should return string for valid timestamps', () => {
      const validTimestamp = '1704124800'; // Valid unix timestamp
      const result = versionManager.formatVersionDate(validTimestamp);
      
      expect(typeof result).toBe('string');
      expect(result).not.toBe('Invalid Date');
      expect(result).not.toBe('Unknown Date');
    });
  });

  describe('isVersionsAvailable', () => {
    it('should return true when authenticated and note is selected', () => {
      // Reset the mock to ensure clean state
      mockDeps.authManager.isAuthenticated = true;
      mockDeps.noteStateService.getCurrentNote = jest.fn().mockReturnValue({ id: 'test_123' });

      const result = versionManager.isVersionsAvailable();
      expect(result).toBe(true);
    });

    it('should return false when not authenticated', () => {
      mockDeps.authManager.isAuthenticated = false;
      mockDeps.noteStateService.getCurrentNote = jest.fn().mockReturnValue({ id: 'test_123' });

      const result = versionManager.isVersionsAvailable();
      expect(result).toBe(false);
    });

    it('should return false when no note is selected', () => {
      mockDeps.authManager.isAuthenticated = true;
      mockDeps.noteStateService.getCurrentNote = jest.fn().mockReturnValue(null);

      const result = versionManager.isVersionsAvailable();
      expect(result).toBe(false);
    });

    it('should return false when neither authenticated nor note selected', () => {
      mockDeps.authManager.isAuthenticated = false;
      mockDeps.noteStateService.getCurrentNote = jest.fn().mockReturnValue(null);

      const result = versionManager.isVersionsAvailable();
      expect(result).toBe(false);
    });
  });
});
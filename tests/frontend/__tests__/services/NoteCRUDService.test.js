import { setupMockFetch, mockNotesApiCalls, createMockNote } from '../../mocks/api-utils.js';
import { mockNotes, mockApiResponses } from '../../fixtures/test-data.js';

const mockModule = () => {
  return class NoteCRUDService {
    constructor() {}
    
    async getNotes() {
      const response = await fetch('/api/notes');
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
      return response.json();
    }
    
    async getNote(noteId) {
      const response = await fetch(`/api/notes/${noteId}`);
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
      return response.json();
    }
    
    async createNote(noteData) {
      const response = await fetch('/api/notes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(noteData),
      });
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
      return response.json();
    }
    
    async updateNote(noteId, noteData) {
      const response = await fetch(`/api/notes/${noteId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(noteData),
      });
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
      return response.json();
    }
    
    async deleteNote(noteId) {
      const response = await fetch(`/api/notes/${noteId}`, {
        method: 'DELETE',
      });
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
      return response.json();
    }
  };
};

describe('NoteCRUDService', () => {
  let service;
  let mockFetch;
  let apiMocks;

  beforeEach(() => {
    mockFetch = setupMockFetch();
    apiMocks = mockNotesApiCalls(mockFetch);
    const NoteCRUDService = mockModule();
    service = new NoteCRUDService();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('getNotes', () => {
    it('should fetch all notes successfully', async () => {
      apiMocks.mockGetNotes(mockNotes);

      const result = await service.getNotes();

      expect(result).toEqual(mockNotes);
      expect(mockFetch).toHaveBeenCalledWith('/api/notes');
    });

    it('should throw error when API call fails', async () => {
      apiMocks.mockApiError(500, 'Server Error');

      await expect(service.getNotes()).rejects.toThrow('HTTP 500');
      expect(mockFetch).toHaveBeenCalledWith('/api/notes');
    });
  });

  describe('getNote', () => {
    it('should fetch a specific note successfully', async () => {
      const note = createMockNote({ id: 'test_123' });
      apiMocks.mockGetNote(note);

      const result = await service.getNote('test_123');

      expect(result).toEqual(note);
      expect(mockFetch).toHaveBeenCalledWith('/api/notes/test_123');
    });

    it('should throw error for non-existent note', async () => {
      apiMocks.mockApiError(404, 'Note not found');

      await expect(service.getNote('invalid_id')).rejects.toThrow('HTTP 404');
      expect(mockFetch).toHaveBeenCalledWith('/api/notes/invalid_id');
    });
  });

  describe('createNote', () => {
    it('should create a new note successfully', async () => {
      const noteData = { title: 'New Note', content: 'Note content' };
      const createdNote = createMockNote(noteData);
      apiMocks.mockCreateNote(createdNote);

      const result = await service.createNote(noteData);

      expect(result).toEqual(createdNote);
      expect(mockFetch).toHaveBeenCalledWith('/api/notes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(noteData),
      });
    });

    it('should handle validation errors', async () => {
      const invalidData = { title: '' };
      apiMocks.mockApiError(400, 'Validation failed');

      await expect(service.createNote(invalidData)).rejects.toThrow('HTTP 400');
    });
  });

  describe('updateNote', () => {
    it('should update an existing note successfully', async () => {
      const noteId = 'test_123';
      const updateData = { title: 'Updated Title', content: 'Updated content' };
      const updatedNote = createMockNote({ id: noteId, ...updateData });
      apiMocks.mockUpdateNote(updatedNote);

      const result = await service.updateNote(noteId, updateData);

      expect(result).toEqual(updatedNote);
      expect(mockFetch).toHaveBeenCalledWith(`/api/notes/${noteId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updateData),
      });
    });

    it('should handle update conflicts', async () => {
      apiMocks.mockApiError(409, 'Conflict detected');

      await expect(service.updateNote('test_123', {})).rejects.toThrow('HTTP 409');
    });
  });

  describe('deleteNote', () => {
    it('should delete a note successfully', async () => {
      apiMocks.mockDeleteNote();

      const result = await service.deleteNote('test_123');

      expect(result).toEqual(mockApiResponses.success);
      expect(mockFetch).toHaveBeenCalledWith('/api/notes/test_123', {
        method: 'DELETE',
      });
    });

    it('should handle deletion of non-existent note', async () => {
      apiMocks.mockApiError(404, 'Note not found');

      await expect(service.deleteNote('invalid_id')).rejects.toThrow('HTTP 404');
    });
  });
});
export const mockApiResponse = (data, status = 200, ok = true) => {
  return Promise.resolve({
    ok,
    status,
    json: () => Promise.resolve(data),
    text: () => Promise.resolve(JSON.stringify(data)),
  });
};

export const mockApiError = (status = 500, message = 'Server Error') => {
  return Promise.resolve({
    ok: false,
    status,
    json: () => Promise.resolve({ error: message }),
    text: () => Promise.resolve(JSON.stringify({ error: message })),
  });
};

export const setupMockFetch = () => {
  const mockFetch = jest.fn();
  global.fetch = mockFetch;
  return mockFetch;
};

export const createMockNote = (overrides = {}) => {
  return {
    id: 'test_note_123',
    title: 'Test Note',
    content: 'Test note content',
    created: '2024-01-01T00:00:00Z',
    modified: '2024-01-01T01:00:00Z',
    isPublic: false,
    folder: null,
    ...overrides,
  };
};

export const createMockNotesList = (count = 3) => {
  return Array.from({ length: count }, (_, i) => createMockNote({
    id: `test_note_${i + 1}`,
    title: `Test Note ${i + 1}`,
    content: `Content for test note ${i + 1}`,
  }));
};

export const createMockFolder = (name = 'Test Folder', notes = []) => {
  return {
    name,
    notes,
    created: '2024-01-01T00:00:00Z',
  };
};

export const createMockVersionsList = (noteId = 'test_note_123', count = 5) => {
  const baseTime = Date.now();
  return Array.from({ length: count }, (_, i) => {
    const timestamp = Math.floor((baseTime - (i * 3600000)) / 1000);
    return {
      timestamp: timestamp.toString(),
      filename: `${timestamp}.json`,
      created: new Date(timestamp * 1000).toISOString(),
    };
  }).reverse();
};

export const createMockVersion = (noteId = 'test_note_123', timestamp = null) => {
  const ts = timestamp || Math.floor(Date.now() / 1000).toString();
  return {
    id: noteId,
    title: 'Test Note Version',
    content: 'Version content at timestamp ' + ts,
    created: '2024-01-01T00:00:00Z',
    modified: new Date(parseInt(ts) * 1000).toISOString(),
    isPublic: false,
    folder: null,
    version_timestamp: ts,
  };
};

export const mockNotesApiCalls = (mockFetch) => {
  return {
    mockGetNotes: (notes = createMockNotesList()) => {
      mockFetch.mockResolvedValueOnce(mockApiResponse(notes));
    },
    
    mockGetNote: (note = createMockNote()) => {
      mockFetch.mockResolvedValueOnce(mockApiResponse(note));
    },
    
    mockCreateNote: (note = createMockNote()) => {
      mockFetch.mockResolvedValueOnce(mockApiResponse(note, 201));
    },
    
    mockUpdateNote: (note = createMockNote()) => {
      mockFetch.mockResolvedValueOnce(mockApiResponse(note));
    },
    
    mockDeleteNote: () => {
      mockFetch.mockResolvedValueOnce(mockApiResponse({ success: true }));
    },
    
    mockGetVersions: (versions = createMockVersionsList()) => {
      mockFetch.mockResolvedValueOnce(mockApiResponse(versions));
    },
    
    mockGetVersion: (version = createMockVersion()) => {
      mockFetch.mockResolvedValueOnce(mockApiResponse(version));
    },
    
    mockApiError: (status = 500, message = 'Server Error') => {
      mockFetch.mockResolvedValueOnce(mockApiError(status, message));
    },
  };
};

export const mockAuthApiCalls = (mockFetch) => {
  return {
    mockLogin: (success = true) => {
      if (success) {
        mockFetch.mockResolvedValueOnce(mockApiResponse({ 
          authenticated: true,
          session: 'mock_session_id' 
        }));
      } else {
        mockFetch.mockResolvedValueOnce(mockApiError(401, 'Invalid credentials'));
      }
    },
    
    mockLogout: () => {
      mockFetch.mockResolvedValueOnce(mockApiResponse({ success: true }));
    },
  };
};
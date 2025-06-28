export const mockNotes = [
  {
    id: 'note_123',
    title: 'Sample Note 1',
    content: 'This is the first sample note content',
    created: '2024-01-01T10:00:00Z',
    modified: '2024-01-01T11:00:00Z',
    isPublic: false,
    folder: null,
  },
  {
    id: 'note_456',
    title: 'Sample Note 2',
    content: 'This is the second sample note content',
    created: '2024-01-01T12:00:00Z',
    modified: '2024-01-01T13:00:00Z',
    isPublic: true,
    folder: 'Work',
  },
  {
    id: 'note_789',
    title: 'Sample Note 3',
    content: 'This is the third sample note content',
    created: '2024-01-01T14:00:00Z',
    modified: '2024-01-01T15:00:00Z',
    isPublic: false,
    folder: 'Personal',
  },
];

export const mockFolders = [
  { name: 'Work', notes: ['note_456'] },
  { name: 'Personal', notes: ['note_789'] },
];

export const mockVersions = [
  {
    timestamp: '1704117600',
    filename: '1704117600.json',
    created: '2024-01-01T16:00:00Z',
  },
  {
    timestamp: '1704121200',
    filename: '1704121200.json',
    created: '2024-01-01T17:00:00Z',
  },
  {
    timestamp: '1704124800',
    filename: '1704124800.json',
    created: '2024-01-01T18:00:00Z',
  },
];

export const mockApiResponses = {
  success: { success: true },
  authSuccess: { authenticated: true, session: 'mock_session' },
  authFailure: { error: 'Invalid credentials' },
  notFound: { error: 'Note not found' },
  serverError: { error: 'Internal server error' },
};
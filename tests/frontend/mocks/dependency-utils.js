export const createMockDependencies = () => {
  return {
    noteCRUDService: {
      getNotes: jest.fn(),
      getNote: jest.fn(),
      createNote: jest.fn(),
      updateNote: jest.fn(),
      deleteNote: jest.fn(),
    },
    
    noteStateService: {
      getCurrentNote: jest.fn(),
      setCurrentNote: jest.fn(),
      isNoteModified: jest.fn(),
      markAsModified: jest.fn(),
      markAsSaved: jest.fn(),
      getLastSaveTime: jest.fn(),
    },
    
    editorStateService: {
      getEditorState: jest.fn(),
      setEditorState: jest.fn(),
      isAutoSaving: jest.fn(),
      setAutoSaving: jest.fn(),
      getLastModified: jest.fn(),
      setLastModified: jest.fn(),
    },
    
    visibilityService: {
      canEdit: jest.fn(() => true),
      canView: jest.fn(() => true),
      setReadOnly: jest.fn(),
      isReadOnly: jest.fn(() => false),
    },
    
    authManager: {
      isAuthenticated: jest.fn(() => true),
      login: jest.fn(),
      logout: jest.fn(),
      getAuthStatus: jest.fn(() => ({ authenticated: true })),
    },
    
    uiManager: {
      showModal: jest.fn(),
      hideModal: jest.fn(),
      showNotification: jest.fn(),
      updateLoadingState: jest.fn(),
      renderNotesList: jest.fn(),
    },
    
    editorManager: {
      getEditor: jest.fn(),
      setContent: jest.fn(),
      getContent: jest.fn(),
      focus: jest.fn(),
      setReadOnly: jest.fn(),
      isReadOnly: jest.fn(() => false),
    },
    
    assetManager: {
      uploadAsset: jest.fn(),
      deleteAsset: jest.fn(),
      getAssets: jest.fn(),
      renameAsset: jest.fn(),
    },
    
    pollingManager: {
      startPolling: jest.fn(),
      stopPolling: jest.fn(),
      isPolling: jest.fn(() => false),
      setIdleCallback: jest.fn(),
    },
  };
};

export const createMockService = (serviceName, methods = {}) => {
  const defaultMethods = createMockDependencies()[serviceName] || {};
  
  return {
    ...defaultMethods,
    ...Object.keys(methods).reduce((acc, methodName) => {
      acc[methodName] = jest.fn(methods[methodName]);
      return acc;
    }, {}),
  };
};

export const mockModuleImport = (modulePath, exportName, mockImplementation) => {
  const originalImport = jest.requireActual(modulePath);
  
  jest.doMock(modulePath, () => ({
    ...originalImport,
    [exportName]: mockImplementation,
  }));
  
  return {
    restore: () => {
      jest.dontMock(modulePath);
    },
  };
};
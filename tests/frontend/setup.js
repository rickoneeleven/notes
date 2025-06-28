const fetchMock = require('jest-fetch-mock');
fetchMock.enableMocks();

global.ResizeObserver = jest.fn().mockImplementation(() => ({
  observe: jest.fn(),
  unobserve: jest.fn(),
  disconnect: jest.fn(),
}));

global.IntersectionObserver = jest.fn().mockImplementation(() => ({
  observe: jest.fn(),
  unobserve: jest.fn(),
  disconnect: jest.fn(),
}));

Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: jest.fn().mockImplementation(query => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: jest.fn(),
    removeListener: jest.fn(),
    addEventListener: jest.fn(),
    removeEventListener: jest.fn(),
    dispatchEvent: jest.fn(),
  })),
});

Storage.prototype.getItem = jest.fn();
Storage.prototype.setItem = jest.fn();
Storage.prototype.removeItem = jest.fn();
Storage.prototype.clear = jest.fn();

beforeEach(() => {
  fetchMock.resetMocks();
  jest.clearAllMocks();
  
  document.body.innerHTML = '';
  
  global.localStorage.clear();
  global.sessionStorage.clear();
});
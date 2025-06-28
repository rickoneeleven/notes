export const createMockElement = (tagName, attributes = {}) => {
  const element = document.createElement(tagName);
  
  Object.entries(attributes).forEach(([key, value]) => {
    if (key === 'classList') {
      value.forEach(className => element.classList.add(className));
    } else if (key === 'style') {
      Object.assign(element.style, value);
    } else {
      element.setAttribute(key, value);
    }
  });
  
  return element;
};

export const createMockButton = (text, attributes = {}) => {
  const button = createMockElement('button', attributes);
  button.textContent = text;
  return button;
};

export const createMockInput = (type = 'text', attributes = {}) => {
  return createMockElement('input', { type, ...attributes });
};

export const createMockTextarea = (attributes = {}) => {
  return createMockElement('textarea', attributes);
};

export const createMockDiv = (attributes = {}) => {
  return createMockElement('div', attributes);
};

export const mockQuerySelector = (element) => {
  const originalQuerySelector = document.querySelector;
  const originalQuerySelectorAll = document.querySelectorAll;
  
  document.querySelector = jest.fn((selector) => {
    if (typeof element === 'function') {
      return element(selector);
    }
    return element;
  });
  
  document.querySelectorAll = jest.fn((selector) => {
    if (typeof element === 'function') {
      const result = element(selector);
      return result ? [result] : [];
    }
    return element ? [element] : [];
  });
  
  return {
    restore: () => {
      document.querySelector = originalQuerySelector;
      document.querySelectorAll = originalQuerySelectorAll;
    }
  };
};

export const mockElementMethods = (element) => {
  element.addEventListener = jest.fn();
  element.removeEventListener = jest.fn();
  element.appendChild = jest.fn();
  element.removeChild = jest.fn();
  element.click = jest.fn();
  element.focus = jest.fn();
  element.blur = jest.fn();
  
  Object.defineProperty(element, 'value', {
    get: jest.fn(() => element._value || ''),
    set: jest.fn((value) => { element._value = value; }),
  });
  
  Object.defineProperty(element, 'textContent', {
    get: jest.fn(() => element._textContent || ''),
    set: jest.fn((content) => { element._textContent = content; }),
  });
  
  return element;
};

export const setupMockDOM = () => {
  document.body.innerHTML = `
    <div id="app">
      <div id="editor"></div>
      <div id="sidebar">
        <div id="notes-list"></div>
        <button id="new-note-btn">New Note</button>
      </div>
      <div id="modal-overlay" style="display: none;"></div>
    </div>
  `;
  
  const elements = {};
  elements.app = document.getElementById('app');
  elements.editor = document.getElementById('editor');
  elements.sidebar = document.getElementById('sidebar');
  elements.notesList = document.getElementById('notes-list');
  elements.newNoteBtn = document.getElementById('new-note-btn');
  elements.modalOverlay = document.getElementById('modal-overlay');
  
  Object.values(elements).forEach(mockElementMethods);
  
  return elements;
};
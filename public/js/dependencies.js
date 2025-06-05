import UIManager from './UIManager.js';
import AuthManager from './AuthManager.js';
import NoteManager from './NoteManager.js';
import PollingManager from './PollingManager.js';
import ConflictResolver from './ConflictResolver.js';
import ClipboardManager from './ClipboardManager.js';
import DeletedNotesManager from './DeletedNotesManager.js';
import URLManager from './URLManager.js';
import EventHandler from './EventHandler.js';
import { AssetManager } from './AssetManager.js';
import EditorManager from './EditorManager.js';
import NoteStateService from './NoteStateService.js';
import EditorStateService from './EditorStateService.js';
import NoteCRUDService from './NoteCRUDService.js';
import VisibilityService from './VisibilityService.js';

export function createAppDependencies() {
    const appPlaceholder = {};
    
    const ui = new UIManager(appPlaceholder);
    const auth = new AuthManager(appPlaceholder);
    const assetManager = new AssetManager(auth, ui);
    const noteManager = new NoteManager(appPlaceholder);
    const pollingManager = new PollingManager(appPlaceholder);
    const conflictResolver = new ConflictResolver(appPlaceholder);
    const clipboardManager = new ClipboardManager();
    const deletedNotesManager = new DeletedNotesManager(appPlaceholder);
    const urlManager = new URLManager(appPlaceholder);
    const eventHandler = new EventHandler(appPlaceholder);
    const editorManager = new EditorManager();
    
    const noteStateService = new NoteStateService(auth, urlManager);
    const editorStateService = new EditorStateService(editorManager, pollingManager, noteStateService);
    const noteCRUDService = new NoteCRUDService(noteManager, conflictResolver, noteStateService, editorManager, auth);
    const visibilityService = new VisibilityService(auth, noteStateService);
    
    return {
        ui,
        auth,
        assetManager,
        noteManager,
        pollingManager,
        conflictResolver,
        clipboardManager,
        deletedNotesManager,
        urlManager,
        eventHandler,
        editorManager,
        noteStateService,
        editorStateService,
        noteCRUDService,
        visibilityService
    };
}
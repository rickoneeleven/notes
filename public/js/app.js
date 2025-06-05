import AppCoordinator from './AppCoordinator.js';
import { createAppDependencies } from './dependencies.js';

document.addEventListener('DOMContentLoaded', () => {
    const dependencies = createAppDependencies();
    const app = new AppCoordinator(dependencies);
    
    dependencies.assetManager.setApp(app);
    dependencies.editorManager.setApp(app);
    
    dependencies.ui.setApp(app);
    dependencies.auth.setApp(app);
    dependencies.noteManager.setApp(app);
    dependencies.pollingManager.setApp(app);
    dependencies.conflictResolver.setApp(app);
    dependencies.deletedNotesManager.setApp(app);
    dependencies.urlManager.setApp(app);
    dependencies.eventHandler.setApp(app);
    
    window.notesApp = app;
    app.init();
});
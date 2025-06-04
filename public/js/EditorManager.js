import { EditorState, Compartment } from '@codemirror/state';
import { EditorView, lineNumbers, keymap } from '@codemirror/view';
import { defaultKeymap, history, historyKeymap } from '@codemirror/commands';
import { oneDark } from '@codemirror/theme-one-dark';

export default class EditorManager {
    constructor() {
        console.log('[EditorManager] Initializing EditorManager instance');
        this.view = null;
        this.mountPoint = null;
        this.changeHandler = null;
        this.isUpdatingContent = false;
        this.app = null;
        this.readOnlyCompartment = new Compartment();
    }
    
    setApp(app) {
        console.log('[EditorManager] App reference set');
        this.app = app;
    }

    init(mountPointElement, options = {}) {
        console.log('[EditorManager] init() called', { 
            mountPointElement, 
            mountPointId: mountPointElement?.id,
            options 
        });

        if (!mountPointElement) {
            console.error('[EditorManager] init() failed: No mount point element provided');
            throw new Error('Mount point element is required');
        }

        this.mountPoint = mountPointElement;

        try {
            const extensions = [
                lineNumbers(),
                history(),
                EditorView.lineWrapping,
                keymap.of([...defaultKeymap, ...historyKeymap]),
                oneDark,
                this.readOnlyCompartment.of(EditorState.readOnly.of(options.readOnly || false)),
                EditorView.updateListener.of(update => {
                    if (!this.isUpdatingContent && update.docChanged) {
                        console.log('[EditorManager] Document changed', {
                            changes: update.changes.toJSON(),
                            transactionTime: update.transactions[0]?.time
                        });
                        
                        if (this.changeHandler) {
                            this.changeHandler(this.getContent());
                        }
                    }
                }),
                EditorView.domEventHandlers({
                    click: () => {
                        console.log('[EditorManager] Editor clicked');
                        if (this.app && this.app.pollingManager) {
                            this.app.pollingManager.trackActivity();
                        }
                        return false;
                    }
                })
            ];

            if (options.readOnly) {
                console.log('[EditorManager] Editor initialized in read-only mode');
            }

            const startState = EditorState.create({
                doc: options.initialContent || '',
                extensions
            });

            this.view = new EditorView({
                state: startState,
                parent: this.mountPoint
            });

            console.log('[EditorManager] CodeMirror EditorView created successfully', {
                lineCount: this.view.state.doc.lines,
                contentLength: this.view.state.doc.length
            });

            return this.view;
        } catch (error) {
            console.error('[EditorManager] Failed to initialize CodeMirror', {
                error: error.message,
                stack: error.stack
            });
            throw error;
        }
    }

    setContent(text) {
        console.log('[EditorManager] setContent() called', {
            contentLength: text?.length || 0,
            preview: text?.substring(0, 100)
        });

        if (!this.view) {
            console.error('[EditorManager] setContent() failed: Editor not initialized');
            return;
        }

        try {
            this.isUpdatingContent = true;
            
            const transaction = this.view.state.update({
                changes: {
                    from: 0,
                    to: this.view.state.doc.length,
                    insert: text || ''
                }
            });
            
            this.view.dispatch(transaction);
            
            console.log('[EditorManager] Content set successfully', {
                newLineCount: this.view.state.doc.lines,
                newContentLength: this.view.state.doc.length
            });
        } catch (error) {
            console.error('[EditorManager] Failed to set content', {
                error: error.message,
                stack: error.stack
            });
        } finally {
            this.isUpdatingContent = false;
        }
    }

    getContent() {
        if (!this.view) {
            console.error('[EditorManager] getContent() failed: Editor not initialized');
            return '';
        }

        const content = this.view.state.doc.toString();
        console.log('[EditorManager] getContent() called', {
            contentLength: content.length,
            lineCount: this.view.state.doc.lines,
            preview: content.substring(0, 100)
        });
        
        return content;
    }

    setReadOnly(isReadOnly) {
        console.log('[EditorManager] setReadOnly() called', { isReadOnly });

        if (!this.view) {
            console.error('[EditorManager] setReadOnly() failed: Editor not initialized');
            return;
        }

        try {
            this.view.dispatch({
                effects: this.readOnlyCompartment.reconfigure(EditorState.readOnly.of(isReadOnly))
            });
            console.log('[EditorManager] Read-only state updated successfully to:', isReadOnly);
        } catch (error) {
            console.error('[EditorManager] Failed to set read-only state', {
                error: error.message,
                stack: error.stack
            });
        }
    }

    onContentChange(handler) {
        console.log('[EditorManager] onContentChange() handler registered');
        this.changeHandler = handler;
    }

    focus() {
        console.log('[EditorManager] focus() called');
        if (this.view) {
            this.view.focus();
        }
    }

    destroy() {
        console.log('[EditorManager] destroy() called');
        if (this.view) {
            this.view.destroy();
            this.view = null;
            this.mountPoint = null;
            this.changeHandler = null;
        }
    }

    getLineCount() {
        if (!this.view) {
            return 0;
        }
        return this.view.state.doc.lines;
    }

    getCursorPosition() {
        if (!this.view) {
            return { line: 0, ch: 0 };
        }
        
        const main = this.view.state.selection.main;
        const line = this.view.state.doc.lineAt(main.head);
        
        return {
            line: line.number - 1,
            ch: main.head - line.from
        };
    }
}
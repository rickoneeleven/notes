const puppeteer = require('puppeteer');
const TestHelper = require('./test-helper');

async function testSimpleSave() {
    const helper = new TestHelper();
    const browser = await helper.setupBrowser(puppeteer);
    const page = await browser.newPage();
    
    // Setup console logging
    helper.setupConsoleLogging(page);
    
    try {
        console.log('=== SIMPLE SAVE TEST ===');
        console.log('Opening app...');
        await page.goto('http://localhost:3000', { waitUntil: 'networkidle0' });
        
        // Login with test password
        await helper.login(page);
        
        console.log('Creating new note...');
        await page.waitForSelector('#newNoteBtn', { visible: true });
        await page.click('#newNoteBtn');
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        console.log('Typing slowly...');
        const editor = await page.$('#editor .cm-content');
        await editor.click();
        
        // Type slowly like a human would
        const testText = 'Hello World';
        for (let char of testText) {
            await page.keyboard.type(char);
            await new Promise(resolve => setTimeout(resolve, 300)); // 300ms between chars
        }
        
        console.log('Waiting for autosave...');
        await new Promise(resolve => setTimeout(resolve, 3000));
        
        console.log('Checking final state...');
        const finalState = await page.evaluate(() => {
            const app = window.notesApp;
            return {
                hasApp: !!app,
                isAuthenticated: app?.isAuthenticated || false,
                currentNoteId: app?.currentNote?.id || null,
                editorContent: app?.editorManager?.getContent() || '',
                noteTitle: app?.currentNote?.title || null,
                noteCreated: app?.currentNote?.created || null
            };
        });
        
        console.log('Final state:', finalState);
        
        // Simple success criteria: we have a note with content
        if (finalState.hasApp && 
            finalState.isAuthenticated && 
            finalState.currentNoteId && 
            finalState.editorContent === testText) {
            
            console.log(`✅ SUCCESS: Note created with ID ${finalState.currentNoteId} and content "${finalState.editorContent}"`);
            
            // Cleanup test notes before closing
            await helper.cleanupTestNotes(page);
            
            return true;
        } else {
            console.log('❌ FAILURE: Basic note creation and content failed');
            return false;
        }
        
    } catch (error) {
        console.error('❌ Test failed with error:', error);
        return false;
    } finally {
        await browser.close();
    }
}

testSimpleSave().then(success => {
    console.log(success ? '=== TEST PASSED ===' : '=== TEST FAILED ===');
    process.exit(success ? 0 : 1);
}).catch(console.error);
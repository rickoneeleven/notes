const puppeteer = require('puppeteer');
const TestHelper = require('./test-helper');

async function testUndoIsolation() {
    const helper = new TestHelper();
    const browser = await helper.setupBrowser(puppeteer);
    const page = await browser.newPage();
    
    helper.setupConsoleLogging(page);
    
    try {
        console.log('=== UNDO ISOLATION TEST ===');
        console.log('Opening app...');
        await page.goto('http://localhost:3000', { waitUntil: 'networkidle0' });
        
        await helper.login(page);
        
        console.log('Creating first note...');
        await page.waitForSelector('#newNoteBtn', { visible: true });
        await page.click('#newNoteBtn');
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        console.log('Typing in first note...');
        const editor = await page.$('#editor .cm-content');
        await editor.click();
        
        const firstNoteText = 'First note content';
        await page.keyboard.type(firstNoteText);
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        const firstNoteId = await page.evaluate(() => window.notesApp?.currentNote?.id);
        console.log('First note ID:', firstNoteId);
        
        console.log('Creating second note...');
        await page.click('#newNoteBtn');
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        console.log('Typing in second note...');
        await editor.click();
        const secondNoteText = 'Second note content';
        await page.keyboard.type(secondNoteText);
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        const secondNoteId = await page.evaluate(() => window.notesApp?.currentNote?.id);
        console.log('Second note ID:', secondNoteId);
        
        console.log('Testing undo in second note...');
        await page.keyboard.down('Control');
        await page.keyboard.press('z');
        await page.keyboard.up('Control');
        await new Promise(resolve => setTimeout(resolve, 500));
        
        const contentAfterUndo = await page.evaluate(() => 
            window.notesApp?.editorManager?.getContent() || ''
        );
        
        console.log('Content after undo:', contentAfterUndo);
        
        console.log('Switching back to first note...');
        await page.click(`[data-note-id="${firstNoteId}"]`);
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        console.log('Testing undo in first note (should do nothing)...');
        await page.keyboard.down('Control');
        await page.keyboard.press('z');
        await page.keyboard.up('Control');
        await new Promise(resolve => setTimeout(resolve, 500));
        
        const firstNoteContentAfterUndo = await page.evaluate(() => 
            window.notesApp?.editorManager?.getContent() || ''
        );
        
        console.log('First note content after undo:', firstNoteContentAfterUndo);
        
        console.log('Switching to new third note to test clean history...');
        await page.click('#newNoteBtn');
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        console.log('Immediately pressing undo in new note...');
        await page.keyboard.down('Control');
        await page.keyboard.press('z');
        await page.keyboard.up('Control');
        await new Promise(resolve => setTimeout(resolve, 500));
        
        const thirdNoteContent = await page.evaluate(() => 
            window.notesApp?.editorManager?.getContent() || ''
        );
        
        const currentNoteId = await page.evaluate(() => window.notesApp?.currentNote?.id);
        
        console.log('Third note content after immediate undo:', thirdNoteContent);
        console.log('Current note ID:', currentNoteId);
        
        const success = 
            contentAfterUndo === '' && 
            firstNoteContentAfterUndo === firstNoteText && 
            thirdNoteContent === '' && 
            currentNoteId !== firstNoteId && 
            currentNoteId !== secondNoteId;
        
        if (success) {
            console.log('✅ SUCCESS: Undo history properly isolated between notes');
            console.log('  - Second note undo worked correctly (cleared content)');
            console.log('  - First note content preserved after undo');
            console.log('  - New note undo did not revert to previous note');
        } else {
            console.log('❌ FAILURE: Undo history not properly isolated');
            console.log(`  - Second note after undo: "${contentAfterUndo}" (expected: "")`);
            console.log(`  - First note after undo: "${firstNoteContentAfterUndo}" (expected: "${firstNoteText}")`);
            console.log(`  - Third note after undo: "${thirdNoteContent}" (expected: "")`);
        }
        
        await helper.cleanupTestNotes(page);
        
        return success;
        
    } catch (error) {
        console.error('❌ Test failed with error:', error);
        return false;
    } finally {
        await browser.close();
    }
}

testUndoIsolation().then(success => {
    console.log(success ? '=== TEST PASSED ===' : '=== TEST FAILED ===');
    process.exit(success ? 0 : 1);
}).catch(console.error);
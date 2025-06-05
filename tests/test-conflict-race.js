const puppeteer = require('puppeteer');
const TestHelper = require('./test-helper');

async function testConflictRaceCondition() {
    const helper = new TestHelper();
    const browser = await helper.setupBrowser(puppeteer);
    const page = await browser.newPage();
    
    // Setup console logging
    helper.setupConsoleLogging(page);
    
    // Listen for dialog events (conflict dialogs)
    page.on('dialog', async dialog => {
        console.log(`[CONFLICT DIALOG DETECTED] ${dialog.message()}`);
        await dialog.accept(); // Auto-accept to continue test
    });
    
    try {
        console.log('Opening notes app...');
        await page.goto('http://localhost:3000', { waitUntil: 'networkidle0' });
        
        // Login with test password
        await helper.login(page);
        
        // Wait for app to load and new note button to appear
        await page.waitForSelector('#editor');
        await page.waitForSelector('#newNoteBtn', { visible: true });
        
        console.log('Creating new note...');
        await page.click('#newNoteBtn');
        await new Promise(resolve => setTimeout(resolve, 1000)); // Wait for note creation
        
        console.log('Typing initial content slowly...');
        const editor = await page.$('#editor .cm-content');
        await editor.click();
        
        const initialText = 'This is some test content that we will copy and paste multiple times.';
        await page.keyboard.type(initialText, { delay: 50 }); // Slow typing
        await new Promise(resolve => setTimeout(resolve, 2000)); // Wait for autosave
        
        console.log('Starting fast copy/paste operations...');
        
        // Select all text
        await page.keyboard.down('Control');
        await page.keyboard.press('a');
        await page.keyboard.up('Control');
        await new Promise(resolve => setTimeout(resolve, 100));
        
        // Copy
        await page.keyboard.down('Control');
        await page.keyboard.press('c');
        await page.keyboard.up('Control');
        await new Promise(resolve => setTimeout(resolve, 100));
        
        // Move to end and paste multiple times rapidly
        await page.keyboard.press('End');
        await page.keyboard.press('Enter');
        
        for (let i = 0; i < 3; i++) {
            console.log(`Fast paste operation ${i + 1}...`);
            await page.keyboard.down('Control');
            await page.keyboard.press('v');
            await page.keyboard.up('Control');
            await page.keyboard.press('Enter');
            await new Promise(resolve => setTimeout(resolve, 50)); // Very short delay between pastes
        }
        
        console.log('Moving to middle of text and deleting section...');
        
        // Go to beginning and move to middle
        await page.keyboard.down('Control');
        await page.keyboard.press('Home');
        await page.keyboard.up('Control');
        
        // Move to roughly middle of first line
        for (let i = 0; i < 25; i++) {
            await page.keyboard.press('ArrowRight');
        }
        
        // Select some text in the middle and delete it rapidly
        await page.keyboard.down('Shift');
        for (let i = 0; i < 15; i++) {
            await page.keyboard.press('ArrowRight');
        }
        await page.keyboard.up('Shift');
        
        console.log('Deleting selected text...');
        await page.keyboard.press('Delete');
        
        // Add more rapid edits
        await page.keyboard.type('MODIFIED', { delay: 10 });
        await new Promise(resolve => setTimeout(resolve, 100));
        
        await page.keyboard.down('Control');
        await page.keyboard.press('a');
        await page.keyboard.up('Control');
        
        await page.keyboard.down('Control');
        await page.keyboard.press('c');
        await page.keyboard.up('Control');
        
        await page.keyboard.press('End');
        await page.keyboard.press('Enter');
        
        await page.keyboard.down('Control');
        await page.keyboard.press('v');
        await page.keyboard.up('Control');
        
        console.log('Waiting to see if conflict occurs...');
        await new Promise(resolve => setTimeout(resolve, 10000)); // Wait 10 seconds to see if conflict dialog appears
        
        console.log('Test completed. Check console for conflict detection messages.');
        
        // Cleanup test notes before closing
        await helper.cleanupTestNotes(page);
        
    } catch (error) {
        console.error('Test failed:', error);
    } finally {
        await browser.close();
        console.log('Test finished.');
    }
}

// Run the test
testConflictRaceCondition().catch(console.error);
const puppeteer = require('puppeteer');
const TestHelper = require('./test-helper');

async function testFastClickAway() {
    const helper = new TestHelper();
    const browser = await helper.setupBrowser(puppeteer);
    const page = await browser.newPage();
    
    try {
        console.log('🚀 Starting Fast Click-Away Test (reproducing text loss issue)...');
        
        // Enable console logging
        page.on('console', msg => {
            const type = msg.type();
            const text = msg.text();
            if (type === 'error' || text.includes('[NoteManager') || text.includes('SAVE') || text.includes('ERROR')) {
                console.log(`[BROWSER ${type.toUpperCase()}] ${text}`);
            }
        });
        
        // Navigate to the app
        await page.goto('http://localhost:3000');
        await page.waitForSelector('#loginBtn', { timeout: 10000 });
        
        // Login with test password
        await helper.login(page);
        
        // Wait for authentication and notes to load
        await page.waitForSelector('#newNoteBtn', { timeout: 5000 });
        await new Promise(resolve => setTimeout(resolve, 1000)); // Let notes load
        
        console.log('📄 Creating first note...');
        await page.click('#newNoteBtn');
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        // Type some content in first note (fast typing)
        const firstNoteText = 'First note content - this should be saved';
        console.log('⚡ Fast typing in first note...');
        const editor = await page.$('#editor .cm-content');
        await editor.click();
        await page.keyboard.type(firstNoteText);
        
        // Immediately create second note (simulating fast click-away before save)
        console.log('🏃 Immediately clicking to create second note (before save completes)...');
        await page.click('#newNoteBtn');
        await new Promise(resolve => setTimeout(resolve, 500)); // Brief pause for UI update
        
        // Type in second note
        const secondNoteText = 'Second note content';
        console.log('📝 Typing in second note...');
        const editor2 = await page.$('#editor .cm-content');
        await editor2.click();
        await page.keyboard.type(secondNoteText);
        
        // Wait for saves to potentially complete
        console.log('⏳ Waiting 6 seconds for any pending saves...');
        await new Promise(resolve => setTimeout(resolve, 6000));
        
        // Now check if first note content was preserved
        console.log('🔍 Checking if first note content was preserved...');
        
        // Click on first note in the list (should be second item since notes are unshifted)
        const noteItems = await page.$$('.notes-list li');
        if (noteItems.length < 2) {
            throw new Error('Expected at least 2 notes in the list');
        }
        
        console.log(`📋 Found ${noteItems.length} notes. Clicking on first note...`);
        await noteItems[1].click(); // Second item is the first note created
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        // Get editor content
        const editorContent = await page.evaluate(() => {
            const content = document.querySelector('#editor .cm-content');
            return content ? content.textContent : '';
        });
        
        console.log(`📖 First note content after click-away: "${editorContent}"`);
        console.log(`🎯 Expected content: "${firstNoteText}"`);
        
        let testSuccess = false;
        if (editorContent === firstNoteText) {
            console.log('✅ SUCCESS: First note content was preserved despite fast click-away');
            testSuccess = true;
        } else if (editorContent === '') {
            console.log('❌ CONFIRMED: Text loss issue reproduced - first note content is empty');
            console.log('🐛 This confirms the bug where fast click-away before save completes loses text');
            testSuccess = false;
        } else {
            console.log('❓ UNEXPECTED: First note has different content than expected');
            console.log(`   Got: "${editorContent}"`);
            console.log(`   Expected: "${firstNoteText}"`);
            testSuccess = false;
        }
        
        // Cleanup test notes before closing
        await helper.cleanupTestNotes(page);
        
        return testSuccess;
        
    } catch (error) {
        console.error('💥 Test failed with error:', error.message);
        return false;
    } finally {
        await browser.close();
    }
}

// Run the test
testFastClickAway().then(success => {
    if (success) {
        console.log('\n🎉 Test completed - text preservation working');
        process.exit(0);
    } else {
        console.log('\n🐛 Test completed - text loss issue confirmed');
        process.exit(1);
    }
}).catch(error => {
    console.error('💥 Test execution failed:', error);
    process.exit(1);
});
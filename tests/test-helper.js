const fs = require('fs');
const path = require('path');

class TestHelper {
    constructor() {
        this.testPasswordFile = path.join(__dirname, 'test-password.txt');
    }

    getTestPassword() {
        try {
            return fs.readFileSync(this.testPasswordFile, 'utf8').trim();
        } catch (error) {
            console.error('Failed to read test password file:', error);
            // Fallback to default test password if file doesn't exist
            return 'test123';
        }
    }

    async login(page, password = null) {
        if (!password) {
            password = this.getTestPassword();
        }

        // Check if already authenticated
        const isAuthenticated = await page.evaluate(() => {
            return window.notesApp && window.notesApp.isAuthenticated;
        });

        if (isAuthenticated) {
            console.log('Already authenticated, skipping login...');
            return;
        }

        console.log('Logging in with test credentials...');
        await page.click('#loginBtn');
        await new Promise(resolve => setTimeout(resolve, 500));
        await page.waitForSelector('#password');
        await page.type('#password', password);
        await page.click('#loginForm button[type="submit"]');
        await new Promise(resolve => setTimeout(resolve, 1000));
    }

    async cleanupTestNotes(page) {
        console.log('Cleaning up test notes...');
        
        const response = await page.evaluate(async () => {
            try {
                const res = await fetch('/api/test-cleanup', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' }
                });
                return await res.json();
            } catch (error) {
                return { error: error.message };
            }
        });

        if (response.success) {
            console.log(`✅ Cleanup successful: ${response.message}`);
        } else {
            console.log(`⚠️ Cleanup failed:`, response.error || 'Unknown error');
        }
        
        return response;
    }

    async setupBrowser(puppeteer) {
        return await puppeteer.launch({ 
            headless: 'new',
            args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage']
        });
    }

    async createTestNote(page, title = 'Test Note', content = 'Test content') {
        // Click new note button
        await page.waitForSelector('#newNoteBtn', { visible: true });
        await page.click('#newNoteBtn');
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        // Set title
        await page.click('#noteTitle');
        await page.keyboard.down('Control');
        await page.keyboard.press('a');
        await page.keyboard.up('Control');
        await page.keyboard.type(title);
        await new Promise(resolve => setTimeout(resolve, 500));
        
        // Set content
        const editor = await page.$('#editor .cm-content');
        await editor.click();
        await page.keyboard.type(content);
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        // Mark as test note by setting is_test flag via API
        const noteId = await page.evaluate(() => {
            return window.notesApp && window.notesApp.currentNoteId;
        });
        
        if (noteId) {
            await page.evaluate(async (noteId) => {
                try {
                    const currentNote = await fetch(`/api/notes/${noteId}`).then(r => r.json());
                    currentNote.is_test = true;
                    await fetch(`/api/notes/${noteId}`, {
                        method: 'PUT',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify(currentNote)
                    });
                } catch (error) {
                    console.warn('Failed to mark note as test:', error);
                }
            }, noteId);
        }
        
        return noteId;
    }

    setupConsoleLogging(page) {
        page.on('console', msg => {
            const type = msg.type();
            const text = msg.text();
            if (type === 'log' || type === 'warn' || type === 'error') {
                console.log(`[BROWSER ${type.toUpperCase()}] ${text}`);
            }
        });
    }
}

module.exports = TestHelper;
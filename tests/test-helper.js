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
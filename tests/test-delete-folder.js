const puppeteer = require('puppeteer');
const TestHelper = require('./test-helper');

async function runTest() {
    const helper = new TestHelper();
    let browser;
    
    try {
        console.log('🧪 DELETE FOLDER TEST\n');
        
        // Launch browser
        browser = await helper.setupBrowser(puppeteer);
        const page = await browser.newPage();
        
        // Setup console logging
        helper.setupConsoleLogging(page);
        
        // Navigate to app
        await page.goto('http://localhost:3000', { 
            waitUntil: 'networkidle0'
        });
        
        // Login using TestHelper
        await helper.login(page);
        
        // Create a test folder
        console.log('Creating test folder...');
        const folderResponse = await page.evaluate(async () => {
            const response = await fetch('/api/folders', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name: 'test-delete-folder' })
            });
            return response.json();
        });
        
        if (!folderResponse.success) {
            throw new Error('Failed to create test folder: ' + JSON.stringify(folderResponse));
        }
        console.log('✅ Test folder created');
        
        // Try to delete the folder
        console.log('Attempting to delete folder...');
        const deleteResponse = await page.evaluate(async () => {
            const response = await fetch('/api/folders/test-delete-folder', {
                method: 'DELETE',
                headers: { 'Content-Type': 'application/json' }
            });
            
            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(`HTTP ${response.status}: ${errorText}`);
            }
            
            return response.json();
        });
        
        if (!deleteResponse.success) {
            throw new Error('Delete folder failed: ' + JSON.stringify(deleteResponse));
        }
        
        console.log('✅ Folder deleted successfully');
        
        // Verify folder is gone by trying to fetch folders list
        const foldersResponse = await page.evaluate(async () => {
            const response = await fetch('/api/folders');
            return response.json();
        });
        
        const folderExists = foldersResponse.folders.some(f => f.name === 'test-delete-folder');
        if (folderExists) {
            throw new Error('Folder still exists after deletion');
        }
        
        console.log('✅ Folder confirmed deleted from folders list');
        console.log('\n📊 DELETE FOLDER TEST: ✅ PASS');
        
    } catch (error) {
        console.error('\n❌ DELETE FOLDER TEST FAILED');
        console.error('Error:', error.message);
        console.log('\n📊 DELETE FOLDER TEST: ❌ FAIL');
        process.exit(1);
    } finally {
        if (browser) {
            await browser.close();
        }
    }
}

// Handle cleanup on exit
process.on('SIGINT', async () => {
    console.log('\n⚠️ Test interrupted by user');
    process.exit(1);
});

runTest().catch(error => {
    console.error('❌ Test failed with error:', error);
    process.exit(1);
});
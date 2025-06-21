const puppeteer = require('puppeteer');
const TestHelper = require('./test-helper');

async function runTest() {
    const helper = new TestHelper();
    let browser;
    
    try {
        console.log('🧪 FOLDER WITH SPACES TEST\n');
        
        browser = await helper.setupBrowser(puppeteer);
        const page = await browser.newPage();
        helper.setupConsoleLogging(page);
        
        await page.goto('http://localhost:3000', { waitUntil: 'networkidle0' });
        await helper.login(page);
        
        const folderName = 'test folder spaces';
        console.log(`Creating folder "${folderName}"...`);
        
        // Create folder
        const createResponse = await page.evaluate(async (name) => {
            const response = await fetch('/api/folders', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name: name })
            });
            return response.json();
        }, folderName);
        
        if (!createResponse.success) {
            throw new Error('Failed to create folder: ' + JSON.stringify(createResponse));
        }
        console.log('✅ Folder created');
        
        // Delete folder using frontend method
        console.log(`Deleting folder "${folderName}" via frontend...`);
        const deleteResponse = await page.evaluate(async (name) => {
            const response = await fetch(`/api/folders/${encodeURIComponent(name)}`, {
                method: 'DELETE'
            });
            
            const responseData = {
                ok: response.ok,
                status: response.status,
                statusText: response.statusText
            };
            
            if (response.ok) {
                responseData.data = await response.json();
            } else {
                responseData.error = await response.text();
            }
            
            return responseData;
        }, folderName);
        
        console.log('Delete response:', deleteResponse);
        
        if (!deleteResponse.ok) {
            throw new Error(`Delete failed: ${deleteResponse.status} - ${deleteResponse.error}`);
        }
        
        console.log('✅ Folder deleted successfully');
        console.log('\n📊 FOLDER WITH SPACES TEST: ✅ PASS');
        
    } catch (error) {
        console.error('\n❌ FOLDER WITH SPACES TEST FAILED');
        console.error('Error:', error.message);
        console.log('\n📊 FOLDER WITH SPACES TEST: ❌ FAIL');
        process.exit(1);
    } finally {
        if (browser) {
            await browser.close();
        }
    }
}

runTest().catch(error => {
    console.error('❌ Test failed with error:', error);
    process.exit(1);
});
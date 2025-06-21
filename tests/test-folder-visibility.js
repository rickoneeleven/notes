const puppeteer = require('puppeteer');
const fs = require('fs');

async function testFolderVisibility() {
    let browser;
    let testResults = [];
    
    try {
        browser = await puppeteer.launch({
            headless: true,
            args: ['--no-sandbox', '--disable-setuid-sandbox']
        });
        
        console.log('Testing folder visibility for unauthenticated users...');
        
        // Test 1: API should not return folders to unauthenticated users
        console.log('\n1. Testing API endpoint directly...');
        const page = await browser.newPage();
        
        // Test public-notes endpoint
        const publicNotesResponse = await page.goto('http://localhost:3000/api/public-notes');
        const publicNotesData = await publicNotesResponse.json();
        
        const foldersInPublicNotes = publicNotesData.filter(item => item.type === 'folder');
        if (foldersInPublicNotes.length > 0) {
            testResults.push(`❌ FAIL: /api/public-notes returned ${foldersInPublicNotes.length} folders`);
            console.log(`   Found folders: ${foldersInPublicNotes.map(f => f.name).join(', ')}`);
        } else {
            testResults.push('✅ PASS: /api/public-notes correctly excludes folders');
        }
        
        // Test 2: Frontend should not show folders to unauthenticated users
        console.log('\n2. Testing frontend visibility...');
        await page.goto('http://localhost:3000');
        await page.waitForSelector('#notesList', { timeout: 5000 });
        
        const folderElements = await page.$$('.folder');
        if (folderElements.length > 0) {
            testResults.push(`❌ FAIL: Frontend shows ${folderElements.length} folder elements to unauthenticated users`);
        } else {
            testResults.push('✅ PASS: Frontend correctly hides folders from unauthenticated users');
        }
        
        // Test 3: Incognito mode test
        console.log('\n3. Testing incognito mode...');
        const incognitoContext = await browser.createIncognitoBrowserContext();
        const incognitoPage = await incognitoContext.newPage();
        
        await incognitoPage.goto('http://localhost:3000');
        await incognitoPage.waitForSelector('#notesList', { timeout: 5000 });
        
        const incognitoFolderElements = await incognitoPage.$$('.folder');
        if (incognitoFolderElements.length > 0) {
            testResults.push(`❌ FAIL: Incognito mode shows ${incognitoFolderElements.length} folder elements`);
        } else {
            testResults.push('✅ PASS: Incognito mode correctly hides folders');
        }
        
        await incognitoContext.close();
        
    } catch (error) {
        testResults.push(`❌ ERROR: ${error.message}`);
    } finally {
        if (browser) {
            await browser.close();
        }
    }
    
    // Print results
    console.log('\n' + '='.repeat(50));
    console.log('FOLDER VISIBILITY TEST RESULTS');
    console.log('='.repeat(50));
    testResults.forEach(result => console.log(result));
    
    const failures = testResults.filter(r => r.includes('❌')).length;
    const successes = testResults.filter(r => r.includes('✅')).length;
    
    console.log(`\nSummary: ${successes} passed, ${failures} failed`);
    
    if (failures > 0) {
        process.exit(1);
    }
}

testFolderVisibility();
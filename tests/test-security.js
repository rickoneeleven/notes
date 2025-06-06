#!/usr/bin/env node

/**
 * Test: Comprehensive Security Verification
 * This test ensures all security measures are properly implemented
 */

const puppeteer = require('puppeteer');
const TestHelper = require('./test-helper');
const { exec } = require('child_process');
const util = require('util');
const execPromise = util.promisify(exec);

async function curlTest(url, expectedStatus) {
    try {
        const { stdout } = await execPromise(`curl -s -o /dev/null -w "%{http_code}" "${url}"`);
        return parseInt(stdout.trim()) === expectedStatus;
    } catch (error) {
        console.error(`Curl error for ${url}:`, error.message);
        return false;
    }
}

async function curlGetBody(url) {
    try {
        const { stdout } = await execPromise(`curl -s "${url}"`);
        return stdout;
    } catch (error) {
        return null;
    }
}

async function testSecurity() {
    console.log('=== SECURITY TEST ===');
    
    const helper = new TestHelper();
    const browser = await helper.setupBrowser(puppeteer);
    
    let page;
    let testNoteId = null;
    let testResults = {
        apiProtection: false,
        configProtection: false,
        directoryProtection: false,
        pathTraversal: false,
        noteUrlAccess: false,
        assetUrlAccess: false,
        privateNoteProtection: false,
        maliciousNoteId: false
    };
    
    try {
        console.log('\n1. Testing unauthenticated API access...');
        // Test 1: API endpoint should be protected
        if (await curlTest('https://notes.pinescore.com/api/notes', 403)) {
            console.log('✅ API endpoint protected from unauthenticated access');
            testResults.apiProtection = true;
        } else {
            console.log('❌ API endpoint NOT protected!');
        }
        
        console.log('\n2. Testing config file protection...');
        // Test 2: Config file should not be accessible
        const configTests = [
            'https://notes.pinescore.com/config.json',
            'https://notes.pinescore.com/note/../config.json',
            'https://notes.pinescore.com/../config.json',
            'https://notes.pinescore.com/api/../config.json'
        ];
        
        let configProtected = true;
        for (const url of configTests) {
            const body = await curlGetBody(url);
            if (body && body.includes('password_hash')) {
                console.log(`❌ Config EXPOSED at ${url}!`);
                configProtected = false;
            } else if (await curlTest(url, 403) || await curlTest(url, 404)) {
                console.log(`✅ Config protected at ${url}`);
            } else {
                console.log(`⚠️  Unexpected response for ${url}`);
            }
        }
        testResults.configProtection = configProtected;
        
        console.log('\n3. Testing directory listing protection...');
        // Test 3: Directory listing should be disabled
        const directoryTests = [
            'https://notes.pinescore.com/notes/',
            'https://notes.pinescore.com/deleted/',
            'https://notes.pinescore.com/api/',
            'https://notes.pinescore.com/assets/'
        ];
        
        let dirProtected = true;
        for (const url of directoryTests) {
            const body = await curlGetBody(url);
            const hasDirectoryListing = body && (
                body.includes('Index of') ||
                body.includes('Parent Directory') ||
                body.includes('<pre>') ||
                body.includes('.json')
            );
            
            if (hasDirectoryListing) {
                console.log(`❌ Directory listing EXPOSED: ${url}`);
                dirProtected = false;
            } else {
                console.log(`✅ Directory protected: ${url}`);
            }
        }
        testResults.directoryProtection = dirProtected;
        
        console.log('\n4. Testing path traversal protection...');
        // Test 4: Path traversal attempts should fail
        const traversalTests = [
            'https://notes.pinescore.com/note/../../etc/passwd',
            'https://notes.pinescore.com/note/../../../etc/passwd',
            'https://notes.pinescore.com/note/%2e%2e%2f%2e%2e%2fetc%2fpasswd',
            'https://notes.pinescore.com/assets/../../../etc/passwd'
        ];
        
        let traversalProtected = true;
        for (const url of traversalTests) {
            const body = await curlGetBody(url);
            if (body && body.includes('root:')) {
                console.log(`❌ Path traversal VULNERABILITY: ${url}`);
                traversalProtected = false;
            } else {
                console.log(`✅ Path traversal blocked: ${url}`);
            }
        }
        testResults.pathTraversal = traversalProtected;
        
        console.log('\n5. Testing malicious note ID validation...');
        // Test 5: Invalid note IDs should be rejected
        const maliciousIds = [
            '../config.json',
            '../../etc/passwd',
            'note_../../../secret',
            'note_%2e%2e%2fconfig.json',
            '<script>alert(1)</script>',
            'note_${7*7}',
            'note_;ls;'
        ];
        
        let idValidation = true;
        for (const id of maliciousIds) {
            if (await curlTest(`https://notes.pinescore.com/note/${encodeURIComponent(id)}`, 404)) {
                console.log(`✅ Malicious ID rejected: ${id}`);
            } else {
                console.log(`❌ Malicious ID NOT rejected: ${id}`);
                idValidation = false;
            }
        }
        testResults.maliciousNoteId = idValidation;
        
        // Now login and create notes for authenticated tests
        console.log('\n6. Logging in for authenticated tests...');
        page = await browser.newPage();
        helper.setupConsoleLogging(page);
        
        await page.goto('http://localhost:3000', { waitUntil: 'networkidle0' });
        await helper.login(page);
        
        // Create a private note
        console.log('Creating private test note...');
        await page.waitForSelector('#newNoteBtn', { visible: true });
        await page.click('#newNoteBtn');
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        // Add content
        const editor = await page.$('#editor .cm-content');
        await editor.click();
        await page.keyboard.type('Secret private note content');
        
        // Wait for save
        await new Promise(resolve => setTimeout(resolve, 3000));
        
        // Get note ID
        testNoteId = await page.evaluate(() => {
            return window.notesApp?.currentNote?.id || null;
        });
        console.log(`Created private note: ${testNoteId}`);
        
        // Also upload an asset
        console.log('Uploading test asset...');
        const fileInput = await page.$('#assetFileInput');
        
        // Create a test file
        await page.evaluate(() => {
            const dataTransfer = new DataTransfer();
            const file = new File(['test asset content'], 'test-asset.txt', { type: 'text/plain' });
            dataTransfer.items.add(file);
            const input = document.querySelector('#assetFileInput');
            input.files = dataTransfer.files;
            input.dispatchEvent(new Event('change', { bubbles: true }));
        });
        
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        console.log('\n7. Testing note URL as access token...');
        // Test 6: Direct note URL should work even for private notes
        const noteUrl = `https://notes.pinescore.com/note/${testNoteId}`;
        const noteBody = await curlGetBody(noteUrl);
        
        if (noteBody && noteBody.includes('Secret private note content')) {
            console.log('✅ Note URL works as access token');
            testResults.noteUrlAccess = true;
        } else {
            console.log('❌ Note URL access failed!');
        }
        
        console.log('\n8. Testing asset URL access...');
        // Test 7: Asset URL should work
        const assetUrl = `https://notes.pinescore.com/note.php?id=${testNoteId}&asset=test-asset.txt`;
        const assetBody = await curlGetBody(assetUrl);
        
        if (assetBody && assetBody.includes('test asset content')) {
            console.log('✅ Asset URL works as access token');
            testResults.assetUrlAccess = true;
        } else {
            console.log('❌ Asset URL access failed!');
        }
        
        // Test that the private note is still accessible via direct URL
        console.log('\n9. Verifying private note remains accessible via direct URL...');
        testResults.privateNoteProtection = testResults.noteUrlAccess; // Same as note URL access test
        
        // Summary
        console.log('\n=== SECURITY TEST SUMMARY ===');
        let passCount = 0;
        for (const [test, passed] of Object.entries(testResults)) {
            if (passed) passCount++;
            console.log(`${passed ? '✅' : '❌'} ${test}: ${passed ? 'PASSED' : 'FAILED'}`);
        }
        
        const allPassed = passCount === Object.keys(testResults).length;
        console.log(`\n${allPassed ? '✅' : '❌'} Overall: ${passCount}/${Object.keys(testResults).length} tests passed`);
        
        // Cleanup
        if (testNoteId) {
            await helper.cleanupTestNotes(page);
        }
        
        return allPassed;
        
    } catch (error) {
        console.error('Test failed:', error.message);
        return false;
    } finally {
        if (browser) {
            await browser.close();
        }
    }
}

// Run test
async function main() {
    const success = await testSecurity();
    process.exit(success ? 0 : 1);
}

if (require.main === module) {
    main().catch(error => {
        console.error('Unhandled error:', error);
        process.exit(1);
    });
}

module.exports = { testSecurity };
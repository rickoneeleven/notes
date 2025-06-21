#!/usr/bin/env node

const puppeteer = require('puppeteer');
const TestHelper = require('./test-helper');

async function testMoveNoteToFolder() {
    console.log('=== MOVE NOTE TO FOLDER TEST ===');
    
    const helper = new TestHelper();
    const browser = await helper.setupBrowser(puppeteer);
    const page = await browser.newPage();
    
    try {
        helper.setupConsoleLogging(page);
        
        // 1. Login
        await page.goto('http://localhost:3000', { waitUntil: 'networkidle0' });
        await helper.login(page);
        
        // 2. Create a test folder
        console.log('Creating test folder...');
        const folderName = 'Test Move Folder ' + Date.now();
        const createFolderResponse = await page.evaluate(async (name) => {
            const response = await fetch('/api/folders', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name: name })
            });
            return {
                status: response.status,
                data: await response.json()
            };
        }, folderName);
        
        if (createFolderResponse.status !== 200) {
            throw new Error(`Failed to create folder: ${createFolderResponse.status}`);
        }
        console.log('✅ Folder created');
        
        // 3. Create a test note
        console.log('Creating test note...');
        await page.click('#newNoteBtn');
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        // Type some content
        const editor = await page.$('#editor .cm-content');
        await editor.click();
        await page.keyboard.type('Test note content for moving');
        await new Promise(resolve => setTimeout(resolve, 2000)); // Wait for autosave
        
        // Get the note ID
        const noteId = await page.evaluate(() => {
            return window.notesApp?.noteStateService?.getCurrentNoteId();
        });
        
        if (!noteId) {
            throw new Error('Failed to get note ID');
        }
        console.log(`✅ Note created: ${noteId}`);
        
        // 4. Test moving note to folder via API
        console.log('Moving note to folder via API...');
        const moveResponse = await page.evaluate(async (noteId, folderName) => {
            const response = await fetch(`/api/notes/${noteId}/move`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ folderName: folderName })
            });
            return {
                status: response.status,
                data: await response.json()
            };
        }, noteId, folderName);
        
        console.log(`Move response: ${moveResponse.status}`);
        console.log('Move data:', moveResponse.data);
        
        if (moveResponse.status !== 200) {
            throw new Error(`Failed to move note: ${moveResponse.status} - ${JSON.stringify(moveResponse.data)}`);
        }
        
        // 5. Verify note is in folder
        const verifyResponse = await page.evaluate(async (noteId) => {
            const response = await fetch(`/api/notes/${noteId}`);
            return {
                status: response.status,
                data: await response.json()
            };
        }, noteId);
        
        if (verifyResponse.status !== 200) {
            throw new Error(`Failed to verify note: ${verifyResponse.status}`);
        }
        
        if (verifyResponse.data.folderName !== folderName) {
            throw new Error(`Note not in correct folder. Expected: ${folderName}, Got: ${verifyResponse.data.folderName}`);
        }
        
        console.log('✅ Note successfully moved to folder');
        
        // 6. Test moving note back to root
        console.log('Moving note back to root...');
        const moveToRootResponse = await page.evaluate(async (noteId) => {
            const response = await fetch(`/api/notes/${noteId}/move`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ folderName: null })
            });
            return {
                status: response.status,
                data: await response.json()
            };
        }, noteId);
        
        if (moveToRootResponse.status !== 200) {
            throw new Error(`Failed to move note to root: ${moveToRootResponse.status} - ${JSON.stringify(moveToRootResponse.data)}`);
        }
        
        // Verify note is back at root
        const verifyRootResponse = await page.evaluate(async (noteId) => {
            const response = await fetch(`/api/notes/${noteId}`);
            return {
                status: response.status,
                data: await response.json()
            };
        }, noteId);
        
        if (verifyRootResponse.data.folderName) {
            throw new Error(`Note should be at root but is in folder: ${verifyRootResponse.data.folderName}`);
        }
        
        console.log('✅ Note successfully moved back to root');
        
        // Cleanup
        await helper.cleanupTestNotes(page);
        await page.evaluate(async (folderName) => {
            await fetch(`/api/folders/${encodeURIComponent(folderName)}`, { method: 'DELETE' });
        }, folderName);
        
        console.log('=== MOVE NOTE TEST PASSED ===');
        return true;
        
    } catch (error) {
        console.error('=== MOVE NOTE TEST FAILED ===');
        console.error('Error:', error.message);
        return false;
    } finally {
        await browser.close();
    }
}

async function testDeleteFolder() {
    console.log('\n=== DELETE FOLDER TEST ===');
    
    const helper = new TestHelper();
    const browser = await helper.setupBrowser(puppeteer);
    const page = await browser.newPage();
    
    try {
        helper.setupConsoleLogging(page);
        
        // 1. Login
        await page.goto('http://localhost:3000', { waitUntil: 'networkidle0' });
        await helper.login(page);
        
        // 2. Create a test folder
        console.log('Creating test folder for deletion...');
        const folderName = 'Test Delete Folder ' + Date.now();
        const createResponse = await page.evaluate(async (name) => {
            const response = await fetch('/api/folders', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name: name })
            });
            return {
                status: response.status,
                data: await response.json()
            };
        }, folderName);
        
        if (createResponse.status !== 200) {
            throw new Error(`Failed to create folder: ${createResponse.status}`);
        }
        console.log('✅ Folder created for deletion test');
        
        // 3. Create a note in the folder
        console.log('Creating note in folder...');
        await page.click('#newNoteBtn');
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        const editor = await page.$('#editor .cm-content');
        await editor.click();
        await page.keyboard.type('Note in folder to be moved to root');
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        const noteId = await page.evaluate(() => {
            return window.notesApp?.noteStateService?.getCurrentNoteId();
        });
        
        // Move note to folder first
        await page.evaluate(async (noteId, folderName) => {
            await fetch(`/api/notes/${noteId}/move`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ folderName: folderName })
            });
        }, noteId, folderName);
        
        console.log('✅ Note created and moved to folder');
        
        // 4. Delete the folder
        console.log('Deleting folder...');
        const deleteResponse = await page.evaluate(async (folderName) => {
            const response = await fetch(`/api/folders/${encodeURIComponent(folderName)}`, {
                method: 'DELETE'
            });
            return {
                status: response.status,
                data: await response.json()
            };
        }, folderName);
        
        console.log(`Delete response: ${deleteResponse.status}`);
        console.log('Delete data:', deleteResponse.data);
        
        if (deleteResponse.status !== 200) {
            throw new Error(`Failed to delete folder: ${deleteResponse.status} - ${JSON.stringify(deleteResponse.data)}`);
        }
        
        // 5. Verify folder is deleted
        const verifyFolderDeleted = await page.evaluate(async () => {
            const response = await fetch('/api/folders');
            return {
                status: response.status,
                data: await response.json()
            };
        });
        
        const folderStillExists = verifyFolderDeleted.data.folders.some(f => f.name === folderName);
        if (folderStillExists) {
            throw new Error('Folder still exists after deletion');
        }
        
        console.log('✅ Folder successfully deleted');
        
        // 6. Verify note was moved to root
        const verifyNoteAtRoot = await page.evaluate(async (noteId) => {
            const response = await fetch(`/api/notes/${noteId}`);
            return {
                status: response.status,
                data: await response.json()
            };
        }, noteId);
        
        if (verifyNoteAtRoot.data.folderName) {
            throw new Error(`Note should be at root after folder deletion but is in: ${verifyNoteAtRoot.data.folderName}`);
        }
        
        console.log('✅ Note correctly moved to root after folder deletion');
        
        // Cleanup
        await helper.cleanupTestNotes(page);
        
        console.log('=== DELETE FOLDER TEST PASSED ===');
        return true;
        
    } catch (error) {
        console.error('=== DELETE FOLDER TEST FAILED ===');
        console.error('Error:', error.message);
        return false;
    } finally {
        await browser.close();
    }
}

async function runTests() {
    console.log('🧪 FOLDER OPERATIONS TESTS\n');
    
    const test1Result = await testMoveNoteToFolder();
    const test2Result = await testDeleteFolder();
    
    const allPassed = test1Result && test2Result;
    
    console.log('\n📊 RESULTS:');
    console.log(`Move Note: ${test1Result ? '✅ PASS' : '❌ FAIL'}`);
    console.log(`Delete Folder: ${test2Result ? '✅ PASS' : '❌ FAIL'}`);
    console.log(`Overall: ${allPassed ? '✅ ALL TESTS PASSED' : '❌ SOME TESTS FAILED'}`);
    
    process.exit(allPassed ? 0 : 1);
}

if (require.main === module) {
    runTests();
}

module.exports = { testMoveNoteToFolder, testDeleteFolder };
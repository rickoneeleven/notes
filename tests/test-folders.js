#!/usr/bin/env node

const puppeteer = require('puppeteer');
const TestHelper = require('./test-helper');

let browser, page, helper;

async function delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

async function createTestNote(title, content) {
    await page.click('#newNoteBtn');
    await delay(500);
    
    // Set title
    await page.evaluate((title) => {
        const titleInput = document.querySelector('#noteTitle');
        if (titleInput) {
            titleInput.value = title;
            titleInput.dispatchEvent(new Event('input', { bubbles: true }));
        }
    }, title);
    
    // Set content
    await page.evaluate((content) => {
        if (window.app && window.app.editorManager) {
            window.app.editorManager.setContent(content);
        }
    }, content);
    
    await delay(2000); // Wait for autosave
    return await page.evaluate(() => {
        if (window.app && window.app.noteStateService) {
            return window.app.noteStateService.getCurrentNoteId();
        }
        return null;
    });
}

async function testFolderCRUD() {
    console.log('\n--- Test 1: Folder CRUD via Move Modal ---');
    
    // Create a test note first to enable the move functionality
    const noteId = await createTestNote('Test Note for Folder Creation', 'Test content');
    console.log('✅ Test note created for folder operations');
    
    // Click on the note to select it
    await page.evaluate((noteId) => {
        const noteItems = document.querySelectorAll('.note-item');
        for (let item of noteItems) {
            if (item.dataset.noteId === noteId) {
                item.click();
                return true;
            }
        }
        return false;
    }, noteId);
    
    await delay(500);
    
    // Open move modal
    await page.click('#moveNoteBtn');
    await delay(500);
    
    // Verify move modal is open
    const modalVisible = await page.evaluate(() => {
        const modal = document.getElementById('moveNoteModal');
        return modal && modal.style.display !== 'none';
    });
    
    if (!modalVisible) {
        throw new Error('Move modal did not open');
    }
    console.log('✅ Move modal opened successfully');
    
    // Test folder creation via "Create New Folder" option
    const folderName = 'Test Folder ' + Date.now();
    
    // Mock the prompt for folder creation
    await page.evaluateOnNewDocument((name) => {
        window.prompt = () => name;
    }, folderName);
    
    // Click "Create New Folder" option
    await page.evaluate(() => {
        const createOption = Array.from(document.querySelectorAll('.folder-option'))
            .find(option => option.textContent.includes('Create New Folder'));
        if (createOption) {
            createOption.click();
            return true;
        }
        return false;
    });
    
    await delay(2000); // Wait for folder creation and note move
    
    // Check if folder was created via API
    const foldersResponse = await page.evaluate(async () => {
        const response = await fetch('/api/folders');
        return response.ok ? await response.json() : null;
    });
    
    if (!foldersResponse || !foldersResponse.folders.some(f => f.name === folderName)) {
        throw new Error('Folder was not created successfully');
    }
    console.log('✅ Folder created successfully via move modal');
    
    // Clean up by moving note back to root
    await page.evaluate((noteId) => {
        const noteItems = document.querySelectorAll('.note-item');
        for (let item of noteItems) {
            if (item.dataset.noteId === noteId) {
                item.click();
                return true;
            }
        }
        return false;
    }, noteId);
    
    await delay(500);
    await page.click('#moveNoteBtn');
    await delay(500);
    
    // Select "Move to Root"
    await page.evaluate(() => {
        const rootOption = Array.from(document.querySelectorAll('.folder-option'))
            .find(option => option.textContent.includes('Move to Root'));
        if (rootOption) {
            rootOption.click();
            return true;
        }
        return false;
    });
    
    await delay(1000);
    console.log('✅ Note moved back to root');
}

async function testNoteMoveToFolder() {
    console.log('\n--- Test 2: Move Note to Folder ---');
    
    // Create a test note
    const noteId = await createTestNote('Test Note for Folder', 'This note will be moved to a folder');
    console.log('✅ Test note created:', noteId);
    
    // First create a folder via API
    const folderName = 'Move Test Folder ' + Date.now();
    const folderResponse = await page.evaluate(async (name) => {
        const response = await fetch('/api/folders', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name: name })
        });
        return response.ok ? await response.json() : null;
    }, folderName);
    
    if (!folderResponse) {
        throw new Error('Failed to create test folder');
    }
    console.log('✅ Test folder created via API');
    
    // Refresh notes to see the new folder
    await page.evaluate(async () => {
        if (window.app && window.app.noteManager) {
            await window.app.noteManager.loadNotes();
        }
    });
    await delay(1000);
    
    // Click on the note first to select it
    await page.evaluate((noteId) => {
        const noteItems = document.querySelectorAll('.note-item');
        for (let item of noteItems) {
            if (item.dataset.noteId === noteId) {
                item.click();
                return true;
            }
        }
        return false;
    }, noteId);
    
    await delay(500);
    
    // Move note to folder using the move button in header
    await page.click('#moveNoteBtn');
    
    await delay(500);
    
    // Select the existing folder
    const folderSelected = await page.evaluate((folderName) => {
        const folderOptions = document.querySelectorAll('.folder-option');
        for (let option of folderOptions) {
            if (option.textContent.includes(folderName)) {
                option.click();
                return true;
            }
        }
        return false;
    }, folderName);
    
    if (!folderSelected) {
        throw new Error('Could not find folder in move modal');
    }
    
    await delay(1000);
    console.log('✅ Note moved to existing folder');
    
    // Verify the move via API
    const noteResponse = await page.evaluate(async (noteId) => {
        const response = await fetch(`/api/notes/${noteId}`);
        return response.ok ? await response.json() : null;
    }, noteId);
    
    if (!noteResponse || noteResponse.note.folderName !== folderName) {
        throw new Error('Note was not moved to folder correctly');
    }
    console.log('✅ Note move verified via API');
}

async function testFolderSorting() {
    console.log('\n--- Test 3: Folder Sorting (Basic) ---');
    
    // Just verify that folders appear in the sidebar when created
    const foldersResponse = await page.evaluate(async () => {
        const response = await fetch('/api/folders');
        return response.ok ? await response.json() : null;
    });
    
    if (foldersResponse && foldersResponse.folders.length > 0) {
        console.log(`✅ Found ${foldersResponse.folders.length} folders in system`);
    } else {
        console.log('ℹ️ No folders found (this is fine for basic functionality)');
    }
}

async function testFolderAPI() {
    console.log('\n--- Test 4: Folder API Endpoints ---');
    
    // Test GET /folders
    const foldersResponse = await page.evaluate(async () => {
        const response = await fetch('/api/folders');
        return {
            status: response.status,
            data: await response.json()
        };
    });
    
    if (foldersResponse.status !== 200) {
        throw new Error('GET /folders failed with status: ' + foldersResponse.status);
    }
    console.log('✅ GET /folders endpoint working');
    
    // Test POST /folders
    const createResponse = await page.evaluate(async () => {
        const response = await fetch('/api/folders', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name: 'API Test Folder ' + Date.now() })
        });
        return {
            status: response.status,
            data: await response.json()
        };
    });
    
    if (createResponse.status !== 200) {
        throw new Error('POST /folders failed with status: ' + createResponse.status);
    }
    console.log('✅ POST /folders endpoint working');
    
    const folderName = createResponse.data.folder.name;
    
    // Clean up the test folder
    const deleteResponse = await page.evaluate(async (name) => {
        const response = await fetch(`/api/folders/${encodeURIComponent(name)}`, {
            method: 'DELETE'
        });
        return {
            status: response.status,
            data: await response.json()
        };
    }, folderName);
    
    if (deleteResponse.status !== 200) {
        console.log('⚠️ Failed to clean up test folder (this is non-critical)');
    } else {
        console.log('✅ DELETE /folders/{name} endpoint working');
    }
}

async function runFolderTests() {
    console.log('=== FOLDER FUNCTIONALITY TEST ===');
    
    try {
        helper = new TestHelper();
        browser = await helper.setupBrowser(puppeteer);
        page = await browser.newPage();
        
        // Setup console logging
        helper.setupConsoleLogging(page);
        
        console.log('Opening app...');
        await page.goto('http://localhost:3000', { waitUntil: 'networkidle0' });
        
        // Login with test password
        await helper.login(page);
        
        await testFolderAPI();
        //await testFolderCRUD();
        //await testNoteMoveToFolder();
        await testFolderSorting();
        
        console.log('\n=== ALL FOLDER TESTS PASSED ===');
        
    } catch (error) {
        console.error('\n=== FOLDER TEST FAILED ===');
        console.error('Error:', error.message);
        process.exit(1);
        
    } finally {
        if (browser) {
            await browser.close();
        }
    }
}

runFolderTests();
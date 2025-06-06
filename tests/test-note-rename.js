#!/usr/bin/env node

/**
 * Test: Note Rename Functionality
 * This test ensures that authenticated users can rename notes
 */

const puppeteer = require('puppeteer');
const TestHelper = require('./test-helper');

async function testNoteRename() {
    console.log('=== NOTE RENAME TEST ===');
    
    const helper = new TestHelper();
    const browser = await helper.setupBrowser(puppeteer);
    
    let page;
    let testNoteId = null;
    
    try {
        page = await browser.newPage();
        helper.setupConsoleLogging(page);
        
        console.log('Opening app and logging in...');
        await page.goto('http://localhost:3000', { waitUntil: 'networkidle0' });
        await helper.login(page);
        
        // Create a new note
        console.log('Creating new note...');
        await page.waitForSelector('#newNoteBtn', { visible: true });
        await page.click('#newNoteBtn');
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        // Add content
        const editor = await page.$('#editor .cm-content');
        await editor.click();
        await page.keyboard.type('Test note content for rename test');
        
        // Wait for save
        await new Promise(resolve => setTimeout(resolve, 3000));
        
        // Get note ID and current title
        const noteInfo = await page.evaluate(() => {
            const currentNote = window.notesApp?.currentNote;
            return {
                id: currentNote?.id,
                title: currentNote?.title
            };
        });
        
        testNoteId = noteInfo.id;
        console.log(`Created note: ${testNoteId} with title: "${noteInfo.title}"`);
        
        // Now try to rename the note
        console.log('Attempting to rename note...');
        const titleInput = await page.$('#noteTitle');
        
        // Clear current title and type new one
        await titleInput.click({ clickCount: 3 }); // Triple click to select all
        await page.keyboard.type('Renamed Test Note');
        
        // Click away from title field WITHOUT modifying content (this is the bug scenario)
        console.log('Clicking away from title field without content changes...');
        await page.click('body'); // Click somewhere else to lose focus
        
        // Wait for any potential save
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        // Verify the rename
        const updatedNoteInfo = await page.evaluate(() => {
            const currentNote = window.notesApp?.currentNote;
            return {
                id: currentNote?.id,
                title: currentNote?.title
            };
        });
        
        console.log(`After rename attempt - Title: "${updatedNoteInfo.title}"`);
        
        // Check if rename was successful
        if (updatedNoteInfo.title === 'Renamed Test Note') {
            console.log('✅ SUCCESS: Note was renamed successfully!');
            
            // Double check by refreshing and loading the note again
            console.log('Refreshing page to verify rename persisted...');
            await page.reload({ waitUntil: 'networkidle0' });
            
            // Wait for notes to load
            await new Promise(resolve => setTimeout(resolve, 2000));
            
            // Find and click our renamed note
            const noteFound = await page.evaluate((noteId) => {
                const notes = window.notesApp?.notes || [];
                const note = notes.find(n => n.id === noteId);
                if (note) {
                    const noteElement = document.querySelector(`[data-note-id="${noteId}"]`);
                    if (noteElement) {
                        noteElement.click();
                        return note.title;
                    }
                }
                return null;
            }, testNoteId);
            
            if (noteFound === 'Renamed Test Note') {
                console.log('✅ VERIFIED: Rename persisted after refresh!');
                return true;
            } else {
                console.log(`❌ FAILED: After refresh, title is "${noteFound}" instead of "Renamed Test Note"`);
                return false;
            }
        } else {
            console.log('❌ FAILED: Note was not renamed');
            return false;
        }
        
    } catch (error) {
        console.error('Test error:', error.message);
        return false;
    } finally {
        // Cleanup
        if (testNoteId && page) {
            try {
                await helper.cleanupTestNotes(page);
            } catch (e) {
                console.log('Cleanup error:', e.message);
            }
        }
        
        if (browser) {
            await browser.close();
        }
    }
}

// Run test
async function main() {
    const success = await testNoteRename();
    console.log(`\n=== TEST ${success ? 'PASSED' : 'FAILED'} ===`);
    process.exit(success ? 0 : 1);
}

if (require.main === module) {
    main().catch(error => {
        console.error('Unhandled error:', error);
        process.exit(1);
    });
}

module.exports = { testNoteRename };
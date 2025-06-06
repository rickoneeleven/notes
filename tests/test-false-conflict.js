#!/usr/bin/env node

/**
 * Test: Verify No False Conflicts Between Two Sessions
 * This test ensures that two users editing the same note don't get false conflict warnings
 */

const puppeteer = require('puppeteer');
const TestHelper = require('./test-helper');

async function testFalseConflict() {
    console.log('=== FALSE CONFLICT TEST ===');
    
    const helper = new TestHelper();
    const browser = await helper.setupBrowser(puppeteer);
    
    let pc1Page, pc2Page;
    let testNoteId = null;
    let conflictDetected = false;
    
    try {
        // === Setup PC1 ===
        pc1Page = await browser.newPage();
        helper.setupConsoleLogging(pc1Page);
        
        // Monitor for conflicts on PC1
        pc1Page.on('console', msg => {
            const text = msg.text();
            if (text.includes('conflict') || text.includes('Conflict')) {
                console.log('🚨 CONFLICT DETECTED:', text);
                conflictDetected = true;
            }
        });
        
        console.log('PC1: Opening app...');
        await pc1Page.goto('http://localhost:3000', { waitUntil: 'networkidle0' });
        
        console.log('PC1: Logging in...');
        await helper.login(pc1Page);
        
        console.log('PC1: Creating test note...');
        await pc1Page.waitForSelector('#newNoteBtn', { visible: true });
        await pc1Page.click('#newNoteBtn');
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        // Set title
        await pc1Page.type('#noteTitle', 'CONFLICT-TEST');
        
        // Add content
        const editor = await pc1Page.$('#editor .cm-content');
        await editor.click();
        await pc1Page.keyboard.type('Initial test content');
        
        // Wait for save
        await new Promise(resolve => setTimeout(resolve, 3000));
        
        // Get note ID
        testNoteId = await pc1Page.evaluate(() => {
            return window.notesApp?.currentNote?.id || null;
        });
        
        console.log(`✓ PC1 created note: ${testNoteId}`);
        
        // === Setup PC2 ===
        pc2Page = await browser.newPage();
        helper.setupConsoleLogging(pc2Page);
        
        console.log('PC2: Opening app...');
        await pc2Page.goto('http://localhost:3000', { waitUntil: 'networkidle0' });
        
        console.log('PC2: Logging in...');
        await helper.login(pc2Page);
        
        console.log('PC2: Opening same note...');
        
        // Wait for PC2 to see the note via polling
        console.log('PC2: Waiting for note list to update...');
        try {
            await pc2Page.waitForFunction(
                (targetNoteId) => {
                    return window.notesApp?.notes?.some(n => n.id === targetNoteId);
                },
                { timeout: 15000 },
                testNoteId
            );
            console.log('PC2: Note found in list!');
        } catch (error) {
            console.error('PC2: Timeout waiting for note list update:', error.message);
            
            // Debug: check what notes PC2 currently has
            const pc2Notes = await pc2Page.evaluate(() => {
                return window.notesApp?.notes?.map(n => ({ id: n.id, title: n.title })) || [];
            });
            console.log('PC2: Current notes:', pc2Notes);
            throw error;
        }
        
        // Find and open the test note using proper note object
        const opened = await pc2Page.evaluate(async (targetNoteId) => {
            const app = window.notesApp;
            if (!app || !app.notes) {
                console.error('[PC2 Eval] notesApp or notesApp.notes not available on PC2.');
                return false;
            }

            const noteToSelect = app.notes.find(n => n.id === targetNoteId);
            if (noteToSelect) {
                console.log(`[PC2 Eval] Found note to select:`, noteToSelect.title);
                app.selectNote(noteToSelect); // Pass the full note object
                return true;
            } else {
                console.error(`[PC2 Eval] Note with ID ${targetNoteId} not found in app.notes list on PC2.`);
                console.log('[PC2 Eval] PC2 available notes IDs:', app.notes.map(n => n.id));
                return false;
            }
        }, testNoteId);
        
        if (!opened) {
            throw new Error('PC2 could not find test note');
        }
        
        await new Promise(resolve => setTimeout(resolve, 1000));
        console.log('✓ PC2 opened the same note');
        
        // === Test conflict scenario ===
        console.log('\n=== TESTING CONFLICT SCENARIO ===');
        
        for (let i = 1; i <= 6 && !conflictDetected; i++) {
            console.log(`Edit ${i}: PC1 adding content...`);
            
            // PC1 adds content
            await pc1Page.evaluate((editNum) => {
                const app = window.notesApp;
                if (app?.editorManager) {
                    const current = app.editorManager.getContent();
                    app.editorManager.setContent(current + `\nEdit ${editNum} from PC1`);
                }
            }, i);
            
            // Wait for autosave
            await new Promise(resolve => setTimeout(resolve, 2000));
            
            // Wait for PC2 polling
            console.log(`  Waiting for PC2 to receive update...`);
            await new Promise(resolve => setTimeout(resolve, 3000));
            
            if (conflictDetected) {
                console.log(`❌ FALSE CONFLICT DETECTED after ${i} edits!`);
                return false; // Test fails if false conflict is detected
            }
        }
        
        console.log('✅ No false conflicts detected - test passed!');
        return true; // Test passes if no false conflicts
        
    } catch (error) {
        console.error('Test failed:', error.message);
        return false;
    } finally {
        // Cleanup
        if (testNoteId && pc1Page) {
            try {
                await helper.cleanupTestNotes(pc1Page);
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
    const success = await testFalseConflict();
    process.exit(success ? 0 : 1);
}

if (require.main === module) {
    main().catch(error => {
        console.error('Unhandled error:', error);
        process.exit(1);
    });
}

module.exports = { testFalseConflict };
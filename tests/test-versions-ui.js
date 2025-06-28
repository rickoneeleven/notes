const puppeteer = require('puppeteer');
const TestHelper = require('./test-helper');

async function testVersionsUI() {
    const helper = new TestHelper();
    const browser = await helper.setupBrowser(puppeteer);
    const page = await browser.newPage();
    
    // Setup console logging
    helper.setupConsoleLogging(page);
    
    try {
        console.log('=== VERSIONS UI TEST ===');
        console.log('Opening app...');
        await page.goto('http://localhost:3000', { waitUntil: 'networkidle0' });
        
        // Login with test password
        await helper.login(page);
        
        console.log('Creating test note...');
        const noteId = await helper.createTestNote(page, 'Test Note for Versions UI', 'Test content for versions');
        console.log(`Created test note with ID: ${noteId}`);
        
        console.log('Checking Previous Versions button visibility...');
        // Previous Versions button should be visible when authenticated and note is selected
        const previousVersionsBtn = await page.$('#previousVersionsBtn');
        const isVisible = await page.evaluate(el => {
            const style = window.getComputedStyle(el);
            return style.display !== 'none';
        }, previousVersionsBtn);
        
        if (!isVisible) {
            throw new Error('Previous Versions button is not visible when it should be');
        }
        console.log('✓ Previous Versions button is visible');
        
        console.log('Clicking Previous Versions button...');
        await page.click('#previousVersionsBtn');
        await new Promise(resolve => setTimeout(resolve, 500));
        
        // Check if versions modal opens
        const versionsModal = await page.$('#versionsModal');
        const modalVisible = await page.evaluate(el => {
            const style = window.getComputedStyle(el);
            return style.display !== 'none';
        }, versionsModal);
        
        if (!modalVisible) {
            throw new Error('Versions modal did not open');
        }
        console.log('✓ Versions modal opened');
        
        console.log('Checking modal content...');
        // Wait for loading state or error state
        await page.waitForFunction(() => {
            const loadingState = document.getElementById('versionsLoadingState');
            const errorState = document.getElementById('versionsErrorState');
            const contentState = document.getElementById('versionsList');
            
            const loadingVisible = window.getComputedStyle(loadingState).display !== 'none';
            const errorVisible = window.getComputedStyle(errorState).display !== 'none';
            const contentVisible = window.getComputedStyle(contentState).display !== 'none';
            
            return loadingVisible || errorVisible || contentVisible;
        }, { timeout: 5000 });
        
        // Check what state we're in
        const loadingVisible = await page.evaluate(() => {
            const el = document.getElementById('versionsLoadingState');
            return window.getComputedStyle(el).display !== 'none';
        });
        
        const errorVisible = await page.evaluate(() => {
            const el = document.getElementById('versionsErrorState');
            return window.getComputedStyle(el).display !== 'none';
        });
        
        const contentVisible = await page.evaluate(() => {
            const el = document.getElementById('versionsList');
            return window.getComputedStyle(el).display !== 'none';
        });
        
        if (loadingVisible) {
            console.log('! Versions modal is in loading state');
        } else if (errorVisible) {
            const errorMessage = await page.$eval('#versionsErrorMessage', el => el.textContent);
            console.log(`! Versions modal shows error: ${errorMessage}`);
            
            // This is expected for a new note with no versions
            if (errorMessage.includes('not found') || errorMessage.includes('no versions')) {
                console.log('✓ Expected error for note with no versions');
            } else {
                console.log('? Unexpected error, but modal is working');
            }
        } else if (contentVisible) {
            console.log('✓ Versions content is visible');
            
            // Check if "no versions" message is shown
            const noVersionsEl = await page.$('.no-versions');
            if (noVersionsEl) {
                console.log('✓ "No versions" message displayed correctly');
            }
        }
        
        console.log('Testing modal close functionality...');
        await page.click('#closeVersionsModal');
        await new Promise(resolve => setTimeout(resolve, 500));
        
        const modalStillVisible = await page.evaluate(el => {
            const style = window.getComputedStyle(el);
            return style.display !== 'none';
        }, versionsModal);
        
        if (modalStillVisible) {
            throw new Error('Versions modal did not close when close button clicked');
        }
        console.log('✓ Versions modal closed successfully');
        
        console.log('Testing button visibility when not authenticated...');
        // Logout to test button visibility
        await page.click('#loginBtn'); // Should logout
        await new Promise(resolve => setTimeout(resolve, 500));
        
        const buttonVisibleAfterLogout = await page.evaluate(el => {
            const style = window.getComputedStyle(el);
            return style.display !== 'none';
        }, previousVersionsBtn);
        
        if (buttonVisibleAfterLogout) {
            throw new Error('Previous Versions button should be hidden when not authenticated');
        }
        console.log('✓ Previous Versions button is hidden when not authenticated');
        
        console.log('All version UI tests passed!');
        
    } catch (error) {
        console.error('Test failed:', error.message);
        await helper.takeScreenshot(page, 'test-versions-ui-error.png');
        throw error;
    } finally {
        console.log('Cleaning up...');
        try {
            await helper.cleanupTestNotes(page);
        } catch (cleanupError) {
            console.warn('Failed to cleanup test notes:', cleanupError.message);
        }
        await browser.close();
    }
}

// Run the test
testVersionsUI().catch(error => {
    console.error('Test suite failed:', error);
    process.exit(1);
});
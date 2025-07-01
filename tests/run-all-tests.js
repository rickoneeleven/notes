#!/usr/bin/env node

const { spawn, exec } = require('child_process');
const path = require('path');
const fs = require('fs');

function discoverTests() {
    const excludedTests = ['test-runner.js', 'test-helper.js'];
    const testFiles = fs.readdirSync(__dirname)
        .filter(file => file.startsWith('test-') && file.endsWith('.js'))
        .filter(file => !excludedTests.includes(file))
        .sort();
    
    console.log(`Discovered ${testFiles.length} test files:`);
    testFiles.forEach(file => console.log(`  - ${file}`));
    console.log('');
    
    return testFiles;
}

const results = {
    passed: [],
    failed: [],
    startTime: new Date()
};

let devServer = null;

function startDevServer() {
    return new Promise((resolve, reject) => {
        console.log('Starting dev server...');
        devServer = spawn('npm', ['run', 'dev'], {
            cwd: path.join(__dirname, '..'),
            stdio: 'pipe'
        });

        let serverReady = false;
        
        devServer.stdout.on('data', (data) => {
            const output = data.toString();
            if (output.includes('ready in') && !serverReady) {
                serverReady = true;
                console.log('Dev server is ready!');
                console.log('Waiting additional 5 seconds for server stability...\n');
                setTimeout(resolve, 5000);
            }
        });

        devServer.stderr.on('data', (data) => {
            const error = data.toString();
            if (!error.includes('VITE') && !error.includes('warning')) {
                console.error('Dev server error:', error);
            }
        });

        devServer.on('error', reject);
        
        setTimeout(() => {
            if (!serverReady) {
                reject(new Error('Dev server failed to start within timeout'));
            }
        }, 30000);
        
    });
}

function stopDevServer() {
    return new Promise((resolve) => {
        console.log('\nStopping dev server...');
        
        if (devServer) {
            devServer.kill('SIGTERM');
            setTimeout(() => {
                if (!devServer.killed) {
                    devServer.kill('SIGKILL');
                }
            }, 5000);
        }
        
        exec('pkill -f "vite"', (error) => {
            console.log('Dev server stopped');
            resolve();
        });
    });
}

function runTest(testFile) {
    return new Promise((resolve) => {
        console.log(`\n${'='.repeat(60)}`);
        console.log(`Running: ${testFile}`);
        console.log(`${'='.repeat(60)}`);
        
        const testPath = path.join(__dirname, testFile);
        const startTime = Date.now();
        
        const testProcess = spawn('node', [testPath], {
            cwd: __dirname,
            stdio: 'inherit'
        });

        testProcess.on('close', (code) => {
            const duration = ((Date.now() - startTime) / 1000).toFixed(2);
            const status = code === 0 ? 'PASSED' : 'FAILED';
            
            console.log(`\nTest ${testFile}: ${status} (${duration}s)`);
            
            if (code === 0) {
                results.passed.push({ test: testFile, duration });
            } else {
                results.failed.push({ test: testFile, duration, exitCode: code });
            }
            
            resolve();
        });

        testProcess.on('error', (error) => {
            console.error(`Error running ${testFile}:`, error);
            results.failed.push({ test: testFile, duration: 0, error: error.message });
            resolve();
        });
    });
}

function printSummary() {
    const totalDuration = ((Date.now() - results.startTime.getTime()) / 1000).toFixed(2);
    const totalTests = results.passed.length + results.failed.length;
    const passRate = totalTests > 0 ? ((results.passed.length / totalTests) * 100).toFixed(1) : 0;
    
    console.log('\n' + '='.repeat(60));
    console.log('TEST SUMMARY');
    console.log('='.repeat(60));
    console.log(`Total Tests: ${totalTests}`);
    console.log(`Passed: ${results.passed.length} (${passRate}%)`);
    console.log(`Failed: ${results.failed.length}`);
    console.log(`Total Duration: ${totalDuration}s`);
    console.log(`Completed at: ${new Date().toLocaleString()}`);
    
    if (results.passed.length > 0) {
        console.log('\nPASSED TESTS:');
        results.passed.forEach(({ test, duration }) => {
            console.log(`  ✓ ${test} (${duration}s)`);
        });
    }
    
    if (results.failed.length > 0) {
        console.log('\nFAILED TESTS:');
        results.failed.forEach(({ test, duration, exitCode, error }) => {
            const details = error ? `Error: ${error}` : `Exit code: ${exitCode}`;
            console.log(`  ✗ ${test} (${duration}s) - ${details}`);
        });
    }
    
    console.log('\n' + '='.repeat(60));
    console.log(`FINAL RESULT: ${results.failed.length === 0 ? 'ALL TESTS PASSED! ✓' : 'SOME TESTS FAILED! ✗'}`);
    console.log('='.repeat(60));
    
    const summaryFile = path.join(__dirname, 'test-summary.txt');
    const summaryContent = `Test Run Summary - ${new Date().toLocaleString()}
${'='.repeat(60)}
Total Tests: ${totalTests}
Passed: ${results.passed.length} (${passRate}%)
Failed: ${results.failed.length}
Total Duration: ${totalDuration}s

PASSED TESTS:
${results.passed.map(({ test, duration }) => `  ✓ ${test} (${duration}s)`).join('\n')}

FAILED TESTS:
${results.failed.length > 0 ? results.failed.map(({ test, duration, exitCode, error }) => {
    const details = error ? `Error: ${error}` : `Exit code: ${exitCode}`;
    return `  ✗ ${test} (${duration}s) - ${details}`;
}).join('\n') : '  None'}

FINAL RESULT: ${results.failed.length === 0 ? 'ALL TESTS PASSED! ✓' : 'SOME TESTS FAILED! ✗'}
`;
    
    fs.writeFileSync(summaryFile, summaryContent);
    console.log(`\nSummary saved to: ${summaryFile}`);
}

async function runAllTests() {
    console.log('Starting test suite execution...');
    
    const tests = discoverTests();
    
    if (tests.length === 0) {
        console.log('No test files found!');
        process.exit(1);
    }
    
    try {
        await startDevServer();
        
        for (const test of tests) {
            await runTest(test);
            console.log('Waiting 3 seconds between tests for stability...');
            await new Promise(resolve => setTimeout(resolve, 3000));
        }
        
    } catch (error) {
        console.error('Fatal error:', error);
        results.failed.push({ test: 'Setup', duration: 0, error: error.message });
    } finally {
        await stopDevServer();
        printSummary();
        process.exit(results.failed.length > 0 ? 1 : 0);
    }
}

process.on('SIGINT', async () => {
    console.log('\n\nTest run interrupted by user');
    await stopDevServer();
    printSummary();
    process.exit(1);
});

runAllTests();
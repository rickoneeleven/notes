#!/usr/bin/env node

/**
 * Parallel Test Runner
 * Runs all tests in parallel with proper timeout handling and reporting
 */

const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

const TEST_TIMEOUT = 300000; // 5 minutes per test
const MAX_CONCURRENT = 3; // Limit concurrent tests to avoid resource exhaustion

// Tests that must run in isolation due to resource contention
const ISOLATED_TESTS = [
    'test-fast-click-away.js',
    'test-patient-save.js',
    'test-security.js',
    'test-folders.js',
    'test-idle-state.js',
    'test-note-rename.js',
    'test-simple-save.js'
];

async function runTestWithTimeout(testFile, timeout = TEST_TIMEOUT) {
    return new Promise((resolve) => {
        const startTime = Date.now();
        console.log(`🚀 Starting ${path.basename(testFile)}...`);
        
        const child = spawn('node', [testFile], {
            stdio: 'pipe',
            cwd: path.dirname(testFile)
        });
        
        let output = '';
        let errorOutput = '';
        let timeoutId;
        let resolved = false;
        
        // Set up timeout
        timeoutId = setTimeout(() => {
            if (!resolved) {
                resolved = true;
                child.kill('SIGKILL');
                const duration = Date.now() - startTime;
                resolve({
                    testFile,
                    success: false,
                    output: `❌ TIMEOUT after ${(duration/1000).toFixed(1)}s`,
                    error: `Test timed out after ${timeout}ms`,
                    duration
                });
            }
        }, timeout);
        
        // Collect output
        child.stdout.on('data', (data) => {
            output += data.toString();
        });
        
        child.stderr.on('data', (data) => {
            errorOutput += data.toString();
        });
        
        // Handle completion
        child.on('close', (code) => {
            if (!resolved) {
                resolved = true;
                clearTimeout(timeoutId);
                const duration = Date.now() - startTime;
                
                const success = code === 0;
                const statusIcon = success ? '✅' : '❌';
                const status = success ? 'PASSED' : 'FAILED';
                
                resolve({
                    testFile,
                    success,
                    output: `${statusIcon} ${path.basename(testFile)} ${status} (${(duration/1000).toFixed(1)}s)`,
                    error: errorOutput,
                    duration,
                    fullOutput: output
                });
            }
        });
        
        child.on('error', (err) => {
            if (!resolved) {
                resolved = true;
                clearTimeout(timeoutId);
                const duration = Date.now() - startTime;
                resolve({
                    testFile,
                    success: false,
                    output: `❌ ${path.basename(testFile)} ERROR (${(duration/1000).toFixed(1)}s)`,
                    error: err.message,
                    duration
                });
            }
        });
    });
}

async function runTestsInBatches(testFiles, batchSize = MAX_CONCURRENT) {
    const results = [];
    
    for (let i = 0; i < testFiles.length; i += batchSize) {
        const batch = testFiles.slice(i, i + batchSize);
        console.log(`\n📦 Running batch ${Math.floor(i/batchSize) + 1}/${Math.ceil(testFiles.length/batchSize)} (${batch.length} tests)...`);
        
        const batchPromises = batch.map(testFile => runTestWithTimeout(testFile));
        const batchResults = await Promise.all(batchPromises);
        
        // Print results for this batch
        batchResults.forEach(result => {
            console.log(result.output);
            if (!result.success && result.error) {
                console.log(`   Error: ${result.error}`);
            }
        });
        
        results.push(...batchResults);
    }
    
    return results;
}

async function main() {
    console.log('🧪 Notes App Test Suite - Parallel Runner\n');
    
    // Find all test files
    const testsDir = path.join(__dirname);
    const allFiles = fs.readdirSync(testsDir)
        .filter(file => file.startsWith('test-') && file.endsWith('.js') && 
                file !== 'test-helper.js' && file !== 'test-runner.js')
        .map(file => path.join(testsDir, file));
    
    if (allFiles.length === 0) {
        console.log('❌ No test files found');
        process.exit(1);
    }
    
    // Separate isolated tests from parallel tests
    const isolatedFiles = allFiles.filter(file => 
        ISOLATED_TESTS.includes(path.basename(file)));
    const parallelFiles = allFiles.filter(file => 
        !ISOLATED_TESTS.includes(path.basename(file)));
    
    console.log(`Found ${allFiles.length} test files:`);
    if (parallelFiles.length > 0) {
        console.log(`\n📦 Parallel tests (${parallelFiles.length}):`);
        parallelFiles.forEach(file => console.log(`  - ${path.basename(file)}`));
    }
    if (isolatedFiles.length > 0) {
        console.log(`\n🔒 Isolated tests (${isolatedFiles.length}):`);
        isolatedFiles.forEach(file => console.log(`  - ${path.basename(file)}`));
    }
    
    const startTime = Date.now();
    let allResults = [];
    
    // Run parallel tests first
    if (parallelFiles.length > 0) {
        console.log('\n🏃 Running parallel tests...');
        const parallelResults = await runTestsInBatches(parallelFiles);
        allResults.push(...parallelResults);
    }
    
    // Run isolated tests one by one
    if (isolatedFiles.length > 0) {
        console.log('\n🔒 Running isolated tests...');
        for (const testFile of isolatedFiles) {
            console.log(`\n📦 Running isolated test: ${path.basename(testFile)}...`);
            const result = await runTestWithTimeout(testFile);
            console.log(result.output);
            if (!result.success && result.error) {
                console.log(`   Error: ${result.error}`);
            }
            allResults.push(result);
        }
    }
    
    const totalTime = Date.now() - startTime;
    const results = allResults;
    
    // Summary
    const passed = results.filter(r => r.success).length;
    const failed = results.filter(r => !r.success).length;
    const totalTests = results.length;
    
    console.log('\n' + '='.repeat(60));
    console.log('📊 TEST SUMMARY');
    console.log('='.repeat(60));
    console.log(`Total Tests: ${totalTests}`);
    console.log(`✅ Passed: ${passed}`);
    console.log(`❌ Failed: ${failed}`);
    console.log(`⏱️  Total Time: ${(totalTime/1000).toFixed(1)}s`);
    console.log(`⚡ Average: ${(totalTime/totalTests/1000).toFixed(1)}s per test`);
    
    if (failed > 0) {
        console.log('\n❌ FAILED TESTS:');
        results.filter(r => !r.success).forEach(result => {
            console.log(`\n📁 ${path.basename(result.testFile)}:`);
            if (result.error) {
                console.log(`   Error: ${result.error}`);
            }
            if (result.fullOutput && result.fullOutput.length > 0) {
                console.log('   Output:');
                console.log(result.fullOutput.split('\n').map(line => `     ${line}`).join('\n'));
            }
        });
    }
    
    console.log('='.repeat(60));
    
    // Exit with appropriate code
    process.exit(failed > 0 ? 1 : 0);
}

// Handle graceful shutdown
process.on('SIGINT', () => {
    console.log('\n⚠️  Test runner interrupted');
    process.exit(1);
});

process.on('SIGTERM', () => {
    console.log('\n⚠️  Test runner terminated');
    process.exit(1);
});

if (require.main === module) {
    main().catch(error => {
        console.error('❌ Test runner error:', error);
        process.exit(1);
    });
}

module.exports = { runTestWithTimeout, runTestsInBatches };
<?php
// Setup script for dual password system (user + test)
// Usage: php setup-dual-password.php

echo "Setting up dual password authentication system...\n\n";

// Set user password
echo "Enter user password: ";
$userPassword = trim(fgets(STDIN));
while (empty($userPassword)) {
    echo "Password cannot be empty. Please enter a password: ";
    $userPassword = trim(fgets(STDIN));
}

// Generate random test password
$testPassword = bin2hex(random_bytes(16)); // 32 character hex string
echo "Generated test password: $testPassword\n";

// Hash both passwords
$userHash = password_hash($userPassword, PASSWORD_DEFAULT);
$testHash = password_hash($testPassword, PASSWORD_DEFAULT);

// Load existing config
$configPath = __DIR__ . '/config.json';
$config = json_decode(file_get_contents($configPath), true);

// Update config with dual password system
$config['password_hash'] = $userHash; // Keep for backward compatibility
$config['auth'] = [
    'user_password_hash' => $userHash,
    'test_password_hash' => $testHash,
    'test_password' => $testPassword // Store plaintext for test scripts
];

// Save updated config
file_put_contents($configPath, json_encode($config, JSON_PRETTY_PRINT));

// Create test password file for test scripts
$testPasswordFile = __DIR__ . '/../tests/test-password.txt';
file_put_contents($testPasswordFile, $testPassword);

echo "\nDual password system configured successfully!\n";
echo "User password: " . str_repeat('*', strlen($userPassword)) . "\n";
echo "Test password: $testPassword (saved to tests/test-password.txt)\n";
?>
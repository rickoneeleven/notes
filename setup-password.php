<?php
// Run this script from command line to set your password
// Usage: php setup-password.php

echo "Enter password: ";
$password = trim(fgets(STDIN));

$hash = password_hash($password, PASSWORD_DEFAULT);

$configPath = __DIR__ . '/config.json';
$config = json_decode(file_get_contents($configPath), true);
$config['password_hash'] = $hash;

file_put_contents($configPath, json_encode($config, JSON_PRETTY_PRINT));

echo "Password updated successfully!\n";
?>
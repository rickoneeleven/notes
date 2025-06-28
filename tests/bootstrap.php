<?php

require_once __DIR__ . '/../vendor/autoload.php';

define('TESTS_ROOT', __DIR__);
define('PROJECT_ROOT', dirname(__DIR__));
define('API_ROOT', PROJECT_ROOT . '/static_server_files/api');
define('NOTES_ROOT', PROJECT_ROOT . '/notes');
define('TEST_NOTES_ROOT', TESTS_ROOT . '/fixtures/notes');

function loadTestUtilities() {
    require_once TESTS_ROOT . '/backend/BaseTestCase.php';
    require_once TESTS_ROOT . '/backend/utilities/MockFilesystem.php';
    require_once TESTS_ROOT . '/backend/utilities/TestHelper.php';
}

loadTestUtilities();

ini_set('memory_limit', '512M');
date_default_timezone_set('UTC');
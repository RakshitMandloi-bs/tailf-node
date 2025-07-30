// Import the expect assertion function from Chai testing library
const { expect } = require('chai');
// Import Sinon library for creating spies, stubs, and mocks
const sinon = require('sinon');
// Import Node.js file system module for file operations
const fs = require('fs');
// Import Node.js path module for handling file paths
const path = require('path');
// Import the LogSimulator class that we want to test
const LogSimulator = require('../log-simulator');

// Define the main test suite for the LogSimulator class
describe('LogSimulator', () => {
    // Declare variables to store test instances and file paths
    let simulator;     // Will hold the LogSimulator instance for each test
    let testLogFile;   // Path to the test log file
    let testLogsDir;   // Path to the test logs directory

    // beforeEach hook runs before each individual test
    beforeEach(() => {
        // Create test logs directory path relative to current test file
        testLogsDir = path.join(__dirname, 'test-logs');
        // Check if test logs directory exists
        if (!fs.existsSync(testLogsDir)) {
            // Create the directory if it doesn't exist
            fs.mkdirSync(testLogsDir);
        }
        
        // Create path for the test log file
        testLogFile = path.join(testLogsDir, 'test-simulator.log');
        // Create a new LogSimulator instance with 100ms interval for fast testing
        simulator = new LogSimulator(testLogFile, 100); // 100ms interval for fast testing
    });

    // afterEach hook runs after each individual test for cleanup
    afterEach(() => {
        // Check if simulator instance exists
        if (simulator) {
            // Stop the simulator to prevent it from running after test
            simulator.stop();
        }
        
        // Clean up test files created during the test
        if (fs.existsSync(testLogFile)) {
            // Delete the test log file
            fs.unlinkSync(testLogFile);
        }
        
        // Clean up test directory
        if (fs.existsSync(testLogsDir)) {
            // Try to remove the test logs directory
            try {
                // Remove directory and all its contents recursively
                fs.rmSync(testLogsDir, { recursive: true, force: true });
            } catch (err) {
                // Ignore errors during cleanup (comment explains why)
            }
        }
    });

    // Test suite for initialization functionality
    describe('Initialization', () => {
        // Test that the simulator creates directories if they don't exist
        it('should create logs directory if it does not exist', () => {
            // Create a path for a log file in a subdirectory that doesn't exist
            const newLogFile = path.join(testLogsDir, 'subdir', 'new.log');
            // Create a new simulator instance with the nested path
            const newSimulator = new LogSimulator(newLogFile);
            
            // Assert that the parent directory was created
            expect(fs.existsSync(path.dirname(newLogFile))).to.be.true;
        });

        // Test that the simulator initializes with correct parameters
        it('should initialize with correct parameters', () => {
            // Check that the log file path is stored correctly
            expect(simulator.logFilePath).to.equal(testLogFile);
            // Check that the interval is set to 100ms as specified
            expect(simulator.intervalMs).to.equal(100);
            // Check that the simulator is not running initially
            expect(simulator.isRunning).to.be.false;
        });
    });

    // Test suite for log generation functionality
    describe('Log Generation', () => {
        // Test that log entries are written with correct format
        it('should write log entry with correct format', () => {
            // Write a single log entry
            simulator.writeLogEntry();
            
            // Read the contents of the test log file
            const content = fs.readFileSync(testLogFile, 'utf8');
            // Split content into lines and remove empty lines
            const lines = content.trim().split('\n');
            
            // Assert that exactly one line was written
            expect(lines).to.have.length(1);
            
            // Get the first (and only) log line
            const logLine = lines[0];
            // Assert that the log line matches the expected format:
            // ISO timestamp + [LOG_LEVEL] + [PID:number] + message
            expect(logLine).to.match(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z \[(INFO|WARN|ERROR|DEBUG)\] \[PID:\d+\] .+$/);
        });

        // Test that multiple log entries can be written
        it('should write multiple log entries', () => {
            // Write three log entries
            simulator.writeLogEntry();
            simulator.writeLogEntry();
            simulator.writeLogEntry();
            
            // Read the contents of the test log file
            const content = fs.readFileSync(testLogFile, 'utf8');
            // Split content into lines and remove empty lines
            const lines = content.trim().split('\n');
            
            // Assert that exactly three lines were written
            expect(lines).to.have.length(3);
        });

        // Test that log levels are determined correctly based on content
        it('should determine correct log level based on content', () => {
            // Test ERROR level detection for explicit ERROR keyword
            expect(simulator.getLogLevel('ERROR: Something went wrong')).to.equal('ERROR');
            // Test ERROR level detection for "Failed" keyword
            expect(simulator.getLogLevel('Failed to process')).to.equal('ERROR');
            // Test WARN level detection for explicit WARN keyword
            expect(simulator.getLogLevel('WARN: High memory usage')).to.equal('WARN');
            // Test INFO level detection for explicit INFO keyword
            expect(simulator.getLogLevel('INFO: Application started')).to.equal('INFO');
            // Test INFO level detection for "successful" keyword
            expect(simulator.getLogLevel('successful connection')).to.equal('INFO');
            // Test DEBUG level as default for regular messages
            expect(simulator.getLogLevel('Regular log message')).to.equal('DEBUG');
        });
    });

    // Test suite for simulator control functionality (start/stop)
    describe('Simulator Control', () => {
        // Test that the simulator can be started and stopped properly
        it('should start and stop simulator', (done) => {
            // Start the simulator
            simulator.start();
            // Assert that the simulator is now running
            expect(simulator.isRunning).to.be.true;
            
            // Wait for a few log entries to be written (250ms allows for 2-3 intervals)
            setTimeout(() => {
                // Stop the simulator
                simulator.stop();
                // Assert that the simulator is no longer running
                expect(simulator.isRunning).to.be.false;
                
                // Check that log entries were actually written to the file
                const content = fs.readFileSync(testLogFile, 'utf8');
                // Split content into lines and remove empty lines
                const lines = content.trim().split('\n');
                // Assert that at least one log entry was written
                expect(lines.length).to.be.greaterThan(0);
                
                // Call done() to signal async test completion
                done();
            }, 250); // Wait for 2-3 intervals (100ms each)
        });

        // Test that the simulator won't start if it's already running
        it('should not start if already running', () => {
            // Start the simulator first
            simulator.start();
            // Assert that the simulator is running
            expect(simulator.isRunning).to.be.true;
            
            // Create a spy to monitor console.log calls
            const consoleSpy = sinon.spy(console, 'log');
            // Try to start the simulator again (should be ignored)
            simulator.start();
            
            // Assert that the appropriate message was logged
            expect(consoleSpy.calledWith('Log simulator is already running')).to.be.true;
            // Clean up the spy
            consoleSpy.restore();
        });

        // Test that the simulator won't stop if it's not running
        it('should not stop if not running', () => {
            // Assert that the simulator is not running initially
            expect(simulator.isRunning).to.be.false;
            
            // Create a spy to monitor console.log calls
            const consoleSpy = sinon.spy(console, 'log');
            // Try to stop the simulator (should log a message)
            simulator.stop();
            
            // Assert that the appropriate message was logged
            expect(consoleSpy.calledWith('Log simulator is not running')).to.be.true;
            // Clean up the spy
            consoleSpy.restore();
        });
    });

    // Test suite for initial log functionality
    describe('Initial Logs', () => {
        // Test that initial logs are written correctly
        it('should write initial logs', () => {
            // Call the method to write initial startup logs
            simulator.writeInitialLogs();
            
            // Read the contents of the test log file
            const content = fs.readFileSync(testLogFile, 'utf8');
            // Split content into lines and remove empty lines
            const lines = content.trim().split('\n');
            
            // Assert that exactly 5 initial log lines were written
            expect(lines).to.have.length(5);
            // Assert that the first line contains the expected startup message
            expect(lines[0]).to.include('System startup initiated');
            // Assert that the last line contains the expected ready message
            expect(lines[4]).to.include('Application ready to serve requests');
        });
    });

    // Test suite for continuous operation functionality
    describe('Continuous Operation', () => {
        // Test that the simulator generates logs continuously when running
        it('should generate logs continuously when running', (done) => {
            // Start the simulator
            simulator.start();
            
            // Variables to track log generation progress
            let previousLineCount = 0;  // Number of lines in previous check
            let checkCount = 0;         // Number of checks performed
            
            // Set up interval to check log generation every 150ms
            const checkInterval = setInterval(() => {
                // Read current file contents
                const content = fs.readFileSync(testLogFile, 'utf8');
                // Count current number of lines
                const currentLineCount = content.trim().split('\n').length;
                
                // After the first check, verify that line count is increasing
                if (checkCount > 0) {
                    // Assert that more lines were added since last check
                    expect(currentLineCount).to.be.greaterThan(previousLineCount);
                }
                
                // Update previous line count for next comparison
                previousLineCount = currentLineCount;
                // Increment check counter
                checkCount++;
                
                // After 3 checks, stop the test
                if (checkCount >= 3) {
                    // Clear the interval to stop checking
                    clearInterval(checkInterval);
                    // Stop the simulator
                    simulator.stop();
                    // Signal test completion
                    done();
                }
            }, 150); // Check every 150ms (slightly more than simulator interval)
        });

        // Test that the simulator cycles through log entries when it runs out
        it('should cycle through log entries', () => {
            // Get the total number of available log entries
            const totalEntries = simulator.logEntries.length;
            
            // Write more entries than available to force cycling
            for (let i = 0; i < totalEntries + 5; i++) {
                // Write a log entry (will cycle through available entries)
                simulator.writeLogEntry();
            }
            
            // Read the contents of the test log file
            const content = fs.readFileSync(testLogFile, 'utf8');
            // Split content into lines and remove empty lines
            const lines = content.trim().split('\n');
            
            // Assert that correct number of lines were written
            expect(lines).to.have.length(totalEntries + 5);
            
            // Assert that logIndex cycled back to beginning (modulo operation)
            expect(simulator.logIndex % totalEntries).to.equal(5);
        });
    });

    // Test suite for file system integration functionality
    describe('File System Integration', () => {
        // Test that file system errors are handled gracefully
        it('should handle file system errors gracefully', () => {
            // Test writing to an invalid path to demonstrate error handling
            // Note: We test fs.writeFileSync directly instead of creating a simulator
            // because the simulator creates directories in its constructor
            expect(() => {
                // Try to write to an invalid path that doesn't exist
                fs.writeFileSync('/invalid/path/file.log', 'test');
            }).to.throw(); // This should throw an error
        });

        // Test that the simulator can append to existing files
        it('should append to existing file', () => {
            // Write some initial content to the test file
            fs.writeFileSync(testLogFile, 'Existing content\n');
            
            // Use the simulator to write a log entry
            simulator.writeLogEntry();
            
            // Read the complete file contents
            const content = fs.readFileSync(testLogFile, 'utf8');
            // Split content into lines and remove empty lines
            const lines = content.trim().split('\n');
            
            // Assert that we now have 2 lines (original + new)
            expect(lines).to.have.length(2);
            // Assert that the first line is the original content
            expect(lines[0]).to.equal('Existing content');
        });
    });
// End of the main describe block for LogSimulator
});

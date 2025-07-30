// Import Express.js framework for creating web server
const express = require('express');
// Import WebSocket library for real-time bidirectional communication
const WebSocket = require('ws');
// Import Node.js file system module for file operations
const fs = require('fs');
// Import Node.js path module for handling file paths
const path = require('path');
// Import chokidar library for efficient file system watching
const chokidar = require('chokidar');
// Import createReadStream for memory-efficient file reading
const { createReadStream } = require('fs');
// Import createInterface for line-by-line file processing
const { createInterface } = require('readline');

// Define the main TailFServer class that handles all tail-f functionality
class TailFServer {
    // Constructor initializes the server with specified port (default 8080)
    constructor(port = 8080) {
        // Store the port number for the server
        this.port = port;
        // Create Express application instance
        this.app = express();
        // Initialize HTTP server reference (will be set later)
        this.server = null;
        // Initialize WebSocket server reference (will be set later)
        this.wss = null;
        // Map to store file watchers for each monitored file
        this.watchers = new Map(); // Map to store file watchers
        // Map to store client connections and their watched files
        this.clients = new Map(); // Map to store client connections and their watched files
        // Map to store last read positions for files to avoid re-reading
        this.filePositions = new Map(); // Map to store last read positions for files
        
        // Set up Express.js routes and middleware
        this.setupExpress();
        // Set up WebSocket server for real-time communication
        this.setupWebSocket();
    }

    // Method to configure Express.js server routes and middleware
    setupExpress() {
        // Serve static files from the 'public' directory
        this.app.use(express.static(path.join(__dirname, 'public')));
        
        // Route to serve the main log viewer HTML page
        this.app.get('/log', (req, res) => {
            // Send the log.html file to the client
            res.sendFile(path.join(__dirname, 'public', 'log.html'));
        });

        // API endpoint to get list of available log files
        this.app.get('/api/logs', (req, res) => {
            // Define the logs directory path
            const logsDir = path.join(__dirname, 'logs');
            // Check if logs directory exists, create if it doesn't
            if (!fs.existsSync(logsDir)) {
                // Create logs directory recursively
                fs.mkdirSync(logsDir, { recursive: true });
            }
            
            // Try to read the logs directory and return file list
            try {
                // Read all files in the logs directory
                const files = fs.readdirSync(logsDir)
                    // Filter to only include .log files
                    .filter(file => file.endsWith('.log'))
                    // Map to objects with name and full path
                    .map(file => ({ name: file, path: path.join(logsDir, file) }));
                // Send the file list as JSON response
                res.json(files);
            } catch (error) {
                // Send error response if directory reading fails
                res.status(500).json({ error: 'Unable to read logs directory' });
            }
        });
    }

    // Method to set up WebSocket server for real-time communication
    setupWebSocket() {
        // Start the HTTP server on the specified port
        this.server = this.app.listen(this.port, () => {
            // Log server startup message with port information
            console.log(`Tail-f server running on http://localhost:${this.port}`);
            // Log the URL for the log viewer interface
            console.log(`Log viewer available at http://localhost:${this.port}/log`);
        });

        // Create WebSocket server attached to the HTTP server
        this.wss = new WebSocket.Server({ server: this.server });

        // Handle new WebSocket connections
        this.wss.on('connection', (ws) => {
            // Log when a new client connects
            console.log('New client connected');
            
            // Handle incoming messages from the client
            ws.on('message', (message) => {
                // Try to parse the JSON message
                try {
                    // Parse the message string to JSON object
                    const data = JSON.parse(message);
                    // Handle the parsed message
                    this.handleClientMessage(ws, data);
                } catch (error) {
                    // Log error if message parsing fails
                    console.error('Error parsing client message:', error);
                }
            });

            // Handle client disconnection
            ws.on('close', () => {
                // Log when a client disconnects
                console.log('Client disconnected');
                // Clean up client data when disconnected
                this.handleClientDisconnect(ws);
            });
        });
    }

    // Method to handle incoming messages from WebSocket clients
    handleClientMessage(ws, data) {
        // Switch based on the message type
        switch (data.type) {
            // Handle request to start watching a file
            case 'watch':
                // Call watchFile method with client socket and file path
                this.watchFile(ws, data.filePath);
                break;
            // Handle request to stop watching a file
            case 'unwatch':
                // Call unwatchFile method with client socket and file path
                this.unwatchFile(ws, data.filePath);
                break;
            // Handle unknown message types
            default:
                // Log unknown message types for debugging
                console.log('Unknown message type:', data.type);
        }
    }

    // Async method to start watching a file for a specific client
    async watchFile(ws, filePath) {
        // Try to start watching the file
        try {
            // Check if the file exists before attempting to watch it
            if (!fs.existsSync(filePath)) {
                // Send error message to client if file doesn't exist
                ws.send(JSON.stringify({
                    type: 'error',
                    message: `File not found: ${filePath}`
                }));
                // Exit the method early
                return;
            }

            // Initialize client entry if it doesn't exist
            if (!this.clients.has(ws)) {
                // Create a new Set to store files watched by this client
                this.clients.set(ws, new Set());
            }
            // Add the file path to the client's watched files
            this.clients.get(ws).add(filePath);

            // Send the last 10 lines of the file immediately
            await this.sendLastLines(ws, filePath, 10);

            // Start file system watching if not already watching this file
            if (!this.watchers.has(filePath)) {
                // Start watching the file for changes
                this.startFileWatcher(filePath);
            }

            // Send success status message to client
            ws.send(JSON.stringify({
                type: 'status',
                message: `Now watching ${filePath}`
            }));

        } catch (error) {
            // Log error if watching fails
            console.error('Error watching file:', error);
            // Send error message to client
            ws.send(JSON.stringify({
                type: 'error',
                message: `Error watching file: ${error.message}`
            }));
        }
    }

    // Async method to send the last N lines of a file to a client
    async sendLastLines(ws, filePath, lineCount) {
        // Try to read and send the last lines
        try {
            // Get the last N lines from the file
            const lines = await this.getLastLines(filePath, lineCount);
            // Send each line as a separate message to the client
            lines.forEach(line => {
                // Send line message with file path information
                ws.send(JSON.stringify({
                    type: 'line',
                    data: line,
                    filePath: filePath
                }));
            });

            // Update file position to current file size after reading
            const stats = fs.statSync(filePath);
            // Store the current file size as the last read position
            this.filePositions.set(filePath, stats.size);
        } catch (error) {
            // Log error if sending last lines fails
            console.error('Error sending last lines:', error);
        }
    }

    // Async method to get the last N lines from a file without loading entire file
    async getLastLines(filePath, lineCount) {
        // Return a Promise that resolves with the last N lines
        return new Promise((resolve, reject) => {
            // Array to store lines as they are read
            const lines = [];
            // Create a readable stream for the file
            const stream = createReadStream(filePath);
            // Create readline interface for line-by-line processing
            const rl = createInterface({
                input: stream,
                crlfDelay: Infinity  // Handle Windows line endings properly
            });

            // Handle each line as it's read
            rl.on('line', (line) => {
                // Add the line to our array
                lines.push(line);
                // Keep only the last N lines (sliding window approach)
                if (lines.length > lineCount) {
                    // Remove first element to keep only last N lines
                    lines.shift(); // Remove first element to keep only last N lines
                }
            });

            // Handle when file reading is complete
            rl.on('close', () => {
                // Resolve the promise with the collected lines
                resolve(lines);
            });

            // Handle any errors during file reading
            rl.on('error', (error) => {
                // Reject the promise with the error
                reject(error);
            });
        });
    }

    // Method to start file system watching for a specific file
    startFileWatcher(filePath) {
        // Create a chokidar watcher for the specified file
        const watcher = chokidar.watch(filePath, {
            persistent: true,     // Keep the process alive
            usePolling: false,    // Use native file system events (more efficient)
            interval: 100         // Polling interval if usePolling is true
        });

        // Handle file change events
        watcher.on('change', () => {
            // Call method to process file changes
            this.handleFileChange(filePath);
        });

        // Store the watcher in our map for later cleanup
        this.watchers.set(filePath, watcher);
        // Log that we started watching the file
        console.log(`Started watching file: ${filePath}`);
    }

    // Async method to handle file change events
    async handleFileChange(filePath) {
        // Try to process the file change
        try {
            // Get only the new lines that were added since last read
            const newLines = await this.getNewLines(filePath);
            // Check if there are any new lines to broadcast
            if (newLines.length > 0) {
                // Send new lines to all clients watching this file
                this.broadcastToClients(filePath, newLines);
            }
        } catch (error) {
            // Log error if file change handling fails
            console.error('Error handling file change:', error);
        }
    }

    // Async method to get only new lines added since last read
    async getNewLines(filePath) {
        // Return a Promise that resolves with new lines
        return new Promise((resolve, reject) => {
            // Get the last read position for this file (0 if first time)
            const lastPosition = this.filePositions.get(filePath) || 0;
            // Get current file statistics
            const stats = fs.statSync(filePath);
            
            // Check if file has grown since last read
            if (stats.size <= lastPosition) {
                // No new content, return empty array
                resolve([]);
                return;
            }

            // Create stream starting from last read position
            const stream = createReadStream(filePath, { start: lastPosition });
            // Create readline interface for line-by-line processing
            const rl = createInterface({
                input: stream,
                crlfDelay: Infinity  // Handle Windows line endings properly
            });

            // Array to collect new lines
            const newLines = [];
            // Handle each new line as it's read
            rl.on('line', (line) => {
                // Add the new line to our array
                newLines.push(line);
            });

            // Handle when stream reading is complete
            rl.on('close', () => {
                // Update the file position to current file size
                this.filePositions.set(filePath, stats.size);
                // Resolve with the new lines
                resolve(newLines);
            });

            // Handle any errors during stream reading
            rl.on('error', (error) => {
                // Reject the promise with the error
                reject(error);
            });
        });
    }

    // Method to broadcast new lines to all clients watching a specific file
    broadcastToClients(filePath, lines) {
        // Iterate through all connected clients
        this.clients.forEach((watchedFiles, ws) => {
            // Check if this client is watching the file and connection is open
            if (watchedFiles.has(filePath) && ws.readyState === WebSocket.OPEN) {
                // Send each new line to the client
                lines.forEach(line => {
                    // Send line message with file path information
                    ws.send(JSON.stringify({
                        type: 'line',
                        data: line,
                        filePath: filePath
                    }));
                });
            }
        });
    }

    // Method to stop watching a file for a specific client
    unwatchFile(ws, filePath) {
        // Check if the client exists in our tracking
        if (this.clients.has(ws)) {
            // Remove the file from the client's watched files
            this.clients.get(ws).delete(filePath);
            
            // Check if any other clients are still watching this file
            let stillWatched = false;
            // Iterate through all clients to check if file is still being watched
            this.clients.forEach((watchedFiles) => {
                // If any client is still watching this file
                if (watchedFiles.has(filePath)) {
                    // Mark as still being watched
                    stillWatched = true;
                }
            });

            // If no clients are watching this file, clean up the watcher
            if (!stillWatched && this.watchers.has(filePath)) {
                // Close the file system watcher
                this.watchers.get(filePath).close();
                // Remove watcher from our map
                this.watchers.delete(filePath);
                // Remove file position tracking
                this.filePositions.delete(filePath);
                // Log that we stopped watching the file
                console.log(`Stopped watching file: ${filePath}`);
            }
        }
    }

    // Method to handle client disconnection and cleanup
    handleClientDisconnect(ws) {
        // Check if the client exists in our tracking
        if (this.clients.has(ws)) {
            // Get all files that this client was watching
            const watchedFiles = this.clients.get(ws);
            // Unwatch each file that the client was monitoring
            watchedFiles.forEach(filePath => {
                // Stop watching the file for this client
                this.unwatchFile(ws, filePath);
            });
            // Remove the client from our tracking completely
            this.clients.delete(ws);
        }
    }

    // Method to gracefully close the server and cleanup resources
    close() {
        // Close all file system watchers
        this.watchers.forEach((watcher, filePath) => {
            // Close each individual watcher
            watcher.close();
        });
        // Clear the watchers map
        this.watchers.clear();
        // Clear the clients map
        this.clients.clear();
        // Clear the file positions map
        this.filePositions.clear();

        // Close WebSocket server if it exists
        if (this.wss) {
            // Close the WebSocket server
            this.wss.close();
        }

        // Close HTTP server if it exists
        if (this.server) {
            // Close the HTTP server
            this.server.close();
        }
    }
}

// Check if this file is being run directly (not imported as a module)
if (require.main === module) {
    // Create a new TailFServer instance on port 8080
    const server = new TailFServer(8080);
    
    // Handle graceful shutdown on Ctrl+C (SIGINT signal)
    process.on('SIGINT', () => {
        // Log shutdown message
        console.log('\nShutting down server...');
        // Close the server and cleanup resources
        server.close();
        // Exit the process
        process.exit(0);
    });
}

// Export the TailFServer class for use in other modules
module.exports = TailFServer;

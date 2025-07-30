# Tail-F Log Viewer

A real-time log monitoring solution similar to the UNIX `tail -f` command, but with a modern web interface. This implementation streams log updates in real-time without loading entire files into memory.

## Features

- **Real-time Log Streaming**: Watch log files and see updates as they happen
- **Memory Efficient**: Reads only new content, never loads entire files into memory
- **Web Interface**: Modern, responsive web UI accessible at `http://localhost:8080/log`
- **WebSocket Communication**: Real-time bidirectional communication between server and client
- **Multiple File Support**: Watch different log files simultaneously
- **Auto-scroll**: Automatically scroll to show latest log entries
- **Log Level Detection**: Automatically highlights ERROR, WARN, INFO messages
- **Last N Lines**: Shows last 10 lines immediately when starting to watch a file

## Architecture

### Server Components

- **TailFServer**: Main server class handling HTTP and WebSocket connections
- **File Monitoring**: Uses `chokidar` for efficient file system watching
- **Position Tracking**: Maintains file read positions to stream only new content
- **Client Management**: Tracks multiple clients and their watched files

### Client Components

- **WebSocket Client**: Handles real-time communication with server
- **Auto-scroll**: Automatically scrolls to show latest entries
- **Connection Management**: Handles connection drops and reconnection
- **File Selection**: UI for selecting log files to watch

## Installation

1. Clone the repository
2. Install dependencies:
   ```bash
   npm install
   ```

## Usage

### Start the Server

```bash
npm start
```

The server will start on `http://localhost:8080`

### Access the Web Interface

Open your browser and navigate to:
```
http://localhost:8080/log
```

### Generate Test Logs

To simulate continuous log generation:

```bash
npm run simulate
```

This will create a log file at `logs/app.log` and continuously append new entries.

For custom log file and interval:
```bash
npm run simulate:custom
```

### Available Scripts

- `npm start` - Start the tail-f server
- `npm test` - Run unit tests
- `npm run test:watch` - Run tests in watch mode
- `npm run simulate` - Start log simulator with default settings
- `npm run simulate:custom` - Start log simulator with custom file and interval

## API

### WebSocket Messages

#### Client to Server

**Watch a file:**
```json
{
  "type": "watch",
  "filePath": "/path/to/logfile.log"
}
```

**Stop watching a file:**
```json
{
  "type": "unwatch",
  "filePath": "/path/to/logfile.log"
}
```

#### Server to Client

**New log line:**
```json
{
  "type": "line",
  "data": "2023-07-15T10:30:00.000Z [INFO] Application started",
  "filePath": "/path/to/logfile.log"
}
```

**Status message:**
```json
{
  "type": "status",
  "message": "Now watching /path/to/logfile.log"
}
```

**Error message:**
```json
{
  "type": "error",
  "message": "File not found: /path/to/logfile.log"
}
```

### HTTP Endpoints

- `GET /log` - Serve the log viewer web interface
- `GET /api/logs` - Get list of available log files in the `logs/` directory

## Key Implementation Details

### Memory Efficiency

- **Streaming Reads**: Uses `fs.createReadStream` with start/end positions
- **Position Tracking**: Maintains file read positions to avoid re-reading content
- **Line-by-line Processing**: Uses `readline` interface to process files line by line
- **No Full File Loading**: Never loads entire log files into memory

### File Monitoring

- **Efficient Watching**: Uses `chokidar` library for cross-platform file watching
- **Change Detection**: Monitors file changes and reads only new content
- **Multiple Files**: Can watch multiple files simultaneously
- **Cleanup**: Properly closes watchers when clients disconnect

### Real-time Communication

- **WebSocket**: Uses `ws` library for real-time bidirectional communication
- **Client Tracking**: Maintains map of clients and their watched files
- **Broadcasting**: Efficiently broadcasts new log lines to relevant clients
- **Connection Management**: Handles client connections and disconnections

## Testing

The project includes comprehensive unit tests using Mocha, Chai, and Sinon.

### Run Tests

```bash
npm test
```

### Test Coverage

- **File Operations**: Tests for reading last N lines, detecting new content
- **WebSocket Communication**: Tests for client-server message handling
- **Memory Efficiency**: Tests ensuring files aren't loaded entirely into memory
- **Client Management**: Tests for client connection tracking and cleanup
- **Error Handling**: Tests for graceful error handling scenarios

### Run Tests in Watch Mode

```bash
npm run test:watch
```

## Project Structure

```
tail-f/
├── server.js              # Main server implementation
├── log-simulator.js       # Log file simulator for testing
├── package.json           # Project configuration
├── README.md              # This file
├── .github/
│   └── copilot-instructions.md  # Copilot instructions
├── public/
│   └── log.html           # Web interface
├── logs/                  # Directory for log files
├── test/                  # Unit tests
│   ├── server.test.js     # Server tests
│   └── log-simulator.test.js  # Simulator tests
└── .vscode/
    └── tasks.json         # VS Code tasks
```

## Requirements Met

✅ **Server Implementation**: Node.js server monitoring log files and streaming updates  
✅ **Web Client**: Accessible via URL with real-time updates (no page refresh needed)  
✅ **Efficient Updates**: Only sends new content, not entire file  
✅ **Memory Efficient**: Doesn't load entire file into memory for last 10 lines  
✅ **No Off-the-shelf Libraries**: Custom implementation of tail functionality  
✅ **Unit Testing**: Comprehensive test suite with Mocha  
✅ **Real-time Log Simulation**: Continuous log generation for testing  

## Performance Considerations

- **File Position Tracking**: Maintains read positions to avoid unnecessary file scanning
- **Streaming**: Uses Node.js streams for efficient file reading
- **Client Limits**: Implements reasonable limits on log line history (1000 lines)
- **Memory Management**: Prevents memory leaks through proper cleanup
- **Error Handling**: Graceful handling of file system errors

## Browser Support

The web interface works in all modern browsers that support WebSockets:
- Chrome 16+
- Firefox 11+
- Safari 7+
- Edge 12+

## License

ISC License

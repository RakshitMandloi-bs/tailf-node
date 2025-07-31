<!-- Use this file to provide workspace-specific custom instructions to Copilot. For more details, visit https://code.visualstudio.com/docs/copilot/copilot-customization#_use-a-githubcopilotinstructionsmd-file -->

# Tail-F Project Instructions

This is a Node.js implementation of a log watching solution similar to the UNIX `tail -f` command, with a real-time web interface.

## Key Requirements

- **Memory Efficiency**: Never load entire log files into memory
- **Real-time Updates**: Stream only new log entries, not entire file contents
- **Last N Lines**: Efficiently read last 10 lines without loading full file
- **WebSocket Communication**: Use WebSocket for real-time client-server communication
- **File Monitoring**: Use `chokidar` for efficient file system watching
- **No Off-the-shelf Libraries**: Implement core tail functionality from scratch

## Architecture

- **Server**: Express.js server with WebSocket support
- **Client**: Web-based interface with auto-scroll and real-time updates
- **File Watching**: Custom implementation using file positions and streaming
- **Testing**: Mocha/Chai/Sinon for comprehensive unit testing

## Important Implementation Details

- Use `fs.createReadStream` with start/end positions for efficient file reading
- Track file positions to read only new content
- Implement proper client connection management
- Handle file system errors gracefully
- Support multiple clients watching the same file

## Testing

- Focus on memory efficiency tests
- Test WebSocket communication
- Verify file position tracking
- Test error handling scenarios

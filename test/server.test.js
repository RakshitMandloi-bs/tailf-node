const { expect } = require('chai');
const sinon = require('sinon');
const fs = require('fs');
const path = require('path');
const WebSocket = require('ws');
const TailFServer = require('../server');

describe('TailFServer', () => {
    let server;
    let testLogFile;
    let testLogsDir;

    beforeEach(() => {
        // Create test logs directory
        testLogsDir = path.join(__dirname, 'test-logs');
        if (!fs.existsSync(testLogsDir)) {
            fs.mkdirSync(testLogsDir);
        }
        
        testLogFile = path.join(testLogsDir, 'test.log');
        
        // Create test server on random port
        server = new TailFServer(0); // port 0 means random available port
    });

    afterEach(() => {
        if (server) {
            server.close();
        }
        
        // Clean up test files
        if (fs.existsSync(testLogFile)) {
            fs.unlinkSync(testLogFile);
        }
        
        if (fs.existsSync(testLogsDir)) {
            try {
                fs.rmSync(testLogsDir, { recursive: true, force: true });
            } catch (err) {
                // Ignore errors during cleanup
            }
        }
    });

    describe('File Watching', () => {
        it('should read last N lines from file without loading entire file', async () => {
            // Create test file with multiple lines
            const testLines = [];
            for (let i = 1; i <= 50; i++) {
                testLines.push(`Line ${i}: This is test log entry number ${i}`);
            }
            fs.writeFileSync(testLogFile, testLines.join('\n'));

            // Get last 10 lines
            const lastLines = await server.getLastLines(testLogFile, 10);
            
            expect(lastLines).to.have.length(10);
            expect(lastLines[0]).to.equal('Line 41: This is test log entry number 41');
            expect(lastLines[9]).to.equal('Line 50: This is test log entry number 50');
        });

        it('should detect new lines added to file', async () => {
            // Create initial file
            fs.writeFileSync(testLogFile, 'Initial line\n');
            
            // Set initial position
            const stats = fs.statSync(testLogFile);
            server.filePositions.set(testLogFile, stats.size);
            
            // Add new lines
            fs.appendFileSync(testLogFile, 'New line 1\nNew line 2\n');
            
            // Get new lines
            const newLines = await server.getNewLines(testLogFile);
            
            expect(newLines).to.have.length(2);
            expect(newLines[0]).to.equal('New line 1');
            expect(newLines[1]).to.equal('New line 2');
        });

        it('should handle empty file', async () => {
            fs.writeFileSync(testLogFile, '');
            
            const lastLines = await server.getLastLines(testLogFile, 10);
            expect(lastLines).to.have.length(0);
        });

        it('should handle file with fewer lines than requested', async () => {
            fs.writeFileSync(testLogFile, 'Line 1\nLine 2\n');
            
            const lastLines = await server.getLastLines(testLogFile, 10);
            expect(lastLines).to.have.length(2);
            expect(lastLines[0]).to.equal('Line 1');
            expect(lastLines[1]).to.equal('Line 2');
        });
    });

    describe('WebSocket Communication', () => {
        it('should establish WebSocket connection', (done) => {
            const port = server.server.address().port;
            const ws = new WebSocket(`ws://localhost:${port}`);
            
            ws.on('open', () => {
                expect(ws.readyState).to.equal(WebSocket.OPEN);
                ws.close();
                done();
            });
        });

        it('should handle watch file message', (done) => {
            const port = server.server.address().port;
            const ws = new WebSocket(`ws://localhost:${port}`);
            
            // Create test file
            fs.writeFileSync(testLogFile, 'Test line 1\nTest line 2\n');
            
            ws.on('open', () => {
                ws.send(JSON.stringify({
                    type: 'watch',
                    filePath: testLogFile
                }));
            });

            let messageCount = 0;
            ws.on('message', (data) => {
                const message = JSON.parse(data);
                messageCount++;
                
                if (message.type === 'line' && messageCount === 1) {
                    expect(message.data).to.equal('Test line 1');
                } else if (message.type === 'line' && messageCount === 2) {
                    expect(message.data).to.equal('Test line 2');
                } else if (message.type === 'status') {
                    expect(message.message).to.include('Now watching');
                    ws.close();
                    done();
                }
            });
        });

        it('should handle non-existent file', (done) => {
            const port = server.server.address().port;
            const ws = new WebSocket(`ws://localhost:${port}`);
            
            ws.on('open', () => {
                ws.send(JSON.stringify({
                    type: 'watch',
                    filePath: '/non/existent/file.log'
                }));
            });

            ws.on('message', (data) => {
                const message = JSON.parse(data);
                if (message.type === 'error') {
                    expect(message.message).to.include('File not found');
                    ws.close();
                    done();
                }
            });
        });
    });

    describe('Client Management', () => {
        it('should track clients watching files', async () => {
            const mockWs = { 
                readyState: WebSocket.OPEN,
                send: sinon.spy()
            };
            
            // Create test file
            fs.writeFileSync(testLogFile, 'Test content\n');
            
            // Watch file
            await server.watchFile(mockWs, testLogFile);
            
            // Check client is tracked
            expect(server.clients.has(mockWs)).to.be.true;
            expect(server.clients.get(mockWs).has(testLogFile)).to.be.true;
        });

        it('should clean up when client disconnects', async () => {
            const mockWs = { 
                readyState: WebSocket.OPEN,
                send: sinon.spy()
            };
            
            // Create test file
            fs.writeFileSync(testLogFile, 'Test content\n');
            
            // Watch file
            await server.watchFile(mockWs, testLogFile);
            
            // Simulate disconnect
            server.handleClientDisconnect(mockWs);
            
            // Check cleanup
            expect(server.clients.has(mockWs)).to.be.false;
            expect(server.watchers.has(testLogFile)).to.be.false;
        });
    });

    describe('File Position Tracking', () => {
        it('should track file read positions', async () => {
            fs.writeFileSync(testLogFile, 'Line 1\nLine 2\n');
            
            const mockWs = { 
                readyState: WebSocket.OPEN,
                send: sinon.spy()
            };
            
            // Watch file to trigger position tracking
            await server.watchFile(mockWs, testLogFile);
            
            // Check position is tracked
            expect(server.filePositions.has(testLogFile)).to.be.true;
            expect(server.filePositions.get(testLogFile)).to.be.greaterThan(0);
        });

        it('should update position after reading new lines', async () => {
            fs.writeFileSync(testLogFile, 'Line 1\n');
            
            // Set initial position
            const stats = fs.statSync(testLogFile);
            server.filePositions.set(testLogFile, stats.size);
            const initialPosition = server.filePositions.get(testLogFile);
            
            // Add new content
            fs.appendFileSync(testLogFile, 'Line 2\n');
            
            // Read new lines
            await server.getNewLines(testLogFile);
            
            // Check position updated
            expect(server.filePositions.get(testLogFile)).to.be.greaterThan(initialPosition);
        });
    });

    describe('Memory Management', () => {
        it('should not load entire file into memory for last lines', async () => {
            // Create large file
            const largeContent = Array(10000).fill('A'.repeat(100)).join('\n');
            fs.writeFileSync(testLogFile, largeContent);
            
            // Spy on memory usage
            const initialMemory = process.memoryUsage().heapUsed;
            
            // Get last lines
            const lastLines = await server.getLastLines(testLogFile, 10);
            
            const finalMemory = process.memoryUsage().heapUsed;
            const memoryIncrease = finalMemory - initialMemory;
            
            // Should not load entire file (memory increase should be minimal)
            expect(memoryIncrease).to.be.lessThan(1000000); // Less than 1MB
            expect(lastLines).to.have.length(10);
        });
    });

    describe('Error Handling', () => {
        it('should handle invalid JSON messages', () => {
            const mockWs = { 
                send: sinon.spy(),
                readyState: WebSocket.OPEN 
            };
            
            // This should not throw an error
            expect(() => {
                server.handleClientMessage(mockWs, 'invalid json');
            }).to.not.throw();
        });

        it('should handle file system errors gracefully', async () => {
            // Try to read non-existent file
            try {
                await server.getLastLines('/non/existent/file.log', 10);
            } catch (error) {
                expect(error).to.exist;
            }
        });
    });
});

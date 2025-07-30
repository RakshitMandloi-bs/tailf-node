const fs = require('fs');
const path = require('path');

class LogSimulator {
    constructor(logFilePath, intervalMs = 1000) {
        this.logFilePath = logFilePath;
        this.intervalMs = intervalMs;
        this.interval = null;
        this.isRunning = false;
        this.logEntries = [
            'Application started successfully',
            'Database connection established',
            'User authentication successful',
            'Processing incoming request',
            'Cache hit for key: user_123',
            'Processing payment transaction',
            'Email notification sent',
            'File upload completed',
            'Background job scheduled',
            'Database query executed',
            'API response sent successfully',
            'User session created',
            'Configuration updated',
            'Backup process initiated',
            'System health check passed',
            'Memory usage: 65%',
            'CPU usage: 23%',
            'Network latency: 45ms',
            'Request processed in 120ms',
            'Cache miss for key: product_456',
            'WARN: High memory usage detected',
            'ERROR: Database connection timeout',
            'WARN: Slow query detected (2.5s)',
            'INFO: Scheduled maintenance in 2 hours',
            'ERROR: Failed to process payment',
            'WARN: Disk space running low',
            'INFO: New user registration: john@example.com',
            'ERROR: Invalid API key provided',
            'WARN: Rate limit exceeded for IP: 192.168.1.100',
            'INFO: System updated to version 2.1.0'
        ];
        
        this.logLevels = ['INFO', 'WARN', 'ERROR', 'DEBUG'];
        this.logIndex = 0;
        
        this.ensureLogDirectory();
    }

    ensureLogDirectory() {
        const logDir = path.dirname(this.logFilePath);
        if (!fs.existsSync(logDir)) {
            fs.mkdirSync(logDir, { recursive: true });
        }
    }

    start() {
        if (this.isRunning) {
            console.log('Log simulator is already running');
            return;
        }

        this.isRunning = true;
        console.log(`Starting log simulator - writing to ${this.logFilePath}`);
        console.log(`Interval: ${this.intervalMs}ms`);

        // Write initial log entry
        this.writeLogEntry();

        // Start interval
        this.interval = setInterval(() => {
            this.writeLogEntry();
        }, this.intervalMs);
    }

    stop() {
        if (!this.isRunning) {
            console.log('Log simulator is not running');
            return;
        }

        this.isRunning = false;
        if (this.interval) {
            clearInterval(this.interval);
            this.interval = null;
        }
        console.log('Log simulator stopped');
    }

    writeLogEntry() {
        const timestamp = new Date().toISOString();
        const entry = this.logEntries[this.logIndex % this.logEntries.length];
        const level = this.getLogLevel(entry);
        const processId = Math.floor(Math.random() * 9999) + 1000;
        
        const logLine = `${timestamp} [${level}] [PID:${processId}] ${entry}\n`;
        
        fs.appendFileSync(this.logFilePath, logLine);
        console.log(`Logged: ${entry}`);
        
        this.logIndex++;
    }

    getLogLevel(entry) {
        if (entry.includes('ERROR') || entry.includes('Failed') || entry.includes('Invalid')) {
            return 'ERROR';
        } else if (entry.includes('WARN') || entry.includes('High') || entry.includes('Low') || entry.includes('Slow')) {
            return 'WARN';
        } else if (entry.includes('INFO') || entry.includes('started') || entry.includes('successful')) {
            return 'INFO';
        } else {
            return 'DEBUG';
        }
    }

    writeInitialLogs() {
        const initialLogs = [
            'System startup initiated',
            'Loading configuration files',
            'Initializing database connections',
            'Starting web server on port 8080',
            'Application ready to serve requests'
        ];

        initialLogs.forEach(entry => {
            const timestamp = new Date().toISOString();
            const logLine = `${timestamp} [INFO] [PID:1234] ${entry}\n`;
            fs.appendFileSync(this.logFilePath, logLine);
        });
    }
}

// Command line interface
if (require.main === module) {
    const args = process.argv.slice(2);
    const logFile = args[0] || path.join(__dirname, 'logs', 'app.log');
    const interval = parseInt(args[1]) || 2000;

    const simulator = new LogSimulator(logFile, interval);
    
    // Write some initial logs
    simulator.writeInitialLogs();
    
    // Start the simulator
    simulator.start();

    // Handle graceful shutdown
    process.on('SIGINT', () => {
        console.log('\nShutting down log simulator...');
        simulator.stop();
        process.exit(0);
    });

    process.on('SIGTERM', () => {
        console.log('\nShutting down log simulator...');
        simulator.stop();
        process.exit(0);
    });
}

module.exports = LogSimulator;

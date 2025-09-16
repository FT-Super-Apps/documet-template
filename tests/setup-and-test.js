#!/usr/bin/env node

/**
 * Setup and Test Runner Script
 * Automatically installs dependencies and runs tests
 */

const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m'
};

function log(message, color = colors.reset) {
  console.log(`${color}${message}${colors.reset}`);
}

function runCommand(command, args = [], options = {}) {
  return new Promise((resolve, reject) => {
    log(`\n${colors.cyan}🔧 Running: ${command} ${args.join(' ')}${colors.reset}`);

    const process = spawn(command, args, {
      stdio: 'inherit',
      shell: true,
      ...options
    });

    process.on('close', (code) => {
      if (code === 0) {
        resolve(code);
      } else {
        reject(new Error(`Command failed with exit code ${code}`));
      }
    });

    process.on('error', (error) => {
      reject(error);
    });
  });
}

async function checkFiles() {
  log(`\n${colors.blue}📁 Checking required files...${colors.reset}`);

  const requiredFiles = [
    '.env.example',
    'package.json',
    'server.js',
    'prisma/schema.prisma'
  ];

  const missingFiles = [];

  for (const file of requiredFiles) {
    if (!fs.existsSync(path.join(__dirname, '..', file))) {
      missingFiles.push(file);
    }
  }

  if (missingFiles.length > 0) {
    log(`${colors.red}❌ Missing required files:${colors.reset}`);
    missingFiles.forEach(file => log(`   - ${file}`, colors.red));
    return false;
  }

  log(`${colors.green}✅ All required files found${colors.reset}`);
  return true;
}

async function setupEnvironment() {
  log(`\n${colors.blue}🔧 Setting up environment...${colors.reset}`);

  if (!fs.existsSync('.env')) {
    if (fs.existsSync('.env.example')) {
      fs.copyFileSync('.env.example', '.env');
      log(`${colors.green}✅ Created .env from .env.example${colors.reset}`);
      log(`${colors.yellow}⚠️  Please edit .env file with your database configuration${colors.reset}`);
    } else {
      log(`${colors.red}❌ No .env.example found${colors.reset}`);
      return false;
    }
  } else {
    log(`${colors.green}✅ .env file already exists${colors.reset}`);
  }

  return true;
}

async function installDependencies() {
  log(`\n${colors.blue}📦 Installing dependencies...${colors.reset}`);

  try {
    await runCommand('npm', ['install']);
    log(`${colors.green}✅ Dependencies installed successfully${colors.reset}`);
    return true;
  } catch (error) {
    log(`${colors.red}❌ Failed to install dependencies: ${error.message}${colors.reset}`);
    return false;
  }
}

async function runDatabaseSetup() {
  log(`\n${colors.blue}🗄️ Setting up database...${colors.reset}`);

  try {
    log(`${colors.cyan}Generating Prisma client...${colors.reset}`);
    await runCommand('npx', ['prisma', 'generate']);

    log(`${colors.cyan}Running database migrations...${colors.reset}`);
    await runCommand('npx', ['prisma', 'migrate', 'deploy']);

    log(`${colors.green}✅ Database setup completed${colors.reset}`);
    return true;
  } catch (error) {
    log(`${colors.yellow}⚠️  Database setup failed: ${error.message}${colors.reset}`);
    log(`${colors.yellow}   This is expected if database is not configured yet${colors.reset}`);
    return false;
  }
}

async function runTests() {
  log(`\n${colors.blue}🧪 Running tests...${colors.reset}`);

  try {
    log(`\n${colors.magenta}=== UNIT TESTS ===${colors.reset}`);
    await runCommand('npm', ['run', 'test:unit']);

    log(`\n${colors.magenta}=== INTEGRATION TESTS ===${colors.reset}`);
    await runCommand('npm', ['run', 'test:integration']);

    log(`\n${colors.green}✅ All automated tests completed${colors.reset}`);
    return true;
  } catch (error) {
    log(`${colors.red}❌ Some tests failed: ${error.message}${colors.reset}`);
    return false;
  }
}

async function runManualTest() {
  log(`\n${colors.blue}🔍 Running manual endpoint test...${colors.reset}`);
  log(`${colors.yellow}⚠️  Make sure your server is running on port 8080${colors.reset}`);
  log(`${colors.cyan}   You can start it with: npm start${colors.reset}`);

  const readline = require('readline');
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });

  const answer = await new Promise(resolve => {
    rl.question('Is your server running? (y/n): ', resolve);
  });

  rl.close();

  if (answer.toLowerCase() === 'y' || answer.toLowerCase() === 'yes') {
    try {
      await runCommand('node', ['tests/manual/endpoint-test.js']);
      return true;
    } catch (error) {
      log(`${colors.red}❌ Manual test failed: ${error.message}${colors.reset}`);
      return false;
    }
  } else {
    log(`${colors.yellow}⚠️  Skipping manual test. Start server and run: node tests/manual/endpoint-test.js${colors.reset}`);
    return false;
  }
}

async function main() {
  log(`${colors.bright}${colors.green}🚀 Generate Document API - Setup and Test Runner${colors.reset}`);
  log(`${colors.bright}==================================================${colors.reset}`);

  try {
    // Check required files
    const filesOk = await checkFiles();
    if (!filesOk) {
      process.exit(1);
    }

    // Setup environment
    const envOk = await setupEnvironment();
    if (!envOk) {
      process.exit(1);
    }

    // Install dependencies
    const depsOk = await installDependencies();
    if (!depsOk) {
      process.exit(1);
    }

    // Database setup (optional)
    await runDatabaseSetup();

    // Run automated tests
    await runTests();

    // Run manual endpoint test
    await runManualTest();

    log(`\n${colors.bright}${colors.green}🎉 Setup and testing completed!${colors.reset}`);
    log(`\n${colors.cyan}Next steps:${colors.reset}`);
    log(`${colors.cyan}1. Configure your .env file with proper database settings${colors.reset}`);
    log(`${colors.cyan}2. Run database migrations: npm run prisma:migrate${colors.reset}`);
    log(`${colors.cyan}3. Seed initial data: npm run seed:eddsa${colors.reset}`);
    log(`${colors.cyan}4. Start the server: npm start${colors.reset}`);
    log(`${colors.cyan}5. Test endpoints manually: node tests/manual/endpoint-test.js${colors.reset}`);

  } catch (error) {
    log(`\n${colors.red}💥 Setup failed: ${error.message}${colors.reset}`);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}

module.exports = { runCommand, log, colors };

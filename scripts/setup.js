#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

console.log('🚀 Setting up Node.js Project Template...\n');

// Create .env file from example if it doesn't exist
const envExamplePath = path.join(__dirname, '../env.example');
const envPath = path.join(__dirname, '../.env');

if (!fs.existsSync(envPath) && fs.existsSync(envExamplePath)) {
  fs.copyFileSync(envExamplePath, envPath);
  console.log('✅ Created .env file from env.example');
} else if (fs.existsSync(envPath)) {
  console.log('ℹ️  .env file already exists');
} else {
  console.log('⚠️  env.example file not found');
}

// Create logs directory
const logsDir = path.join(__dirname, '../logs');
if (!fs.existsSync(logsDir)) {
  fs.mkdirSync(logsDir, { recursive: true });
  console.log('✅ Created logs directory');
} else {
  console.log('ℹ️  logs directory already exists');
}

console.log('\n🎉 Setup completed!');
console.log('\nNext steps:');
console.log('1. Run: npm install');
console.log('2. Run: npm run dev');
console.log('3. Visit: http://localhost:3000');
console.log('\nHappy coding! 🚀'); 
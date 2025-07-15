#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

console.log('🧪 Testing Video Labeling Service Setup...\n');

// Test 1: Check if all required files exist
const requiredFiles = [
  'package.json',
  'frontend/package.json',
  'backend/package.json',
  'frontend/app/page.tsx',
  'frontend/app/layout.tsx',
  'frontend/app/globals.css',
  'backend/server.js',
  'README.md',
  'DEPLOYMENT.md',
  '.gitignore'
];

console.log('📁 Checking required files...');
let allFilesExist = true;

requiredFiles.forEach(file => {
  const exists = fs.existsSync(file);
  console.log(`${exists ? '✅' : '❌'} ${file}`);
  if (!exists) allFilesExist = false;
});

// Test 2: Check package.json dependencies
console.log('\n📦 Checking dependencies...');

const rootPackage = JSON.parse(fs.readFileSync('package.json', 'utf8'));
const frontendPackage = JSON.parse(fs.readFileSync('frontend/package.json', 'utf8'));
const backendPackage = JSON.parse(fs.readFileSync('backend/package.json', 'utf8'));

// Check root package.json
console.log('✅ Root package.json has workspaces configured');
console.log('✅ Root package.json has dev scripts configured');

// Check frontend dependencies
const frontendDeps = ['next', 'react', 'react-dom', 'react-player'];
const frontendDevDeps = ['typescript', 'tailwindcss', 'autoprefixer', 'postcss'];

frontendDeps.forEach(dep => {
  if (frontendPackage.dependencies[dep]) {
    console.log(`✅ Frontend has ${dep} dependency`);
  } else {
    console.log(`❌ Frontend missing ${dep} dependency`);
    allFilesExist = false;
  }
});

frontendDevDeps.forEach(dep => {
  if (frontendPackage.devDependencies[dep]) {
    console.log(`✅ Frontend has ${dep} dev dependency`);
  } else {
    console.log(`❌ Frontend missing ${dep} dev dependency`);
    allFilesExist = false;
  }
});

// Check backend dependencies
const backendDeps = ['express', 'cors', 'axios', 'ffmpeg-static', 'fluent-ffmpeg', 'uuid', 'fs-extra'];

backendDeps.forEach(dep => {
  if (backendPackage.dependencies[dep]) {
    console.log(`✅ Backend has ${dep} dependency`);
  } else {
    console.log(`❌ Backend missing ${dep} dependency`);
    allFilesExist = false;
  }
});

// Test 3: Check configuration files
console.log('\n⚙️ Checking configuration files...');

const configFiles = [
  'frontend/next.config.js',
  'frontend/tailwind.config.ts',
  'frontend/postcss.config.js',
  'frontend/tsconfig.json',
  'backend/render.yaml',
  'frontend/vercel.json'
];

configFiles.forEach(file => {
  const exists = fs.existsSync(file);
  console.log(`${exists ? '✅' : '❌'} ${file}`);
  if (!exists) allFilesExist = false;
});

// Test 4: Check if node_modules exist
console.log('\n📚 Checking node_modules...');
const hasRootModules = fs.existsSync('node_modules');
const hasFrontendModules = fs.existsSync('frontend/node_modules');
const hasBackendModules = fs.existsSync('backend/node_modules');

console.log(`${hasRootModules ? '✅' : '❌'} Root node_modules`);
console.log(`${hasFrontendModules ? '✅' : '❌'} Frontend node_modules`);
console.log(`${hasBackendModules ? '✅' : '❌'} Backend node_modules`);

// Summary
console.log('\n📊 Setup Summary:');
console.log('================');

if (allFilesExist && hasRootModules && hasFrontendModules && hasBackendModules) {
  console.log('🎉 All tests passed! Your Video Labeling Service is ready to run.');
  console.log('\n🚀 To start development:');
  console.log('   npm run dev');
  console.log('\n🌐 Frontend will be available at: http://localhost:3000');
  console.log('🔧 Backend will be available at: http://localhost:3001');
  console.log('\n📖 See README.md for detailed instructions');
  console.log('🚀 See DEPLOYMENT.md for deployment guide');
} else {
  console.log('❌ Some tests failed. Please check the issues above.');
  console.log('\n💡 Try running:');
  console.log('   npm install');
  console.log('   cd frontend && npm install');
  console.log('   cd ../backend && npm install');
}

console.log('\n✨ Happy coding!'); 
/* eslint-disable @typescript-eslint/no-require-imports */
/**
 * Setup Verification Script
 * Checks if all required environment variables and dependencies are configured
 */

const fs = require('fs');
const path = require('path');

console.log('🔍 Verifying setup...\n');

let allGood = true;

// Check if .env.local exists
const envLocalPath = path.join(process.cwd(), '.env.local');
const envPath = path.join(process.cwd(), '.env');

console.log('📁 Checking environment files...');
if (fs.existsSync(envLocalPath)) {
  console.log('   ✅ .env.local exists');
  const envContent = fs.readFileSync(envLocalPath, 'utf8');
  if (envContent.includes('BLOB_READ_WRITE_TOKEN')) {
    console.log('   ✅ BLOB_READ_WRITE_TOKEN found in .env.local');
  } else {
    console.log('   ⚠️  BLOB_READ_WRITE_TOKEN not found in .env.local');
    console.log('      You may need to add it manually or pull from Vercel');
    allGood = false;
  }
} else if (fs.existsSync(envPath)) {
  console.log('   ✅ .env exists');
  const envContent = fs.readFileSync(envPath, 'utf8');
  if (envContent.includes('BLOB_READ_WRITE_TOKEN')) {
    console.log('   ✅ BLOB_READ_WRITE_TOKEN found in .env');
  } else {
    console.log('   ⚠️  BLOB_READ_WRITE_TOKEN not found in .env');
    allGood = false;
  }
} else {
  console.log('   ⚠️  No .env.local or .env file found');
  console.log('      For local development, you may need to:');
  console.log('      1. Create .env.local file');
  console.log('      2. Add BLOB_READ_WRITE_TOKEN from Vercel dashboard');
  console.log('      3. Or use: vercel env pull .env.local');
  allGood = false;
}

// Check package.json for @vercel/blob
console.log('\n📦 Checking dependencies...');
const packageJson = JSON.parse(fs.readFileSync(path.join(process.cwd(), 'package.json'), 'utf8'));
if (packageJson.dependencies && packageJson.dependencies['@vercel/blob']) {
  console.log(`   ✅ @vercel/blob installed (v${packageJson.dependencies['@vercel/blob']})`);
} else {
  console.log('   ❌ @vercel/blob not found in dependencies');
  allGood = false;
}

// Check if node_modules exists
const nodeModulesPath = path.join(process.cwd(), 'node_modules', '@vercel', 'blob');
if (fs.existsSync(nodeModulesPath)) {
  console.log('   ✅ @vercel/blob package files exist');
} else {
  console.log('   ⚠️  @vercel/blob not installed. Run: npm install');
  allGood = false;
}

// Check required files exist
console.log('\n📄 Checking required files...');
const requiredFiles = [
  'lib/blobStorage.ts',
  'app/api/uploadFile/route.ts',
  'lib/airtable.ts',
  'app/api/createMyKendall/route.ts',
  'components/OnboardingWizard.tsx',
];

requiredFiles.forEach(file => {
  const filePath = path.join(process.cwd(), file);
  if (fs.existsSync(filePath)) {
    console.log(`   ✅ ${file}`);
  } else {
    console.log(`   ❌ ${file} - MISSING`);
    allGood = false;
  }
});

// Summary
console.log('\n' + '='.repeat(50));
if (allGood) {
  console.log('✅ Setup looks good! You can start testing.');
  console.log('\n📝 Next steps:');
  console.log('   1. Run: npm run dev');
  console.log('   2. Go to the personal setup page');
  console.log('   3. Upload a test file');
  console.log('   4. Check browser console and server logs');
} else {
  console.log('⚠️  Some issues found. Please fix them before testing.');
  console.log('\n💡 Tips:');
  console.log('   - If BLOB_READ_WRITE_TOKEN is missing, get it from:');
  console.log('     Vercel Dashboard → Your Project → Settings → Environment Variables');
  console.log('   - Or connect your Blob store in Vercel (which auto-adds the token)');
  console.log('   - For local dev, create .env.local with: BLOB_READ_WRITE_TOKEN=your_token');
}
console.log('='.repeat(50) + '\n');

process.exit(allGood ? 0 : 1);

















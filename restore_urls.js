const fs = require('fs');
const path = require('path');

const srcDir = path.join(__dirname, 'frontend/src');
const backendUrl = 'https://backend.s-yuuui.workers.dev';

function processDir(dir) {
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const fullPath = path.join(dir, file);
    if (fs.statSync(fullPath).isDirectory()) {
      processDir(fullPath);
    } else if (file.endsWith('.tsx') || file.endsWith('.ts')) {
      let content = fs.readFileSync(fullPath, 'utf8');
      // Handle single quotes, double quotes, and backticks
      let newContent = content.replace(/(['"`])\/api/g, `$1${backendUrl}/api`);
      if (content !== newContent) {
        fs.writeFileSync(fullPath, newContent, 'utf8');
        console.log(`Updated: ${fullPath}`);
      }
    }
  }
}

processDir(srcDir);

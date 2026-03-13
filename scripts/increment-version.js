const fs = require('fs');
const path = require('path');

const versionFilePath = path.join(__dirname, '..', 'version.json');

try {
    const versionData = JSON.parse(fs.readFileSync(versionFilePath, 'utf8'));
    versionData.version += 1;
    fs.writeFileSync(versionFilePath, JSON.stringify(versionData, null, 2));
    console.log(`Version incremented to: ${versionData.version}`);
} catch (error) {
    console.error('Error incrementing version:', error);
    process.exit(1);
}

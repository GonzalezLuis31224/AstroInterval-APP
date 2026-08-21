const fs = require('fs');

// 1x1 transparent pixel is enough to satisfy some basic checks, 
// but let's make a real solid color PNG just in case.
// Actually, I can use a simple SVG icon and save it as PNG using canvas, 
// but wait, we don't have canvas installed.
// We can just create an SVG and reference it in the manifest!

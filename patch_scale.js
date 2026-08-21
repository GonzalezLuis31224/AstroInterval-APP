import fs from 'fs';

let content = fs.readFileSync('src/App.tsx', 'utf-8');

content = content.replace("canvas.width = img.width;", "canvas.width = Math.min(img.width, 800);");
content = content.replace("canvas.height = img.height;", "canvas.height = Math.min(img.height, 800 * (img.height / img.width));");
content = content.replace("ctx.drawImage(img, 0, 0);", "ctx.drawImage(img, 0, 0, canvas.width, canvas.height);");

fs.writeFileSync('src/App.tsx', content);

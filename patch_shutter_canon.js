import fs from 'fs';

let content = fs.readFileSync('src/App.tsx', 'utf-8');

const oldShutterBlock = `                 let data = 0;
                 if (valStr.includes('"')) {
                     const s = parseFloat(valStr.replace('"', ''));
                     data = Math.round(56 - 8 * Math.log2(s));
                 } else if (valStr.includes('/')) {
                     const x = parseFloat(valStr.split('/')[1]);
                     data = Math.round(64 + 8 * Math.log2(x / 2));
                 } else {
                     const n = parseFloat(valStr);
                     if (!isNaN(n)) {
                         if (n >= 1) {
                             data = Math.round(56 - 8 * Math.log2(n));
                         } else {
                             const inv = Math.round(1 / n);
                             data = Math.round(64 + 8 * Math.log2(inv / 2));
                         }
                     }
                 }`;

const explicitShutterMap = `                 let data = 0;
                 const shutterMap: any = {
                     "30\\"": 0x10, "25\\"": 0x13, "20\\"": 0x15, "15\\"": 0x18, "13\\"": 0x1b, "10\\"": 0x1d,
                     "8\\"": 0x20, "6\\"": 0x23, "5\\"": 0x25, "4\\"": 0x28, "3.2\\"": 0x2b, "2.5\\"": 0x2d,
                     "2\\"": 0x30, "1.6\\"": 0x33, "1.3\\"": 0x35, "1\\"": 0x38, "0.8\\"": 0x3b, "0.6\\"": 0x3d,
                     "0.5\\"": 0x40, "0.4\\"": 0x43, "0.3\\"": 0x45, 
                     "1/4": 0x48, "1/5": 0x4b, "1/6": 0x4d, "1/8": 0x50, "1/10": 0x53, "1/13": 0x55,
                     "1/15": 0x58, "1/20": 0x5b, "1/25": 0x5d, "1/30": 0x60, "1/40": 0x63, "1/50": 0x65,
                     "1/60": 0x68, "1/80": 0x6b, "1/100": 0x6d, "1/125": 0x70, "1/160": 0x73, "1/200": 0x75,
                     "1/250": 0x78, "1/320": 0x7b, "1/400": 0x7d, "1/500": 0x80, "1/640": 0x83, "1/800": 0x85,
                     "1/1000": 0x88, "1/1250": 0x8b, "1/1600": 0x8d, "1/2000": 0x90, "1/2500": 0x93,
                     "1/3200": 0x95, "1/4000": 0x98, "1/8000": 0xa0, "bulb": 0x0c
                 };
                 if (shutterMap[valStr] !== undefined) {
                     data = shutterMap[valStr];
                 } else {
                     if (valStr.includes('"')) {
                         const s = parseFloat(valStr.replace('"', ''));
                         data = Math.round(56 - 8 * Math.log2(s));
                     } else if (valStr.includes('/')) {
                         const x = parseFloat(valStr.split('/')[1]);
                         data = Math.round(64 + 8 * Math.log2(x / 2));
                     } else {
                         const n = parseFloat(valStr);
                         if (!isNaN(n)) {
                             if (n >= 1) {
                                 data = Math.round(56 - 8 * Math.log2(n));
                             } else {
                                 const inv = Math.round(1 / n);
                                 data = Math.round(64 + 8 * Math.log2(inv / 2));
                             }
                         }
                     }
                 }`;

content = content.replace(oldShutterBlock, explicitShutterMap);
fs.writeFileSync('src/App.tsx', content);

import fs from 'fs';

let content = fs.readFileSync('src/App.tsx', 'utf-8');

const mathBlock = `                     // Traductor propio de Canon para los valores
                     const valStr = String(args.value).toLowerCase();
                     if (propCode === 0xD103) { // ISO
                         const isoVal = parseInt(valStr, 10);
                         if (!isNaN(isoVal)) data = Math.round(72 + 8 * Math.log2(isoVal / 100));
                     } else if (propCode === 0xD101) { // Aperture
                         const fVal = parseFloat(valStr.replace('f/', ''));
                         if (!isNaN(fVal)) data = Math.round(24 + 16 * Math.log2(fVal / 2.0));
                     } else if (propCode === 0xD102) { // Shutter
                         if (valStr === 'bulb') data = 0x0c;
                         else if (valStr.includes('"')) {
                             const s = parseFloat(valStr.replace('"', ''));
                             data = Math.round(56 - 8 * Math.log2(s));
                         } else if (valStr.includes('/')) {
                             const x = parseFloat(valStr.split('/')[1]);
                             data = Math.round(64 + 8 * Math.log2(x / 2));
                         }
                     } else if (propCode === 0xD109) { // WB
                         if (valStr === 'auto') data = 0;
                         else if (valStr === 'daylight') data = 1;
                         else if (valStr === 'cloudy') data = 2;
                         else if (valStr === 'tungsten') data = 3;
                         else if (valStr === 'fluorescent') data = 4;
                     }`;

const explicitMaps = `                     const valStr = String(args.value).toLowerCase();
                     if (propCode === 0xD103) { // ISO
                         const isoMap: any = {
                             "auto": 0x00, "50": 0x40, "100": 0x48, "125": 0x4b, "160": 0x4d, "200": 0x50,
                             "250": 0x53, "320": 0x55, "400": 0x58, "500": 0x5b, "640": 0x5d, "800": 0x60,
                             "1000": 0x63, "1250": 0x65, "1600": 0x68, "2000": 0x6b, "2500": 0x6d, "3200": 0x70,
                             "4000": 0x73, "5000": 0x75, "6400": 0x78, "12800": 0x80, "25600": 0x88, "51200": 0x90,
                             "102400": 0x98
                         };
                         if (isoMap[valStr] !== undefined) data = isoMap[valStr];
                         else {
                            const isoVal = parseInt(valStr, 10);
                            if (!isNaN(isoVal)) data = Math.round(72 + 8 * Math.log2(isoVal / 100));
                         }
                     } else if (propCode === 0xD101) { // Aperture
                         const apMap: any = {
                             "1.0": 0x08, "1.1": 0x0b, "1.2": 0x0c, "1.4": 0x10, "1.6": 0x13, "1.8": 0x15,
                             "2.0": 0x18, "2.2": 0x1b, "2.5": 0x1d, "2.8": 0x20, "3.2": 0x23, "3.5": 0x25,
                             "4.0": 0x28, "4.5": 0x2b, "5.0": 0x2d, "5.6": 0x30, "6.3": 0x33, "6.7": 0x34,
                             "7.1": 0x35, "8.0": 0x38, "9.0": 0x3b, "9.5": 0x3c, "10": 0x3d, "11": 0x40,
                             "13": 0x43, "14": 0x45, "16": 0x48, "18": 0x4b, "19": 0x4c, "20": 0x4d,
                             "22": 0x50, "25": 0x53, "27": 0x54, "29": 0x55, "32": 0x58
                         };
                         const cleanAp = valStr.replace('f/', '');
                         if (apMap[cleanAp] !== undefined) data = apMap[cleanAp];
                         else {
                             const fVal = parseFloat(cleanAp);
                             if (!isNaN(fVal)) data = Math.round(24 + 16 * Math.log2(fVal / 2.0));
                         }
                     } else if (propCode === 0xD102) { // Shutter
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
                         if (shutterMap[valStr] !== undefined) data = shutterMap[valStr];
                         else {
                             if (valStr.includes('"')) {
                                 const s = parseFloat(valStr.replace('"', ''));
                                 data = Math.round(56 - 8 * Math.log2(s));
                             } else if (valStr.includes('/')) {
                                 const x = parseFloat(valStr.split('/')[1]);
                                 data = Math.round(64 + 8 * Math.log2(x / 2));
                             }
                         }
                     } else if (propCode === 0xD109) { // WB
                         if (valStr === 'auto') data = 0;
                         else if (valStr === 'daylight') data = 1;
                         else if (valStr === 'cloudy') data = 2;
                         else if (valStr === 'tungsten') data = 3;
                         else if (valStr === 'fluorescent') data = 4;
                     }`;

content = content.replace(mathBlock, explicitMaps);
fs.writeFileSync('src/App.tsx', content);

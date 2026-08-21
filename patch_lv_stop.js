import fs from 'fs';
let content = fs.readFileSync('src/App.tsx', 'utf-8');

const oldStop = `                   setLiveViewActive(false);
                   if ((camera as any).device) {
                       await (camera as any).device.sendCommand({ opcode: 0x9152 }).catch(()=>null);
                   } else {`;

const newStop = `                   setLiveViewActive(false);
                   if ((camera as any).device) {
                       console.log("Apagando LiveView (Canon Hack)...");
                       try {
                           const size = 12;
                           const buffer = new ArrayBuffer(size);
                           const view = new DataView(buffer);
                           view.setUint32(0, size, true);
                           view.setUint32(4, 0xD1B0, true);
                           view.setUint32(8, 0, true); 
                           await (camera as any).device.sendData({ opcode: 0x9110, data: buffer });
                           console.log("EVF Output Mode Set to OFF");
                       } catch (e) {
                           console.log("Failed to turn off D1B0", e);
                       }
                       await (camera as any).device.sendCommand({ opcode: 0x9152 }).catch(()=>null);
                   } else {`;

if (content.includes(oldStop)) {
  content = content.replace(oldStop, newStop);
  fs.writeFileSync('src/App.tsx', content);
  console.log("Stop LiveView patched.");
} else {
  console.log("Stop LiveView block not found.");
}

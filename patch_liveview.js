import fs from 'fs';
let content = fs.readFileSync('src/App.tsx', 'utf-8');

// The start sequence currently has:
// await (camera as any).device.sendCommand({ opcode: 0x9151 }).catch(()=>null);
// await (camera as any).device.sendCommand({ opcode: 0x9152 }).catch(()=>null);

content = content.replace(
  "await (camera as any).device.sendCommand({ opcode: 0x9151 }).catch(()=>null);\n                       await (camera as any).device.sendCommand({ opcode: 0x9152 }).catch(()=>null);",
  "await (camera as any).device.sendCommand({ opcode: 0x9151 }).catch(()=>null);"
);

fs.writeFileSync('src/App.tsx', content);

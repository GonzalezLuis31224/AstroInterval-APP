import fs from 'fs';

let content = fs.readFileSync('src/App.tsx', 'utf-8');

// Replace fetchLastPhoto
const newFetch = `
  const fetchLastPhoto = async () => {
    if (!camera) return;
    setIsFetchingPhoto(true);
    try {
      const handles = await (camera as any).getObjectHandles();
      if (!handles || handles.length === 0) {
        alert("No se encontraron fotos en la cámara.");
        setIsFetchingPhoto(false);
        return;
      }
      const lastHandle = handles[handles.length - 1];
      setStatusText("Descargando última foto...");
      
      let thumbBuffer = null;
      try {
          const { data } = await (camera as any).device.receiveData({
              opcode: 4106, // GetThumb
              parameters: [lastHandle]
          });
          thumbBuffer = data;
      } catch (e) {
          console.log("No thumb...", e);
      }
      
      let exifBuffer = null;
      try {
          // Get first 128KB for EXIF parsing
          const { data } = await (camera as any).device.receiveData({
              opcode: 4123, // GetPartialObject
              parameters: [lastHandle, 0, 131072] // 128 KB
          });
          exifBuffer = data;
      } catch (e) {
          console.log("GetPartialObject failed, using thumb for EXIF...", e);
          exifBuffer = thumbBuffer;
      }
      
      if (!thumbBuffer || thumbBuffer.byteLength < 1000) {
         setStatusText("Descargando original...");
         thumbBuffer = await (camera as any).getObject(lastHandle).catch(() => null);
         if (!exifBuffer) exifBuffer = thumbBuffer;
      }
      
      if (thumbBuffer) {
          let iso = "N/A", aperture = "N/A", shutter = "N/A";
          
          if (exifBuffer) {
              const exif = await exifr.parse(exifBuffer).catch(() => null);
              if (exif) {
                  if (exif.ISO) iso = String(exif.ISO);
                  if (exif.FNumber) aperture = \`f/\${exif.FNumber}\`;
                  if (exif.ExposureTime) {
                      shutter = exif.ExposureTime < 1 ? \`1/\${Math.round(1/exif.ExposureTime)}\` : \`\${exif.ExposureTime}"\`;
                  }
              }
          }
          
          // Fallback to current camera settings if EXIF is still missing
          if (iso === "N/A" || iso === "undefined") {
              const cIso = await camera.getISO().catch(()=>null);
              if (cIso) iso = cIso.value + " (Cam)";
          }
          if (aperture === "N/A" || aperture === "undefined") {
              const cAp = await camera.getAperture().catch(()=>null);
              if (cAp) aperture = cAp.value + " (Cam)";
          }
          if (shutter === "N/A" || shutter === "undefined") {
              const cSh = await camera.getShutterSpeed().catch(()=>null);
              if (cSh) shutter = cSh.value + " (Cam)";
          }
          
          const blob = new Blob([thumbBuffer], { type: 'image/jpeg' });
          const url = URL.createObjectURL(blob);
          
          const img = new Image();
          img.onload = () => {
             const canvas = document.createElement('canvas');
             const ctx = canvas.getContext('2d');
             canvas.width = Math.min(img.width, 800);
             canvas.height = Math.min(img.height, 800 * (img.height / img.width));
             ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
             const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
             const hist = new Array(256).fill(0);
             let maxHist = 0;
             for (let i = 0; i < imgData.length; i += 16) {
                 const r = imgData[i];
                 const g = imgData[i+1];
                 const b = imgData[i+2];
                 const luminance = Math.round(0.299 * r + 0.587 * g + 0.114 * b);
                 hist[luminance]++;
                 if (hist[luminance] > maxHist) maxHist = hist[luminance];
             }
             setLastPhoto({ url, iso, aperture, shutter, hist, maxHist });
             setIsFetchingPhoto(false);
             setStatusText("Listo.");
          };
          img.src = url;
          setGalleryOpen(true);
      }
    } catch (e) {
       console.error(e);
       alert("Error obteniendo la foto: " + (e?.message || "Error desconocido"));
       setIsFetchingPhoto(false);
       setStatusText("Error en descarga.");
    }
  };
`;

content = content.replace(/const fetchLastPhoto = async \(\) => \{[\s\S]*?setStatusText\("Error en descarga\."\);\n    \}\n  \};\n/, newFetch + '\n');

// Also fix the LiveView stop opcode
// From: await (camera as any).device.sendCommand({ opcode: 0x9154 }).catch(()=>null);
// To: await (camera as any).device.sendCommand({ opcode: 0x9152 }).catch(()=>null);
content = content.replace(/await \(camera as any\).device.sendCommand\(\{ opcode: 0x9154 \}\).catch\(\(\)=>null\);/g, "await (camera as any).device.sendCommand({ opcode: 0x9152 }).catch(()=>null);");

fs.writeFileSync('src/App.tsx', content);

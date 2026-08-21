import fs from 'fs';

let content = fs.readFileSync('src/App.tsx', 'utf-8');

// Update state
const oldState = `  const [galleryOpen, setGalleryOpen] = useState(false);
  const [lastPhoto, setLastPhoto] = useState<{ url: string; iso: string; aperture: string; shutter: string; hist: number[]; maxHist: number } | null>(null);
  const [isFetchingPhoto, setIsFetchingPhoto] = useState(false);`;

const newState = `  const [galleryOpen, setGalleryOpen] = useState(false);
  const [galleryPhotos, setGalleryPhotos] = useState<{ handle: number, url: string, thumbBuffer: ArrayBuffer }[]>([]);
  const [selectedPhotoIndex, setSelectedPhotoIndex] = useState<number>(0);
  const [lastPhoto, setLastPhoto] = useState<{ url: string; iso: string; aperture: string; shutter: string; hist: number[]; maxHist: number } | null>(null);
  const [isFetchingPhoto, setIsFetchingPhoto] = useState(false);`;

content = content.replace(oldState, newState);

// Update fetchLastPhoto
const oldFetchRegex = /const fetchLastPhoto = async \(\) => \{[\s\S]*?setStatusText\("Error en descarga\."\);\n    \}\n  \};\n/;

const newFetch = `
  const fetchGallery = async () => {
    if (!camera) return;
    setIsFetchingPhoto(true);
    try {
      const handles = await (camera as any).getObjectHandles();
      if (!handles || handles.length === 0) {
        alert("No se encontraron fotos en la cámara.");
        setIsFetchingPhoto(false);
        return;
      }
      
      const recentHandles = handles.slice(-5).reverse(); // Last 5, newest first
      setStatusText(\`Descargando \${recentHandles.length} fotos...\`);
      
      let fetchedPhotos = [];
      for (const handle of recentHandles) {
          let thumbBuffer = null;
          try {
              const { data } = await (camera as any).device.receiveData({ opcode: 4106, parameters: [handle] });
              thumbBuffer = data;
          } catch (e) { }
          
          if (!thumbBuffer || thumbBuffer.byteLength < 1000) {
              thumbBuffer = await (camera as any).getObject(handle).catch(() => null);
          }
          if (thumbBuffer) {
              const blob = new Blob([thumbBuffer], { type: 'image/jpeg' });
              fetchedPhotos.push({ handle, url: URL.createObjectURL(blob), thumbBuffer });
          }
      }
      
      if (fetchedPhotos.length > 0) {
          setGalleryPhotos(fetchedPhotos);
          setSelectedPhotoIndex(0);
          await loadPhotoDetails(fetchedPhotos[0].handle, fetchedPhotos[0].thumbBuffer, fetchedPhotos[0].url);
          setGalleryOpen(true);
      } else {
          alert("No se pudieron descargar las fotos.");
      }
    } catch (e: any) {
       console.error(e);
       alert("Error obteniendo fotos: " + (e?.message || "Error desconocido"));
    }
    setIsFetchingPhoto(false);
    setStatusText("Listo.");
  };

  const loadPhotoDetails = async (handle: number, thumbBuffer: ArrayBuffer, url: string) => {
      let iso = "N/A", aperture = "N/A", shutter = "N/A";
      
      let exifBuffer = null;
      try {
          const { data } = await (camera as any).device.receiveData({ opcode: 4123, parameters: [handle, 0, 131072] });
          exifBuffer = data;
      } catch (e) {
          exifBuffer = thumbBuffer;
      }
      
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
      
      // Fallback
      if (iso === "N/A" || iso === "undefined") {
          const cIso = await camera?.getISO().catch(()=>null);
          if (cIso) iso = cIso.value + " (Cam)";
      }
      if (aperture === "N/A" || aperture === "undefined") {
          const cAp = await camera?.getAperture().catch(()=>null);
          if (cAp) aperture = cAp.value + " (Cam)";
      }
      if (shutter === "N/A" || shutter === "undefined") {
          const cSh = await camera?.getShutterSpeed().catch(()=>null);
          if (cSh) shutter = cSh.value + " (Cam)";
      }
      
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
      };
      img.src = url;
  };
`;

content = content.replace(oldFetchRegex, newFetch + '\n');

// Replace fetchLastPhoto button usage
content = content.replace("onClick={fetchLastPhoto}", "onClick={fetchGallery}");

// Replace modal
const oldModalRegex = /\{galleryOpen && lastPhoto && \([\s\S]*?\}\n    <\/div>\n  \);\n\}/;

const newModal = `{galleryOpen && lastPhoto && (
        <div className="fixed inset-0 z-[100] bg-black flex flex-col items-center justify-center p-4 md:p-8">
           <button onClick={() => setGalleryOpen(false)} className="absolute top-4 right-4 px-4 py-2 bg-neutral-800 hover:bg-neutral-700 transition-colors rounded-full text-white font-bold shadow-lg z-10">
              Cerrar
           </button>
           <div className="w-full max-w-5xl flex flex-col gap-4 overflow-y-auto max-h-full pb-10">
               {/* Gallery Strip */}
               {galleryPhotos.length > 1 && (
                 <div className="flex gap-2 overflow-x-auto pb-2 justify-start md:justify-center shrink-0">
                    {galleryPhotos.map((photo, i) => (
                       <button 
                         key={i} 
                         onClick={() => {
                            setSelectedPhotoIndex(i);
                            loadPhotoDetails(photo.handle, photo.thumbBuffer, photo.url);
                         }}
                         className={\`shrink-0 w-24 h-16 rounded-lg overflow-hidden border-2 transition-all \${i === selectedPhotoIndex ? 'border-blue-500 opacity-100 scale-105' : 'border-transparent opacity-50 hover:opacity-100'}\`}
                       >
                         <img src={photo.url} className="w-full h-full object-cover" />
                       </button>
                    ))}
                 </div>
               )}
               
               {/* Main Image */}
               <img src={lastPhoto.url} className="w-full h-auto max-h-[50vh] object-contain rounded-xl border border-neutral-700 bg-neutral-900 shrink-0" />
               
               {/* Metadata & Histogram */}
               <div className="flex flex-col sm:flex-row gap-4 p-4 bg-neutral-900 rounded-xl text-white border border-neutral-800 shrink-0">
                  <div className="flex-1 flex flex-col justify-center border-b sm:border-b-0 sm:border-r border-neutral-700 pb-4 sm:pb-0 sm:pr-4">
                     <p className="text-sm opacity-50 mb-2 font-bold tracking-widest uppercase">Parámetros EXIF</p>
                     <p className="font-mono text-xl"><span className="opacity-50 text-sm w-20 inline-block">ISO</span> {lastPhoto.iso}</p>
                     <p className="font-mono text-xl"><span className="opacity-50 text-sm w-20 inline-block">Apertura</span> {lastPhoto.aperture}</p>
                     <p className="font-mono text-xl"><span className="opacity-50 text-sm w-20 inline-block">Veloc.</span> {lastPhoto.shutter}</p>                  </div>
                  <div className="flex-[2]">
                     <p className="text-sm opacity-50 mb-2 font-bold tracking-widest uppercase">Histograma de Luminancia</p>
                     <div className="w-full h-24 flex items-end justify-between border-b border-neutral-700 pb-1">
                        {lastPhoto.hist.map((val, i) => (
                           <div key={i} className={\`bg-white \${val > 0 ? 'opacity-80' : 'opacity-0'}\`} style={{ width: '100%', height: \`\${Math.max(1, (val / lastPhoto.maxHist) * 100)}%\` }} />
                        ))}
                     </div>
                  </div>
               </div>
           </div>
        </div>
      )}
    </div>
  );
}`;

content = content.replace(oldModalRegex, newModal);

fs.writeFileSync('src/App.tsx', content);

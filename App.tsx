import React, { useState, useEffect, useRef } from 'react';
import { Camera, Image as ImageIcon, Play, Square, Settings2, Moon, Sun, Usb, MonitorPlay, AlertCircle, Maximize, Minimize, Video, VideoOff, ZoomIn, ZoomOut } from 'lucide-react';
import { TethrManager } from 'tethr';
import exifr from 'exifr';
import { ParameterDial } from './ParameterDial';

const FALLBACK_ISO = ["Auto", "100", "200", "400", "800", "1600", "3200", "6400"];
const FALLBACK_APERTURE = ["1.8", "2.0", "2.2", "2.5", "2.8", "3.2", "3.5", "4.0", "4.5", "5.0", "5.6", "6.3", "7.1", "8.0", "9.0", "10", "11", "13", "14", "16", "18", "20", "22"];
const FALLBACK_SHUTTER = ["Bulb", "30\"", "25\"", "20\"", "15\"", "13\"", "10\"", "8\"", "6\"", "5\"", "4\"", "3.2\"", "2.5\"", "2\"", "1.6\"", "1.3\"", "1\"", "0.8\"", "0.6\"", "0.5\"", "0.4\"", "0.3\"", "1/4", "1/5", "1/6", "1/8", "1/10", "1/13", "1/15", "1/20", "1/25", "1/30", "1/40", "1/50", "1/60", "1/80", "1/100", "1/125", "1/160", "1/200", "1/250", "1/320", "1/400", "1/500", "1/640", "1/800", "1/1000", "1/1250", "1/1600", "1/2000", "1/2500", "1/3200", "1/4000"];
const FALLBACK_WB = ["auto", "daylight", "cloudy", "tungsten", "fluorescent", "flash", "custom", "shade", "kelvin"];

interface AppState {
  iso: string;
  aperture: string;
  shutter: string;
  whiteBalance: string;
  delay: number;
  bulbTime: number;
  interval: number;
  shots: number; // 0 = infinite
}

export default function App() {
  const [isRedMode, setIsRedMode] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);

  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
  }, []);
  const [camera, setCamera] = useState<any>(null); // Tethr camera instance
  const [cameraName, setCameraName] = useState<string>('');
  const [isRunning, setIsRunning] = useState(false);
  const [currentShot, setCurrentShot] = useState(0);
  const [statusText, setStatusText] = useState("Esperando...");
  const [liveViewActive, setLiveViewActive] = useState(false);
  const liveViewActiveRef = useRef(false);
  const [liveViewZoom, setLiveViewZoom] = useState(1);
  const [zoomPos, setZoomPos] = useState({ x: 50, y: 50 });
  const zoomDragRef = useRef({ isDragging: false, startX: 0, startY: 0, startPosX: 50, startPosY: 50 });
  useEffect(() => {
    liveViewActiveRef.current = liveViewActive;
  }, [liveViewActive]);

  
  const [galleryOpen, setGalleryOpen] = useState(false);
  const [galleryPhotos, setGalleryPhotos] = useState<{ handle: number, url: string, thumbBuffer: ArrayBuffer }[]>([]);
  const [selectedPhotoIndex, setSelectedPhotoIndex] = useState<number>(0);
  const [lastPhoto, setLastPhoto] = useState<{ url: string; iso: string; aperture: string; shutter: string; hist: number[]; maxHist: number } | null>(null);
  const [isFetchingPhoto, setIsFetchingPhoto] = useState(false);

  
  
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
      setStatusText(`Descargando ${recentHandles.length} fotos...`);
      
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
              if (exif.FNumber) aperture = `f/${exif.FNumber}`;
              if (exif.ExposureTime) {
                  shutter = exif.ExposureTime < 1 ? `1/${Math.round(1/exif.ExposureTime)}` : `${exif.ExposureTime}"`;
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



  const [supportedConfigs, setSupportedConfigs] = useState<{
    iso: string[];
    aperture: string[];
    shutterSpeed: string[];
    whiteBalance: string[];
  }>({ iso: [], aperture: [], shutterSpeed: [], whiteBalance: [] });
  
  const videoRef = useRef<HTMLVideoElement>(null);
  const managerRef = useRef<TethrManager | null>(null);
  const [logs, setLogs] = useState<string[]>([]);
  const logsRef = useRef<string[]>([]);

  useEffect(() => {
    // Intercept console for mobile debugging
    const originalLog = console.log;
    const originalError = console.error;
    const originalWarn = console.warn;
    
    const addLog = (msg: string) => {
      logsRef.current = [...logsRef.current.slice(-50), msg];
      setLogs([...logsRef.current]);
    };

    const serializeArg = (a: any) => {
      if (a instanceof Error) return `${a.name}: ${a.message}`;
      if (typeof a === 'object') {
        try {
          return JSON.stringify(a);
        } catch(e) {
          return '[Objeto Complejo]';
        }
      }
      return String(a);
    };

    console.log = (...args) => {
      originalLog(...args);
      addLog('[LOG] ' + args.map(serializeArg).join(' '));
    };
    console.error = (...args) => {
      originalError(...args);
      addLog('[ERR] ' + args.map(serializeArg).join(' '));
    };
    console.warn = (...args) => {
      originalWarn(...args);
      addLog('[WARN] ' + args.map(serializeArg).join(' '));
    };

    return () => {
      console.log = originalLog;
      console.error = originalError;
      console.warn = originalWarn;
    };
  }, []);

  useEffect(() => {
     managerRef.current = new TethrManager();
  }, []);

  const [settings, setSettings] = useState<AppState>({
    iso: "800",
    aperture: "f/2.8",
    shutter: "Bulb",
    whiteBalance: "auto",
    delay: 5,
    bulbTime: 30,
    interval: 5,
    shots: 0,
  });

  const runRef = useRef(isRunning);
  useEffect(() => {
    runRef.current = isRunning;
  }, [isRunning]);

  const connectUSB = async () => {
    try {
      if (!("usb" in navigator)) {
        alert("Tu navegador no soporta WebUSB. Por favor usa Google Chrome en Android.");
        return;
      }
      
      if (!managerRef.current) return;

      setStatusText("Buscando cámaras por PTP/WebUSB...");
      
      let usbDevice;
      try {
        usbDevice = await (navigator as any).usb.requestDevice({
          filters: [{ vendorId: 0x04a9 }] // Canon Vendor ID
        });
      } catch (e: any) {
        setStatusText("Cancelaste o no se encontraron cámaras.");
        return;
      }

      if (!usbDevice) return;
      
      // Import dynamicly to avoid issues
      const { initTethrUSBPTP } = await import('tethr/lib/TethrPTPUSB/index.js');
      const result = await initTethrUSBPTP(usbDevice);
      
      if (result.status !== 'ok' || !result.value) {
        setStatusText("El dispositivo no respondió como cámara PTP.");
        return;
      }
      
      const cam = result.value;
      
      setStatusText("Abriendo sesión PTP...");
      await cam.open();
      
      const model = await cam.getDesc('model');
      setCameraName(model?.value || 'Cámara conectada');
      setCamera(cam);
      setStatusText(`Conectado a: ${model?.value || 'Cámara'}`);
      
      // Intentar forzar que guarde en la SD de la cámara
      try {
        await cam.set('destinationToSave', 'camera');
      } catch (e) {
        console.warn("Could not set destination", e);
      }

      // HACK CANON: Poner en PC Connect Mode (0x9114) y Remote Mode (0x9115)
      try {
        if ((cam as any).device && (cam as any).device.sendCommand) {
          console.log("Iniciando modo PC Connect para Canon...");
          await (cam as any).device.sendCommand({ opcode: 0x9114, parameters: [1] });
          await (cam as any).device.sendCommand({ opcode: 0x9115, parameters: [1] });
          
          // HACK CANON: Interceptar lecturas y escrituras de parámetros (0x1016 -> 0x9110)
          const origSet = (cam as any).setDevicePropValue.bind(cam);
          (cam as any).setDevicePropValue = async function(args: any) {
             let propCode = args.devicePropCode;
             if (propCode === 0x500F) propCode = 0xD103; // ISO
             if (propCode === 0x5007) propCode = 0xD101; // Aperture
             if (propCode === 0x500D) propCode = 0xD102; // Shutter
             if (propCode === 0x5005) propCode = 0xD109; // WB
             try {
                 // Try standard first
                 return await origSet(args);
             } catch (e: any) {
                 if (e.message && (e.message.includes('0x200a') || e.message.includes('0x2019') || e.message.includes('Cannot send data'))) {
                     console.log(`Canon 0x1016 falló. Usando 0x9110 para propiedad original 0x${args.devicePropCode.toString(16)} transformada a 0x${propCode.toString(16)}...`);
                     let data = args.encode(args.value);
                     
                     const valStr = String(args.value).toLowerCase();
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
                             "30\"": 0x10, "25\"": 0x13, "20\"": 0x15, "15\"": 0x18, "13\"": 0x1b, "10\"": 0x1d,
                             "8\"": 0x20, "6\"": 0x23, "5\"": 0x25, "4\"": 0x28, "3.2\"": 0x2b, "2.5\"": 0x2d,
                             "2\"": 0x30, "1.6\"": 0x33, "1.3\"": 0x35, "1\"": 0x38, "0.8\"": 0x3b, "0.6\"": 0x3d,
                             "0.5\"": 0x40, "0.4\"": 0x43, "0.3\"": 0x45, 
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
                     }

                     if (data !== null) {
                        const size = 12;
                        const buffer = new ArrayBuffer(size);
                        const view = new DataView(buffer);
                        view.setUint32(0, size, true);
                        view.setUint32(4, propCode, true);
                        view.setUint32(8, data, true); // Canon properties usually Uint32 in EX or Uint16
                        
                        // Solo usar sendData simple, el lock a veces causa DeviceBusy si no se maneja bien
                        const res = await this.device.sendData({ opcode: 0x9110, data: buffer });
                        console.log(`0x9110 éxito para 0x${propCode.toString(16)} con valor ${data}:`, res);
                        return { status: 'ok', value: res };
                     }
                 }
                 throw e;
             }
          };
        }
      } catch (e) {
        console.warn("No se pudo iniciar modo PC Connect (puede no ser Canon)", e);
      }

      // Fetch supported configs to populate dropdowns
      const isoDesc = await cam.getDesc('iso');
      const apertureDesc = await cam.getDesc('aperture');
      const shutterDesc = await cam.getDesc('shutterSpeed');
      const wbDesc = await cam.getDesc('whiteBalance');

      setSupportedConfigs({
        iso: (isoDesc?.option && 'values' in isoDesc.option) ? isoDesc.option.values.map(String) : [],
        aperture: (apertureDesc?.option && 'values' in apertureDesc.option) ? apertureDesc.option.values.map(String) : [],
        shutterSpeed: (shutterDesc?.option && 'values' in shutterDesc.option) ? shutterDesc.option.values.map(String) : [],
        whiteBalance: (wbDesc?.option && 'values' in wbDesc.option) ? wbDesc.option.values.map(String) : []
      });

    } catch (error: any) {
      console.error(error);
      alert(`Error al conectar: ${error.message || 'Asegúrate de dar los permisos y conectar el OTG.'}`);
      setStatusText("Error en conexión.");
    }
  };

  const handleStart = async () => {
    if (!camera) {
      alert("Por favor conecta la cámara primero.");
      return;
    }
    
    setIsRunning(true);
    setCurrentShot(0);
    setStatusText("Iniciando secuencia...");
    
    // Función auxiliar para esperar
    const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

    // Apagar Live View para ahorrar batería y evitar errores
    if (liveViewActive) {
      console.log("Apagando LiveView para la secuencia...");
      await camera.stopLiveview();
      if ((camera as any).device && (camera as any).device.sendCommand) {
         await (camera as any).device.sendCommand({ opcode: 0x9152 }).catch(()=>null);
      }
      setLiveViewActive(false);
      await sleep(1000);
    }

    // Apply settings if supported
    try {
      if (settings.iso) {
         const r = await camera.set('iso', settings.iso);
         if (r.status !== 'ok') console.error('ISO error:', r);
      }
      if (settings.aperture) {
         const r = await camera.set('aperture', settings.aperture);
         if (r.status !== 'ok') console.error('Aperture error:', r);
      }
      if (settings.whiteBalance) {
         const r = await camera.set('whiteBalance', settings.whiteBalance);
         if (r.status !== 'ok') console.error('WB error:', r);
      }
      if (settings.shutter !== 'Bulb') {
         let r = await camera.set('shutterSpeed', settings.shutter);
         if (r.status === 'unsupported' && (camera as any).device) {
             console.log("Forzando shutter por ruta Canon (0xD102)...");
             try {
                 const valStr = String(settings.shutter).toLowerCase();
                 console.log("Shutter value string:", valStr);
                 let data = 0;
                 const shutterMap: any = {
                     "30\"": 0x10, "25\"": 0x13, "20\"": 0x15, "15\"": 0x18, "13\"": 0x1b, "10\"": 0x1d,
                     "8\"": 0x20, "6\"": 0x23, "5\"": 0x25, "4\"": 0x28, "3.2\"": 0x2b, "2.5\"": 0x2d,
                     "2\"": 0x30, "1.6\"": 0x33, "1.3\"": 0x35, "1\"": 0x38, "0.8\"": 0x3b, "0.6\"": 0x3d,
                     "0.5\"": 0x40, "0.4\"": 0x43, "0.3\"": 0x45, 
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
                 }
                 console.log("Calculated shutter data:", data);
                 if (data > 0) {
                     const buffer = new ArrayBuffer(12);
                     const view = new DataView(buffer);
                     view.setUint32(0, 12, true);
                     view.setUint32(4, 0xD102, true);
                     view.setUint32(8, data, true);
                     const rawRes = await (camera as any).device.sendData({ opcode: 0x9110, data: buffer });
                     console.log("Forzado de shutter exitoso:", rawRes);
                     r = { status: 'ok' };
                 }
             } catch(e: any) {
                 console.error("Fallo forzado de shutter:", e);
             }
         }
         if (r.status !== 'ok') console.error('Shutter error:', r);
      } else {
         let r = await camera.set('shutterSpeed', 'Bulb').catch(e => ({ status: 'error', message: e.message }));
         if (r && r.status !== 'ok' && (camera as any).device) {
            console.log("Forzando shutter BULB por ruta Canon (0xD102)...");
            try {
               const buffer = new ArrayBuffer(12);
               const view = new DataView(buffer);
               view.setUint32(0, 12, true);
               view.setUint32(4, 0xD102, true);
               view.setUint32(8, 0x0c, true);
               const rawRes = await (camera as any).device.sendData({ opcode: 0x9110, data: buffer });
               console.log("Forzado de BULB exitoso:", rawRes);
            } catch(e: any) {
               console.error("Fallo forzado de BULB:", e);
            }
         }
      }
    } catch(e) {
      console.warn("Error al setear parámetros, usando los actuales", e);
    }

    // 1. Delay Inicial
    if (settings.delay > 0) {
      for(let i = settings.delay; i > 0; i--) {
        if (!runRef.current) break;
        setStatusText(`Retraso inicial: ${i}s...`);
        await sleep(1000);
      }
    }

    // Helper function para disparar Canon de forma nativa
    const canonShoot = async (dev: any, isBulb: boolean, bulbTime: number) => {
      try {
        console.log(`[SHOOT] Iniciando Secuencia (Bulb: ${isBulb})...`);
        
        // Helper interno con Timeout para que no se congele si la cámara no responde
        const sendWithTimeout = async (opcode: number, parameters: number[], timeoutMs = 4000) => {
          let timeoutHandle: any;
          const timeoutPromise = new Promise((_, reject) => {
            timeoutHandle = setTimeout(() => reject(new Error(`Timeout de cámara en opcode ${opcode.toString(16)}`)), timeoutMs);
          });
          try {
            const result = await Promise.race([
              dev.sendCommand({ opcode, parameters }),
              timeoutPromise
            ]);
            clearTimeout(timeoutHandle);
            return result;
          } catch (e) {
            clearTimeout(timeoutHandle);
            throw e;
          }
        };

        // 1. Half-press (AutoFoco)
        console.log(`[SHOOT] AF (Half Press)`);
        await sendWithTimeout(0x9128, [1, 0], 3000).catch((e:any) => console.log('AF Info:', e.message));
        await sleep(500); // Darle un momentito extra al lente
        
        // 2. Full-press (Gatillo Shutter)
        console.log(`[SHOOT] Gatillo (Full Press)`);
        // Le damos 6 segundos de timeout por si tarda en enfocar y disparar en modo AF
        if (isBulb) {
           await sendWithTimeout(0x9128, [3, 0], 6000).catch((e:any) => console.log('Bulb Start Info:', e.message));
        } else {
           await sendWithTimeout(0x9128, [2, 0], 6000).catch((e:any) => console.log('Shutter Info:', e.message));
        }
        
        // 3. Exposición
        if (isBulb) {
           for(let i = bulbTime; i > 0; i--) {
             if (!runRef.current) break;
             setStatusText(`Exponiendo [Bulb]: ${i}s restantes...`);
             await sleep(1000);
           }
        } else {
           await sleep(300); // Exposición normal rápida
        }
        
        // 4. Liberar botones
        console.log(`[SHOOT] Liberando gatillo...`);
        if (isBulb) {
           await sendWithTimeout(0x9129, [3], 2000).catch((e:any) => console.log('Bulb End Info:', e.message));
        } else {
           await sendWithTimeout(0x9129, [2], 2000).catch((e:any) => console.log('RelShutter Info:', e.message));
           await sendWithTimeout(0x9129, [1], 2000).catch((e:any) => console.log('RelAF Info:', e.message));
        }
        
        console.log(`[SHOOT] Ciclo finalizado`);
        return true;
      } catch (e: any) {
        console.error("Fallo general disparo Canon:", e);
        return false;
      }
    };

    let shotCount = 1;
    
    while (runRef.current && (settings.shots === 0 || shotCount <= settings.shots)) {
      setCurrentShot(shotCount);
      
      const isBulb = settings.shutter === "Bulb";
      setStatusText(`Tomando foto ${shotCount}... ${isBulb ? `(Bulb ${settings.bulbTime}s)` : ''}`);
      
      try {
         if ((camera as any).device && (camera as any).device.sendCommand) {
            await canonShoot((camera as any).device, isBulb, settings.bulbTime);
         } else {
            // Fallback genérico para otras marcas
            console.log("Intentando disparo genérico...");
            const r = await camera.takePhoto({ doDownload: false });
            if (r.status !== 'ok') {
               console.error("Error en disparo genérico:", r);
               setStatusText(`Error disparando: ${r.status}`);
            }
         }
      } catch (e: any) {
         console.error("Excepción disparando", e);
      }

      if (!runRef.current) break;

      // 3. Intervalo de espera
      if ((settings.shots === 0 || shotCount < settings.shots) && settings.interval > 0) {
        for(let i = settings.interval; i > 0; i--) {
          if (!runRef.current) break;
          setStatusText(`Esperando intervalo: ${i}s...`);
          await sleep(1000);
        }
      }

      shotCount++;
    }

    if (runRef.current) {
      setIsRunning(false);
      setStatusText("Secuencia completada.");
    }
  };

  const handleStop = async () => {
    setIsRunning(false);
    runRef.current = false;
    setStatusText("Secuencia detenida por el usuario.");
  };

  // Tema de color dinámico
  const themeClass = isRedMode 
    ? "bg-black text-red-600 border-red-900 ring-red-900 selection:bg-red-900" 
    : "bg-neutral-950 text-neutral-100 border-neutral-800 ring-neutral-800";
    
  const accentClass = isRedMode
    ? "bg-red-950 text-red-500 hover:bg-red-900 border-red-900"
    : "bg-neutral-800 text-neutral-200 hover:bg-neutral-700 border-neutral-700";

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => {});
    } else {
      if (document.exitFullscreen) {
        document.exitFullscreen();
      }
    }
  };

  return (
    <div className={`min-h-screen font-mono p-4 pb-24 transition-colors duration-300 ${themeClass}`}>
      <div className="max-w-2xl mx-auto space-y-6">
        
        {/* HEADER */}
        <div className="flex items-center justify-between pb-4 border-b border-current opacity-80">
          <div className="flex items-center gap-3">
            <Camera className="w-6 h-6" />
            <h1 className="text-xl font-bold tracking-wider">AstroInterval</h1>
          </div>
          <div className="flex items-center gap-2">
            
            <button 
              onClick={fetchGallery}
              className={`p-2 rounded-full border ${accentClass} transition-all ${isFetchingPhoto ? 'animate-pulse' : ''}`}
              title="Última Foto (EXIF e Histograma)"
              disabled={!camera || isFetchingPhoto}
            >
              <ImageIcon className="w-5 h-5" />
            </button>

            <button 
              onClick={toggleFullscreen}
              className={`p-2 rounded-full border ${accentClass} transition-all`}
              title="Pantalla Completa"
            >
              {isFullscreen ? <Minimize className="w-5 h-5" /> : <Maximize className="w-5 h-5" />}
            </button>
            <button 
              onClick={() => setIsRedMode(!isRedMode)}
              className={`p-2 rounded-full border ${accentClass} transition-all`}
              title="Cambiar Modo Nocturno (Rojo)"
            >
              {isRedMode ? <Moon className="w-5 h-5" /> : <Sun className="w-5 h-5" />}
            </button>
          </div>
        </div>

        {/* CONNECTION CARD */}
        <div className={`p-4 rounded-xl border ${isRedMode ? 'border-red-900 bg-red-950/20' : 'border-neutral-800 bg-neutral-900/50'}`}>
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <Usb className={`w-6 h-6 ${camera ? 'opacity-100' : 'opacity-50'}`} />
              <div>
                <h2 className="font-semibold text-lg">{cameraName || 'Cámara Desconectada'}</h2>
                <p className="text-sm opacity-70">Usa cable USB o OTG</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button 
                onClick={connectUSB}
                className={`px-4 py-2 rounded-lg font-bold border transition-colors flex items-center gap-2 w-full justify-center ${
                  camera 
                    ? (isRedMode ? 'bg-black text-red-500 border-red-900' : 'bg-transparent border-neutral-600')
                    : (isRedMode ? 'bg-red-900 text-black border-red-700' : 'bg-neutral-100 text-neutral-900 border-neutral-100')
                }`}
              >
                {camera ? 'Reconectar' : 'Conectar Cámara'}
              </button>
            </div>
          </div>
        </div>

        {/* LIVE VIEW */}
        <div 
          id="liveview-container" 
          className={`aspect-video rounded-xl border flex flex-col items-center justify-center gap-2 overflow-hidden relative touch-none ${isRedMode ? 'border-red-900 bg-black' : 'border-neutral-800 bg-neutral-900'}`}
          onPointerDown={(e) => {
            if (liveViewZoom <= 1) return;
            const container = e.currentTarget;
            container.setPointerCapture(e.pointerId);
            zoomDragRef.current = {
              isDragging: true,
              startX: e.clientX,
              startY: e.clientY,
              startPosX: zoomPos.x,
              startPosY: zoomPos.y
            };
          }}
          onPointerMove={(e) => {
            if (zoomDragRef.current.isDragging && liveViewZoom > 1) {
              const rect = e.currentTarget.getBoundingClientRect();
              const dx = e.clientX - zoomDragRef.current.startX;
              const dy = e.clientY - zoomDragRef.current.startY;
              
              const sensitivityX = 100 / (rect.width * (liveViewZoom * 0.5));
              const sensitivityY = 100 / (rect.height * (liveViewZoom * 0.5));
              
              let newX = zoomDragRef.current.startPosX - (dx * sensitivityX);
              let newY = zoomDragRef.current.startPosY - (dy * sensitivityY);
              
              newX = Math.max(0, Math.min(100, newX));
              newY = Math.max(0, Math.min(100, newY));
              
              setZoomPos({ x: newX, y: newY });
            }
          }}
          onPointerUp={(e) => {
            zoomDragRef.current.isDragging = false;
            e.currentTarget.releasePointerCapture(e.pointerId);
          }}
          onPointerCancel={(e) => {
            zoomDragRef.current.isDragging = false;
            e.currentTarget.releasePointerCapture(e.pointerId);
          }}
        >
          {liveViewActive && (
            <div className="absolute top-4 left-4 z-20 flex flex-col gap-2">
              <button 
                onClick={() => setLiveViewZoom(prev => Math.min(prev + 1, 10))}
                className="p-2 bg-black/50 text-white rounded-full hover:bg-black/80 transition-colors"
                title="Acercar (Zoom In)"
              >
                <ZoomIn className="w-5 h-5" />
              </button>
              {liveViewZoom > 1 && (
                <button 
                  onClick={() => { setLiveViewZoom(1); setZoomPos({x:50, y:50}); }}
                  className="p-2 bg-black/50 text-white rounded-full hover:bg-black/80 transition-colors font-bold text-xs flex items-center justify-center w-9 h-9"
                  title="Restablecer Zoom"
                >
                  {liveViewZoom}x
                </button>
              )}
              <button 
                onClick={() => setLiveViewZoom(prev => Math.max(prev - 1, 1))}
                className="p-2 bg-black/50 text-white rounded-full hover:bg-black/80 transition-colors"
                title="Alejar (Zoom Out)"
              >
                <ZoomOut className="w-5 h-5" />
              </button>
            </div>
          )}
          {liveViewActive && (
            <button 
              onClick={() => {
                 const container = document.getElementById("liveview-container");
                 if (container) {
                    if (document.fullscreenElement) {
                       document.exitFullscreen();
                    } else {
                       container.requestFullscreen().catch(()=>{});
                       if (screen && screen.orientation && ((screen.orientation as any).lock as any)) {
                           ((screen.orientation as any).lock as any)("landscape").catch(()=>{});
                       }
                    }
                 }
              }}
              className="absolute top-4 right-4 z-20 p-2 bg-black/50 text-white rounded-full hover:bg-black/80 transition-colors"
            >
              <Maximize className="w-5 h-5" />
            </button>
          )}
          <img 
            ref={videoRef as any}
            className={`absolute inset-0 w-full h-full object-contain ${liveViewActive ? 'opacity-100' : 'opacity-0'}`} 
            style={{
              transform: `scale(${liveViewZoom})`,
              transformOrigin: `${zoomPos.x}% ${zoomPos.y}%`,
              transition: zoomDragRef.current.isDragging ? 'none' : 'transform 0.2s ease-out'
            }}
          />
          {!liveViewActive && (
            <>
              <MonitorPlay className="w-10 h-10 opacity-30" />
              <p className="text-sm opacity-50">Live View</p>
            </>
          )}
        </div>
          <button 
            onClick={async () => {
              if (camera) {
                 if (!liveViewActive) {
                   try {
                     setLiveViewActive(true);
                     if ((camera as any).device && (camera as any).device.sendCommand) {
                       console.log("Activando modo LiveView (Canon Hack)...");
                       
                       try {
                           // Set EVF Output Device to PC (2) or TFT+PC (3)
                           const size = 12;
                           const buffer = new ArrayBuffer(size);
                           const view = new DataView(buffer);
                           view.setUint32(0, size, true);
                           view.setUint32(4, 0xD1B0, true);
                           view.setUint32(8, 2, true); 
                           await (camera as any).device.sendData({ opcode: 0x9110, data: buffer });
                           console.log("EVF Output Mode Set");
                       } catch (e) {
                           console.log("Failed to set D1B0 (EVF Output), continuing...", e);
                       }
                       
                       await (camera as any).device.sendCommand({ opcode: 0x9151 }).catch(()=>null);
                       
                       let consecutiveErrors = 0;
                       const loop = async () => {
                           if (!liveViewActiveRef.current) return;
                           try {
                               const res = await (camera as any).device.receiveData({ opcode: 0x9153, parameters: [0x00200000, 0, 0] });
                               if (res && res.data) {
                                   consecutiveErrors = 0;
                                   const bytes = new Uint8Array(res.data);
                                   let jpegStart = -1;
                                   for(let i = 0; i < bytes.length - 1; i++) {
                                       if(bytes[i] === 0xFF && bytes[i+1] === 0xD8) {
                                           jpegStart = i;
                                           break;
                                       }
                                   }
                                   if (jpegStart !== -1) {
                                       const jpegBytes = bytes.slice(jpegStart);
                                       const blob = new Blob([jpegBytes], { type: 'image/jpeg' });
                                       if (videoRef.current) {
                                           const oldUrl = (videoRef.current as HTMLImageElement).src;
                                           if (oldUrl && oldUrl.startsWith('blob:')) URL.revokeObjectURL(oldUrl);
                                           (videoRef.current as HTMLImageElement).src = URL.createObjectURL(blob);
                                       }
                                   } else {
                                       console.log("No JPEG header found in payload of size", bytes.length);
                                   }
                               } else {
                                   console.log("Empty or invalid res:", res);
                               }
                           } catch (e: any) {
                               consecutiveErrors++;
                               if (consecutiveErrors % 10 === 1) { // Log selectively to avoid spam
                                 console.error("Poll EVF failed:", e.message || e);
                               }
                           }
                           
                           if (liveViewActiveRef.current) {
                               setTimeout(loop, 150);
                           }
                       };
                       loop();
                     } else {
                       const result = await camera.startLiveview();
                       if (result.status === 'ok' && result.value) {
                         if (videoRef.current) {
                           (videoRef.current as HTMLVideoElement).srcObject = result.value;
                         }
                       }
                     }
                   } catch(e: any) {
                     console.error("Excepción LiveView:", e);
                     setLiveViewActive(false);
                     alert(`Error encendiendo Live View: ${e.message}`);
                   }
                 } else {
                   setLiveViewActive(false);
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
                   } else {
                       await camera.stopLiveview();
                   }
                   if (videoRef.current) {
                     if ((videoRef.current as HTMLVideoElement).srcObject) {
                        (videoRef.current as HTMLVideoElement).srcObject = null;
                     }
                     if ((videoRef.current as HTMLImageElement).src) {
                        (videoRef.current as HTMLImageElement).src = "";
                     }
                   }
                 }
              }
            }}
            disabled={!camera}
            className={`mt-2 px-4 py-2 flex items-center gap-2 text-sm font-bold rounded-full border transition-all z-10 shadow-lg 
              ${camera ? 'opacity-100' : 'opacity-30 cursor-not-allowed'} 
              ${liveViewActive ? 'absolute bottom-4 right-4 bg-red-600 border-red-500 text-white hover:bg-red-700' : accentClass} 
            `}
          >
            {liveViewActive ? <VideoOff className="w-4 h-4" /> : <Video className="w-4 h-4" />}
            {liveViewActive ? 'Apagar' : 'Encender Pantalla'}
          </button>
        </div>

        {/* CAMERA SETTINGS */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <ParameterDial 
            label="ISO"
            value={settings.iso}
            onChange={(v) => setSettings({...settings, iso: v})}
            options={supportedConfigs.iso.length > 0 ? supportedConfigs.iso : FALLBACK_ISO}
            accentClass={accentClass}
          />
          <ParameterDial 
            label="Apertura"
            value={settings.aperture}
            onChange={(v) => setSettings({...settings, aperture: v})}
            options={supportedConfigs.aperture.length > 0 ? supportedConfigs.aperture : FALLBACK_APERTURE}
            accentClass={accentClass}
          />
          <ParameterDial 
            label="Obturador"
            value={settings.shutter}
            onChange={(v) => setSettings({...settings, shutter: v})}
            options={
              supportedConfigs.shutterSpeed.length > 0 
                ? (supportedConfigs.shutterSpeed.includes('Bulb') ? supportedConfigs.shutterSpeed : [...supportedConfigs.shutterSpeed, 'Bulb'])
                : FALLBACK_SHUTTER
            }
            accentClass={accentClass}
          />
          <ParameterDial 
            label="WB"
            value={settings.whiteBalance}
            onChange={(v) => setSettings({...settings, whiteBalance: v})}
            options={supportedConfigs.whiteBalance.length > 0 ? supportedConfigs.whiteBalance : FALLBACK_WB}
            accentClass={accentClass}
          />
        </div>

        {/* INTERVALOMETER SETTINGS */}
        <div className={`p-5 rounded-xl border space-y-5 ${isRedMode ? 'border-red-900 bg-black' : 'border-neutral-800 bg-neutral-900/30'}`}>
          <div className="flex items-center gap-2 mb-2 pb-2 border-b border-current opacity-80">
            <Settings2 className="w-5 h-5" />
            <h2 className="font-semibold uppercase tracking-widest text-sm">Secuencia</h2>
          </div>

          <div className="grid grid-cols-2 gap-x-6 gap-y-5">
            <div className="flex flex-col gap-2">
              <label className="text-xs font-bold opacity-70">Retraso Inicial (s)</label>
              <input 
                type="number" min="0" 
                value={settings.delay} 
                onChange={e => setSettings({...settings, delay: Number(e.target.value)})}
                className={`p-2 rounded border outline-none ${accentClass}`} 
              />
            </div>
            
            <div className={`flex flex-col gap-2 transition-opacity ${settings.shutter === 'Bulb' ? 'opacity-100' : 'opacity-30'}`}>
              <label className="text-xs font-bold opacity-70 text-nowrap">Tiempo Bulb (s)</label>
              <input 
                type="number" min="1" 
                value={settings.bulbTime} 
                onChange={e => setSettings({...settings, bulbTime: Number(e.target.value)})}
                disabled={settings.shutter !== 'Bulb'}
                className={`p-2 rounded border outline-none ${accentClass}`} 
              />
            </div>

            <div className="flex flex-col gap-2">
              <label className="text-xs font-bold opacity-70">Intervalo de Espera (s)</label>
              <input 
                type="number" min="1" 
                value={settings.interval} 
                onChange={e => setSettings({...settings, interval: Number(e.target.value)})}
                className={`p-2 rounded border outline-none ${accentClass}`} 
              />
            </div>

            <div className="flex flex-col gap-2">
              <label className="text-xs font-bold opacity-70">Fotografías (0 = Inf)</label>
              <input 
                type="number" min="0" 
                value={settings.shots} 
                onChange={e => setSettings({...settings, shots: Number(e.target.value)})}
                className={`p-2 rounded border outline-none ${accentClass}`} 
              />
            </div>
          </div>
        </div>

        {/* STATUS & ACTIONS */}
        <div className={`p-5 rounded-xl border flex flex-col items-center justify-center text-center gap-4 ${
          isRunning 
            ? (isRedMode ? 'border-red-600 bg-red-950/40' : 'border-neutral-500 bg-neutral-800') 
            : (isRedMode ? 'border-red-900 bg-black' : 'border-neutral-800 bg-neutral-900/30')
        }`}>
          <div className="text-sm opacity-80 min-h-[1.25rem]">
            {statusText}
          </div>
          <div className="text-3xl font-light tracking-widest">
            {currentShot} <span className="opacity-30 text-lg">/ {settings.shots === 0 ? '∞' : settings.shots}</span>
          </div>

          <div className="pt-2 w-full max-w-xs">
            {!isRunning ? (
              <button 
                onClick={handleStart}
                className={`w-full py-4 rounded-xl font-bold flex items-center justify-center gap-2 transition-transform active:scale-95 ${
                  isRedMode ? 'bg-red-700 text-black hover:bg-red-600' : 'bg-white text-black hover:bg-neutral-200'
                }`}
              >
                <Play className="w-5 h-5 fill-current" />
                INICIAR SECUENCIA
              </button>
            ) : (
              <button 
                onClick={handleStop}
                className="w-full py-4 rounded-xl font-bold flex items-center justify-center gap-2 bg-transparent border-2 border-current transition-transform active:scale-95"
              >
                <Square className="w-5 h-5 fill-current" />
                DETENER
              </button>
            )}
          </div>
        </div>

        {/* ADVERTENCIA WEBUSB */}
        {!camera && (
          <div className="flex items-start gap-3 p-3 text-xs opacity-70 border-l-2 border-current">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
            <div>
              <p>
                Conecta tu cámara mediante un cable OTG USB. Cuando presiones "Conectar", Android te pedirá permisos para acceder a la cámara.
              </p>
              <p className="mt-2 text-yellow-400 font-bold">
                ⚠️ IMPORTANTE CANON:
              </p>
              <ul className="list-disc ml-4 mt-1">
                <li>Pon la rueda de la cámara en <b>M (Manual)</b>.</li>
                <li>Pon el interruptor del lente en <b>MF (Manual Focus)</b>. Si lo dejas en AF, la cámara intentará enfocar y rechazará el disparo.</li>
                <li>Si la app marca error al cambiar ISO/Apertura, ajústalos directamente con la rueda de la cámara física.</li>
              </ul>
            </div>
          </div>
        )}

        {/* LOG DE DEPURACION */}
        <div className="mt-4 border border-neutral-700 bg-black p-2 rounded text-xs font-mono max-h-40 overflow-y-auto whitespace-pre-wrap break-all text-neutral-400">
          <div className="font-bold text-white mb-1">Terminal Interna:</div>
          {logs.map((log, i) => (
            <div key={i} className={`${log.startsWith('[ERR]') ? 'text-red-400' : log.startsWith('[WARN]') ? 'text-yellow-400' : ''}`}>
              {log}
            </div>
          ))}
          {logs.length === 0 && <div>Esperando eventos...</div>}
        </div>

      </div>

      {galleryOpen && lastPhoto && (
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
                         className={`shrink-0 w-24 h-16 rounded-lg overflow-hidden border-2 transition-all ${i === selectedPhotoIndex ? 'border-blue-500 opacity-100 scale-105' : 'border-transparent opacity-50 hover:opacity-100'}`}
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
                           <div key={i} className={`bg-white ${val > 0 ? 'opacity-80' : 'opacity-0'}`} style={{ width: '100%', height: `${Math.max(1, (val / lastPhoto.maxHist) * 100)}%` }} />
                        ))}
                     </div>
                  </div>
               </div>
           </div>
        </div>
      )}
    </div>
  );
}

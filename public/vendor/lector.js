/* =============================================================
   lector.js — Lectura de códigos de barras (cámara y foto)

   · Cámara: abre la trasera, pide 1080p y enfoque continuo, y decodifica
     cuadro a cuadro con BarcodeDetector nativo (Android) y/o ZXing
     (iPhone, Windows, Firefox). Prueba varias variantes por cuadro:
     franja central / cuadro completo, canal de luminancia / canal rojo
     (el canal rojo "borra" la G2 naranja impresa sobre las barras).
   · Foto: decodifica una imagen a resolución completa probando
     recortes, escalas, canales y pequeñas rotaciones.
   ============================================================= */
(function (global) {
  'use strict';

  // Simbologías de etiqueta industrial: lineales Code 128/39/93 y bidimensionales
  // QR, Data Matrix, PDF417 y Aztec (agregadas el 23-09-2026 a pedido de Brayan;
  // el original del escáner solo traía las tres lineales).
  // Codabar, ITF y EAN/UPC se excluyen a propósito: con fotos borrosas producen
  // lecturas falsas (p. ej. "BDD" en Codabar a partir del texto impreso).
  const NATIVOS = ['code_128', 'code_39', 'code_93', 'qr_code', 'data_matrix', 'pdf417', 'aztec'];
  const LARGO_MINIMO = 6;   // un número de serie de membrana tiene bastante más que esto (ej.: BE8A68F5406)
  const ES_2D = /qr|data_?matrix|pdf_?417|aztec/i;

  // Un código 2D lleva corrección de error: lo que entrega es lo que dice la
  // etiqueta, así que se acepta tal cual (sin espacios) aunque traiga separadores
  // que un lineal borroso no podría garantizar.
  function serieValida(texto, formato) {
    if (typeof texto !== 'string') return false;
    const t = texto.trim();
    if (ES_2D.test(String(formato || ''))) return t.length >= 4 && t.length <= 64 && !/\s/.test(t);
    return t.length >= LARGO_MINIMO && /^[A-Za-z0-9\-\/\.]+$/.test(t);
  }

  /* ---------- ZXing --------------------------------------------------- */

  let zx = null;
  function lectorZX() {
    if (zx) return zx;
    const Z = global.ZXing;
    if (!Z) return null;
    const F = Z.BarcodeFormat;
    const hints = new Map();
    hints.set(Z.DecodeHintType.TRY_HARDER, true);
    hints.set(Z.DecodeHintType.POSSIBLE_FORMATS, [
      F.CODE_128, F.CODE_39, F.CODE_93,
      F.QR_CODE, F.DATA_MATRIX, F.PDF_417, F.AZTEC
    ]);
    zx = new Z.MultiFormatReader();
    zx.setHints(hints);
    return zx;
  }

  function nombreFormatoZX(f) {
    const F = global.ZXing && global.ZXing.BarcodeFormat;
    return F && F[f] !== undefined ? String(F[f]) : String(f);
  }

  /** Convierte un ImageData en arreglo de luminancia (o canal rojo). */
  function aLuminancia(img, canal) {
    const d = img.data, n = img.width * img.height;
    const out = new Uint8ClampedArray(n);
    if (canal === 'rojo') {
      for (let i = 0, j = 0; i < n; i++, j += 4) out[i] = d[j];
    } else {
      for (let i = 0, j = 0; i < n; i++, j += 4) out[i] = (d[j] * 77 + d[j + 1] * 150 + d[j + 2] * 29) >> 8;
    }
    return out;
  }

  function decodificarZX(img, canal, binarizador) {
    const Z = global.ZXing;
    const r = lectorZX();
    if (!r) return null;
    try {
      const fuente = new Z.RGBLuminanceSource(aLuminancia(img, canal), img.width, img.height);
      const Bin = binarizador === 'global' ? Z.GlobalHistogramBinarizer : Z.HybridBinarizer;
      const res = r.decodeWithState(new Z.BinaryBitmap(new Bin(fuente)));
      const texto = String(res.getText() || '').trim();
      const formato = nombreFormatoZX(res.getBarcodeFormat());
      return serieValida(texto, formato) ? { texto: texto, formato: formato } : null;
    } catch (e) {
      return null;   // NotFound / Checksum / Format: simplemente no hubo lectura en esta variante
    }
  }

  /* ---------- Lienzo de trabajo -------------------------------------- */

  const lienzo = document.createElement('canvas');
  const ctx = lienzo.getContext('2d', { willReadFrequently: true });

  /**
   * Dibuja una región de la fuente (video/imagen) en el lienzo.
   * @param {CanvasImageSource} src
   * @param {number} sw, sh      tamaño natural de la fuente
   * @param {object} reg         región relativa {x,y,w,h} (0..1)
   * @param {number} anchoMax    ancho máximo del resultado
   * @param {number} angulo      rotación en grados
   */
  function capturar(src, sw, sh, reg, anchoMax, angulo) {
    const rx = Math.round(sw * reg.x), ry = Math.round(sh * reg.y);
    const rw = Math.max(1, Math.round(sw * reg.w)), rh = Math.max(1, Math.round(sh * reg.h));
    const esc = Math.min(anchoMax / rw, 2.5);
    const w = Math.max(1, Math.round(rw * esc)), h = Math.max(1, Math.round(rh * esc));
    lienzo.width = w;
    lienzo.height = h;
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, w, h);
    if (angulo) {
      ctx.save();
      ctx.translate(w / 2, h / 2);
      ctx.rotate(angulo * Math.PI / 180);
      ctx.drawImage(src, rx, ry, rw, rh, -w / 2, -h / 2, w, h);
      ctx.restore();
    } else {
      ctx.drawImage(src, rx, ry, rw, rh, 0, 0, w, h);
    }
    return ctx.getImageData(0, 0, w, h);
  }

  // Variantes que se alternan cuadro a cuadro en modo cámara
  const FRANJA = { x: 0.04, y: 0.28, w: 0.92, h: 0.44 };   // coincide con la mira en pantalla
  const COMPLETO = { x: 0, y: 0, w: 1, h: 1 };
  const VARIANTES_VIDEO = [
    { reg: 'mira', ancho: 1280, canal: 'lum', bin: 'hybrid' },
    { reg: 'mira', ancho: 1280, canal: 'rojo', bin: 'hybrid' },
    { reg: COMPLETO, ancho: 1024, canal: 'lum', bin: 'hybrid' },
    { reg: 'mira', ancho: 960, canal: 'lum', bin: 'global' },
    { reg: 'mira', ancho: 1280, canal: 'rojo', bin: 'global' }
  ];

  /**
   * Traduce el recuadro visible en pantalla a coordenadas del cuadro de video.
   * El <video> usa object-fit: cover, por lo que lo que se ve es un recorte del cuadro real.
   */
  function regionDeMira(video, mira) {
    if (!mira) return FRANJA;
    const vw = video.videoWidth, vh = video.videoHeight;
    const rv = video.getBoundingClientRect(), rm = mira.getBoundingClientRect();
    if (!vw || !vh || !rv.width || !rv.height || !rm.width) return FRANJA;
    const esc = Math.max(rv.width / vw, rv.height / vh);          // cover
    const ox = (vw * esc - rv.width) / 2, oy = (vh * esc - rv.height) / 2;
    const margen = 0.12;
    let x = (rm.left - rv.left + ox) / esc, y = (rm.top - rv.top + oy) / esc;
    let w = rm.width / esc, h = rm.height / esc;
    x -= w * margen / 2; w *= 1 + margen;
    y -= h * margen; h *= 1 + margen * 2;
    x = Math.max(0, x); y = Math.max(0, y);
    w = Math.min(vw - x, w); h = Math.min(vh - y, h);
    return { x: x / vw, y: y / vh, w: w / vw, h: h / vh };
  }

  /* =============================================================
     Cámara
     ============================================================= */

  const C = {
    stream: null, video: null, activo: false, timer: null, tick: 0,
    detector: null, camaras: [], deviceId: null, mira: null,
    onCodigo: null, onEstado: null,
    ultimo: '', ultimoT: 0
  };

  async function crearDetectorNativo() {
    if (!('BarcodeDetector' in global)) return null;
    try {
      const sop = await global.BarcodeDetector.getSupportedFormats();
      const usar = NATIVOS.filter((f) => sop.indexOf(f) !== -1);
      return usar.length ? new global.BarcodeDetector({ formats: usar }) : null;
    } catch (e) { return null; }
  }

  async function obtenerStream(deviceId) {
    const res = { width: { ideal: 1920 }, height: { ideal: 1080 } };
    const intentos = [];
    if (deviceId) intentos.push({ video: Object.assign({ deviceId: { exact: deviceId } }, res), audio: false });
    intentos.push({ video: Object.assign({ facingMode: { exact: 'environment' } }, res), audio: false });
    intentos.push({ video: Object.assign({ facingMode: 'environment' }, res), audio: false });
    intentos.push({ video: true, audio: false });

    let ultimoError = null;
    for (const c of intentos) {
      try { return await navigator.mediaDevices.getUserMedia(c); }
      catch (e) {
        ultimoError = e;
        if (e && (e.name === 'NotAllowedError' || e.name === 'SecurityError')) throw e;   // sin permiso: no insistir
      }
    }
    throw ultimoError || new Error('No hay cámara disponible');
  }

  async function mejorarPista(pista) {
    const caps = pista.getCapabilities ? pista.getCapabilities() : {};
    const avanzados = [];
    if (caps.focusMode && caps.focusMode.indexOf('continuous') !== -1) avanzados.push({ focusMode: 'continuous' });
    if (caps.exposureMode && caps.exposureMode.indexOf('continuous') !== -1) avanzados.push({ exposureMode: 'continuous' });
    for (const a of avanzados) {
      try { await pista.applyConstraints({ advanced: [a] }); } catch (e) { /* no soportado */ }
    }
    return caps;
  }

  /**
   * Abre la cámara y comienza a leer.
   * @returns {Promise<{linterna:boolean, zoom:null|{min,max,step,valor}, camaras:number}>}
   */
  async function iniciar(opciones) {
    detener();
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      throw new Error('Este navegador no permite usar la cámara.');
    }
    if (!global.isSecureContext) throw new Error('La cámara solo funciona con HTTPS.');

    C.video = opciones.video;
    C.mira = opciones.mira || C.mira;
    C.onCodigo = opciones.onCodigo;
    C.onEstado = opciones.onEstado || function () {};

    C.stream = await obtenerStream(opciones.deviceId || C.deviceId);
    const pista = C.stream.getVideoTracks()[0];
    C.deviceId = (pista.getSettings && pista.getSettings().deviceId) || null;

    C.video.setAttribute('playsinline', '');
    C.video.muted = true;
    C.video.srcObject = C.stream;
    await C.video.play();
    await esperarDimensiones(C.video);

    const caps = await mejorarPista(pista);

    // Tras conceder permiso ya se conocen los IDs reales de las cámaras
    try {
      const disp = await navigator.mediaDevices.enumerateDevices();
      C.camaras = disp.filter((d) => d.kind === 'videoinput' && d.deviceId);
    } catch (e) { C.camaras = []; }

    C.detector = await crearDetectorNativo();
    C.activo = true;
    C.tick = 0;
    C.onEstado(C.detector ? 'Apunte al código de barras' : 'Apunte al código de barras (lector compatible)');
    programar();

    const s = pista.getSettings ? pista.getSettings() : {};
    return {
      linterna: !!caps.torch,
      zoom: caps.zoom ? { min: caps.zoom.min, max: caps.zoom.max, step: caps.zoom.step || 0.1, valor: s.zoom || caps.zoom.min } : null,
      camaras: C.camaras.length,
      resolucion: (C.video.videoWidth || 0) + 'x' + (C.video.videoHeight || 0),
      motor: C.detector ? 'nativo+zxing' : 'zxing'
    };
  }

  /** Permite iniciar la lectura sobre un <video> ya alimentado (pruebas). */
  async function iniciarConVideo(opciones) {
    detener();
    C.video = opciones.video;
    C.mira = opciones.mira || null;
    C.onCodigo = opciones.onCodigo;
    C.onEstado = opciones.onEstado || function () {};
    await esperarDimensiones(C.video);
    C.detector = opciones.sinNativo ? null : await crearDetectorNativo();
    C.activo = true;
    programar();
  }

  function esperarDimensiones(video) {
    return new Promise((ok) => {
      if (video.videoWidth) return ok();
      const t0 = Date.now();
      (function mirar() {
        if (video.videoWidth || Date.now() - t0 > 4000) ok();
        else setTimeout(mirar, 60);
      })();
    });
  }

  function programar() {
    clearTimeout(C.timer);
    if (C.activo) C.timer = setTimeout(paso, 110);
  }

  async function paso() {
    if (!C.activo) return;
    const v = C.video;
    const w = v.videoWidth, h = v.videoHeight;
    if (!w || !h || v.readyState < 2) { programar(); return; }

    let hallado = null;
    C.tick++;

    // 1) Detector nativo (rápido; Android / ChromeOS / macOS)
    if (C.detector) {
      try {
        const cods = await C.detector.detect(v);
        const ok = (cods || []).map((c) => ({ texto: String(c.rawValue || '').trim(), formato: c.format })).filter((c) => serieValida(c.texto, c.formato));
        if (ok.length) hallado = ok[0];
      } catch (e) { /* cuadro descartado */ }
    }

    // 2) ZXing: siempre si no hay nativo; si hay nativo, en uno de cada dos cuadros
    if (!hallado && (!C.detector || C.tick % 2 === 0)) {
      const variante = VARIANTES_VIDEO[C.tick % VARIANTES_VIDEO.length];
      const reg = variante.reg === 'mira' ? regionDeMira(v, C.mira) : variante.reg;
      const img = capturar(v, w, h, reg, variante.ancho, 0);
      hallado = decodificarZX(img, variante.canal, variante.bin);
    }

    if (hallado && hallado.texto) confirmar(hallado);
    programar();
  }

  // Para evitar lecturas falsas se exige ver el mismo código dos veces
  // (excepto en simbologías con verificación fuerte).
  let candidato = { texto: '', t: 0 };
  function confirmar(h) {
    const ahora = Date.now();
    const fuerte = /code_?128/i.test(h.formato || '') || ES_2D.test(String(h.formato || ''));
    if (!fuerte && !(candidato.texto === h.texto && ahora - candidato.t < 2500)) {
      candidato = { texto: h.texto, t: ahora };
      C.onEstado('Leyendo… mantenga el código dentro del recuadro');
      return;
    }
    candidato = { texto: '', t: 0 };
    // No repetir el mismo código mientras siga frente a la cámara
    if (h.texto === C.ultimo && ahora - C.ultimoT < 4000) { C.ultimoT = ahora; return; }
    C.ultimo = h.texto;
    C.ultimoT = ahora;
    if (C.onCodigo) C.onCodigo(h.texto, h.formato || '');
  }

  function detener() {
    C.activo = false;
    clearTimeout(C.timer);
    if (C.stream) C.stream.getTracks().forEach((t) => t.stop());
    C.stream = null;
    if (C.video) { try { C.video.srcObject = null; } catch (e) {} }
    C.detector = null;
  }

  function olvidarUltimo() { C.ultimo = ''; C.ultimoT = 0; }

  async function siguienteCamara() {
    if (C.camaras.length < 2) return null;
    const i = C.camaras.findIndex((c) => c.deviceId === C.deviceId);
    const sig = C.camaras[(i + 1) % C.camaras.length];
    return iniciar({ video: C.video, mira: C.mira, onCodigo: C.onCodigo, onEstado: C.onEstado, deviceId: sig.deviceId });
  }

  async function linterna(encender) {
    if (!C.stream) return false;
    const p = C.stream.getVideoTracks()[0];
    await p.applyConstraints({ advanced: [{ torch: !!encender }] });
    return true;
  }

  async function zoom(valor) {
    if (!C.stream) return;
    const p = C.stream.getVideoTracks()[0];
    try { await p.applyConstraints({ advanced: [{ zoom: Number(valor) }] }); } catch (e) {}
  }

  /* =============================================================
     Foto (imagen fija a resolución completa)
     ============================================================= */

  function cargarImagen(archivo) {
    return new Promise((ok, mal) => {
      const url = URL.createObjectURL(archivo);
      const img = new Image();
      img.onload = () => { URL.revokeObjectURL(url); ok(img); };
      img.onerror = () => { URL.revokeObjectURL(url); mal(new Error('No se pudo abrir la imagen.')); };
      img.src = url;
    });
  }

  const pausa = () => new Promise((r) => setTimeout(r, 0));

  /**
   * Decodifica un código de barras en una imagen (File, Blob o HTMLImageElement/Canvas).
   * @returns {Promise<{texto, formato}|null>}
   */
  async function decodificarImagen(fuente) {
    const img = (fuente instanceof Blob) ? await cargarImagen(fuente) : fuente;
    const sw = img.naturalWidth || img.videoWidth || img.width;
    const sh = img.naturalHeight || img.videoHeight || img.height;
    if (!sw || !sh) return null;

    // 1) Detector nativo sobre la imagen completa
    const det = await crearDetectorNativo();
    if (det) {
      try {
        const cods = await det.detect(img);
        const ok = (cods || []).map((c) => ({ texto: String(c.rawValue || '').trim(), formato: c.format })).filter((c) => serieValida(c.texto, c.formato));
        if (ok.length) return ok[0];
      } catch (e) {}
    }

    // 2) ZXing con variantes, de la más probable a la menos, con límite de tiempo
    const regiones = [
      { x: 0, y: 0, w: 1, h: 1 },
      { x: 0.1, y: 0.2, w: 0.8, h: 0.6 },
      { x: 0, y: 0.25, w: 1, h: 0.5 },
      { x: 0.2, y: 0.3, w: 0.6, h: 0.4 }
    ];
    const pruebas = [];
    [0, -6, 6, -12, 12].forEach((ang) => regiones.forEach((reg) => [1400, 900, 2000].forEach((ancho) => {
      pruebas.push({ ang: ang, reg: reg, ancho: ancho });
    })));
    const limite = Date.now() + 7000;
    for (const p of pruebas) {
      if (Date.now() > limite) break;
      const datos = capturar(img, sw, sh, p.reg, p.ancho, p.ang);
      const r = decodificarZX(datos, 'lum', 'hybrid') || decodificarZX(datos, 'rojo', 'hybrid') ||
                decodificarZX(datos, 'lum', 'global');
      if (r) return r;
      await pausa();
    }
    return null;
  }

  global.LECTOR = {
    iniciar: iniciar,
    iniciarConVideo: iniciarConVideo,
    detener: detener,
    siguienteCamara: siguienteCamara,
    linterna: linterna,
    zoom: zoom,
    olvidarUltimo: olvidarUltimo,
    decodificarImagen: decodificarImagen,
    activo: function () { return C.activo; }
  };
})(window);

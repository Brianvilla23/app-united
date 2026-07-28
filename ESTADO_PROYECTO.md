# App United — Estado del proyecto
_Última actualización: 25-07-2026_

App móvil (PWA) para los supervisores de la Planta Desaladora United, Coloso.
Funciona offline en planta y se instala en el celular sin tienda de apps.

## 🔗 Accesos

| Qué | Dónde |
|---|---|
| **App online** | https://brianvilla23.github.io/app-united/ |
| Código | https://github.com/Brianvilla23/app-united (cuenta Brianvilla23) |
| Proyecto local | `C:\Users\braya\Desktop\app_united\` |
| Arrancar en local | doble-click `iniciar.bat` → http://localhost:5173 |

---

## ✅ Módulos terminados

### 1. Nuevo aviso
Formulario + genera **PDF = informe técnico para la OT** (folio `AV-AAAA-####`).
Campos: título, tipo (correctivo/preventivo/inspección/emergencia), prioridad,
zona (16 sectores de planta), equipo, descripción con "mejorar redacción" y dictado
por voz, modo de falla → sugiere materiales con código SAP, dotación, horas,
materiales, detención sí/no, fecha, fotos/video, correo de respaldo (siempre con
copia a brayan.villalobos.c@gmail.com).

### 2. Levantamiento de andamio
Acta + PDF (folio `AND-AAAA-####`). Lugar, uso, temporalidad (por días / solo por
el trabajo), cantidad de cuerpos, fecha, **tarjeta de andamio** (verde/amarilla/roja,
inspeccionado por, próxima inspección), foto del andamio + foto de la tarjeta,
"¿se generó el subsecuente?" sí/no.

### 3. Diagrama de fugas
Réplica fiel del plano "Vasijas lado Alimentación enumeradas" (**295 vasijas**,
Semi Rack A cols 1-8 / B cols 9-16, filas A-S). Selector **R1–R12**.
Vista Semi Rack A / B / Todo (para que se lea bien en celular).
Se toca una vasija → detalle → se marca el componente con fuga (queda **amarillo**):
victaulic norte/sur, sideport norte/sur, tapón, canastillo.
Modelo de cañería fiel al plano: 1 victaulic entre vasijas contiguas, **spool**
(victaulic + tubo + victaulic) solo contra el **manifold central**, la cañería
no cruza el poste.

### 4. Estado de tapas
Mismo esquema del rack. **Solo 2 colores**: 🟠 ámbar = agripada/rodada · 🟢 verde = retirada.
Detalle = cabeza Protec realista: **3 seguros triples** (arcos) + **3 pernos parker**
(círculos 1-2-3), se tocan individualmente y quedan en ámbar; los sanos se atenúan.
Tocar el borde = tapa completa agripada. El color del rack se calcula solo.
**Data cargada**: turno noche 21/07/2026, OT 419375139, Rack 12
(K10 agripada; J4/J9/J12/J14/J16 pernos rodados; resto chequeado OK).

### 5. Extras
- **Guardados**: lista unificada de avisos y andamios, con descarga de PDF.
- **PWA instalable** + **auto-actualización** (revisa versión nueva cada 60 s y se
  actualiza sola). ⚠️ Cada celular debe tomar UNA vez la versión del 22-07 en
  adelante (abrir en incógnito o reinstalar); después ya se actualiza solo.

---

## 6. Trazabilidad — identidad + historial ✅ (código listo)

- **"¿Quién sos?"**: se pregunta el nombre la primera vez en cada celular
  (`src/identidad.ts`, guardado en localStorage). Antes de esto, TODO salía
  firmado como "B. Villalobos" porque estaba hardcodeado en 3 archivos.
  El nombre firma avisos, actas y cada marca; se cambia desde la barra superior.
- **Historial**: cada marca de tapa o fuga deja un registro
  (quién · qué vasija · qué hizo · cuándo). Se ve en un panel plegable
  al pie del diagrama, filtrado por rack, y sincroniza para toda la cuadrilla.
- Verificado end-to-end en local: nombre → marcar perno → registro correcto → panel.

---

## 7. Base compartida ✅ (25-07-2026, funcionando)

Se decidió quedarse con la **cuenta nueva** (`brayan.villalobos.castill@gmail.com`),
org **United** → proyecto **"Planta Desaladora"** = `egxgxejgcohzwuoqhald`.
NO se tocó `brayan-metas`. El proyecto `app-united` de la cuenta vieja queda
pausado y sin uso.

`sql/01_esquema.sql` ya corrió: existen `avisos`, `andamios`, `marcas_fuga`,
`estado_tapas`, `historial` + índice + políticas RLS. Es idempotente.

**Verificado end-to-end contra la base real:**
- Las 5 tablas leen y escriben con la clave anon (200/201).
- Los arrays `jsonb` hacen round-trip correcto (crítico para `pullTapas`).
- El outbox drenó solo: **Rack 12 sincronizado, 63 vasijas**, con K10 agripada
  y J4/J9/J12/J14/J16 con pernos rodados, OT 419375139.
- Marcar una tapa genera el registro de historial con el nombre correcto y sube.

_Los 126 items que había en el outbox eran seeds repetidos de sesiones previas;
los upserts los colapsaron a las 63 filas reales._

⚠️ **Nota de seguridad**: sin login, las políticas RLS dan acceso total al rol
`anon`, y esa clave va embebida en el JS publicado. Aceptable para un tool interno;
cuando exista el módulo de login hay que cambiarlas por políticas con `auth.uid()`.

---

## 8. Tapas v2 — colores, avance, PDF y lado descarga ✅ (27-07-2026)

- **Avance**: % de tapas extraídas sobre las **295 vasijas** del rack (no sobre las
  registradas). Al 27-07 va en **56,6 % — 167 de 295**.
- **5 colores, uno por tipo de falla** (antes eran 2). Si una tapa tiene varias
  fallas manda **la más grave**: aislada › tapa agripada › seguros › pernos.
  Verificado: 15 + 0 + 24 + 167 = 206 registros. El único con seguros también
  tiene la tapa agripada, por eso "Seguros triples" marca 0.
- **Tapas aisladas**: nuevo estado, se marca desde el detalle de la tapa.
- **PDF A4 vertical vectorial** (`src/pdfTapas.ts`, no es captura de pantalla),
  copiando el formato de la hoja de levantamiento que se usa en planta
  (referencia: foto "RACK 4 · LADO DESCARGA"): título arriba, el rack completo en
  UNA página con postes y cañerías, y la **leyenda abajo**. Hoja 2 = pendientes
  agrupados por tipo, en dos columnas.
- Colores: 🔵 aislada · 🔴 tapa agripada · 🟡 seguros · 🟠 pernos · 🟢 retirada.
- **Dos planos**: alimentación y descarga. Cada vasija tiene una tapa por extremo
  y son piezas distintas, así que **cada lado guarda sus propios registros**.
  El plano de descarga es el espejo: columnas 16→1 y Semi Rack B a la izquierda.
  Derivado y **verificado contra `Vasijas lado Descarga enumeradas.pdf`**,
  incluida la fila C que es la asimétrica (C16→C2, sin C1).
- **Sin selector de rack** en tapas: solo se interviene el Rack 12.
- En la app: título `RACK 12 · LADO X` arriba, leyenda abajo (con descripción y
  conteo), y la vista "Todo" ahora **entra completa** sin scroll horizontal.
  ⚠️ En celular de 375 px, "Todo" deja las vasijas en 9 px — sirve de panorama,
  no para leer. Para trabajar están las vistas Semi Rack A / B (18 px). El PDF es
  el formato legible de verdad.

### Migración de datos (hecha, sin pérdida)
- Respaldo previo en `respaldos/20260727_1652/` (206 tapas + 539 de historial).
- `sql/02_lado_y_aislada.sql` agrega `lado` y `aislada` y cambia la PK a
  (lado, rack, vasija). Solo **agrega** columnas con default; no reescribe filas.
- Post-migración verificado: 206 registros intactos, todos en `alimentacion`.
- Dexie v11 migra el celular preservando los datos (ojo: las migraciones
  anteriores usaban `.clear()`, esta **no**).

---

## 📋 Otros pendientes
- **Entrega de turno**: que el parte del grupo de WhatsApp actualice las tapas
  (hoy se edita a mano, o Brayan pega el texto y Claude lo carga).
- **Materiales por modo de falla**: el generador `scripts/gen_catalogo.py` nunca
  corrió porque **busca el Excel en la ruta equivocada** — apunta a
  `OneDrive\Escritorio\` y el archivo está en `OneDrive\Escritorio\Planificacion\`.
  Por eso `src/catalogo.ts` no existe y la app sigue usando 5 modos de falla
  inventados a mano en `types.ts` (uno dice literal "cargar desde catálogo real")
  en vez de los 14 modos / 69 repuestos SAP reales. Arreglar la ruta, correrlo,
  integrarlo. Brayan iba a pasar los modos de falla por vasija para la compra.
- Fugas: el lado descarga ya está soportado en la base (`marcas_fuga.lado`) pero
  el módulo de fugas sigue fijo en alimentación — falta exponerle el selector.
  También falta exportar el diagrama de fugas a PDF y un botón para limpiar
  marcas por parada.
- **Falta marcar la vasija aislada**: Brayan dijo que hay 1, pero no cuál.
  Se marca desde el detalle de la tapa → "Marcar vasija aislada".
- Módulos que faltan del mapa original: entrega de turno, reporte de equipo,
  plan de semana, mantenciones futuras, login.

---

## 🛠 Notas técnicas
- **Stack**: Vite + React + TypeScript · Dexie/IndexedDB (offline) · jsPDF ·
  vite-plugin-pwa · Supabase (sync) · deploy con `npm run deploy` a GitHub Pages.
- **Claude puede ver la app**: Playwright instalado. `node screenshot.mjs` saca
  captura del local; `screenshot_online.mjs`, de la versión publicada.
  Regla aprendida: **capturar y mirar antes de decir que está listo.**
- Los planos de referencia están en
  `C:\Users\braya\OneDrive\Escritorio\Planificacion\`.

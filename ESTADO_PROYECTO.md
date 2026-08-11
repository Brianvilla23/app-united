# App United — Estado del proyecto
_Última actualización: 10-08-2026_

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
Tres vistas del mismo rack: **Vasijas · Manifold · Tapas**, con el selector
R1-R12 en las dos primeras.

**Manifold (11-08-2026)**: el plano de los 40 manifolds, marcando dónde filtra
en vez de qué se avanzó. Se toca un manifold → detalle con sus piezas → se
marca barra, stub end, **brazo** o tubing. Acá el brazo SÍ se registra: en el
outage no se marca, pero filtrar puede. En el plano general el manifold con
fuga queda amarillo con el número de piezas que filtran. Reusa el detalle del
outage con `modo="fuga"`. Se guarda en `avance_item` con
`actividad='fuga_manifold'` y el **rack dentro del `item`** (`7-DE1`), porque
esa tabla no tiene columna de rack.

**Comentario por rack (11-08-2026)**: caja de texto libre al pie del
levantamiento, una por rack, para las anomalías que no caben en ninguna
casilla del diagrama. Queda firmada con quién y cuándo, y sincroniza para toda
la cuadrilla. También va en `avance_item` (`actividad='comentario_rack'`,
`item` = el número de rack) y **no** en una tabla nueva a propósito: la cola de
subida se procesa en orden y se detiene al primer error, así que una tabla que
falte en Supabase dejaría trancados también los avisos y las tapas.

**Vasijas**: réplica fiel del plano "Vasijas lado Alimentación enumeradas" (**295 vasijas**,
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

## 9. Outage Rack 12 — la secuencia completa ✅ (29-07 al 10-08-2026)

Pestaña propia con **las 14 actividades del outage en su orden de ejecución**
(fuente: hojas manuscritas de Brayan + planos de Planificación, en
`src/actividades.ts`). Cierra con la prueba de alta: el 11-08 se sacaron
"Chequeo general" y "Entrega de rack", que no tenían avance guardado.
Cada una muestra su avance y su diagrama; el candado
**avisa** el orden pero no lo impone, porque en terreno las cuadrillas se
traslapan y la app no puede impedir registrar lo ya hecho.

Todo el avance vive en **una sola tabla**, `avance_item` (`sql/03`), con
`datos jsonb` libre para lo particular de cada actividad. Agregar una actividad
es elegir su tipo en el catálogo, no programar una pantalla.

| Tipo de diagrama | Qué dibuja |
|---|---|
| `tapa` | plano de 295 con seguros y pernos (reusa el módulo de tapas) |
| `simple` | plano de 295, se toca y queda hecho |
| `manifold` | los 40 manifolds sobre el plano real |
| `venteo` | los 6 venteos del rack |
| `fugas` | pruebas de presión de baja y alta |

### Manifolds: el diagrama ES el plano
Redibujarlo a mano nunca iba a quedar idéntico, así que la app muestra el PDF
de Planificación recortado y cuantizado (`public/manifold_descarga.png`, 83 KB)
con las 40 zonas tocables encima. El SVG vectorial del plano pesaba 1,17 MB.

### Detalle de manifold: pieza por pieza ✅ (10-08)
Tocar un manifold abre su detalle: el recorte del plano ampliado, con sus
piezas marcables una por una. Qué se marca depende de la actividad:

| Actividad | Piezas |
|---|---|
| Codificación de manifold y tubing | manifold · stub end · tubing |
| **Retiro de manifold** | **solo stub end** — sale entero y el tubing se cambia, lo que hay que dejar registrado es que ninguno se quedó atrás |
| Instalación de manifold | stub end · manifold · tubing |

El **stub end** es el octágono ámbar y el **tubing** es la manguerita amarilla
del extremo.

⚠️ **La barra celeste NO es el tubing: es el BRAZO**, la pieza que va al cuerpo
central del manifold. Son repuestos distintos (MF6 Brazo vs MF7 Tubing en el
catálogo SAP). Estuvo al revés hasta que Brayan lo corrigió el 11-08. El brazo
**no se marca** en las actividades del outage: queda dibujado y ubicado en
`manifoldDetalle.ts` por si más adelante hay que registrarlo.

- Las zonas **no se estimaron a ojo**: `scripts/gen_manifold.py` las saca de la
  geometría vectorial del PDF filtrando por color de relleno, y genera
  `src/manifoldDetalle.ts` + `public/manifold_detalle.png` (28 KB).
- El plano trae hasta 4 copias encimadas de cada pieza (copia-pega del CAD).
  Deduplicadas dan **295 stub end, 295 brazos y 295 tubing: uno por vasija del
  rack**, y el script lo verifica en los 40 manifolds antes de escribir nada.
- Por eso cada pieza sabe a qué vasija sirve: en terreno se marca "el tubing de
  la D14", no "el tercero de la izquierda". La fórmula de nombrado
  (`vasijaDeParte`) se comparó pieza por pieza contra la del generador.
- Los 40 manifolds se dibujan igual salvo qué vasijas existen en su fila y de
  qué lado queda la columna verde: **7 recortes cubren los 40**.
- El avance cuenta **piezas y no manifolds** — instalar los 295 stub end es
  trabajo real y tenía que verse en la barra. Instalación = 630 piezas,
  codificación = 335.
- Al marcar se lee de la base dentro de la transacción y no de la pantalla: dos
  toques seguidos se pisaban y se perdía la primera marca.
- ⚠️ Si en `codificacion` quedó algún ítem viejo con `hecho: true` y
  `datos: {}` (del modo anterior, marcar el manifold entero), se ve verde pero
  aporta 0 a la barra de piezas. Hoy no hay ninguno así.

### Pruebas de presión ✅ (10-08)
`prueba_baja` y `prueba_alta` tienen su propio diagrama — **no** el módulo de
fugas del rack, que marca victaulic y sideports del spool, que no es lo que se
revisa acá. Cada vasija queda **sin revisar · revisada sin fuga (verde) · con
fuga (amarillo)**, y al abrirla se marca dónde filtra:

- **Baja**: tapón, tapa, interconector.
- **Alta**: esos tres y, solo en descarga, manifold, stub end y tubing.
- Los **venteos van aparte** porque son del semi rack y no de una vasija: fila
  propia bajo el plano, con los del lado que se esté revisando.
- Supuesto a confirmar con Brayan: se ofrecen **todos** los venteos del lado en
  las dos pruebas (en descarga son 4: 2 de alta y 2 de baja).

### ⚠️ El local escribe en la base REAL
`src/supabase.ts` trae la URL y la clave anon fijas, así que `npm run dev`
sincroniza contra la base que usa la cuadrilla en planta. `screenshot.mjs` y
`screenshot_online.mjs` cortan Supabase (`ctx.route(...supabase.co...)`) y dejan
el nombre puesto: **cualquier script nuevo tiene que hacer lo mismo** o deja
marcas falsas sobre el rack.

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
  la vista de vasijas sigue fija en alimentación — falta exponerle el selector.
  También falta exportar el diagrama de fugas a PDF (incluyendo la vista de
  manifold y el comentario del rack) y un botón para limpiar marcas por parada.
- **Falta marcar la vasija aislada**: Brayan dijo que hay 1, pero no cuál.
  Se marca desde el detalle de la tapa → "Marcar vasija aislada".
- Módulos que faltan del mapa original: entrega de turno, reporte de equipo,
  plan de semana, mantenciones futuras, login.

---

## 🛠 Notas técnicas
- **Stack**: Vite + React + TypeScript · Dexie/IndexedDB (offline) · jsPDF ·
  vite-plugin-pwa · Supabase (sync) · deploy con `npm run deploy` a GitHub Pages.
- **Identidad visual**: paleta corporativa United en `index.css`
  (`--united-rojo #e1251b`, `--united-gris #7f7f7f`) y el logo real en la barra
  superior (`public/united.png`, sacado de `Plantilla_Maestra_MN55-M04.xls`).
  Va sobre placa blanca: el isotipo es rojo sobre blanco y en el azul de la
  barra el rojo se apaga y la barra gris del logo desaparece.
- **Claude puede ver la app**: Playwright instalado. `node screenshot.mjs` saca
  captura del local; `screenshot_online.mjs`, de la versión publicada.
  Regla aprendida: **capturar y mirar antes de decir que está listo.**
- Los planos de referencia están en
  `C:\Users\braya\OneDrive\Escritorio\Planificacion\`.

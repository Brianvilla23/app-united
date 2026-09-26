# App United — Estado del proyecto
_Última actualización: 25-09-2026_

> 👉 **Para retomar: leer primero `TRASPASO_OUTAGE_RACK3.md`.** El Rack 12
> cerró y el outage del **Rack 3** (también de EWS, no de Planta 0) ya está
> abierto en la app: ver la sección 10. Ahí están las trampas que ya costaron
> caro.

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
el trabajo), cantidad de cuerpos, fecha, **tarjeta de andamio** (verde o roja —
la amarilla se sacó el 11-08-2026; el tipo la conserva para no romper actas
viejas ya guardadas —, inspeccionado por, próxima inspección), foto del andamio + foto de la tarjeta,
"¿se generó el subsecuente?" sí/no.

### 3. Diagrama de fugas
**Una hoja por rack** (23-09-2026, pedido de Brayan): el selector R1-R12 arriba
y, debajo, los tres planos del rack — **Alimentación · Descarga · Manifold**.
Antes eran "Vasijas / Manifold" y el plano de vasijas estaba fijo en
alimentación; el semi rack A/B salió de acá (sigue en el plano de tapas del
outage, que es donde se usa para leer). El título dice el rack con su planta:
"RACK 1 EWS".

⚠️ **Las fugas se guardan por lado.** La base lo soportaba desde la migración 2
(`marcas_fuga.lado` en la llave), pero la app marcaba todo como alimentación;
ahora la marca lleva su lado también en el celular (Dexie v15, que reescribe
las locales como alimentación, que es lo que eran).

**Manifold (11-08-2026)**: el plano de los 40 manifolds, marcando dónde filtra
en vez de qué se avanzó. Se toca un manifold → detalle con sus piezas → se
marca barra, stub end, **brazo** o tubing. Acá el brazo SÍ se registra: en el
outage no se marca, pero filtrar puede. En el plano general el manifold con
fuga queda amarillo con el número de piezas que filtran. Reusa el detalle del
outage con `modo="fuga"`. Se guarda en `avance_item` con
`actividad='fuga_manifold'`; el rack va en su **columna** desde la migración 7
(antes viajaba dentro del `item`, como `7-DE1`, porque la tabla no la tenía).

**Comentario por rack (11-08-2026)**: caja de texto libre al pie del
levantamiento, una por rack, para las anomalías que no caben en ninguna
casilla del diagrama. Queda firmada con quién y cuándo, y sincroniza para toda
la cuadrilla. También va en `avance_item` (`actividad='comentario_rack'`, con
su columna `rack`) y **no** en una tabla nueva a propósito: la cola de
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

### 📐 Regla de orden en DESCARGA
En descarga el plano va espejado, así que el **Semi Rack B queda a la izquierda**
y se nombra y se lista **primero**: `B, A`. Vale para TODOS los diagramas de ese
lado — selectores de semi rack, bloques de venteos, listas y PDF. Sale de una
sola función, `ordenSemiRacks(espejo)` en `rackLayout.ts`; antes cada pantalla
tenía el orden escrito a mano y los selectores quedaban al revés del dibujo.
En alimentación sigue siendo `A, B`.

### 4. Estado de tapas
**Vive dentro del Outage** (11-08-2026): se saca del menú principal y de las
pestañas del levantamiento, porque ahí mostraba siempre el retiro de
alimentación — la actividad 1 del outage — y era el mismo dato dos veces. Se
entra por sus 4 actividades (retiro e instalación, por lado), cada una con su
propio registro. Mismo esquema del rack. **Solo 2 colores**: 🟠 ámbar = agripada/rodada · 🟢 verde = retirada.
Detalle = cabeza Protec realista: **3 seguros triples** (arcos) + **3 pernos parker**
(círculos 1-2-3), se tocan individualmente y quedan en ámbar; los sanos se atenúan.
Tocar el borde = tapa completa agripada. El color del rack se calcula solo.
**Data cargada**: turno noche 21/07/2026, OT 419375139, Rack 12
(K10 agripada; J4/J9/J12/J14/J16 pernos rodados; resto chequeado OK).

### 5. Extras
- **Guardados**: lista unificada de avisos y andamios, con descarga de PDF.
- **PDF de todo** (11-08-2026): cada diagrama tiene su botón `PDF`, con la
  misma regla que ya traía el de tapas — el papel sale del **mismo SVG que se
  ve en pantalla** (`svg2pdf`), no de una captura ni de un redibujo, así no se
  pueden desincronizar. `src/pdfDiagrama.ts` es el molde común: encabezado,
  diagrama, leyenda y una hoja 2 con el detalle y el comentario del rack.
  Hoja A3 apaisada para los planos de 295 vasijas (en A4 no se leen) y A4
  vertical para manifolds y venteos. Van **comprimidos**: sin eso el plano de
  manifolds pesaba 1,5 MB y no se manda por WhatsApp; comprimido queda en 96 KB.
  Los planos viven en un solo lugar cada uno — `PlanoRack`, `PlanoManifolds`,
  `PlanoVenteos` — y los usan pantalla y PDF.
- **Botón de atrás del teléfono** (arreglado 11-08-2026): cada pantalla y cada
  modal empuja **una capa** (`src/navegacion.ts`), y cada "atrás" cierra la de
  arriba. Antes se guardaba UNA sola pantalla de retorno: al entrar dos niveles
  (menú → outage → actividad) el segundo atrás se quedaba pegado y el tercero
  **cerraba la app**. Los botones ‹ y ✕ de la app también pasan por el
  historial (`volver()`), así el gesto del teléfono y los botones hacen lo mismo
  y no se desalinean. Los modales usan `useModal`, que engancha abrir/cerrar a
  la misma pila.
- **PWA instalable** + **auto-actualización** (revisa versión nueva cada 60 s y se
  actualiza sola). ⚠️ Cada celular debe tomar UNA vez la versión del 22-07 en
  adelante (abrir en incógnito o reinstalar); después ya se actualiza solo.

---

## 6. Trazabilidad — identidad, modo de uso e historial ✅

- **Modo de uso** (11-08-2026): al entrar, además del nombre se elige **Solo
  mirar** o **Registrar avance**, y queda guardado en ese celular
  (`united_modo`). En "solo mirar" se ve todo el avance y se descargan los PDF,
  pero no se puede tocar nada: sin botones de acción, el comentario del rack en
  solo lectura y las funciones de escritura cortadas por si acaso. La barra de
  identidad cambia de color para que se note. Se cambia con "cambiar", al lado
  del nombre.
  ⚠️ **Esto NO es seguridad**: no hay login y la clave de Supabase va dentro del
  JS publicado, así que quien sepa lo que hace escribe igual. Lo que evita es lo
  que pasa de verdad en planta — que alguien que entró a mirar el avance toque
  una vasija sin querer. Control de acceso real recién con el módulo de login
  (RLS por `auth.uid()` en vez de acceso libre al rol anon).

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
- **6 colores, uno por estado** (antes eran 2). Si una tapa tiene varias
  fallas manda **la más grave**: aislada › tapa agripada › seguros › pernos ›
  pendiente de retiro.
- **Pendiente de retiro** 🟣 (11-08-2026): salieron los seguros triples y los
  pernos parker, pero la tapa sigue adentro. No es falla ni está retirada, así
  que no suma al avance. Se marca con el interruptor de abajo del esquema.
  **En el retiro ya no va la vasija aislada**: ese interruptor pasa a ser el de
  pendiente de retiro, y la aislada queda solo en la instalación.
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

## 10. Dos racks: el outage del Rack 3 ✅ (22/23-09-2026)

El Rack 12 terminó y Brayan pidió abrir el **Rack 3**, que también es de EWS
(no de Planta 0: hay documentos de un "Rack 3 Planta Cero" que son de otro rack
con el mismo número). Confirmó que es **igual al 12** —295 vasijas, 40
manifolds, 6 venteos y las mismas 14 actividades—, así que los diagramas se
reusan tal cual. El manifold sí cambia: es **flexible**, con la misma forma que
el de PVC.

- **`src/rackOutage.ts`**: el catálogo de racks (`RACKS_OUTAGE`), el rack activo
  por contexto (`useRack`) y el cierre del outage. Agregar un rack es agregar
  una línea ahí; el primero de la lista es el que está en curso.
- **El menú muestra una tarjeta por rack**, con el cerrado abajo y marcado.
- **La tapa del Rack 3 no lleva seguros triples ni pernos parker** (ahí está la
  diferencia con el 12): su retiro es **un toque y queda retirada**, sin abrir
  el detalle pieza por pieza, y la leyenda y el PDF muestran solo ese estado.
  Va por rack en `retiroTapas: 'simple' | 'detallado'`. La **instalación** sí es
  igual en los dos: tapón al centro y shim en milímetros.
- **`avance_item` ahora tiene `rack`** (migración `sql/07`, corrida el 22-09).
  La llave pasó a `(actividad, lado, rack, item)` y los 969 registros del Rack
  12 quedaron donde estaban (`default 12`). De paso, el rack que viajaba dentro
  del ítem (`fuga_manifold` = "7-DE1", `comentario_rack` = "12") se mudó a la
  columna. Lo mismo hace la versión 14 de Dexie en el celular.
- **Cierre del outage**: un rack terminado NO se rellena ítem por ítem —eso
  inventaría registros que nadie marcó, por ejemplo 295 vasijas "revisadas sin
  fuga" en una prueba que sí tuvo fugas. Se guarda **una** marca de cierre
  (`outage_cerrado`): el rack se ve al 100%, cada actividad queda con el chip
  "✓ cerrada" y el rack pasa a solo lectura, con el porcentaje real de lo que
  alcanzó a registrarse a la vista. Se puede reabrir.
- **Se sacó el seed de tapas** (`src/seedTapas.ts`): reinyectaba el snapshot del
  21/07 en cada celular nuevo (63 filas con `creado_por = 'Turno noche 21/07'`).
  Con dos racks eso era pólvora; los datos ya viven en Supabase.
- 🔴 **Bug que trajo el segundo rack: lo marcado se veía desaparecer.**
  Supabase corta **toda respuesta en 1.000 filas**. Con un solo rack no se
  notaba (965 tapas), pero al abrir el Rack 3 las tablas pasaron las 1.000 y el
  pull traía solo las primeras mil; como el pull **borra lo local y lo
  reemplaza**, al minuto se borraban de la pantalla marcas que en la base
  estaban intactas. Arreglado paginando de a mil (`bajarTabla` en `sync.ts`,
  con `order` obligatorio para que las páginas no se pisen). Medido: la versión
  con el bug bajaba 1.000 filas (35 tapas del Rack 3); la corregida, las 1.045.
  **Regla: cualquier `select('*')` que reemplace datos locales tiene que
  paginar.**
- Probado de verdad con las dos versiones: se compiló la anterior, se marcó
  avance del Rack 12 y se sirvió la nueva **en el mismo origen** para que
  corriera la migración v13→v14 del IndexedDB. Los 17 chequeos pasaron: el
  avance viejo sobrevivió, el Rack 3 entra en cero y no se mezcla, y el cierre
  deja el rack de solo lectura.

---

## 11. Membranas: el escáner entra al carguío ✅ (23-09-2026)

Brayan pasó el proyecto **escáner de membranas** de United
(`escaner-membranas.pages.dev`, Cloudflare Pages + D1) para meterlo acá, y
decidió que va **dentro de la actividad "Carguío de membrana"** del outage: la
vasija ya está en el plano, así que tocarla abre sus 7 membranas.

- **Cada vasija lleva 7 membranas**: las 4 del fondo son C6 y las 3 del lado mar
  son C5. Se escanean en el orden en que se instalan, de la **posición 7 a la
  1**. Catálogo de modelos igual al del escáner (LG SW 440 R / 400 SR / 400 R
  G2 · SWC6-LD / SWC5-LD), en `src/membranas.ts`.
- **Se guardan en `avance_item.datos`**, sin tabla nueva: la vasija queda
  `hecho` con las 7 puestas, y el avance de la actividad se mide en membranas
  (295 × 7 = **2.065**), no en vasijas. En el plano, vasija completa en verde y
  a medio cargar en ámbar.
- **La serie no se puede repetir**: avisa si ya está en otra posición de la
  misma vasija o en otra vasija del rack.
- **El lector de códigos NO se reescribió**: se copiaron `lector.js` y
  `zxing.js` del escáner a `public/vendor/` y se cargan recién al abrir la
  cámara (350 KB que no tienen por qué pesar en cada arranque). Ese lector ya
  venía afinado para estas etiquetas: prueba el **canal rojo** además del de
  luminancia porque la "G2" naranja impresa sobre las barras borra la lectura
  normal, y usa BarcodeDetector nativo con ZXing de respaldo. También lee
  **desde una foto** y permite escribir la serie a mano.
- **Planilla**: botón que baja un CSV (`;` + BOM, Excel lo abre directo) con una
  fila por membrana — rack, vasija, posición, tipo, marca, modelo, serie, cómo
  se registró, quién y cuándo.
- **Simbologías** (ampliadas el 23-09 a pedido de Brayan): lineales **Code 128,
  Code 39 y Code 93** y bidimensionales **QR, Data Matrix, PDF417 y Aztec**.
  Codabar, ITF y EAN/UPC siguen fuera a propósito: con fotos borrosas dan
  lecturas falsas. Un 2D se acepta con una sola lectura (trae corrección de
  error propia); un lineal que no sea Code 128 pide leerlo dos veces igual.
  ⚠️ **Aztec solo donde el teléfono lo traiga nativo** (Android): el ZXing que
  viene con el lector incluye QR, Data Matrix y PDF417, pero no Aztec.
- ⚠️ La cámara **exige HTTPS**: en la app publicada funciona; en local, solo por
  `localhost`.
- Lo que **no** se trajo: los registros que ya están en la base D1 del escáner y
  la exportación a `.xlsx`. La app del escáner sigue publicada aparte.

### Marca: rojo United rgb(192,0,0)
Por decisión de Brayan (23-09) toda la app pasó al rojo corporativo del escáner
—`--accent: #c00000`— y al **logo nuevo** (1738×595 con fondo transparente, el
mismo `logo-united.png` del escáner) en vez del de 179×60 sacado del Excel. El
chip de "en línea" quedó verde a propósito: con el acento en rojo se leía como
alarma.

---

## 12. Planificación: proyectos y entrega de turno ✅ (25-09-2026)

Del cuaderno de Brayan (foto del 25-09): *Planificación → acceso con correo y
clave · Entrega de turno · Proyectos · actividades pendientes/completadas con
seguimiento y rango de fecha · cargar actividades y subtareas y tachar las
completadas · exportar la planilla en PDF o Excel*.

- **Es la única pantalla con cuenta.** El resto de la app sigue entrando sin
  registrarse: la cuadrilla marca tapas, fugas y membranas como siempre. Acá va
  Supabase Auth (correo y clave), y **quién entra lo dice la tabla
  `plan_editores`**, no la pantalla: son permisos de verdad, por RLS. Si alguien
  abre esta pantalla sin estar en la lista, la base no le devuelve ni una fila.
- **Proyectos** (`sql/09`): los 7 del cuaderno — Acueducto, Soporte de rack,
  Tapas Protec USA, Manifold desarmable, Tubing, Brazo y Sala eléctrica. Cada
  uno con sus **actividades y subtareas** (`plan_tareas`, el padre es la
  actividad), con estado, desde/hasta y seguimiento. **Tachar es marcar**: la
  completada queda tachada, como en el papel.
- **Entrega de turno**: el supervisor la llena **sin cuenta**, desde el menú
  principal, y funciona sin señal (se va por la cola de subida). En la base
  `entregas_turno` deja **insertar a cualquiera y leer solo a los editores** —
  por eso queda además una copia local, para que el supervisor pueda releer y
  reimprimir lo que entregó desde ese celular. En Planificación se ven todas,
  se abre el detalle, se baja **el PDF de una** o **el Excel (CSV) de todas**.
- **Formato oficial (26-09)**: la entrega de turno dejó de ser texto libre y
  tomó la forma del formato de United **PYC-EG-MEL-6001-01**: antecedentes
  (fecha, semana, quién entrega y quién recibe con cargo y RUN), **3.1 órdenes
  de trabajo ejecutadas**, **3.2 actividades adicionales / OT subsecuentes**,
  **3.3 amenazas** y **3.4 equipos** (los 23 del formato, con estado y
  horómetro). Al bajarla se rellena **la misma planilla**, que viaja con la app
  en `public/plantillas/entrega_turno.xlsx` — con su logo, sus textos fijos y
  los datos del contrato — usando ExcelJS (930 KB, se carga solo al exportar).
  También sale en PDF para mandarla por WhatsApp. La semana (W35) se propone
  sola —una atrás de la ISO, que es como la numeran ellos— y se puede corregir.
- **Las dos cuentas están creadas** (26-09): `bvillalobos@` y `jmolina@`
  `unitedpipeline-sa.com`, con la clave provisoria que definió Brayan y el
  botón para cambiarla dentro de la pantalla. Quedaron en `plan_editores`.
- ~~**Faltan las dos cuentas.**~~ Se crean en Supabase → Authentication → Add user
  (con "Auto Confirm User"), y después se corre `sql/10_cuentas_planificacion.sql`
  con los dos correos. ⚠️ Si alguna vez se crean por SQL: GoTrue no soporta NULL
  en sus columnas de token — el login devuelve "Database error querying schema"
  hasta dejarlas en cadena vacía, y hace falta la fila en `auth.identities`.
- Probado de punta a punta contra la base real (19 chequeos): el supervisor
  manda su entrega, planificación entra con clave, la ve, la baja en PDF y
  Excel, carga una actividad con subtarea, la tacha y la borra. Todo lo que creó
  la prueba se borró después, incluida la cuenta de prueba.
- 🐛 Lección: la clase CSS `.lista` ya era el contenedor de las entregas, y
  reusarla como "completada" dejó la fila de la actividad apilada en vertical.
  Las clases son globales: la de estado se llama `.tachada`.

---

## 13. Planificación: home, minuta semanal y plan maestro ✅ (26-09-2026)

- **Al entrar hay un HOME** con las cuatro áreas: Minuta de la semana, Plan
  maestro, Proyectos y Entrega de turno.
- ⚠️ **La semana de planificación va de MARTES a LUNES**, como la trabaja
  Brayan. Todo se guarda contra el martes de inicio y se rotula
  "Martes 22-09 → lunes 28-09 · W38" — el número sale de la misma regla que el
  formato de entrega de turno (una atrás de la ISO).
- **Minuta de la semana** (`minuta_tareas`): las tareas de la semana con tres
  estados —pendiente · en curso · lista— que se ciclan tocando el cuadrito.
  Botón **"Traer lo que quedó abierto la semana pasada"**, que copia lo que no
  se cerró y lo deja marcado como arrastrado. Abajo, **lo pendiente de los
  proyectos**, con un botón para bajarlo a la semana.
- **Plan maestro** (`plan_semana`): la planilla "Planificacion" de SharePoint.
  Se **carga el Excel** (lo parsea en el navegador con ExcelJS: bloques
  semanales, 7 días de a 3 columnas, turno día/noche, HH y OT) y se **baja el
  Excel** de vuelta. La semana se ve día por día con sus dos turnos y las
  **HH usadas contra las 344** del día. Cargar **reemplaza** las semanas que
  traiga el archivo, para que lo borrado en la planilla no quede de fantasma.
  Probado con el archivo real: **704 líneas en 33 semanas**.
- ⚠️ **No hay conexión en vivo con SharePoint.** Para que la app leyera y
  escribiera el archivo haría falta que **TI de United registre la app en el
  tenant** (Microsoft Graph), y Brayan descartó todo lo que dependa de TI. El
  ida y vuelta es por archivo.

---

## 14. La ficha de la tarea y el plan que se encuentra ✅ (26-09-2026)

- **Cada tarea de la minuta tiene ficha** (`sql/13`): fecha de cierre, correo de
  contacto, información libre, **subtareas** y **archivos** (PDF, fotos, lo que
  sea). Se abre tocando el título. Los archivos van a un bucket **privado** de
  Supabase y se abren con **enlaces firmados de 5 minutos**: no hay URL pública
  que se pueda pasar por ahí. En la lista, cada tarea muestra su fecha de cierre
  y cuántas subtareas tiene.
- 🔴 **"El plan maestro no funciona"** — eran cuatro cosas, no una:
  1. **Se cargaba la hoja equivocada.** El libro de SharePoint trae dos hojas
     con plan: `Planifcacion` (histórica, abr–dic 2025) y **`OT Estrategia`,
     que es la viva** (dic 2025 → ene 2027). El lector tomaba la primera que le
     servía y nunca llegaba a la buena. Ahora **lee todo el libro y ofrece las
     hojas** con sus fechas, marcando cuál tiene la semana de hoy.
  2. **Las dos hojas no tienen la misma forma**: la histórica usa 3 columnas
     por día (actividad, HH, OT) y la viva 2 (Descripcion, Horas). El lector ya
     no asume columnas fijas: **busca la fila de fechas y deduce el ancho**.
  3. **Las semanas cercanas tienen el día escrito a mano** ("lunes 21") en vez
     de una fecha. Esas se deducen del número de *Week* del título o de la
     semana anterior, y se validan contra el día del mes.
  4. **Todo caía un día antes.** Excel entrega el día a medianoche UTC y la
     cuenta lo corría al domingo anterior. Ahora se redondea al día más cercano.
- La semana del plan va de **lunes a domingo** y lleva el **número de la
  planilla** ("Week 39"), no la de martes a lunes de la minuta. Son dos
  calendarios a propósito: este es el de United.
- Si la semana que se mira está vacía, la app lo dice y ofrece ir a una con
  datos; y hay un **selector con las semanas cargadas**.
- Un `.xlsb` no se puede leer en el navegador: la app lo dice y pide guardarlo
  como `.xlsx`. Y elegir **el mismo archivo dos veces** ya funciona.
- Comprobado contra el archivo real: saca **451 líneas** de la hoja viva y
  **704** de la histórica — exactamente las celdas que tienen actividad, ni una
  inventada ni una perdida. La semana de hoy muestra el outage del Rack 3.

---

## 15. Los dos Excel salen en el formato de United ✅ (26-09-2026)

Regla que dejó Brayan: **lo que se descarga tiene que ser la misma planilla que
se sube, porque esa es la que tiene validada control de calidad.**

- **Plan maestro**: ya no arma un libro nuevo. Se sacó una **plantilla en
  blanco** del archivo real —`public/plantillas/plan_maestro.xlsx`, 76 KB: la
  hoja `OT Estrategia` con sus 73 bloques, títulos, fechas, fórmulas de HH
  libres, franjas de turno y formato, sin ninguna actividad— y al bajar se
  **escriben las actividades dentro de esa plantilla**. Se regenera con
  `node scripts/plantilla_plan.mjs "<archivo de SharePoint>"`.
  - Ida y vuelta probado con el archivo real: **451 líneas entran y 451 salen**,
    sin perder ni inventar ninguna, conservando hoja, 1.174 celdas combinadas,
    títulos y fórmulas.
  - ⚠️ **Las franjas que separan día de noche son una celda combinada de lado a
    lado.** Escribir ahí pisa la celda vecina (se perdían 2 líneas). El
    exportador salta toda fila cuya celda de HH no sea dueña de sí misma.
  - La plantilla arranca en **diciembre de 2025**: las semanas anteriores no
    tienen bloque y la app avisa cuántas quedaron fuera.
- **Entrega de turno**: ya rellenaba el formato oficial, pero 🔴 **el botón
  fallaba en silencio**: `.xlsx` no estaba en `globPatterns` del service worker,
  así que la plantilla no quedaba guardada y sin señal —en planta— no bajaba
  nada y no se mostraba error. Ahora el xlsx se precachea, el botón **Excel es
  el principal** (el PDF quedó secundario, "solo para leerlo") y cualquier falla
  se muestra. Probado **con la red cortada**: baja igual.

---

## 16. La minuta y la entrega de turno se hablan ✅ (26-09-2026)

⚠️ **Son DOS entregas de turno, de dos áreas distintas** (Brayan lo corrigió en
el mismo día, y la primera versión estaba mal):
- **Supervisión**: la llena el supervisor en terreno, desde la portada de la
  app, sin cuenta.
- **Planificación**: la hacen Brayan y Juan desde su pantalla. Es *su* entrega
  de turno, no la de supervisión.

`entregas_turno.area` las separa (`sql/15`) y lo que había hasta hoy quedó como
`'supervision'`. En Planificación hay dos tarjetas: **"Nuestra entrega de
turno"** (el formulario, para llenarla y bajarla) y **"Entregas de
supervisión"** (las que llegan, para leer y bajar). La misma pantalla
`EntregaTurno` sirve a las dos con un `area` y nunca mezcla las listas.

**De la minuta a nuestra entrega.** En la minuta hay **"Para nuestra entrega de
turno"**: se escribe una observación y se elige en qué cuadro del formato
oficial cae —**3.2 Actividades adicionales** o **3.3 Amenazas**—. Al abrir la
entrega de planificación de esa semana, llegan **ya cargadas en ese cuadro**,
marcadas con una pastilla "Plan", y se pueden corregir o sacar. Cada tarea de la
minuta tiene además un botón **"Al turno"** que la manda de una.
- 🔑 **No se inventó ninguna sección en la planilla validada**: la observación
  ocupa filas que el formato ya tiene. Comprobado en el Excel bajado: la
  actividad quedó en la fila 63 (3.2) y la amenaza en la 83 (3.3).
- `turno_observaciones` la leen **solo los editores**: como la entrega de
  planificación la llenan ellos con su cuenta, no hace falta abrirla a nadie
  más. La prueba verifica que a supervisión no le llega nada.

**De la entrega a la minuta.** La minuta muestra **"Nuestras entregas de turno
de esta semana"** (con Excel y PDF) y a cada una se le puede dejar una
**observación de planificación** para seguimiento.
- Esa observación **no va en el Excel**: ese es el documento firmado y no se le
  mete mano después. Sale en el **PDF** y queda en la app.

**De paso:** tocar dos veces "A la semana" duplicaba la tarea. Ahora el botón
dice "Ya está" y no repite. En la minuta del 22-09 quedaron 6 + 2 duplicados de
antes del arreglo: se sacan con la ✕.

---

## 17. Proyectos: agregar, renombrar y secciones nuevas ✅ (26-09-2026)

- El campo para **agregar una actividad** estaba al final de la lista y no se
  veía: ahora va **arriba**, apenas se abre la sección (y es uno solo, no dos).
- El **nombre de la sección se cambia en su propio título** ("Cambiar nombre").
- Botón **"+ Sección"** al final de las pestañas: se le pone nombre, se crea,
  queda seleccionada y ya se le pueden cargar actividades y subtareas.
- Una sección vacía lo dice en vez de quedar en blanco.

---

## 18. El PDF es el mismo documento que el Excel ✅ (26-09-2026)

Brayan: *"el PDF debe quedar de igual forma que el documento en excel"*. El PDF
era un diseño propio; ahora **reproduce el formato oficial**: logo de United,
título, cuadro de código/revisión/fecha, y las mismas secciones en el mismo
orden con los colores de la planilla —bandas rojas `C00000` para las secciones
numeradas, gris `696A6D` para 3.1/3.2/3.3/3.4 y gris `8D8F91` para los
encabezados de tabla—, incluidos **los 23 equipos del catálogo** y el cuadro de
firmas. Verificado renderizando el PDF y mirándolo página por página.

- El título dice **de qué área es**: `ENTREGA DE TURNO SUPERVISORES` para la de
  terreno y `ENTREGA DE TURNO PYC` para la de planificación (`entregaFormato.ts`),
  tanto en el PDF como en la celda D2 del Excel.
- ⚠️ **El formato oficial no tiene casilla para día/noche.** Para no ensuciarlo,
  el turno va en el pie de página del PDF. Si hay que meterlo en un cuadro, hay
  que decidir en cuál.
- La observación de planificación va como **anexo al final**, fuera del formato.

---

## 19. Las secciones de Planificación se editan y se crean ✅ (26-09-2026)

Las cinco tarjetas estaban escritas en el código. Ahora viven en la base
(`sql/16`) y desde la app se puede:

- **Cambiar el nombre** de cualquiera —incluidas las de siempre— con "Editar
  las secciones". El nombre manda también en el título de la pantalla.
- **Agregar una sección nueva** con un asistente: una conversación corta que
  pregunta cómo se llama, qué se va a anotar (una lista que se marca, una tabla
  con las columnas que uno defina, o notas sueltas) y con qué ícono; después
  **la muestra en vista previa** —la tarjeta y la pantalla, con dos filas de
  ejemplo— y recién ahí se crea.
- ⚠️ **El asistente NO es una IA**: es un guion de preguntas. Así funciona sin
  llaves de nadie, sin mandar nada afuera y sin depender de la señal de la
  planta. Si algún día se quiere que redacte solo, hay que meter un servicio y
  una llave.
- Las secciones nuevas guardan lo suyo en `plan_seccion_items` y las dibuja una
  sola pantalla genérica (`PanelSeccion.tsx`). Las fijas no se pueden borrar.

---

## 20. La entrega de planificación sale de la minuta ✅ (26-09-2026)

Brayan: *"nuestra entrega de turno debe modificarse porque no es lo mismo que
los supervisores"*. Ya no usa la plantilla PYC: es **su propio documento** y se
arma **desde la minuta de la semana**, ordenado por estado (`sql/17`):

| En la minuta | En la entrega |
|---|---|
| Lista (se hizo) | **Tareas realizadas** |
| En curso (quedó a medias) | **Actividades en seguimiento** |
| Pendiente | **Pendientes** |
| Las observaciones "Para nuestra entrega" | **Observaciones** |

Se pueden sacar líneas o agregar otras a mano antes de guardar, y al guardar
queda **una foto de esa semana** (la minuta sigue viva después). Baja en Excel
y en PDF con la cara de United.

- **Las entregas se listan por semana**, y cada una tiene **Ver** —se lee en
  pantalla sin bajar nada—, Excel y PDF. Lo mismo en la lista del celular del
  supervisor y en las de supervisión.
- **Fuera el RUT** de los formularios. En el Excel oficial la fila "RUN:" del
  cuadro de firmas queda impresa y en blanco, para firmarla a mano: es parte
  del formato validado y no se toca.
- 🔴 **El logo hinchaba los PDF a 4 MB**: `united.png` son 1738×595 px y jsPDF
  los mete como mapa de bits. Se reduce en un canvas y sale como JPEG
  (`logoPdf.ts`) → **15 KB**. Y ojo: jsPDF usa WinAnsi, así que la flecha "→"
  sale como basura y en los PDF se cambia por un guion.

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
- **Identidad visual**: rojo corporativo `rgb(192,0,0)` (`--accent`), el mismo
  del escáner de membranas, y el logo de United en la barra superior
  (`public/united.png`, 1738×595 con fondo transparente). Va sobre placa
  blanca: el isotipo es rojo sobre blanco y en el azul de la barra el rojo se
  apaga y la barra gris del logo desaparece.
- **Claude puede ver la app**: Playwright instalado. `node screenshot.mjs` saca
  captura del local; `screenshot_online.mjs`, de la versión publicada.
  Regla aprendida: **capturar y mirar antes de decir que está listo.**
- Los planos de referencia están en
  `C:\Users\braya\OneDrive\Escritorio\Planificacion\`.

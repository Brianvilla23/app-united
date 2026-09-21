# Traspaso — Outage del Rack 3 (y cierre del Rack 12)

_Escrito el 21-09-2026 al cerrar una conversación saturada. Actualizado el
mismo día, al construir el outage del Rack 3 con la Carta Gantt ya en mano._

El estado general de la app está en `ESTADO_PROYECTO.md`. Este archivo es solo
lo del Rack 3: qué se construyó, qué quedó decidido y qué sigue abierto.

---

## 🔴 Corrección: el Rack 3 NO es de Planta 0

La primera versión de este traspaso daba por hecho que el Rack 3 era de
**Planta 0**, y de ahí salían las dos primeras preguntas para Brayan (cuántas
vasijas tiene, si el manifold es flexible). **Era falso.**

La Carta Gantt que mandó Brayan —`OCDN2502_Rack_03_P1_-_EWS_-_Carta_Gantt.pdf`,
emitida el 18-09-2026— dice en el encabezado de cada bloque:

> ACTIVIDADES OUTAGE - **Rack 03 EWS P1** - Revision OCDN2502

Es decir: **Rack 3 de EWS, Planta 1**. Eso cambia todo para bien, porque el
Rack 3 comparte geometría con el Rack 12, que es el que la app ya dibuja:

| | Fuente en la Gantt |
|---|---|
| **295 vasijas, filas A-S, columnas 1-16** | «Fila C Semirack B Vasijas C16-C15-C14-C13 / C12-C11-C10-C9», «Fila A Semirack B Vasijas A15-A14-A13 / A12-A11-A10» — la fila A con 10-15 y la C hasta 16, igual que `rackLayout.ts` |
| **Manifold de PVC, no flexible** | «Retiro Manifold **PVC Permeado** Fila K Semirack B…» |
| **40 manifolds, 4 por fila doble** | Los sectores 1-4 recorren K-S y A-J en los dos semi racks |

Así que `rackLayout.ts`, `manifoldDetalle.ts`, `PlanoRack` y `PlanoManifolds`
se reusan **tal cual**, sin tocar una línea.

### Las tres preguntas del traspaso

1. **¿Qué Carta Gantt?** → **Resuelta por la Gantt misma.** No son las de
   «Planta Cero 36/60 horas»: la buena es la **OCDN2502 del Rack 03 EWS P1**.
   El alcance que pidió Brayan es el paquete **«36M Mec Camb Membrana
   Hydranaut Rack 3»** (fila 43): **22-09 10:30 → 03-10 06:21**, que cierra en
   la fila 496, «Desbloqueo y 2da prueba controlada en alta presion, Entrega de
   Rack a operaciones».
2. **¿Manifold PVC o flexible?** → **PVC**, como EWS. Lo dice el nombre de las
   40 tareas de retiro y de instalación de manifold.
3. **Cierre del Rack 12** → **SIGUE ABIERTA.** Es la única que falta. Ver abajo.

---

## ✅ Lo que se construyó (21-09-2026)

### El outage del Rack 3, con 24 actividades
`src/actividadesRack3.ts` traduce el paquete de cambio de membrana de la Gantt
a las 24 actividades de la app, **en el orden de inicio real**, cada una con su
fila de origen en el comentario y su ventana planificada a la vista:

1. Verificación de puntos de bloqueo · 2. Retiro de pantallas descarga ·
3. Recepción de membranas · 4. Recepción de material de manifold ·
5. Retiro de pantallas alimentación · 6. Armado y normalización de andamios ·
7. Retiro de manifold · 8-9. Retiro de tapas (alim. y desc.) ·
10. Retiro de membranas · 11. Reparación de sideport ·
12. Alineamiento y ovalamiento de puertos laterales ·
13. Limpieza interior descarga · 14. Instalación de tapas descarga ·
15. Montaje de membranas · 16. Montaje de tapas, tapones y canastillos ·
17. Prueba de baja presión · 18. Limpieza exterior · 19. Preparación de
manifold · 20. Instalación de manifold · 21. Prueba de marcha ·
22-23. Reparación de filtraciones (desc. y alim.) ·
**24. Desbloqueo y entrega del rack a operaciones**

**Lo que quedó fuera a propósito**, porque Brayan pidió solo el cambio de
membrana: los preparativos y el Rump Down (filas 3-41, ya corriendo desde el
19-09), el **cambio de válvulas de venteo** (fila 548, que es otro paquete de
trabajo: `36M Mec Rest Valv Venteo Rack 3`), y el RUN UP de planta con el Post
Outage (filas 658-662), que van después de la entrega.

### Tipo de diagrama nuevo: `pasos`
La Gantt del cambio de membrana trae mucho trabajo que **no cae sobre una
vasija ni sobre un manifold**: armar y retirar andamios del pasillo seguro por
nivel, verificar el bloqueo, recibir materiales, entregar el rack. No hay nada
que dibujar, así que `src/Pasos.tsx` los muestra como una checklist que se
tilda de a una, firmada con quién y cuándo, y con su PDF. 11 de las 24
actividades son de este tipo.

### `avance_item` por fin tiene rack
Era el problema de fondo que anotaba este mismo traspaso. Ya está hecho:

- **`sql/07_rack_en_avance_item.sql`** agrega la columna `rack` con
  `default 12` (los registros del Rack 12 quedan como están, sin reescribir
  ninguna fila) y mueve la PK a `(actividad, rack, lado, item)`.
- Las dos actividades que metían el rack **dentro** del `item`
  (`fuga_manifold` → `7-DE1`, `comentario_rack` → `7`) quedan con su rack real
  backfilleado desde el item. **El `item` no se toca**, así que los upserts de
  la app caen sobre las mismas filas que ya existen.
- Dexie sube a **v14** y reescribe los ids locales para incluir el rack. **No
  borra nada** (las migraciones viejas usaban `.clear()`; esta no).
- Se murió `RACK_TAPAS = 12`. El rack ahora baja por prop desde el outage
  abierto, que vive en **`src/racks.ts`**. En la pantalla del outage hay un
  selector Rack 3 / Rack 12.

### Se retiró el seed de tapas
`src/seedTapas.ts` reinyectaba el snapshot del 21/07 (63 filas firmadas «Turno
noche 21/07») en cada celular nuevo. Con un rack más eso solo empeoraba, y ya
era redundante: esos datos están en Supabase y bajan solos con `pullTapas`.
Se eliminó el archivo y su llamada en `App.tsx`.

---

## 🟡 Lo único que falta decidir: el cierre del Rack 12

Hoy el Rack 12 queda en el selector como **«cerrado»**, pero su avance sigue
mostrando en cero la instalación de tapas · alimentación, el carguío de
membrana, el cambio de venteos, las dos pruebas de presión, la limpieza
exterior y la instalación de manifold.

**Rellenarlas vasija por vasija inventaría registros** — por ejemplo, 295
«revisada sin fuga» en una prueba que pudo haber tenido fugas, firmadas con el
nombre de quien apriete el botón. La propuesta sigue en pie: un **estado
«outage cerrado»** que muestre el rack al 100 % sin fabricar datos, dejando el
historial real intacto. **Lo decide Brayan.** Mientras tanto no se tocó nada:
el Rack 12 está tal cual quedó.

Estado del Rack 12 al cierre: retiro de tapas descarga 100 %, instalación de
tapas descarga 100 %, retiro alimentación 98 % (289/295), codificación y retiro
de manifold 40/40, retiro de membrana 295/295, limpieza interior 590/590.

---

## 🔴 Las tres trampas (siguen todas vigentes)

### 1. Abrir la app en local ESCRIBE en la base de la cuadrilla
`src/supabase.ts` trae la URL y la clave fijas: `npm run dev` y `preview_start`
sincronizan contra producción. Ya pasó: una vista previa metió 43 filas falsas
el 24-08. **Toda prueba corta Supabase**:
```js
await ctx.route('**://*.supabase.co/**', (r) => r.abort())
```
`screenshot.mjs` ya lo hace. `preview_start` NO — no usarlo sin cortar antes.
(La verificación del Rack 3 se hizo así, con Supabase cortado.)

### 2. El Plan maestro vive en su propia rama — no publicarlo por accidente
El módulo Plan maestro (commit `eb81438`) está en la rama **`plan-maestro`**,
fuera de `main`. Se sacó de `main` el 21-09 porque agrega una tarjeta al menú
y sus tablas no existen en Supabase: un `npm run deploy` desde `main` lo habría
publicado roto. Brayan pidió no tocarlo hasta cerrar el diseño de la planilla.
`npm run deploy` publica lo que hay en el árbol de trabajo, así que antes de
desplegar: `git branch --show-current`.

### 3. Los datos de la planilla nunca van al repo
El repo es **público**. `sql/08_plan_semilla.sql`, `Plan_Maestro_*.xlsx` y
`scripts/plan_semilla.json` traen datos de operación de United: están en
`.gitignore` y quedan en disco. **Nunca `git add -A` sin mirar antes.**

---

## ⚠️ Orden de publicación (no invertirlo)

1. **Primero** correr `sql/07_rack_en_avance_item.sql` en Supabase → proyecto
   `egxgxejgcohzwuoqhald` → SQL Editor → Run.
2. **Después** publicar la app.

Si se publica antes de migrar, la app manda `rack` en cada upsert de avance, el
upsert falla porque la columna no existe, y **la cola de subida se detiene
ahí** — y como se sube en orden, deja trancados también los avisos, los
andamios y las tapas. Es la misma trampa que ya documentó la migración 06.

---

## Estado verificado el 21-09-2026

- **Supabase «Planta Desaladora» (`egxgxejgcohzwuoqhald`): ACTIVO.** Estaba
  pausado por inactividad (plan gratis, ~7 días sin uso) y se reactivó ese día.
  Datos completos: 965 tapas · 969 avance · 2.988 historial. **Se va a volver a
  pausar** si nadie usa la app una semana: si el dominio no resuelve, es eso.
- **El conector de Supabase ya ve la cuenta nueva** (antes solo la vieja): se
  puede migrar con `apply_migration` y reactivar con `restore_project`.
- **App publicada** = `main` = `82905dc`. https://brianvilla23.github.io/app-united/
- El Rack 3 se verificó en el navegador con Supabase cortado: las 24
  actividades en orden, el avance guardando con `rack: 3`, el selector volviendo
  al Rack 12 con sus 14 actividades, y la instalación de tapas del Rack 3
  pidiendo tapón y shim (los ids prefijados `r3_` rompían `esInstalacion` y
  `esRetiroTapas`, que miraban con `startsWith`; ahora usan `includes`).

### Dudas de la Gantt que conviene confirmarle a Brayan
La Gantt trae algunas listas de vasijas con erratas evidentes de copia y pega,
que **no** se modelaron como vasijas faltantes: «Fila N Semirack A Vasijas
N8-N7-N6-**N2** / - - -N1», «Vasija D1-**D2-D2-D2**- -N2-D7-D8», «N9-N10-N11-
-N13…». Se asumió que el Rack 3 tiene las 295 vasijas completas, igual que el
12. Si alguna vasija está realmente fuera de servicio o no existe, hay que
decirlo y se ajusta `rackLayout.ts` por rack.

### Pendientes que siguen abiertos (no son esta tarea)
- 80 filas duplicadas (`retiro_tapas_alim` + lado `descarga`), inofensivas.
- Plan maestro: 5 preguntas de Brayan sin responder (en la memoria
  `united_plan_maestro.md` y en `ESTADO_PROYECTO.md`).
- El cambio de válvulas de venteo del Rack 3 (fila 548 de la Gantt) no está en
  la app: si Brayan lo quiere, es agregar una actividad de tipo `venteo`.

# Traspaso — Outage del Rack 3 (y cierre del Rack 12)

_Escrito el 21-09-2026 al cerrar una conversación saturada; corregido el 22-09
(el Rack 3 es de EWS, no de Planta 0). Léelo entero antes de tocar nada: tiene
tres trampas que ya costaron caro._

El estado general de la app está en `ESTADO_PROYECTO.md`. Este archivo es solo
lo nuevo: qué pidió Brayan, qué hay que decidir antes de construir y qué no hay
que romper.

---

## Lo que pidió Brayan

1. **El outage del Rack 12 terminó** → marcar que todo está cambiado.
2. **Crear el outage del Rack 3.**

---

## El Rack 3 es de EWS, igual que el Rack 12

**Corrección de Brayan (22-09): el Rack 3 es de EWS, no de Planta 0.** La
primera versión de este traspaso se equivocó porque en `Planificacion\` hay
documentos de un "Rack 3 Planta 0" (Cartas Gantt de 36 y 60 h, informe QAQC,
mantención, alta conductividad). **Son de otro rack que tiene el mismo número:
no sirven para este outage.**

La buena noticia: EWS usa los mismos planos en todos sus racks (las Plantas 1,
2 y 3 comparten plano de vasija, y los planos enumerados ya se usaron en el
Rack 9). O sea, **lo que la app dibuja hoy para el Rack 12 debería servir tal
cual para el Rack 3**: las 295 vasijas (`rackLayout.ts`), los 40 manifolds y
los 6 venteos. Igual hay que confirmarlo con Brayan (pregunta 1).

Fuentes en `C:\Users\braya\OneDrive\Escritorio\Planificacion\`:

| Qué | Archivo |
|---|---|
| **De donde salió el Rack 12** | `Vasijas lado Alimentacion enumeradas.pdf` · `Vasijas lado Descarga enumeradas.pdf` · `Manifold pvc lado descarga enumerados.pdf` |
| Plano de la vasija EWS | `Extractor\Plano Vasija Planta 1,2,3 EWS.pdf` |
| Secuencia de un outage EWS | `Rack EWS\Pauta de Outage.pdf` · `Rack EWS\Carta Gantt.xlsx` · `Carta Gantt RACK 10 EWS.pdf_ Brayan Villalobos - UNITED.pdf` |
| Lo registrado del Rack 12 | `Rack 12.xlsx` · `Componentes Outage Rack 12.xlsx` |
| Manifold flexible (si el Rack 3 lo lleva) | `Rack EWS\Manifold Flexible Rack RO Tipo A Planta 1.docx` · `Rack EWS\SC Manifold Flexible Planta 1-2-3.eml` · `Materiales de Rack\Costo manifold flexible EWS.xlsx` |

⛔ **No usar** nada que diga "Rack 3 Planta Cero" o "Rack 3 P0".

### Preguntas para Brayan (no adivinar ninguna)

1. **¿El Rack 3 es igual al 12?** Mismas 295 vasijas, 40 manifolds, 6 venteos
   y las mismas 14 actividades. Si es así, no hay nada que dibujar: el trabajo
   es enseñarle a la app a manejar dos racks.
2. **¿Lleva el mismo manifold PVC, o el flexible?** Hay una solicitud de compra
   de manifold flexible para las Plantas 1-2-3 de EWS. Si el Rack 3 lo lleva,
   el detalle de manifold (stub end, brazo, tubing) sale del plano del PVC y
   habría que rehacerlo.
3. **"Marcar que todo está cambiado" en el Rack 12**: hoy quedan en cero
   instalación de tapas · alimentación, carguío de membrana, cambio de
   venteos, las dos pruebas de presión, limpieza exterior e instalación de
   manifold. **Rellenarlas vasija por vasija inventaría registros** — por
   ejemplo, 295 "revisada sin fuga" en una prueba que pudo haber tenido fugas.
   Proponerle un **estado "outage cerrado"** que muestre el rack al 100 % sin
   fabricar datos, y que el historial real quede intacto. Que decida él.

---

## El problema de fondo: la app está casada con el Rack 12

- `src/types.ts` → `export const RACK_TAPAS = 12`, usado por tapas, outage y PDF.
- Títulos fijos: `App.tsx` ("Outage Rack 12"), `Outage.tsx`, `actividades.ts`.
- **`avance_item` no tiene columna de rack.** Todo lo que guarda se da por Rack
  12. Las fugas de manifold y el comentario por rack ya tuvieron que meter el
  rack dentro del `item` (`7-DE1`) para esquivar esto.
- En cambio `estado_tapas`, `marcas_fuga` e `historial` **sí** tienen `rack`.

O sea: soportar un segundo rack es **agregarle la dimensión de rack al
outage**, no duplicar pantallas. Lo sano es una migración que agregue `rack`
a `avance_item` con `default 12` (así los 969 registros del Rack 12 quedan
como están) y lo sume a la llave primaria.

Si Brayan confirma que el Rack 3 es igual al 12 (pregunta 1), esto es casi todo
el trabajo: los dibujos ya existen y sirven para los dos.

---

## 🔴 Las tres trampas

### 1. Abrir la app en local ESCRIBE en la base de la cuadrilla
`src/supabase.ts` trae la URL y la clave fijas: `npm run dev` y `preview_start`
sincronizan contra producción. Ya pasó: una vista previa metió 43 filas falsas
el 24-08. **Toda prueba corta Supabase**:
```js
await ctx.route('**://*.supabase.co/**', (r) => r.abort())
```
`screenshot.mjs` ya lo hace. `preview_start` NO — no usarlo sin cortar antes.

### 2. El Plan maestro vive en su propia rama — no publicarlo por accidente
El módulo Plan maestro (commit `eb81438`) está en la rama **`plan-maestro`**,
fuera de `main`. Se sacó de `main` el 21-09 porque agrega una tarjeta al menú
y sus tablas no existen en Supabase: un `npm run deploy` desde `main` lo habría
publicado roto. Brayan pidió no tocarlo hasta cerrar el diseño de la planilla.
**Trabajar el Rack 3 sobre `main`.** `npm run deploy` publica lo que hay en el
árbol de trabajo, así que antes de desplegar: `git branch --show-current` = `main`.

### 3. Los datos de la planilla nunca van al repo
El repo es **público**. `sql/08_plan_semilla.sql`, `Plan_Maestro_*.xlsx` y
`scripts/plan_semilla.json` traen datos de operación de United: están en
`.gitignore` y quedan en disco. **Nunca `git add -A` sin mirar antes.**

---

## Estado verificado el 21-09-2026

- **Supabase "Planta Desaladora" (`egxgxejgcohzwuoqhald`): ACTIVO.** Estaba
  pausado por inactividad (plan gratis, ~7 días sin uso) y se reactivó ese día.
  Datos completos: 965 tapas · 969 avance · 2.988 historial. Escritura
  verificada con una fila de descarte que se borró. **Se va a volver a pausar**
  si nadie usa la app una semana: si el dominio no resuelve, es eso.
- **El conector de Supabase ya ve la cuenta nueva** (antes solo la vieja): se
  puede migrar con `apply_migration` y reactivar con `restore_project`, sin
  pasar por el navegador.
- **App publicada** = `main` = `82905dc`. https://brianvilla23.github.io/app-united/
- **Rack 12 al cierre**: retiro de tapas descarga 100 %, instalación de tapas
  descarga 100 %, retiro alimentación 98 % (289/295), codificación y retiro de
  manifold 40/40, retiro de membrana 295/295, limpieza interior 590/590.

### Pendientes que siguen abiertos (no son esta tarea)
- **El seed de tapas** (`src/seedTapas.ts`) reinyecta el snapshot del 21/07 en
  cada celular nuevo: 63 filas con `creado_por = 'Turno noche 21/07'`. Con un
  rack nuevo esto empeora — conviene retirarlo antes de abrir el Rack 3.
- 80 filas duplicadas (`retiro_tapas_alim` + lado `descarga`), inofensivas.
- Plan maestro: 5 preguntas de Brayan sin responder (en la memoria
  `united_plan_maestro.md` y en `ESTADO_PROYECTO.md`).

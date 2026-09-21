# Traspaso — Outage del Rack 3 (y cierre del Rack 12)

_Escrito el 21-09-2026 al cerrar una conversación saturada. Léelo entero antes
de tocar nada: tiene tres trampas que ya costaron caro._

El estado general de la app está en `ESTADO_PROYECTO.md`. Este archivo es solo
lo nuevo: qué pidió Brayan, qué hay que decidir antes de construir y qué no hay
que romper.

---

## Lo que pidió Brayan

1. **El outage del Rack 12 terminó** → marcar que todo está cambiado.
2. **Crear el outage del Rack 3.**

---

## ⚠️ Antes de construir: el Rack 3 NO es una copia del Rack 12

**El Rack 12 es de EWS; el Rack 3 es de Planta 0.** Todo lo que la app dibuja
hoy es EWS: las 295 vasijas (`rackLayout.ts`, sacado de "Vasijas lado
Alimentación enumeradas"), el plano de los 40 manifolds (`Manifold pvc lado
descarga enumerados.pdf`), los 6 venteos. Planta 0 puede tener otra cantidad de
vasijas, otro fabricante y otro manifold. **Verificarlo contra los planos antes
de escribir una línea.**

Fuentes en `C:\Users\braya\OneDrive\Escritorio\Planificacion\`:

| Qué | Archivo |
|---|---|
| **Plano de vasijas de Planta 0** | `Planos\Plano Vasijas Planta 0.pdf` · `Extractor\Plano Vasija Planta 0.pdf` |
| Vasijas de las tres plantas | `Planos\Plano de las vasijas EWS, EWSE y Planta 0.docx` · `Planos\Plano de Vasijas BEL, CODELINE y PROTEC.pdf` |
| **Secuencia del outage** | `Descarga\Propuesta de carta Gannt\Carta Gantt Rack 3 Planta Cero 36 HORAS.xlsx` y `… 60 HORAS.xlsx` |
| Mantención e inspección | `Mantenimiento Rack 3 P0.pdf` · `Informe Inspeccion Terreno QAQC-IN-MEL-6001-106 RACK 3 PLANTA 0.pdf` · `Alta conductividad Rack 3 P0.docx` |
| Materiales | `Materiales Outage Rack Planta 0.xlsx` · `Descarga\Materiales rack Planta 0 2.0.xlsx` |
| Manifold (si es flexible) | `Rack EWS\Manifold Flexible Rack RO Tipo A Planta 1.docx` |

### Preguntas para Brayan (no adivinar ninguna)

1. **¿La secuencia de actividades del Rack 3 es la misma del Rack 12?** La
   Carta Gantt es la fuente; confirmar si hay que usar la de 36 h o la de 60 h.
2. **¿Planta 0 tiene manifold PVC como EWS, o flexible?** Cambia todo el
   detalle de manifold (stub end, brazo, tubing se sacaron del plano de EWS).
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

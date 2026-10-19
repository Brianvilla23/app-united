// Carga un script de `public/vendor/` recién cuando hace falta (el lector de
// códigos, el visor de PDF): son cientos de KB que no tienen por qué pesar en
// cada arranque de la app. Dos llamados seguidos esperan la misma carga.
export const BASE = import.meta.env.BASE_URL

export function cargarScript(src: string): Promise<void> {
  return new Promise((listo, falla) => {
    const ya = document.querySelector(`script[data-src="${src}"]`)
    if (ya) {
      if (ya.getAttribute('data-listo')) return listo()
      ya.addEventListener('load', () => listo())
      ya.addEventListener('error', () => falla(new Error(src)))
      return
    }
    const s = document.createElement('script')
    s.src = src
    s.dataset.src = src
    s.onload = () => { s.dataset.listo = '1'; listo() }
    s.onerror = () => falla(new Error(src))
    document.head.appendChild(s)
  })
}

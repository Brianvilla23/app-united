// AUTO-GENERADO desde "Buscador Repuestos SAP por Modo de Falla.xlsx"
// No editar a mano: re-generar con  python scripts/gen_catalogo.py

export interface MaestroFila {
  mf: string
  falla: string
  planta: string
  componente: string
  sap: string
  cantidad: number
  conjunto: string
}

export interface CatalogoItem {
  sap: string
  nombre: string
  planta: string
  conjunto: string
}

export interface ModoFalla { codigo: string; nombre: string }

export const PLANTAS_RO: string[] = ["EWS", "EWSE", "Planta 0"]

export const MODOS_FALLA: ModoFalla[] = [
  {
    "codigo": "MF1",
    "nombre": "Tapón"
  },
  {
    "codigo": "MF2",
    "nombre": "Canastillo"
  },
  {
    "codigo": "MF3",
    "nombre": "Piedmont"
  },
  {
    "codigo": "MF4",
    "nombre": "Sideport"
  },
  {
    "codigo": "MF5",
    "nombre": "Americana"
  },
  {
    "codigo": "MF6",
    "nombre": "Brazo"
  },
  {
    "codigo": "MF7",
    "nombre": "Tubing"
  },
  {
    "codigo": "MF8",
    "nombre": "Manifold"
  },
  {
    "codigo": "MF9",
    "nombre": "Tapa"
  },
  {
    "codigo": "MF10",
    "nombre": "Flange"
  },
  {
    "codigo": "MF11",
    "nombre": "Piting"
  },
  {
    "codigo": "MF12",
    "nombre": "Venteo Alta"
  },
  {
    "codigo": "MF13",
    "nombre": "Venteo Baja"
  },
  {
    "codigo": "MF14",
    "nombre": "Tapón manifold"
  }
]

export const MAESTRO: MaestroFila[] = [
  {
    "mf": "MF1",
    "falla": "Tapon",
    "planta": "EWS",
    "componente": "CAP",
    "sap": "11466642",
    "cantidad": 1,
    "conjunto": "Tapones EWS"
  },
  {
    "mf": "MF1",
    "falla": "Tapon",
    "planta": "EWSE",
    "componente": "TAPON HIDROLATINA",
    "sap": "11362360",
    "cantidad": 1,
    "conjunto": "Tapa vasija"
  },
  {
    "mf": "MF1",
    "falla": "Tapon",
    "planta": "Planta 0",
    "componente": "Tapon Hidrolatina",
    "sap": "11455010",
    "cantidad": 1,
    "conjunto": "Tapon"
  },
  {
    "mf": "MF2",
    "falla": "Canastillo EWS",
    "planta": "EWS",
    "componente": "Canastillo",
    "sap": "11053685",
    "cantidad": 1,
    "conjunto": "VASIJA"
  },
  {
    "mf": "MF2",
    "falla": "Canastillo EWS",
    "planta": "EWS",
    "componente": "O´ring Canastillo",
    "sap": "11053686",
    "cantidad": 1,
    "conjunto": "VASIJA"
  },
  {
    "mf": "MF2",
    "falla": "Canastillo EWS",
    "planta": "EWS",
    "componente": "Seguro Heleicoidales",
    "sap": "11064579",
    "cantidad": 1,
    "conjunto": "VASIJA"
  },
  {
    "mf": "MF2",
    "falla": "Canastillo EWS",
    "planta": "EWS",
    "componente": "Seguro Triple",
    "sap": "11064601",
    "cantidad": 1,
    "conjunto": "VASIJA"
  },
  {
    "mf": "MF2",
    "falla": "Canastillo EWS",
    "planta": "EWS",
    "componente": "espaciador 1mm",
    "sap": "11053680",
    "cantidad": 3,
    "conjunto": "VASIJA"
  },
  {
    "mf": "MF2",
    "falla": "Canastillo EWS",
    "planta": "EWS",
    "componente": "espaciador 3mm",
    "sap": "11053681",
    "cantidad": 3,
    "conjunto": "VASIJA"
  },
  {
    "mf": "MF2",
    "falla": "Canastillo EWS",
    "planta": "EWS",
    "componente": "Adaptador mem-canast",
    "sap": "11129763",
    "cantidad": 1,
    "conjunto": "VASIJA"
  },
  {
    "mf": "MF2",
    "falla": "Canastillo EWS",
    "planta": "EWS",
    "componente": "O´ring Adaptador membrana-canast",
    "sap": "11053687",
    "cantidad": 2,
    "conjunto": "VASIJA"
  },
  {
    "mf": "MF2",
    "falla": "Canastillo EWS",
    "planta": "EWS",
    "componente": "Oring de viton",
    "sap": "11130159",
    "cantidad": 2,
    "conjunto": "VASIJA"
  },
  {
    "mf": "MF3",
    "falla": "Piedmont",
    "planta": "EWS/EWSE",
    "componente": "Piedmont Completa",
    "sap": "11377357",
    "cantidad": 1,
    "conjunto": "Piedmont"
  },
  {
    "mf": "MF3",
    "falla": "Piedmont",
    "planta": "EWS/EWSE",
    "componente": "Goma Flutflit",
    "sap": "11129467",
    "cantidad": 1,
    "conjunto": "Piedmont"
  },
  {
    "mf": "MF3",
    "falla": "Piedmont",
    "planta": "Planta 0",
    "componente": "Piedmont Completa",
    "sap": "11326947",
    "cantidad": 1,
    "conjunto": "Conector Victaulic Piedmont"
  },
  {
    "mf": "MF3",
    "falla": "Piedmont",
    "planta": "Planta 0",
    "componente": "Goma Flutflit",
    "sap": "10484186",
    "cantidad": 1,
    "conjunto": "Conector Victaulic Piedmont"
  },
  {
    "mf": "MF4",
    "falla": "Sideport",
    "planta": "EWS",
    "componente": "Seguro Heleicoidales Sideport",
    "sap": "11064586",
    "cantidad": 2,
    "conjunto": "Componentes de SIDEPORT"
  },
  {
    "mf": "MF4",
    "falla": "Sideport",
    "planta": "EWS",
    "componente": "Puerto sideport",
    "sap": "11130141",
    "cantidad": 1,
    "conjunto": "Componentes de SIDEPORT"
  },
  {
    "mf": "MF4",
    "falla": "Sideport",
    "planta": "EWS",
    "componente": "Disco Espaciador Sideport",
    "sap": "11064592",
    "cantidad": 1,
    "conjunto": "Componentes de SIDEPORT"
  },
  {
    "mf": "MF4",
    "falla": "Sideport",
    "planta": "EWS",
    "componente": "O´ring de sideport",
    "sap": "11064547",
    "cantidad": 1,
    "conjunto": "Componentes de SIDEPORT"
  },
  {
    "mf": "MF4",
    "falla": "Sideport",
    "planta": "EWSE",
    "componente": "Puerto de Sideport",
    "sap": "11355549",
    "cantidad": 1,
    "conjunto": "Sideport"
  },
  {
    "mf": "MF4",
    "falla": "Sideport",
    "planta": "EWSE",
    "componente": "Disco de Retencion Sideport",
    "sap": "11355548",
    "cantidad": 1,
    "conjunto": "Sideport"
  },
  {
    "mf": "MF4",
    "falla": "Sideport",
    "planta": "EWSE",
    "componente": "Seguro Heleicoidal Sideport",
    "sap": "11356086",
    "cantidad": 2,
    "conjunto": "Sideport"
  },
  {
    "mf": "MF4",
    "falla": "Sideport",
    "planta": "EWSE",
    "componente": "O-Ring de Sideport",
    "sap": "11202449",
    "cantidad": 1,
    "conjunto": "Sideport"
  },
  {
    "mf": "MF5",
    "falla": "Americana",
    "planta": "EWS",
    "componente": "Conector Canastillo Manifold Hidrolatina",
    "sap": "11535470",
    "cantidad": 1,
    "conjunto": "Manifold Nuevos"
  },
  {
    "mf": "MF5",
    "falla": "Americana",
    "planta": "EWS",
    "componente": "Americana Manifold Solucion Comando",
    "sap": "11427300",
    "cantidad": 1,
    "conjunto": ""
  },
  {
    "mf": "MF5",
    "falla": "Americana",
    "planta": "EWSE",
    "componente": "Americana  Manifold Hidrolatina",
    "sap": "11427300",
    "cantidad": 1,
    "conjunto": ""
  },
  {
    "mf": "MF6",
    "falla": "Brazo",
    "planta": "EWS",
    "componente": "Manifold Hidrolatina",
    "sap": "11462444",
    "cantidad": 1,
    "conjunto": "Manifold Nuevos"
  },
  {
    "mf": "MF6",
    "falla": "Brazo",
    "planta": "EWS",
    "componente": "Manifold Solucion Comando",
    "sap": "11432371",
    "cantidad": 1,
    "conjunto": ""
  },
  {
    "mf": "MF6",
    "falla": "Brazo",
    "planta": "EWSE",
    "componente": "Manifold Solucion Comando EWS-E",
    "sap": "11341522",
    "cantidad": 1,
    "conjunto": "Manifold"
  },
  {
    "mf": "MF7",
    "falla": "Tubing",
    "planta": "EWS/EWSE/P0",
    "componente": "Tubing",
    "sap": "11487183",
    "cantidad": 1,
    "conjunto": "Tapa vasija"
  },
  {
    "mf": "MF8",
    "falla": "Manifold",
    "planta": "EWS",
    "componente": "Manifold Hidrolatin",
    "sap": "11462444",
    "cantidad": 1,
    "conjunto": "Manifold Nuevos"
  },
  {
    "mf": "MF8",
    "falla": "Manifold",
    "planta": "EWS",
    "componente": "Manifold Solucion Comando",
    "sap": "11432371",
    "cantidad": 1,
    "conjunto": ""
  },
  {
    "mf": "MF8",
    "falla": "Manifold",
    "planta": "EWSE",
    "componente": "Manifold Solucion Comando",
    "sap": "11341522",
    "cantidad": 1,
    "conjunto": "Manifold"
  },
  {
    "mf": "MF8",
    "falla": "Manifold",
    "planta": "Planta 0",
    "componente": "KIT PPR",
    "sap": "11449266",
    "cantidad": 1,
    "conjunto": "Manifold"
  },
  {
    "mf": "MF9",
    "falla": "Tapa",
    "planta": "EWSE",
    "componente": "Tapa Metalica (BEARING PLATE BPV-8-1200PSI-SP)",
    "sap": "11201480",
    "cantidad": 1,
    "conjunto": "Tapa vasija"
  },
  {
    "mf": "MF9",
    "falla": "Tapa",
    "planta": "EWSE",
    "componente": "Placa de sellado (SEALING PLATE 8SP)",
    "sap": "11201535",
    "cantidad": 1,
    "conjunto": "Tapa vasija"
  },
  {
    "mf": "MF9",
    "falla": "Tapa",
    "planta": "EWSE",
    "componente": "Puerto de permeado Descarga (PERM PORT SEAWATER 1-1/2\" NPTM)",
    "sap": "11201490",
    "cantidad": 1,
    "conjunto": "Tapa Vasija"
  },
  {
    "mf": "MF9",
    "falla": "Tapa",
    "planta": "EWSE",
    "componente": "Puerto de permeado Alimentacion (PERM PORT SEAWATER 1-1/4 NPTM)",
    "sap": "11201486",
    "cantidad": 1,
    "conjunto": "Tapa Vasija"
  },
  {
    "mf": "MF9",
    "falla": "Tapa",
    "planta": "EWSE",
    "componente": "O-Ring de Placa de sellado (HEAD SEAL 8)",
    "sap": "11202479",
    "cantidad": 1,
    "conjunto": "Tapa Vasija"
  },
  {
    "mf": "MF9",
    "falla": "Tapa",
    "planta": "EWSE",
    "componente": "O-Ring Tapa - conector (O-RING PERMEATE PORT SEAL)",
    "sap": "11202480",
    "cantidad": 1,
    "conjunto": "Tapa Vasija"
  },
  {
    "mf": "MF9",
    "falla": "Tapa",
    "planta": "EWSE",
    "componente": "Seguro de Bloqueo (LOCKING SEG 8)",
    "sap": "11201871",
    "cantidad": 1,
    "conjunto": "Tapa Vasija"
  },
  {
    "mf": "MF9",
    "falla": "Tapa",
    "planta": "EWSE",
    "componente": "Anillo de Retencion para puerto de permeado (RETAINING RING FOR PERMEATE PORT)",
    "sap": "11201497",
    "cantidad": 1,
    "conjunto": "Tapa Vasija"
  },
  {
    "mf": "MF9",
    "falla": "Tapa",
    "planta": "EWSE",
    "componente": "Adaptado de Membrana - Conector MEMBRANE ADAPTER SEAWATER",
    "sap": "11201494",
    "cantidad": 1,
    "conjunto": "Tapa vasija"
  },
  {
    "mf": "MF9",
    "falla": "Tapa",
    "planta": "EWSE",
    "componente": "Anillo de empuje conico (THRUST RING CONICAL)",
    "sap": "11201528",
    "cantidad": 1,
    "conjunto": "Tapa vasija"
  },
  {
    "mf": "MF9",
    "falla": "Tapa",
    "planta": "EWSE",
    "componente": "O-Ring Adaptador membrana-conector Primario (O-RING ADPTER SEAL)",
    "sap": "11202448",
    "cantidad": 1,
    "conjunto": "Tapa vasija"
  },
  {
    "mf": "MF9",
    "falla": "Tapa",
    "planta": "EWSE",
    "componente": "O-Ring de conector Membrana -Conector Secundario (O-RING PWT SEAL)",
    "sap": "11202447",
    "cantidad": 2,
    "conjunto": "Tapa vasija"
  },
  {
    "mf": "MF9",
    "falla": "Tapa",
    "planta": "EWSE",
    "componente": "Pernos Parker (SCREW - DIN912 M10x20 SEGM 8 A4)",
    "sap": "11244940",
    "cantidad": 3,
    "conjunto": "Tapa vasija"
  },
  {
    "mf": "MF9",
    "falla": "Tapa",
    "planta": "EWSE",
    "componente": "Anillo de soporte 5 mm (SHIMMING RINGS 5 MM)",
    "sap": "11356146",
    "cantidad": 3,
    "conjunto": "Tapa vasija"
  },
  {
    "mf": "MF9",
    "falla": "Tapa",
    "planta": "EWSE",
    "componente": "Anillo de soporte 1 mm (SHIMMING RINGS 2 MM)",
    "sap": "11356087",
    "cantidad": 3,
    "conjunto": "Tapa vasija"
  },
  {
    "mf": "MF9",
    "falla": "Tapa",
    "planta": "EWSE",
    "componente": "O-Ring Tapa - conector Secundario (O-RING SECONDARY SEAL FOR PERMEATE PORT)",
    "sap": "11356147",
    "cantidad": 1,
    "conjunto": "Tapa vasija"
  },
  {
    "mf": "MF9",
    "falla": "Tapa",
    "planta": "EWSE",
    "componente": "Pernos parker Extractores",
    "sap": "11509219",
    "cantidad": 1,
    "conjunto": "Extractorde Tapa"
  },
  {
    "mf": "MF9",
    "falla": "Tapa",
    "planta": "Planta 0",
    "componente": "Bearing Plate (Tapa Metalica)",
    "sap": "11396364",
    "cantidad": 1,
    "conjunto": "Tapa de vasija"
  },
  {
    "mf": "MF9",
    "falla": "Tapa",
    "planta": "Planta 0",
    "componente": "Placa de sellado (Sealing Plate)",
    "sap": "11451335",
    "cantidad": 1,
    "conjunto": "Tapa de vasija"
  },
  {
    "mf": "MF9",
    "falla": "Tapa",
    "planta": "Planta 0",
    "componente": "Puerto de Permeado (F/C Port extended)",
    "sap": "11451338",
    "cantidad": 1,
    "conjunto": "Tapa de vasija"
  },
  {
    "mf": "MF9",
    "falla": "Tapa",
    "planta": "Planta 0",
    "componente": "Juego de retenedores de puerto (Port Retainer Set)",
    "sap": "11326936",
    "cantidad": 1,
    "conjunto": "Tapa de vasija"
  },
  {
    "mf": "MF9",
    "falla": "Tapa",
    "planta": "Planta 0",
    "componente": "Puerto de permeado (Permeate Port)",
    "sap": "11326870",
    "cantidad": 1,
    "conjunto": "Tapa de vasija"
  },
  {
    "mf": "MF9",
    "falla": "Tapa",
    "planta": "Planta 0",
    "componente": "Tuerca de puerto (Port Nut)",
    "sap": "11326878",
    "cantidad": 1,
    "conjunto": "Tapa de vasija"
  },
  {
    "mf": "MF9",
    "falla": "Tapa",
    "planta": "Planta 0",
    "componente": "Sello del cabezal  (Head Seal)",
    "sap": "10929117",
    "cantidad": 1,
    "conjunto": "Tapa de vasija"
  },
  {
    "mf": "MF9",
    "falla": "Tapa",
    "planta": "Planta 0",
    "componente": "Kit de sellado del puerto de permeado (Permeate Port Seal Kit (20x45312))",
    "sap": "11192534",
    "cantidad": 2,
    "conjunto": "Tapa de vasija"
  },
  {
    "mf": "MF9",
    "falla": "Tapa",
    "planta": "Planta 0",
    "componente": "Anillo de retención de liberación rápida (Quick Release Ret Ring)",
    "sap": "10835588",
    "cantidad": 1,
    "conjunto": "Tapa de vasija"
  },
  {
    "mf": "MF9",
    "falla": "Tapa",
    "planta": "Planta 0",
    "componente": "Kit adaptador 8 pulgadas (Adapter kit 8 inch)",
    "sap": "11327144",
    "cantidad": 1,
    "conjunto": "Adaptador Tapa Membrana"
  },
  {
    "mf": "MF9",
    "falla": "Tapa",
    "planta": "Planta 0",
    "componente": "Sello PWT (PWT Seal)",
    "sap": "11327125",
    "cantidad": 2,
    "conjunto": "Adaptador Tapa Membrana"
  },
  {
    "mf": "MF9",
    "falla": "Tapa",
    "planta": "Planta 0",
    "componente": "Junta adaptadora (Adapter Seal)",
    "sap": "10759984",
    "cantidad": 1,
    "conjunto": "Adaptador Tapa Membrana"
  },
  {
    "mf": "MF9",
    "falla": "Tapa",
    "planta": "Planta 0",
    "componente": "Anillo de empuje (Thrust Ring)",
    "sap": "11326872",
    "cantidad": 1,
    "conjunto": "Canastillo de retencion"
  },
  {
    "mf": "MF10",
    "falla": "Flanje",
    "planta": "(sin definir)",
    "componente": "Flange",
    "sap": "FALTA SAP",
    "cantidad": 1,
    "conjunto": ""
  },
  {
    "mf": "MF11",
    "falla": "Piting",
    "planta": "(sin definir)",
    "componente": "Piting Vasija",
    "sap": "FALTA SAP",
    "cantidad": 1,
    "conjunto": ""
  },
  {
    "mf": "MF12",
    "falla": "Venteo Alta",
    "planta": "EWS",
    "componente": "Venteo Alta",
    "sap": "11319362",
    "cantidad": 1,
    "conjunto": "Venteo"
  },
  {
    "mf": "MF13",
    "falla": "Venteo Baja",
    "planta": "(sin definir)",
    "componente": "Venteo Baja",
    "sap": "FALTA SAP",
    "cantidad": 1,
    "conjunto": ""
  }
]

export const CATALOGO: CatalogoItem[] = [
  {
    "sap": "11064579",
    "nombre": "Seguros helicoidales",
    "planta": "EWS",
    "conjunto": "VASIJA"
  },
  {
    "sap": "11064601",
    "nombre": "seguro triple",
    "planta": "EWS",
    "conjunto": "VASIJA"
  },
  {
    "sap": "11064603",
    "nombre": "Plato  metalico",
    "planta": "EWS",
    "conjunto": "VASIJA"
  },
  {
    "sap": "11064378",
    "nombre": "Canastillo alimentación",
    "planta": "EWS",
    "conjunto": "VASIJA"
  },
  {
    "sap": "11053686",
    "nombre": "O´ring de canastillo",
    "planta": "EWS",
    "conjunto": "VASIJA"
  },
  {
    "sap": "11129763",
    "nombre": "Adaptador  mem-canast",
    "planta": "EWS",
    "conjunto": "VASIJA"
  },
  {
    "sap": "11053687",
    "nombre": "O´ring Adaptador membrana-canast",
    "planta": "EWS",
    "conjunto": "VASIJA"
  },
  {
    "sap": "11130159",
    "nombre": "Oring de viton",
    "planta": "EWS",
    "conjunto": "VASIJA"
  },
  {
    "sap": "11053680",
    "nombre": "espaciador  1mm",
    "planta": "EWS",
    "conjunto": "VASIJA"
  },
  {
    "sap": "11053681",
    "nombre": "espaciador  3mm",
    "planta": "EWS",
    "conjunto": "VASIJA"
  },
  {
    "sap": "11053685",
    "nombre": "canastillo descarga",
    "planta": "EWS",
    "conjunto": "VASIJA"
  },
  {
    "sap": "11064363",
    "nombre": "Membranas C-5",
    "planta": "EWS",
    "conjunto": "Membranas"
  },
  {
    "sap": "11064351",
    "nombre": "Membranas C-6",
    "planta": "EWS",
    "conjunto": "Membranas"
  },
  {
    "sap": "11130141",
    "nombre": "Puerto  sideport",
    "planta": "EWS",
    "conjunto": "Componentes de SIDEPORT"
  },
  {
    "sap": "11064586",
    "nombre": "Seguro Heleicoidal side port",
    "planta": "EWS",
    "conjunto": "Componentes de SIDEPORT"
  },
  {
    "sap": "11064592",
    "nombre": "Anillo metalico de side port",
    "planta": "EWS",
    "conjunto": "Componentes de SIDEPORT"
  },
  {
    "sap": "11064547",
    "nombre": "Oring de sideport (sello)",
    "planta": "EWS",
    "conjunto": "Componentes de SIDEPORT"
  },
  {
    "sap": "11375013",
    "nombre": "Carrete entre piedmon (SPOL 3\")",
    "planta": "EWS",
    "conjunto": "Carrete entre piedmont"
  },
  {
    "sap": "11129466",
    "nombre": "Piedmont Completa",
    "planta": "EWS",
    "conjunto": "Piedmont"
  },
  {
    "sap": "10388329",
    "nombre": "ANTISEIZE,NI BASE,TIN/500G",
    "planta": "EWS",
    "conjunto": "Piedmont"
  },
  {
    "sap": "11263794",
    "nombre": "Pernos para Piedmont",
    "planta": "EWS",
    "conjunto": "Piedmont"
  },
  {
    "sap": "11377357",
    "nombre": "Piedmont Completa duplex ( Perno, golilla y tuerca)",
    "planta": "EWS",
    "conjunto": "Piedmont"
  },
  {
    "sap": "11386818",
    "nombre": "Pernos , Tuerca y Golillas Duplex 3\"",
    "planta": "EWS",
    "conjunto": "Piedmont"
  },
  {
    "sap": "11263797",
    "nombre": "Tuercas duplex para pied 3\"",
    "planta": "EWS",
    "conjunto": "Piedmont"
  },
  {
    "sap": "11129467",
    "nombre": "Goma Flutflit piedmont",
    "planta": "EWS",
    "conjunto": "Piedmont"
  },
  {
    "sap": "11064588",
    "nombre": "Asiento de vasija",
    "planta": "EWS",
    "conjunto": "Alineamiento de vasijas"
  },
  {
    "sap": "11064415",
    "nombre": "Abrazadera",
    "planta": "EWS",
    "conjunto": "Alineamiento de vasijas"
  },
  {
    "sap": "11487183",
    "nombre": "Tubing",
    "planta": "EWS",
    "conjunto": "Tubing"
  },
  {
    "sap": "11319362",
    "nombre": "Valvulas de Venteo Alta",
    "planta": "EWS",
    "conjunto": "Venteo"
  },
  {
    "sap": "11130653",
    "nombre": "Extractor (Hidrolatina)",
    "planta": "EWS",
    "conjunto": "Herramienta del rack"
  },
  {
    "sap": "11130654",
    "nombre": "Martillo Slide Hammer (Hidrolatina)",
    "planta": "EWS",
    "conjunto": "Herramienta del rack"
  },
  {
    "sap": "11233865",
    "nombre": "Lubricante",
    "planta": "EWS",
    "conjunto": "Lubricante"
  },
  {
    "sap": "11462444",
    "nombre": "Manifold flexible permeado EWS (Pulpo Blanco Hidrolatina)",
    "planta": "EWS",
    "conjunto": "Manifold Nuevos"
  },
  {
    "sap": "11535470",
    "nombre": "Conectores Canastillo - Manifold",
    "planta": "EWS",
    "conjunto": "Manifold Nuevos"
  },
  {
    "sap": "11470292",
    "nombre": "Tapón manifold Permeado blancos (para posiciones no operativas superiores del Rack).",
    "planta": "EWS",
    "conjunto": "Manifold Nuevos"
  },
  {
    "sap": "11466642",
    "nombre": "CAP",
    "planta": "EWS",
    "conjunto": "Tapones EWS"
  },
  {
    "sap": "11462426",
    "nombre": "Martillo Slide Hammer (Sobek)",
    "planta": "EWS",
    "conjunto": "Extractor EWS"
  },
  {
    "sap": "11478052",
    "nombre": "Extractores de Tapas (Sobek)",
    "planta": "EWS",
    "conjunto": "Extractor EWS"
  },
  {
    "sap": "11470413",
    "nombre": "Instalador de Sideport",
    "planta": "EWS",
    "conjunto": "Herramientas de Sideport"
  },
  {
    "sap": "11523954",
    "nombre": "Extractor de Puerto (Sobek)",
    "planta": "EWS",
    "conjunto": "Herramientas de Sideport"
  },
  {
    "sap": "11350782",
    "nombre": "Resina Vinilester Estandar 60 KG",
    "planta": "EWS",
    "conjunto": "Tratamiento de Resina"
  },
  {
    "sap": "11354373",
    "nombre": "Peroxido  para Vinilester 1kg",
    "planta": "EWS",
    "conjunto": "Tratamiento de Resina"
  },
  {
    "sap": "11354379",
    "nombre": "Octoato de covalto 6% 1KG",
    "planta": "EWS",
    "conjunto": "Tratamiento de Resina"
  },
  {
    "sap": "11354361",
    "nombre": "Agente S 1KG",
    "planta": "EWS",
    "conjunto": "Tratamiento de Resina"
  },
  {
    "sap": "11349126",
    "nombre": "Mat 450g/m2 TSHN Emulsion 48 KG. A= 1.40",
    "planta": "EWS",
    "conjunto": "Tratamiento de Resina"
  },
  {
    "sap": "11348921",
    "nombre": "Tela 800 G/m2 CPIC A=1.40 R=60 kg APP",
    "planta": "EWS",
    "conjunto": "Tratamiento de Resina"
  },
  {
    "sap": "11349127",
    "nombre": "Disco Lija 4\" 1/2 GNO. 24",
    "planta": "EWS",
    "conjunto": "Tratamiento de Resina"
  },
  {
    "sap": "11358701",
    "nombre": "Diluyente Poly D-17 5 Litros",
    "planta": "EWS",
    "conjunto": "Tratamiento de Resina"
  },
  {
    "sap": "11425518",
    "nombre": "Tapon Hidrolatina HE",
    "planta": "EWS",
    "conjunto": "Tratamiento de Resina"
  },
  {
    "sap": "11201480",
    "nombre": "Tapa Metalica (BEARING PLATE BPV-8-1200PSI-SP)",
    "planta": "EWSE",
    "conjunto": "Tapa vasija"
  },
  {
    "sap": "11201535",
    "nombre": "Placa de sellado (SEALING PLATE 8SP)",
    "planta": "EWSE",
    "conjunto": "Tapa vasija"
  },
  {
    "sap": "11355549",
    "nombre": "Puerto de Sideport (F/C PORT 3 1000/1200 PSI SP)",
    "planta": "EWSE",
    "conjunto": "Sideport"
  },
  {
    "sap": "11355548",
    "nombre": "Disco de Retencion Sideport (RETAINING RING F/C PORT 3 INNER)",
    "planta": "EWSE",
    "conjunto": "Sideport"
  },
  {
    "sap": "11356086",
    "nombre": "Seguro Heleicoidal Sideport (RETAINING RING F/C PORT 3 UNS S32750 OUTER)",
    "planta": "EWSE",
    "conjunto": "Sideport"
  },
  {
    "sap": "11202449",
    "nombre": "O-Ring de Sideport Planta 4 (O-RING F/C PORT 3)",
    "planta": "EWSE",
    "conjunto": "Sideport"
  },
  {
    "sap": "11201490",
    "nombre": "Puerto de permeado Descarga (PERM PORT SEAWATER 1-1/2\" NPTM)",
    "planta": "EWSE",
    "conjunto": "Tapa Vasija"
  },
  {
    "sap": "11201486",
    "nombre": "Puerto de permeado Alimentacion (PERM PORT SEAWATER 1-1/4 NPTM)",
    "planta": "EWSE",
    "conjunto": "Tapa Vasija"
  },
  {
    "sap": "11202479",
    "nombre": "O-Ring de Placa de sellado (HEAD SEAL 8)",
    "planta": "EWSE",
    "conjunto": "Tapa Vasija"
  },
  {
    "sap": "11202480",
    "nombre": "O-Ring Tapa - conector (O-RING PERMEATE PORT SEAL)",
    "planta": "EWSE",
    "conjunto": "Tapa Vasija"
  },
  {
    "sap": "11201871",
    "nombre": "Seguro de Bloqueo (LOCKING SEG 8)",
    "planta": "EWSE",
    "conjunto": "Tapa Vasija"
  },
  {
    "sap": "11201497",
    "nombre": "Anillo de Retencion para puerto de permeado (RETAINING RING FOR PERMEATE PORT)",
    "planta": "EWSE",
    "conjunto": "Tapa Vasija"
  },
  {
    "sap": "11201477",
    "nombre": "Soporte de vasijas (SADDLE 8 1000/1200 PSI)",
    "planta": "EWSE",
    "conjunto": "Alineamiento"
  },
  {
    "sap": "11256489",
    "nombre": "Correa de abrazaderas  (STRAP 8 UNS31603 BRASS)",
    "planta": "EWSE",
    "conjunto": "Alineamiento"
  },
  {
    "sap": "11201520",
    "nombre": "Tornillo  de abrazadera (SCREW - DIN933 M8x70 A4)",
    "planta": "EWSE",
    "conjunto": "Alineamiento"
  },
  {
    "sap": "11201494",
    "nombre": "Adaptado de Membrana - Conector MEMBRANE ADAPTER SEAWATER",
    "planta": "EWSE",
    "conjunto": "Tapa vasija"
  },
  {
    "sap": "11201528",
    "nombre": "Anillo de empuje conico (THRUST RING CONICAL)",
    "planta": "EWSE",
    "conjunto": "Tapa vasija"
  },
  {
    "sap": "11202448",
    "nombre": "O-Ring Adaptador membrana-conector Primario (O-RING ADPTER SEAL)",
    "planta": "EWSE",
    "conjunto": "Tapa vasija"
  },
  {
    "sap": "11202447",
    "nombre": "O-Ring de conector Membrana -Conector Secundario (O-RING PWT SEAL)",
    "planta": "EWSE",
    "conjunto": "Tapa vasija"
  },
  {
    "sap": "11244940",
    "nombre": "Pernos Parker (SCREW - DIN912 M10x20 SEGM 8 A4)",
    "planta": "EWSE",
    "conjunto": "Tapa vasija"
  },
  {
    "sap": "11356146",
    "nombre": "Anillo de soporte 5 mm (SHIMMING RINGS 5 MM)",
    "planta": "EWSE",
    "conjunto": "Tapa vasija"
  },
  {
    "sap": "11356087",
    "nombre": "Anillo de soporte 1 mm (SHIMMING RINGS 2 MM)",
    "planta": "EWSE",
    "conjunto": "Tapa vasija"
  },
  {
    "sap": "11356147",
    "nombre": "O-Ring Tapa - conector Secundario (O-RING SECONDARY SEAL FOR PERMEATE PORT)",
    "planta": "EWSE",
    "conjunto": "Tapa vasija"
  },
  {
    "sap": "11201475",
    "nombre": "VALVE,SAMPLING,ARISAWA 30800012",
    "planta": "EWSE",
    "conjunto": "Tapa vasija"
  },
  {
    "sap": "11363687",
    "nombre": "HEAD EXTRACTOR 4 & 8",
    "planta": "EWSE",
    "conjunto": "Tapa vasija"
  },
  {
    "sap": "11362360",
    "nombre": "TAPON HIDROLATINA",
    "planta": "EWSE",
    "conjunto": "Tapa vasija"
  },
  {
    "sap": "11487183",
    "nombre": "Tubing",
    "planta": "EWSE",
    "conjunto": "Tapa vasija"
  },
  {
    "sap": "11341532",
    "nombre": "MANIFOLD,KIT,TYPE A,UPVC,3 X 1-1/2IN PIP",
    "planta": "EWSE",
    "conjunto": "Manifold"
  },
  {
    "sap": "11341522",
    "nombre": "MANIFOLD,KIT,TYPE B,UPVC,8 X 1-1/2IN PIP",
    "planta": "EWSE",
    "conjunto": "Manifold"
  },
  {
    "sap": "11341547",
    "nombre": "MANIFOLD,KIT,TYPE C,UPVC,7 X 1-1/2IN PIP",
    "planta": "EWSE",
    "conjunto": "Manifold"
  },
  {
    "sap": "11341520",
    "nombre": "MANIFOLD,KIT,TYPE D,UPVC,3 X 1-1/2IN PIP",
    "planta": "EWSE",
    "conjunto": "Manifold"
  },
  {
    "sap": "11341596",
    "nombre": "MANIFOLD,KIT,TYP E,UPVC,8 X 1-1/2IN PIPE",
    "planta": "EWSE",
    "conjunto": "Manifold"
  },
  {
    "sap": "11341605",
    "nombre": "MANIFOLD,KIT,TYP F,UPVC,7 X 1-1/2IN PIPE",
    "planta": "EWSE",
    "conjunto": "Manifold"
  },
  {
    "sap": "11341551",
    "nombre": "MANIFOLD,KIT,TYPE G,UPVC,6 X 1-1/2IN PIP",
    "planta": "EWSE",
    "conjunto": "Manifold"
  },
  {
    "sap": "11341568",
    "nombre": "MANIFOLD,KIT,TYP H,UPVC,8 X 1-1/2IN PIPE",
    "planta": "EWSE",
    "conjunto": "Manifold"
  },
  {
    "sap": "11341581",
    "nombre": "MANIFOLD,KIT,TYP I,UPVC,8 X 1-1/2IN PIPE",
    "planta": "EWSE",
    "conjunto": "Manifold"
  },
  {
    "sap": "11509010",
    "nombre": "Extractor de planta  4",
    "planta": "EWSE",
    "conjunto": "Extractorde Tapa"
  },
  {
    "sap": "11509219",
    "nombre": "Pernos parker Extractores",
    "planta": "EWSE",
    "conjunto": "Extractorde Tapa"
  },
  {
    "sap": "11396364",
    "nombre": "Bearing Plate (Tapa Metalica)",
    "planta": "Planta 0",
    "conjunto": "Tapa de vasija"
  },
  {
    "sap": "11451335",
    "nombre": "Placa de sellado (Sealing Plate)",
    "planta": "Planta 0",
    "conjunto": "Tapa de vasija"
  },
  {
    "sap": "11451338",
    "nombre": "Puerto de Permeado (F/C Port extended)",
    "planta": "Planta 0",
    "conjunto": "Tapa de vasija"
  },
  {
    "sap": "11326936",
    "nombre": "Juego de retenedores de puerto (Port Retainer Set)",
    "planta": "Planta 0",
    "conjunto": "Tapa de vasija"
  },
  {
    "sap": "11326870",
    "nombre": "Puerto de permeado (Permeate Port)",
    "planta": "Planta 0",
    "conjunto": "Tapa de vasija"
  },
  {
    "sap": "11326878",
    "nombre": "Tuerca de puerto (Port Nut)",
    "planta": "Planta 0",
    "conjunto": "Tapa de vasija"
  },
  {
    "sap": "10929117",
    "nombre": "Sello del cabezal  (Head Seal)",
    "planta": "Planta 0",
    "conjunto": "Tapa de vasija"
  },
  {
    "sap": "11192534",
    "nombre": "Kit de sellado del puerto de permeado (Permeate Port Seal Kit (20x45312))",
    "planta": "Planta 0",
    "conjunto": "Tapa de vasija"
  },
  {
    "sap": "10835588",
    "nombre": "Anillo de retención de liberación rápida (Quick Release Ret Ring)",
    "planta": "Planta 0",
    "conjunto": "Tapa de vasija"
  },
  {
    "sap": "11064588",
    "nombre": "Soporte de vasijas (SADDLE 8 1000/1200 PSI)",
    "planta": "Planta 0",
    "conjunto": "Alineamiento"
  },
  {
    "sap": "11064415",
    "nombre": "Correa de abrazaderas  (STRAP 8 UNS31603 BRASS)",
    "planta": "Planta 0",
    "conjunto": "Alineamiento"
  },
  {
    "sap": "11201520",
    "nombre": "Tornillo  de abrazadera (SCREW - DIN933 M8x70 A4)",
    "planta": "Planta 0",
    "conjunto": "Alineamiento"
  },
  {
    "sap": "11327144",
    "nombre": "Kit adaptador 8 pulgadas (Adapter kit 8 inch)",
    "planta": "Planta 0",
    "conjunto": "Adaptador Tapa Membrana"
  },
  {
    "sap": "11327125",
    "nombre": "Sello PWT (PWT Seal)",
    "planta": "Planta 0",
    "conjunto": "Adaptador Tapa Membrana"
  },
  {
    "sap": "10759984",
    "nombre": "Junta adaptadora (Adapter Seal)",
    "planta": "Planta 0",
    "conjunto": "Adaptador Tapa Membrana"
  },
  {
    "sap": "11326872",
    "nombre": "Anillo de empuje (Thrust Ring)",
    "planta": "Planta 0",
    "conjunto": "Canastillo de retencion"
  },
  {
    "sap": "11455010",
    "nombre": "Tapon Hidrolatina",
    "planta": "Planta 0",
    "conjunto": "Tapon"
  },
  {
    "sap": "11326947",
    "nombre": "Conector Victaulic Piedmont Tipo D Completo",
    "planta": "Planta 0",
    "conjunto": "Conector Victaulic Piedmont"
  },
  {
    "sap": "11328373",
    "nombre": "Set Perno, Golilla y Tuerca Tipo D Piedmont  (Duplex)",
    "planta": "Planta 0",
    "conjunto": "Conector Victaulic Piedmont"
  },
  {
    "sap": "10484186",
    "nombre": "Goma Conector Victaulic Tipo D Piedmont",
    "planta": "Planta 0",
    "conjunto": "Conector Victaulic Piedmont"
  },
  {
    "sap": "11449266",
    "nombre": "Kit manifold PPR",
    "planta": "Planta 0",
    "conjunto": "Manifold"
  },
  {
    "sap": "11527640",
    "nombre": "Extractor planta 0",
    "planta": "Planta 0",
    "conjunto": "Extractor"
  }
]

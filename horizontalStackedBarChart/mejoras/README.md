# Horizontal Stacked Bar — Custom Visual para Power BI

## Setup inicial (una sola vez)

```bash
# 1. Instalar Node.js 18+ desde nodejs.org

# 2. Instalar las herramientas de Power BI visuals globalmente
npm install -g powerbi-visuals-tools

# 3. Crear el proyecto base
pbiviz new horizontalStackedBar
cd horizontalStackedBar

# 4. Instalar dependencias del proyecto
npm install
```

## Reemplazar archivos generados

Copia los archivos de este paquete en las rutas correspondientes:

```
horizontalStackedBar/
├── src/
│   ├── visual.ts        ← reemplazar
│   └── settings.ts      ← reemplazar
├── capabilities.json    ← reemplazar
└── package.json         ← reemplazar (luego correr npm install)
```

Después de copiar:
```bash
npm install   # instalar d3 y utils
```

## Probar en vivo (sin exportar)

```bash
pbiviz start
```

1. Abre Power BI Desktop
2. Ve a Archivo → Opciones → Características de vista previa → activa "Desarrollador de objetos visuales"
3. En el panel de visualizaciones aparece el ícono de desarrollo — úsalo para ver el visual en tiempo real

## Campos en Power BI

| Campo en el visual     | Qué columna arrastrar                          |
|------------------------|------------------------------------------------|
| **Indicador (nombre)** | Columna de texto con el nombre del KPI         |
| **Valor actual**       | Medida numérica (el valor del marcador)        |
| **Período (mes/año)**  | Opcional: columna de fecha para mostrar historial de barras |

## Panel de formato (propiedades configurables)

### Escala
- **Valor mínimo** — extremo izquierdo de la barra (default: 0)
- **Valor máximo** — extremo derecho (default: 100)
- **Unidad** — texto junto al valor del marcador (%, min, pts, etc.)

### Orden de segmentos
- **Ascendente** — ON = izquierda es el estado más favorable; OFF = izquierda es el peor

### Umbral 1 … Umbral 5
Cada umbral define el límite de un segmento:
- **Mostrar** — activar/desactivar este umbral
- **Valor del umbral** — número en la escala del indicador
- **Color del segmento** — selector de color (aplica al segmento que termina en este umbral)
- **Etiqueta** — nombre del segmento (aparece en la leyenda)

Los segmentos entre umbrales se calculan automáticamente.
Ejemplo con 4 umbrales activos (valores 25, 50, 75, 90):
→ 5 segmentos: [0–25], [25–50], [50–75], [75–90], [90–100]

### Marcador
- **Color** — color de la línea vertical
- **Grosor** — px de ancho (1–10)
- **Mostrar etiqueta** — muestra el valor numérico sobre el marcador

### Barra
- **Alto** — altura en px
- **Esquinas redondeadas** — px de border-radius
- **Mostrar marcas de umbral** — ticks numéricos debajo de la barra
- **Mostrar leyenda** — muestra los colores y etiquetas al final

### Etiquetas
- **Tamaño de fuente** — px
- **Color del texto** — para nombres e indicadores
- **Mostrar nombre del indicador** — ON/OFF

## Exportar como .pbiviz

```bash
pbiviz package
```

Genera `dist/horizontalStackedBar.pbiviz`.

Para importar en Power BI Desktop:
Visualizaciones → "..." → Importar un objeto visual desde un archivo → seleccionar el .pbiviz

Para publicar en Power BI Service:
El .pbiviz también se puede subir desde Configuración de organización en el portal de administración.

# Detalles y Documentación del Proyecto: Horizontal Stacked Bar Chart

Esta guía explica en detalle la estructura de carpetas y el propósito de cada archivo clave en el desarrollo de este visual personalizado para Power BI.

---

## Estructura Principal del Proyecto

Al inicializar un visual de Power BI con `pbiviz new`, se genera una estructura estándar. A continuación, se detalla para qué sirve cada directorio y archivo importante.

```text
HorizontalStackedBarChart/
├── .tmp/                    # Carpeta temporal usada durante la compilación.
├── assets/                  # Contiene el icono del visual (icon.png) que aparece en Power BI.
├── dist/                    # Directorio de salida. Aquí se genera el archivo .pbiviz final.
├── node_modules/            # Dependencias de Node.js instaladas mediante npm (como d3).
├── src/                     # Carpeta principal donde reside el código fuente (TypeScript).
│   ├── settings.ts          # Definición del modelo de formateo (opcional).
│   └── visual.ts            # El motor principal de renderizado del visual.
├── style/                   # Hojas de estilo estructuradas (LESS).
│   └── visual.less          # Estilos visuales del gráfico.
├── capabilities.json        # Define cómo el visual interactúa con los datos de Power BI.
├── package.json             # Manifiesto del proyecto (dependencias de npm, scripts, versión).
├── pbiviz.json              # Configuración principal y metadatos del paquete pbiviz.
└── tsconfig.json            # Configuración del compilador de TypeScript.
```

---

## Explicación Detallada del Código

### 1. `capabilities.json`
Este archivo es crucial. Le dice a Power BI qué campos de datos puede aceptar el visual y cómo debe estructurarlos.

*   **`dataRoles`**: Define las "canastas" donde el usuario de Power BI puede arrastrar campos de datos.
    *   `category` (Grouping): Se usa para el eje Y (ej: País).
    *   `series` (Grouping): Se usa para apilar las barras (ej: Año).
    *   `measure` (Measure): El valor numérico del ancho de cada bloque (ej: Ventas).
*   **`dataViewMappings`**: Instruye a Power BI sobre cómo mapear esos *dataRoles* a la estructura interna de datos llamada `dataView.categorical` que luego leeremos en `visual.ts` para poder dibujar.

### 2. `pbiviz.json`
Es la "tarjeta de presentación" del visual.
Contiene el nombre, el identificador global (`guid`), el nombre de la clase a instanciar, la versión, la información del autor (`author`), el icono a usar, y vincula qué archivo `.less` y qué `capabilities.json` se van a asociar con el proyecto. Debe ser válido para que el visual compile (por ejemplo, requiere un link de soporte `supportUrl` válido y los datos del autor).

### 3. `style/visual.less`
Este archivo CSS usa LESS (un preprocesador CSS) para definir la apariencia.
En este caso, se definen los colores y grosores de las líneas de los ejes `x-axis` y `y-axis`, la tipografía para los textos de los ejes, y el efecto de transición CSS cuando pasamos el cursor (hover) por encima de las barras `.bar` modificando su `opacity`.

### 4. `src/visual.ts`

Este es el corazón lógico del gráfico. Está estructurado como una clase TypeScript `Visual` que implementa la interfaz `IVisual`.

#### Componentes de la clase `Visual`:

1.  **Variables Globales y Constructor**:
    *   `svg`, `container`, `xAxisGroup`, `yAxisGroup`: Son selecciones de D3 que almacenan los elementos SVG principales donde se dibujarán el gráfico de barras y los ejes.
    *   **El `constructor`**: Se ejecuta *solo una vez* cuando el visual se instancia. Es el lugar perfecto para crear todos los grupos estáticos (como el lienzo SVG principal `<svg>`) y añadirlos al `target` (el elemento HTML proporcionado por Power BI).

2.  **Método `update(options)`**:
    *   Este método es llamado por Power BI **cada vez que cambian los datos, el tamaño de la ventana (viewport), u otras propiedades**.
    *   Empieza re-calculando el ancho y alto del gráfico en base al espacio disponible (`options.viewport`).
    *   Extrae el modelo de datos invocando a nuestro método auxiliar `getViewModel`.
    *   **Escalas de D3**:
        *   `xScale` (ScaleLinear): Mapea valores numéricos (0 a máximo total de ventas) a píxeles en el lienzo.
        *   `yScale` (ScaleBand): Mapea la lista de categorías del eje Y a ubicaciones verticales e incluye un padding entre barras horizontales.
    *   **Ejes de D3**: Genera un componente de eje X con `d3.axisBottom(xScale)` y eje Y con `d3.axisLeft(yScale)`.
    *   **Apilamiento (Stacking)**: Usa `d3.stack().keys(seriesNames)` para tomar nuestro arreglo de datos rectangulares y devolver coordenadas iniciales y finales para cada segmento en nuestro apilamiento.
    *   **Data Binding (D3 Enter/Update/Exit)**:
        *   Primero, dibuja o actualiza los grupos `<g class="serie">` que representará a toda una serie, asignándole el color respectivo de nuestro colorMap.
        *   Luego, dentro de cada serie, asocia los segmentos de barras a elementos SVG `<rect class="bar">`. Se procesan sus propiedades visuales como el alto (`yScale.bandwidth()`), ancho (`xScale(d[1]) - xScale(d[0])`), posición vertical y horizontal.

3.  **Método Auxiliar `getViewModel(dataView)`**:
    *   Los datos proporcionados por PBI en `options.dataViews[0]` son completos, pero muy complejos. Suelen estar divididos por arrays separados para categorías e índices. Este método transforma esos datos "crudos" en una estructura de arreglo de objetos que `d3.stack()` espera y requiere.
    *   Itera sobre la lista principal de categorías (eje y). En cada iteración procesa todos los valores de Measure pertenecientes a las diferentes Series conectadas.
    *   Además, almacena y calcula dinámicamente colores generados a través de la herramienta de Power BI `host.colorPalette` para garantizar que el gráfico se alinea con la plantilla de colores y paletas internas.

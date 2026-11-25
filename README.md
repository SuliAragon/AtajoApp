# Atajo

Gestor personal de marcadores. La portada muestra ejemplos de Wikipedia, OpenStreetMap y MDN Web Docs. Usa **Ocultar ejemplos** para dejar de verlos en ese navegador. En **Mis marcadores**, cada persona empieza con una colección vacía y puede crear sus propias secciones o importar sus enlaces.

Atajo está hecho con Astro y genera dos páginas estáticas. Los datos se guardan en el navegador. Usa el CSV para mover tu colección a otro dispositivo o navegador.

Las miniaturas automáticas usan capturas de Thum.io. Se solicita la portada del sitio, sin enviar rutas de los marcadores, parámetros ni fragmentos. Los enlaces locales y los sitios sin captura muestran el nombre y el dominio. Puedes desactivar las capturas en **Mis marcadores**.

## Desarrollo

Con Node.js 22.12 o posterior, ejecuta:

```sh
npm ci
npm run dev
```

Para comprobar la versión de producción, ejecuta `npm run build` y después `npm run preview`.

## GitHub Pages

1. Sube el proyecto a la rama `main` de tu repositorio en GitHub.
2. En **Settings → Pages → Build and deployment**, elige **GitHub Actions** como origen.
3. Ejecuta **Deploy to GitHub Pages** desde la pestaña **Actions** o sube otro cambio a `main`.

El flujo toma la ruta base de Pages, así que funciona tanto en `usuario.github.io/repositorio/` como en la raíz de un dominio propio.

## Organizar e importar marcadores

En **Mis marcadores**, pulsa el icono de flechas de una sección o un marcador y elige su nueva posición. El orden se guarda en el navegador y se conserva al exportar el CSV.

Para traer tus marcadores del navegador, expórtalos como HTML desde su gestor de marcadores y abre **Importar CSV o HTML** en Atajo. Cada carpeta se convierte en una sección. Las subcarpetas aparecen con su ruta, por ejemplo, `Trabajo › Referencias`, y los enlaces de la raíz van a **Sin carpeta**. Atajo importa enlaces HTTP y HTTPS.

## Importar un CSV

El archivo debe incluir las columnas `seccion`, `nombre` y `url`. La columna `descripcion` es opcional. Atajo acepta comas, puntos y comas o tabuladores.

```csv
seccion,nombre,url,descripcion
Aprendizaje,Wikipedia,https://es.wikipedia.org/,Enciclopedia libre
Mapas,OpenStreetMap,https://www.openstreetmap.org/,Mapa colaborativo
Desarrollo,MDN Web Docs,https://developer.mozilla.org/,Documentación web
Pendientes,,,
```

La última fila añade una sección vacía. Al importar puedes añadir los enlaces a tu colección, omitiendo los duplicados en cada sección, o sustituir la colección por la copia. Para mover una copia completa, usa la opción de sustituir.

## Guía de diseño

La guía [gemini-frontend-design](skills/gemini-frontend-design/SKILL.md) está incluida en el proyecto. Puedes pedir que se use por ese nombre al trabajar en Atajo.

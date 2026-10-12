# LivesHC Web

API y panel público para LivesHC. PostgreSQL es una proyección de lectura; `players.yml` sigue siendo la fuente autoritativa de vidas.

El panel adapta título y skins según el `modo` enviado por el plugin (`solo` o `coop`):

- `solo`: cada jugador conserva sus propias vidas. Con un solo jugador muestra la ficha destacada; con varios genera una rejilla adaptativa de fichas compactas.
- `coop`: muestra todo el equipo. Con dos jugadores mantiene la pareja con insignia `+`; con más pasa a la rejilla adaptativa.

En ambos modos el roster se ordena primero por conexión (en línea antes que desconectados) y, dentro de cada grupo, alfabéticamente por nombre. En las cuentas de Bedrock (Floodgate) se ignora el punto inicial, de modo que `.Alex` ordena junto a `Alex` y no antes que la `A`.

En ambos modos el bloque "Intento hardcore" muestra el intento actual: `comandos-sin-vidas-ejecutados` + 1 (0 ejecuciones = intento #1). El máximo de jugadores mostrados lo controla `MAX_PLAYERS` (por defecto 30).

No hay que configurar UUID en la web: el plugin ya envía todos los jugadores en cada snapshot y el backend elige cuántos mostrar. `modo` es solo presentación; `vidas-compartidas` sigue controlando la lógica de vidas (`individual` / `shared`). Con vidas compartidas el panel muestra el contador global y oculta las vidas individuales de cada ficha.

## Dokploy

1. Crear un servicio PostgreSQL privado y una base/usuario para LivesHC.
2. Crear una aplicación desde el directorio `web` usando su `Dockerfile`.
3. Copiar las variables de `.env.example`, usando un secreto de al menos 24 caracteres. No hay UUID que configurar: los protagonistas se detectan solos desde los snapshots. `SERVER_ADDRESS` define la dirección que aparece en el pie del panel con botón de copiar; por defecto `alexndh.holy.gg`. Si se deja vacía, el bloque no se muestra.
4. Exponer solamente el puerto HTTP `3000`. No publicar el puerto de PostgreSQL.
5. Configurar el health check en `/health`.
6. Copiar en `plugins/LivesHC/config.yml` la URL HTTPS `/internal/v1/snapshot`, el mismo token y `server-id`, elegir `modo: solo|coop`, activar `web.habilitada` y reiniciar el servidor.

El contenedor aplica las migraciones pendientes antes de iniciar Express. Para cambiar las skins se puede usar cualquier URL HTTPS que contenga `{uuid}`.

## Overlays para OBS (Browser Source)

El panel incluye endpoints y un editor visual pensados para usarse como **Fuente de navegador** en OBS Studio:

- **/overlay/builder**: Editor visual e interactivo donde puedes marcar o desmarcar datos (`vidas`, `muertes`, `intento`), filtrar jugadores, cambiar el orden, elegir cabeza (plana o 3D), orientación (fila, columna o rejilla), tamaño y fondo. Genera la URL lista para copiar a OBS y muestra una previsualización en vivo.
- **/overlay**: La vista limpia y transparente para OBS.

### Parámetros de URL para `/overlay`

| Parámetro | Opciones | Por defecto | Descripción |
|---|---|---|---|
| `stats` | lista de `lives`, `deaths`, `attempts` (o `none`) | `lives,deaths,attempts` | Datos a mostrar y su orden |
| `players` | nombres o UUID separados por coma | todos | Filtra y ordena jugadores específicos |
| `head` | `flat`, `3d` | `flat` | Tipo de cabeza de skin |
| `layout` | `row`, `column`, `grid` | `row` | Disposición visual |
| `size` | `s`, `m`, `l` | `m` | Tamaño de cabezas y texto |
| `offline` | `dim`, `show`, `hide` | `dim` | Atenuar, mostrar o esconder jugadores desconectados |
| `bg` | `none`, `dark` | `none` | Fondo transparente o tarjeta oscura |
| `names` | `1`, `0` | `1` | Mostrar u ocultar nombres de jugadores |
| `refresh` | número de segundos (3 a 60) | `5` | Frecuencia de actualización |

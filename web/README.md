# LivesHC Web

API y panel público para LivesHC. PostgreSQL es una proyección de lectura; `players.yml` sigue siendo la fuente autoritativa de vidas.

El panel adapta título y skins según el `modo` enviado por el plugin (`solo` o `coop`):

- `solo`: cada jugador conserva sus propias vidas. Con un solo jugador muestra la ficha destacada; con varios (10, 15, 20…) genera una rejilla adaptativa de fichas compactas ordenadas por relevancia (online primero, luego más reciente). El máximo lo controla `MAX_PLAYERS` (por defecto 30).
- `coop`: muestra automáticamente a los 2 más relevantes con insignia `+`, título "Supervivencia cooperativa".

No hay que configurar UUID en la web: el plugin ya envía todos los jugadores en cada snapshot y el backend elige cuántos mostrar. `modo` es solo presentación; `vidas-compartidas` sigue controlando la lógica de vidas (`individual` / `shared`). En cooperativo con vidas compartidas se muestran los dos retratos sin insignia y las vidas individuales se ocultan en favor del contador compartido.

## Dokploy

1. Crear un servicio PostgreSQL privado y una base/usuario para LivesHC.
2. Crear una aplicación desde el directorio `web` usando su `Dockerfile`.
3. Copiar las variables de `.env.example`, usando un secreto de al menos 24 caracteres. No hay UUID que configurar: los protagonistas se detectan solos desde los snapshots.
4. Exponer solamente el puerto HTTP `3000`. No publicar el puerto de PostgreSQL.
5. Configurar el health check en `/health`.
6. Copiar en `plugins/LivesHC/config.yml` la URL HTTPS `/internal/v1/snapshot`, el mismo token y `server-id`, elegir `modo: solo|coop`, activar `web.habilitada` y reiniciar el servidor.

El contenedor aplica las migraciones pendientes antes de iniciar Express. Para cambiar las skins se puede usar cualquier URL HTTPS que contenga `{uuid}`.

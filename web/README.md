# LivesHC Web

API y panel público para LivesHC. PostgreSQL es una proyección de lectura; `players.yml` sigue siendo la fuente autoritativa de vidas.

El panel adapta título y skins según el `modo` enviado por el plugin (`solo` o `coop`):

- `solo`: muestra automáticamente al jugador más relevante (online primero, luego más reciente), skin centrada, título "Supervivencia en solitario".
- `coop`: muestra automáticamente a los 2 más relevantes con insignia `+`, título "Supervivencia cooperativa".

No hay que configurar UUID en la web: el plugin ya envía todos los jugadores en cada snapshot y el backend elige solo. `modo` es solo presentación; `vidas-compartidas` sigue controlando la lógica de vidas (`individual` / `shared`).

## Dokploy

1. Crear un servicio PostgreSQL privado y una base/usuario para LivesHC.
2. Crear una aplicación desde el directorio `web` usando su `Dockerfile`.
3. Copiar las variables de `.env.example`, usando un secreto de al menos 24 caracteres. No hay UUID que configurar: los protagonistas se detectan solos desde los snapshots.
4. Exponer solamente el puerto HTTP `3000`. No publicar el puerto de PostgreSQL.
5. Configurar el health check en `/health`.
6. Copiar en `plugins/LivesHC/config.yml` la URL HTTPS `/internal/v1/snapshot`, el mismo token y `server-id`, elegir `modo: solo|coop`, activar `web.habilitada` y reiniciar el servidor.

El contenedor aplica las migraciones pendientes antes de iniciar Express. Para cambiar las skins se puede usar cualquier URL HTTPS que contenga `{uuid}`.

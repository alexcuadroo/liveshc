# LivesHC Web

API y panel VS público para LivesHC. PostgreSQL es una proyección de lectura; `players.yml` sigue siendo la fuente autoritativa de vidas.

## Dokploy

1. Crear un servicio PostgreSQL privado y una base/usuario para LivesHC.
2. Crear una aplicación desde el directorio `web` usando su `Dockerfile`.
3. Copiar las variables de `.env.example`, usando un secreto de al menos 24 caracteres y los UUID reales.
4. Exponer solamente el puerto HTTP `3000`. No publicar el puerto de PostgreSQL.
5. Configurar el health check en `/health`.
6. Copiar en `plugins/LivesHC/config.yml` la URL HTTPS `/internal/v1/snapshot`, el mismo token y `server-id`, activar `web.habilitada` y reiniciar el servidor.

El contenedor aplica las migraciones pendientes antes de iniciar Express. Para cambiar las skins se puede usar cualquier URL HTTPS que contenga `{uuid}`.

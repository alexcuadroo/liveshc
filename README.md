# LivesHC

Plugin para Paper que reúne vidas, muertes, HUD, comandos administrativos, sonidos personalizados y sincronización opcional con el panel web. Ya no hace falta instalar el plugin HardcoreSounds por separado.

## Requisitos

- Paper compatible con la API `26.1` (probado al compilar contra Paper API `26.1.2`).
- Java 25 para ejecutar el servidor. Para compilar desde el código fuente se necesita un **JDK 25**.
- PlaceholderAPI 2.11.6 o posterior, opcional, solo si se quieren usar sus placeholders.

## Instalación y actualización

1. Descarga o compila `build/libs/liveshc-1.3.4.jar` y colócalo en `plugins/`.
2. Si usabas HardcoreSounds por separado, apaga el servidor y retira su JAR para evitar tener dos plugins gestionando `/sfx` y el resource pack.
3. Inicia el servidor. LivesHC crea su carpeta y archivos de configuración al arrancar y al guardar datos.
4. Configura `plugins/LivesHC/config.yml` y `plugins/LivesHC/sounds.yml`; reinicia o usa `/liveshc reload`.

Los archivos de vidas y récords son locales y no se eliminan al actualizar el JAR. Haz copias de seguridad antes de reemplazar una instalación existente. Si migras desde HardcoreSounds, traslada manualmente los ajustes de pack desde su `config.yml` a la sección `resource-pack` de LivesHC; conserva también tu catálogo `sounds.yml` y los mismos assets del resource pack.

## Vidas, muertes e intentos

`vidas-iniciales` define las vidas de inicio y `vidas-maximas` el límite. Con `vidas-compartidas: false`, cada UUID tiene su propio contador; con `true`, todos consumen un único contador compartido. En ambos modos, las muertes se cuentan por jugador.

Cada muerte resta una vida. Cuando un contador pasa de una o más vidas a cero, se programa `comando-sin-vidas` para ejecutarse desde la consola; `%player%` se reemplaza por el nombre del jugador. Si `delay-comando-segundos` es mayor que cero, antes de ejecutarlo se comprueba que las vidas sigan en cero. Tras despachar el comando, el contador afectado vuelve a `vidas-iniciales`. En modo compartido se reinicia el contador del equipo. `records.yml` acumula las ejecuciones del comando sin vidas.

El comando se dispara exactamente una vez por agotamiento. Si el comando configurado no existe o no se reconoce, las vidas quedan en cero y se reintenta en la próxima muerte o al volver a entrar, para no dejar al jugador atascado; si `comando-sin-vidas` está vacío, se avisa por consola y se reinician las vidas.

### Persistencia

- `players.yml`: vidas individuales (`players`), muertes por UUID (`deaths`) y, si corresponde, el contador común (`shared-lives`). Se crea cuando el plugin guarda por primera vez, normalmente al entrar un jugador.
- `records.yml`: `comandos-sin-vidas-ejecutados`. Se crea al iniciar el plugin.
- `config.yml`: reglas de vidas, HUD, ajustes de sonidos/resource pack y conexión web.
- `sounds.yml`: catálogo de sonidos y sus claves, nombres, materiales y parámetros.

Los UUID, no los nombres, identifican los datos de cada jugador.

## Configuración de vidas y HUD

Los valores predeterminados están en `src/main/resources/config.yml`. Ejemplo:

```yaml
vidas-iniciales: 3
vidas-maximas: 5
vidas-compartidas: false
modo: coop
comando-sin-vidas: "gamemode spectator %player%"
delay-comando-segundos: 0

hud-muerte:
  habilitado: true
  fade-in-ticks: 5
  duracion-ticks: 160
  fade-out-ticks: 10

hud-actionbar:
  habilitado: true

debug: false
```

`modo` solo controla la presentación web (`solo` o `coop`); no cambia cómo se comparten las vidas. El HUD usa texto vanilla: en PvP muestra `jugador vs jugador` y las muertes de ambos; en una muerte ambiental muestra `ENTORNO vs jugador` y las muertes del jugador. No necesita resource pack. Los tiempos del HUD están en ticks (20 ticks = 1 segundo). `hud-actionbar` muestra periódicamente `Muertes: N | Vidas: M` sobre la barra rápida. `debug` escribe en la consola el detalle de cada muerte y de la ejecución del comando sin vidas; déjalo en `false` salvo que estés diagnosticando.

## Comandos y permisos

| Comando | Función | Permiso |
| --- | --- | --- |
| `/liveshc reload` | Recarga la configuración, datos de récords y ajustes/catálogo de sonidos. | `liveshc.reload` |
| `/liveshc add <jugador> <cantidad>` | Añade vidas a un jugador conectado; en modo compartido modifica el contador común. | `liveshc.add` |
| `/liveshc remove <jugador> <cantidad>` | Quita vidas a un jugador conectado (alias `/liveshc quitar`); si llega a 0 ejecuta la acción de cero vidas. | `liveshc.remove` |
| `/liveshc get <jugador>` | Muestra las vidas de un jugador (conectado o conocido; alias `/liveshc vidas` o `check`). | `liveshc.get` |
| `/sfx` | Abre el menú de sonidos si `general.gui-enabled` está activo. | `hardcoresounds.use` |
| `/sfx list` | Lista los IDs de sonidos cargados. | `hardcoresounds.use` |
| `/sfx play <sonido> [jugador|@a]` | Reproduce un sonido para ti o para el destino indicado. | `hardcoresounds.play`, `.others` o `.all` según destino |
| `/sfx stop <sonido> [jugador|@a]` | Detiene un sonido. | `hardcoresounds.stop` |
| `/sfx stopall [jugador|@a]` | Detiene todos los sonidos. | `hardcoresounds.stop` |
| `/sfx reload` | Recarga `config.yml` y `sounds.yml` del sistema de sonidos. | `hardcoresounds.reload` |

La consola debe especificar un jugador o `@a` en los comandos de sonido que requieren destino. En el menú, clic izquierdo reproduce para uno mismo, clic derecho permite elegir jugador y Shift+clic izquierdo reproduce para todos. Los permisos se conceden a operadores por defecto; `hardcoresounds.admin` agrupa los permisos de sonidos.

PlaceholderAPI, si está instalado:

| Placeholder | Valor |
| --- | --- |
| `%liveshc_vidas%` | Vidas actuales del jugador o contador compartido. |
| `%liveshc_muertes%` | Muertes acumuladas del jugador. |
| `%liveshc_maxvidas%` | Máximo configurado. |
| `%liveshc_intentos%` | Comandos de cero vidas ejecutados. |

## Sonidos y resource pack

El pack se entrega a los jugadores desde LivesHC cuando `resource-pack.enabled` está activado. Por defecto está desactivado. Para habilitarlo, configura URL directa, SHA-1 del ZIP y UUID estable para cada perfil de Minecraft en `resource-pack.profiles` dentro de `config.yml`. El mensaje y si se exige aceptar el pack se controlan con `prompt` y `required`.

### Corazones hardcore (cosmético)

El pack también incluye las texturas de corazones de hardcore (`assets/minecraft/textures/gui/sprites/hud/heart/`) copiadas sobre las normales, para que en supervivencia se vean los corazones hardcore **sin activar el modo hardcore de Minecraft**. Esto es importante: activar `hardcore=true` en `server.properties`/`level.dat` haría que el servidor mande a los jugadores a espectador al morir, rompiendo el sistema de vidas. El cambio es puramente visual y depende del resource pack (si el jugador no lo acepta, verá los corazones normales).

Los sonidos se definen en `sounds.yml`; cada `key` debe existir en `resource-pack/source/assets/hardcoresounds/sounds.json`, que a su vez debe apuntar a un archivo `.ogg` en `resource-pack/source/assets/hardcoresounds/sounds/`. Tras añadir o cambiar audios, genera los ZIP compatibles con 26.1–26.3:

```powershell
powershell -File scripts/build-resource-packs.ps1
```

El script valida que todos los audios referenciados existan y sean contenedores Ogg, genera ZIP y SHA-1 para cada perfil en `build/resource-packs/`. Publica los ZIP en URLs accesibles directamente y copia URL/SHA-1 a `config.yml`. Los clientes necesitan aceptar el pack para escuchar estos sonidos y ver los corazones hardcore; el HUD de muerte y el action bar no dependen de él.

## Sincronización web opcional

La integración está desactivada por defecto. Para activarla, configura `web.habilitada`, `web.api-url` (endpoint HTTPS `/internal/v1/snapshot`), `web.token`, `web.server-id` y `web.intervalo-segundos` en `config.yml`; el token debe coincidir con el del servicio web. El plugin envía snapshots a la API y **no se conecta directamente a PostgreSQL**.

Se sincronizan los jugadores, vidas individuales/compartidas, estado online, posición y estadísticas incluidas por la API, además del modo de vidas y ejecuciones del comando sin vidas. Se envía al iniciar, ante cambios relevantes y periódicamente (mínimo 10 segundos; predeterminado 30). El backend admite hasta 5.000 jugadores por snapshot. La base de datos conserva la proyección recibida; la web pública muestra hasta `MAX_PLAYERS` jugadores (el `modo` solo cambia la presentación), el intento actual y, con vidas compartidas, el contador global. Las vidas y muertes de cada jugador también se envían en cada snapshot. Si la API no está disponible, el plugin sigue funcionando y guardando localmente. Consulta [`web/README.md`](web/README.md) para desplegar el backend y PostgreSQL.

## Compilar

Con JDK 25:

```powershell
./gradlew.bat test build
```

En Linux/macOS:

```bash
./gradlew test build
```

El JAR queda en `build/libs/liveshc-1.3.4.jar`. El proyecto incluye pruebas unitarias de `LivesManager` (`./gradlew test`); compilar y pasar las pruebas no sustituye una prueba en un servidor Paper.

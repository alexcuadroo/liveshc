# LivesHC

LivesHC es un plugin para servidores Paper que gestiona un número limitado de vidas por jugador. Cada muerte resta una vida y, cuando el contador llega a cero, el plugin ejecuta desde la consola el comando configurado. Después de ejecutarlo correctamente, el contador vuelve a su valor inicial.

El plugin permite usar vidas individuales o un único contador compartido por todo el servidor. Los datos se guardan localmente, incluye placeholders para PlaceholderAPI y puede publicar opcionalmente una vista de solo lectura en el panel web incluido en este repositorio.

## Características

- Vidas iniciales y límite máximo configurables.
- Contadores individuales o compartidos.
- Ejecución de un comando al quedarse sin vidas.
- Retraso configurable antes de ejecutar dicho comando.
- Comando administrativo para añadir vidas.
- Persistencia local de jugadores y estadísticas.
- Integración opcional con PlaceholderAPI.
- Sincronización opcional con el panel web.
- Comprobación automática de nuevas releases de GitHub al iniciar el servidor.

## Requisitos

- Un servidor compatible con Paper API `26.1`.
- Java 25.
- PlaceholderAPI 2.11.6 o posterior, únicamente si se quieren utilizar placeholders.
- El resource pack combinado generado por el proyecto HardcoreSounds para mostrar el rayo del HUD.

## Instalación

1. Descarga el archivo `.jar` desde [GitHub Releases](https://github.com/alexcuadroo/liveshc/releases).
2. Copia el archivo en la carpeta `plugins` de tu servidor.
3. Inicia o reinicia el servidor para generar la configuración.
4. Edita `plugins/LivesHC/config.yml` según tus necesidades.
5. Ejecuta `/liveshc reload` o reinicia el servidor para aplicar los cambios.

## Funcionamiento

Cada jugador recibe el valor de `vidas-iniciales` la primera vez que entra. Al morir pierde una vida. Cuando pasa de una vida a cero, LivesHC ejecuta `comando-sin-vidas` desde la consola, sustituyendo `%player%` por el nombre del jugador.

Si se configura un retraso, el comando solo se ejecuta si el contador continúa en cero cuando termina la espera. Cuando el comando se ejecuta correctamente, las vidas se restablecen al valor inicial. Nunca pueden superar `vidas-maximas`.

Con `vidas-compartidas: true`, todos los jugadores consumen y reciben vidas del mismo contador. Con `false`, cada UUID conserva su propio contador.

## Configuración

```yaml
# Vidas que recibe un jugador la primera vez que entra.
vidas-iniciales: 3

# Cantidad máxima de vidas permitida.
vidas-maximas: 5

# true: un contador para todo el servidor.
# false: un contador independiente por jugador.
vidas-compartidas: false

# Comando ejecutado por la consola cuando las vidas llegan a cero.
# %player% se sustituye por el nombre del jugador.
comando-sin-vidas: "gamemode spectator %player%"

# Espera en segundos antes de ejecutar el comando. Usa 0 para no esperar.
delay-comando-segundos: 0

# HUD mostrado durante 8 segundos después de cualquier muerte.
hud-muerte:
  habilitado: true
  fade-in-ticks: 5
  duracion-ticks: 160
  fade-out-ticks: 10

# Integración opcional con el panel web.
web:
  habilitada: false
  api-url: "https://tu-dominio.example/internal/v1/snapshot"
  token: "cambia-este-token"
  server-id: "principal"
  intervalo-segundos: 30
```

El comando configurado puede escribirse con o sin `/`. Se ejecuta desde la consola, por lo que no está limitado por los permisos del jugador.

## Comandos

| Comando | Descripción | Permiso |
| --- | --- | --- |
| `/liveshc reload` | Recarga `config.yml` y los registros del plugin. | `liveshc.reload` |
| `/liveshc add <jugador> <cantidad>` | Añade vidas a un jugador conectado o al contador compartido. | `liveshc.add` |

Los dos permisos se conceden a operadores de forma predeterminada. La cantidad de `/liveshc add` debe ser un número entero positivo y el resultado queda limitado por `vidas-maximas`.

## PlaceholderAPI

Si PlaceholderAPI está instalado, LivesHC registra automáticamente estos placeholders:

| Placeholder | Valor |
| --- | --- |
| `%liveshc_vidas%` | Vidas actuales del jugador o del contador compartido. |
| `%liveshc_muertes%` | Muertes acumuladas del jugador. |
| `%liveshc_maxvidas%` | Máximo de vidas configurado. |
| `%liveshc_intentos%` | Cantidad de veces que se ejecutó correctamente el comando al llegar a cero vidas. |

## Panel web opcional

La carpeta [`web`](web) contiene una API y un panel público que muestran el estado del servidor. Esta integración está deshabilitada de forma predeterminada y no es necesaria para que el plugin funcione.

Aunque la API no esté disponible, LivesHC continúa funcionando y conserva sus datos localmente. Las instrucciones de despliegue se encuentran en [`web/README.md`](web/README.md).

## HUD de muertes

Cuando un jugador mata a otro, ambos reciben un título temporal con sus cabezas y muertes acumuladas. En muertes ambientales o suicidios, la víctima ve el mismo layout con un indicador de entorno. Las cabezas se resuelven directamente por UUID; el rayo central usa la fuente `liveshc:duel` incluida en el resource pack combinado de HardcoreSounds.

El HUD se configura con `hud-muerte` en `config.yml`. Las duraciones están expresadas en ticks (20 ticks = 1 segundo). Las muertes se guardan por UUID en la sección `deaths` de `players.yml`; la sección `players` conserva el formato anterior para mantener compatibilidad con los datos existentes.

## Resource pack compartido con HardcoreSounds

LivesHC y HardcoreSounds comparten deliberadamente un único resource pack obligatorio, mantenido y construido en el repositorio de HardcoreSounds. El ZIP contiene dos namespaces independientes:

- `assets/hardcoresounds`: sonidos consumidos por HardcoreSounds.
- `assets/liveshc`: fuente y textura del rayo consumidas por el HUD de LivesHC.

LivesHC resuelve las cabezas de los jugadores por UUID mediante Paper/Adventure; esas skins no están almacenadas en el ZIP. Sin el namespace `assets/liveshc`, el contador continúa funcionando pero el rayo personalizado no se renderiza correctamente.

No se debe publicar un segundo pack exclusivo para LivesHC ni configurar ambos packs por separado. Después de modificar assets de cualquiera de los dos plugins, ejecuta `scripts/build-resource-packs.ps1` en HardcoreSounds, publica nuevamente los ZIP generados y actualiza sus SHA-1 en la configuración que los envía a los jugadores.

## Compilar desde el código fuente

En Windows:

```powershell
.\gradlew.bat build
```

En Linux o macOS:

```bash
./gradlew build
```

El archivo compilado se genera como `build/libs/liveshc-1.2.0.jar`.

/* The concept catalog behind the exploration map: branches (universal, languages, frameworks,
   kinds of project) and concepts with prerequisites. One source of truth, shared by the plugin
   (which suggests these slugs to the model) and by the study space (which draws the map).
   After editing, run: node scripts/sync-catalog.js */

const BRANCHES = [
  { id: 'universal', label: 'Universal', type: 'universal', key: '' },
  { id: 'lang:javascript', label: 'JavaScript', type: 'lenguaje', key: 'javascript' },
  { id: 'lang:typescript', label: 'TypeScript', type: 'lenguaje', key: 'typescript' },
  { id: 'lang:python', label: 'Python', type: 'lenguaje', key: 'python' },
  { id: 'fw:react', label: 'React', type: 'framework', key: 'react' },
  { id: 'fw:nextjs', label: 'Next.js', type: 'framework', key: 'nextjs' },
  { id: 'fw:express', label: 'Express', type: 'framework', key: 'express' },
  { id: 'fw:fastapi', label: 'FastAPI', type: 'framework', key: 'fastapi' },
  { id: 'kind:app', label: 'App', type: 'tipo', key: 'app' },
  { id: 'kind:libreria', label: 'Librería', type: 'tipo', key: 'libreria' },
  { id: 'kind:plugin', label: 'Plugin', type: 'tipo', key: 'plugin' },
  { id: 'kind:mcp', label: 'MCP', type: 'tipo', key: 'mcp' },
  { id: 'kind:integracion', label: 'Integración', type: 'tipo', key: 'integracion' },
  { id: 'kind:script', label: 'Script', type: 'tipo', key: 'script' },
  { id: 'kind:infraestructura', label: 'Infraestructura', type: 'tipo', key: 'infraestructura' },
];

const N = (id, branch, title, desc, requires = [], aliases = []) => ({ id, branch, title, desc, requires, aliases });

const NODES = [
  /* universal */
  N('variables-y-tipos', 'universal', 'Variables y tipos de datos', 'Dónde se guarda un valor y qué clase de valor es.', [], ['variables', 'data-types']),
  N('funciones', 'universal', 'Funciones y parámetros', 'Bloques reutilizables que reciben datos y devuelven un resultado.', ['variables-y-tipos'], ['functions']),
  N('control-de-flujo', 'universal', 'Condicionales y bucles', 'Cómo un programa decide y repite.', ['variables-y-tipos'], ['control-flow']),
  N('estructuras-de-datos', 'universal', 'Listas, mapas y conjuntos', 'Formas de agrupar datos y cuándo usar cada una.', ['variables-y-tipos'], ['data-structures']),
  N('manejo-de-errores', 'universal', 'Manejo de errores', 'Qué hacer cuando algo falla, sin esconder el fallo.', ['funciones'], ['error-handling']),
  N('modularidad', 'universal', 'Módulos y dependencias', 'Dividir el código en piezas con límites claros.', ['funciones'], ['modules', 'modularity']),
  N('separacion-de-responsabilidades', 'universal', 'Separación de responsabilidades', 'Cada pieza hace una cosa y los cambios quedan contenidos.', ['modularidad'], ['separation-of-concerns']),
  N('arquitectura-en-capas', 'universal', 'Arquitectura en capas', 'Organizar el código en capas que solo hablan con la de al lado.', ['separacion-de-responsabilidades'], ['layered-architecture', 'capa-de-acceso-a-datos']),
  N('patrones-de-diseno', 'universal', 'Patrones de diseño', 'Soluciones probadas a problemas de estructura que se repiten.', ['separacion-de-responsabilidades'], ['design-patterns']),
  N('programacion-orientada-a-objetos', 'universal', 'Programación orientada a objetos', 'Modelar con objetos que unen datos y comportamiento.', ['funciones', 'estructuras-de-datos'], ['oop', 'object-oriented-programming']),
  N('programacion-funcional', 'universal', 'Programación funcional', 'Componer funciones puras y evitar el estado compartido.', ['funciones'], ['functional-programming']),
  N('asincronia', 'universal', 'Asincronía', 'Trabajo que termina más tarde sin bloquear al resto.', ['funciones'], ['async', 'asynchronous-programming']),
  N('estado-inmutable', 'universal', 'Estado inmutable', 'Crear copias en lugar de modificar el original.', ['estructuras-de-datos'], ['immutability', 'immutable-state']),
  N('validacion-de-entrada', 'universal', 'Validación de entrada', 'Comprobar lo que llega de fuera antes de usarlo.', ['manejo-de-errores'], ['input-validation']),
  N('autenticacion-y-autorizacion', 'universal', 'Autenticación y autorización', 'Quién eres y qué se te permite hacer.', ['validacion-de-entrada'], ['authentication', 'authorization', 'auth']),
  N('seguridad-basica', 'universal', 'Seguridad básica', 'Secretos, inyecciones y datos que no deben filtrarse.', ['validacion-de-entrada'], ['security-basics', 'auth-error-messages']),
  N('pruebas-automaticas', 'universal', 'Pruebas automáticas', 'Código que comprueba que tu código sigue funcionando.', ['funciones'], ['testing', 'tests']),
  N('bases-de-datos', 'universal', 'Bases de datos y modelado', 'Guardar datos con estructura y consultarlos.', ['estructuras-de-datos'], ['databases', 'data-modeling']),
  N('api-rest', 'universal', 'APIs REST', 'Recursos, métodos y códigos de estado sobre HTTP.', ['separacion-de-responsabilidades'], ['rest-api', 'rest']),
  N('limitacion-de-peticiones', 'universal', 'Limitación de peticiones', 'Poner un tope a cuántas peticiones acepta un servicio.', ['api-rest'], ['rate-limiting', 'rate-limiter']),
  N('control-de-versiones', 'universal', 'Git y control de versiones', 'Historial de cambios, ramas y colaboración.', [], ['git', 'version-control']),
  N('integracion-continua', 'universal', 'Integración y entrega continuas', 'Pruebas y despliegues automáticos en cada cambio.', ['pruebas-automaticas', 'control-de-versiones'], ['ci-cd', 'ci']),
  N('observabilidad', 'universal', 'Logs y observabilidad', 'Ver qué hace tu programa cuando ya está en marcha.', ['manejo-de-errores'], ['logging', 'observability']),
  N('idempotencia-y-reintentos', 'universal', 'Idempotencia y reintentos', 'Repetir una operación sin duplicar su efecto.', ['manejo-de-errores', 'api-rest'], ['idempotency', 'retries']),
  N('contenedores', 'universal', 'Contenedores', 'Empaquetar una app con lo que necesita para ejecutarse igual en todas partes.', ['control-de-versiones'], ['containers', 'docker']),
  N('infraestructura-como-codigo', 'universal', 'Infraestructura como código', 'Describir servidores y servicios en archivos versionados.', ['control-de-versiones'], ['iac', 'infrastructure-as-code']),

  /* JavaScript */
  N('js-closures', 'lang:javascript', 'Closures', 'Funciones que recuerdan las variables del sitio donde nacieron.', ['funciones'], ['closures']),
  N('js-desestructuracion', 'lang:javascript', 'Desestructuración y spread', 'Sacar y copiar partes de objetos y listas con una sintaxis corta.', ['estructuras-de-datos'], ['destructuring', 'spread-operator']),
  N('js-prototipos-y-clases', 'lang:javascript', 'Prototipos y clases', 'Cómo JavaScript hereda comportamiento entre objetos.', ['programacion-orientada-a-objetos'], ['prototypes', 'classes']),
  N('js-event-loop', 'lang:javascript', 'Event loop', 'Cómo JavaScript reparte el tiempo entre tareas.', ['asincronia'], ['event-loop']),
  N('js-promesas-y-async-await', 'lang:javascript', 'Promesas y async/await', 'Esperar resultados sin bloquear y leer el orden de ejecución.', ['js-event-loop'], ['async-await', 'promises', 'orden-con-async-await']),
  N('js-modulos-esm', 'lang:javascript', 'Módulos ES', 'Importar y exportar código entre archivos.', ['modularidad'], ['esm', 'es-modules']),

  /* TypeScript */
  N('ts-tipos-estaticos', 'lang:typescript', 'Tipos estáticos', 'Comprobar los tipos antes de ejecutar el programa.', ['variables-y-tipos'], ['static-typing']),
  N('ts-interfaces-y-alias', 'lang:typescript', 'Interfaces y alias de tipo', 'Dar nombre a la forma de los datos.', ['ts-tipos-estaticos'], ['interfaces', 'type-aliases']),
  N('ts-genericos', 'lang:typescript', 'Genéricos', 'Escribir código que funciona con varios tipos sin perder precisión.', ['ts-interfaces-y-alias'], ['generics']),
  N('ts-uniones-y-narrowing', 'lang:typescript', 'Uniones y estrechamiento', 'Distinguir entre varios tipos posibles con comprobaciones.', ['ts-interfaces-y-alias'], ['union-types', 'narrowing']),
  N('ts-configuracion', 'lang:typescript', 'Configuración de TypeScript', 'Qué controla tsconfig y cómo afecta al proyecto.', ['ts-tipos-estaticos', 'modularidad'], ['tsconfig']),

  /* Python */
  N('py-tipado-y-hints', 'lang:python', 'Tipado dinámico y type hints', 'Python no obliga a declarar tipos, pero puedes anotarlos.', ['variables-y-tipos'], ['type-hints']),
  N('py-comprensiones', 'lang:python', 'Comprensiones', 'Construir listas y diccionarios en una sola expresión.', ['estructuras-de-datos'], ['comprehensions', 'list-comprehensions']),
  N('py-decoradores', 'lang:python', 'Decoradores', 'Envolver una función para añadirle comportamiento.', ['funciones'], ['decorators']),
  N('py-generadores', 'lang:python', 'Generadores', 'Producir valores uno a uno en lugar de todos de golpe.', ['funciones'], ['generators']),
  N('py-entornos-virtuales', 'lang:python', 'Entornos virtuales', 'Aislar las dependencias de cada proyecto.', ['modularidad'], ['virtualenv', 'venv']),
  N('py-asyncio', 'lang:python', 'asyncio', 'Programación asíncrona con corrutinas en Python.', ['asincronia'], ['asyncio']),

  /* React */
  N('react-componentes', 'fw:react', 'Componentes', 'Una función que devuelve lo que se pinta.', ['funciones'], ['components', 'component-function']),
  N('react-estado-y-props', 'fw:react', 'Estado y props', 'Datos que entran en un componente y datos que cambian dentro de él.', ['react-componentes'], ['state-and-props']),
  N('react-hooks', 'fw:react', 'Hooks', 'Funciones que dan estado y efectos a los componentes.', ['react-estado-y-props'], ['hooks']),
  N('react-efectos', 'fw:react', 'Efectos y ciclo de vida', 'Qué ocurre cuando un componente aparece, cambia o desaparece.', ['react-hooks'], ['effects', 'useeffect']),
  N('react-contexto', 'fw:react', 'Contexto y estado global', 'Compartir datos con muchos componentes sin pasarlos uno a uno.', ['react-hooks'], ['context', 'global-state']),

  /* Next.js */
  N('next-rutas', 'fw:nextjs', 'Rutas del App Router', 'Cómo las carpetas se convierten en páginas.', ['react-componentes'], ['rutas-del-app-router', 'app-router']),
  N('next-server-components', 'fw:nextjs', 'Componentes de servidor', 'Componentes que se ejecutan en el servidor y no envían su código al cliente.', ['next-rutas'], ['server-components']),
  N('next-datos-y-cache', 'fw:nextjs', 'Datos y caché', 'Dónde se piden los datos y cuánto tiempo se reutilizan.', ['next-server-components'], ['data-fetching', 'caching']),
  N('next-rutas-api', 'fw:nextjs', 'Rutas de API', 'Endpoints que viven dentro de la propia app.', ['next-rutas', 'api-rest'], ['route-handlers', 'api-routes']),

  /* Express */
  N('express-middleware', 'fw:express', 'Middleware', 'Funciones que procesan la petición antes de llegar a la ruta.', ['funciones'], ['middleware']),
  N('express-enrutado', 'fw:express', 'Enrutado', 'Asociar direcciones y métodos HTTP con funciones.', ['express-middleware'], ['routing']),
  N('express-errores', 'fw:express', 'Manejo de errores en Express', 'Un único sitio donde acaban los errores de la API.', ['express-middleware', 'manejo-de-errores'], ['express-error-handling']),
  N('express-validacion', 'fw:express', 'Validación con esquemas', 'Declarar la forma esperada de la entrada y rechazar el resto.', ['express-middleware', 'validacion-de-entrada'], ['schema-validation']),

  /* FastAPI */
  N('fastapi-rutas', 'fw:fastapi', 'Rutas y parámetros', 'Funciones decoradas que atienden peticiones.', ['funciones'], ['path-operations']),
  N('fastapi-pydantic', 'fw:fastapi', 'Modelos Pydantic', 'Describir y validar datos con clases tipadas.', ['py-tipado-y-hints'], ['pydantic']),
  N('fastapi-dependencias', 'fw:fastapi', 'Inyección de dependencias', 'Pedir lo que una ruta necesita en vez de crearlo dentro.', ['fastapi-rutas'], ['dependency-injection']),
  N('fastapi-async', 'fw:fastapi', 'Async en FastAPI', 'Cuándo usar rutas asíncronas y cuándo no.', ['fastapi-rutas', 'py-asyncio'], ['fastapi-async-routes']),

  /* kind: app */
  N('app-arquitectura', 'kind:app', 'Arquitectura de la app', 'Cómo se reparten las responsabilidades dentro de la aplicación.', ['arquitectura-en-capas'], ['app-architecture']),
  N('app-estado', 'kind:app', 'Estado de la aplicación', 'Dónde vive el estado y quién puede cambiarlo.', ['estructuras-de-datos'], ['app-state']),
  N('app-configuracion', 'kind:app', 'Configuración por entorno', 'Que la misma app funcione en desarrollo y en producción.', ['control-de-versiones'], ['environment-config']),
  N('app-despliegue', 'kind:app', 'Despliegue', 'Llevar la app a un servidor y mantenerla en marcha.', ['contenedores', 'integracion-continua'], ['deployment']),

  /* kind: libreria */
  N('lib-api-publica', 'kind:libreria', 'Diseño de API pública', 'Qué exponer y qué esconder para que sea fácil de usar bien.', ['modularidad'], ['public-api', 'api-publica']),
  N('lib-versionado', 'kind:libreria', 'Versionado semántico', 'Qué significa subir la versión mayor, menor o de parche.', ['control-de-versiones'], ['semver']),
  N('lib-documentacion', 'kind:libreria', 'Documentación de API', 'Explicar cómo usar la librería con ejemplos que funcionan.', ['lib-api-publica'], ['api-docs']),
  N('lib-publicacion', 'kind:libreria', 'Publicación de paquetes', 'Empaquetar y publicar una versión para que otros la instalen.', ['lib-versionado'], ['publishing']),

  /* kind: plugin */
  N('plugin-manifiesto', 'kind:plugin', 'Manifiesto del plugin', 'El archivo que declara qué es el plugin y qué aporta.', ['modularidad'], ['plugin-manifest', 'contrato-del-plugin']),
  N('plugin-hooks', 'kind:plugin', 'Hooks y eventos', 'Reaccionar a lo que ocurre en la herramienta anfitriona.', ['plugin-manifiesto'], ['hooks-and-events']),
  N('plugin-skills', 'kind:plugin', 'Skills y comandos', 'Instrucciones y atajos que el plugin ofrece al usuario.', ['plugin-manifiesto'], ['skills', 'commands']),
  N('plugin-permisos', 'kind:plugin', 'Permisos y seguridad del plugin', 'Qué puede hacer un plugin y cómo limitarlo.', ['seguridad-basica', 'plugin-hooks'], ['plugin-permissions']),

  /* kind: mcp */
  N('mcp-protocolo', 'kind:mcp', 'Protocolo MCP', 'Cómo un cliente descubre y llama a las herramientas de un servidor.', ['funciones'], ['mcp-protocol']),
  N('mcp-esquemas', 'kind:mcp', 'Esquemas de herramientas', 'Declarar qué entrada acepta cada herramienta.', ['validacion-de-entrada', 'mcp-protocolo'], ['tool-schemas']),
  N('mcp-transporte', 'kind:mcp', 'Transportes stdio y HTTP', 'Por dónde se comunican el cliente y el servidor.', ['mcp-protocolo'], ['transports']),
  N('mcp-errores', 'kind:mcp', 'Errores en herramientas', 'Cómo informar de un fallo para que el modelo pueda corregir.', ['manejo-de-errores', 'mcp-protocolo'], ['tool-errors']),

  /* kind: integracion */
  N('int-contrato', 'kind:integracion', 'Contrato con el otro sistema', 'Qué promete el otro servicio y qué esperas tú.', ['api-rest'], ['integration-contract']),
  N('int-oauth', 'kind:integracion', 'Autenticación OAuth', 'Acceder en nombre de un usuario sin guardar su contraseña.', ['autenticacion-y-autorizacion', 'int-contrato'], ['oauth']),
  N('int-reintentos', 'kind:integracion', 'Reintentos y límites', 'Qué hacer cuando el otro sistema falla o te frena.', ['idempotencia-y-reintentos', 'int-contrato'], ['retries-and-limits']),
  N('int-mapeo', 'kind:integracion', 'Mapeo de datos', 'Traducir los datos de un sistema a la forma del otro.', ['estructuras-de-datos', 'int-contrato'], ['data-mapping']),

  /* kind: script */
  N('script-entrada', 'kind:script', 'Argumentos y entrada estándar', 'Cómo recibe datos un programa de línea de comandos.', ['funciones'], ['cli-args', 'stdin']),
  N('script-salida', 'kind:script', 'Códigos de salida', 'Cómo avisa un script de si salió bien o mal.', ['manejo-de-errores'], ['exit-codes']),

  /* kind: infraestructura */
  N('infra-entornos', 'kind:infraestructura', 'Entornos y variables', 'Separar desarrollo, pruebas y producción.', ['control-de-versiones'], ['environments']),
  N('infra-secretos', 'kind:infraestructura', 'Secretos', 'Guardar claves y contraseñas fuera del código.', ['seguridad-basica'], ['secrets']),
  N('infra-reproducibilidad', 'kind:infraestructura', 'Reproducibilidad', 'Que el mismo código produzca siempre el mismo entorno.', ['infraestructura-como-codigo'], ['reproducibility']),
];

const byId = new Map(NODES.map((n) => [n.id, n]));
const aliasMap = new Map();
for (const n of NODES) { aliasMap.set(n.id, n.id); for (const a of n.aliases) aliasMap.set(a, n.id); }

/* A slug the model wrote, matched to a catalog concept by id or alias. */
const resolve = (slug) => aliasMap.get(slug) || null;

/* Catalog concept ids worth suggesting for a repo: universal plus its languages, frameworks and kind. */
function slugsFor(det, kind) {
  const keep = new Set(['universal', ...((det && det.languages) || []).map((l) => `lang:${l}`), ...((det && det.frameworks) || []).map((f) => `fw:${f}`), `kind:${kind}`]);
  return NODES.filter((n) => keep.has(n.branch)).map((n) => n.id);
}

module.exports = { BRANCHES, NODES, byId, resolve, slugsFor };

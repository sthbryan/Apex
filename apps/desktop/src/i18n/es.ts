import type { Messages } from "./en";

export const es: Messages = {
  "app.name": "Apex",
  "status.connecting": "conectando",
  "status.ready": "listo",
  "status.failed": "fallo",

  "agents.detecting": "Detectando agentes…",
  "agents.available": "Disponibles",
  "agents.missing": "Sin instalar",
  "agents.notFound": 'no se encontró "{command}" en el PATH',
  "agents.supportsResume": "reanudar",
  "agents.dot.available": "disponible",
  "agents.dot.missing": "sin instalar",

  "daemon.unreachable": "No se pudo hablar con apexd.",
  "daemon.retry": "Reintentar",

  "dock.sessions": "Sesiones",
  "dock.agents": "Agentes",
  "dock.toggle": "Mostrar u ocultar el panel",

  "sessions.live": "Corriendo",
  "sessions.empty": "Todavía no hay sesiones.",
  "sessions.exited": "salió {code}",
  "sessions.close": "Cerrar sesión",

  "workspace.empty": "No hay nada abierto.",
  "workspace.emptyHint": "Pulsa {shortcut} para arrancar una sesión.",

  "palette.placeholder": "Escribe un comando…",
  "palette.empty": "Nada coincide.",
  "palette.newSession": "Nueva sesión: {agent}",
  "palette.goTo": "Ir a: {title}",
  "palette.splitRight": "Dividir a la derecha",
  "palette.splitDown": "Dividir abajo",
  "palette.closePane": "Cerrar panel",
  "palette.closeTab": "Cerrar pestaña",

  "error.unsupported_version": "El daemon habla otra versión del protocolo.",
  "error.unauthorized": "Este cliente no puede ejecutar ese comando.",
  "error.malformed_request": "El daemon no entendió la petición.",
  "error.not_found": "El daemon no encontró lo que se le pidió.",
  "error.internal": "El daemon tuvo un error interno.",
};

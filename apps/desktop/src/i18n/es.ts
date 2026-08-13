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

  "error.unsupported_version": "El daemon habla otra versión del protocolo.",
  "error.unauthorized": "Este cliente no puede ejecutar ese comando.",
  "error.malformed_request": "El daemon no entendió la petición.",
  "error.not_found": "El daemon no encontró lo que se le pidió.",
  "error.internal": "El daemon tuvo un error interno.",
};

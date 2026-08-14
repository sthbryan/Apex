import type { Messages } from "./en";

export const es: Messages = {
  "app.name": "Apex",
  "status.connecting": "conectando",
  "status.ready": "listo",
  "status.failed": "fallo",

  "daemon.unreachable": "No se pudo hablar con apexd.",
  "daemon.retry": "Reintentar",

  "dock.sessions": "Sesiones",

  "projects.none": "Sin proyecto",
  "projects.open": "Abrir proyecto…",
  "projects.empty": "Abre un proyecto para empezar.",
  "projects.elsewhere": "Otros proyectos",

  "usage.title": "Uso de suscripción",
  "usage.resetsIn": "reinicia en {away} · {when}",
  "usage.resetsAt": "reinicia {when}",

  "status.sessions": "{count} vivas",

  "resources.sampling": "Midiendo…",
  "resources.system": "Sistema",
  "resources.cpu": "CPU",
  "resources.gpu": "GPU",
  "resources.memory": "Memoria",
  "resources.swap": "Swap",
  "resources.cores": "núcleos",
  "resources.bySession": "Por sesión",
  "resources.noSessions": "No hay sesiones corriendo.",
  "resources.noQuota": "Sin datos.",
  "resources.refresh": "Actualizar ahora",
  "resources.kill": "Matar el proceso {pid}",

  "toolbar.newSession": "Nueva sesión",
  "toolbar.theme.system": "Tema: sistema",
  "toolbar.theme.light": "Tema: claro",
  "toolbar.theme.dark": "Tema: oscuro",

  "notify.blocked": "Un agente te está esperando",
  "notify.done": "Un agente terminó",
  "sessions.waiting": "Te esperan",
  "sessions.live": "Corriendo",
  "sessions.finished": "Terminadas",
  "sessions.empty": "Todavía no hay sesiones.",
  "sessions.exited": "salió {code}",
  "sessions.close": "Cerrar sesión",
  "sessions.dismiss": "Descartar",
  "sessions.clearFinished": "Limpiar terminadas",

  "workspace.empty": "No hay nada abierto.",
  "workspace.emptyHint": "Pulsa {shortcut} para arrancar una sesión.",

  "palette.placeholder": "Escribe un comando…",
  "palette.empty": "Nada coincide.",
  "palette.newSession": "Nueva sesión: {agent}",
  "palette.resume": "Reanudar {agent}: {label}",
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

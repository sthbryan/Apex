import type { Messages } from "@/shared/i18n/en";

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

  "resources.sampling": "Midiendo…",
  "resources.cpu": "CPU",
  "resources.gpu": "GPU",
  "resources.memory": "Memoria",
  "resources.swap": "Swap",
  "resources.bySession": "Por sesión",
  "resources.noSessions": "No hay sesiones corriendo.",
  "resources.noQuota": "Sin datos.",
  "resources.refresh": "Actualizar ahora",
  "resources.kill": "Matar el proceso {pid}",

  "settings.title": "Preferencias",
  "settings.close": "Cerrar preferencias",
  "settings.theme": "Tema",
  "settings.themeHint": "Sigue al sistema.",
  "settings.language": "Idioma",
  "settings.languageHint": "Se aplica al momento.",
  "settings.agentsHint": "Los agentes son archivos TOML en {path} — suelta uno para añadir un CLI.",

  "theme.system": "Sistema",
  "theme.light": "Claro",
  "theme.dark": "Oscuro",

  "usage.overPace": "acelerado",

  "toolbar.newSession": "Nueva sesión",

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
  "palette.settings": "Preferencias",

  "error.unsupported_version": "El daemon habla otra versión del protocolo.",
  "error.unauthorized": "Este cliente no puede ejecutar ese comando.",
  "error.malformed_request": "El daemon no entendió la petición.",
  "error.not_found": "El daemon no encontró lo que se le pidió.",
  "error.internal": "El daemon tuvo un error interno.",
};

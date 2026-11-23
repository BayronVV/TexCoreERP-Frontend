/** Bloqueo temporal por intentos fallidos (HU 1.5): vigente mientras `locked_until` esté en el futuro. */
export function isLocked(user, now = Date.now()) {
  return Boolean(user?.locked_until) && new Date(user.locked_until).getTime() > now
}

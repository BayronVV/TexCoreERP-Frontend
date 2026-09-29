// Misma política que apps/users/validators.py en el backend.
export const PASSWORD_RULES = [
  { label: 'Al menos 8 caracteres', test: (p) => p.length >= 8 },
  { label: 'Una letra mayúscula', test: (p) => /[A-Z]/.test(p) },
  { label: 'Una letra minúscula', test: (p) => /[a-z]/.test(p) },
  { label: 'Un número', test: (p) => /[0-9]/.test(p) },
  { label: 'Un símbolo (!, #, $...)', test: (p) => /[^\p{L}\p{N}\s]/u.test(p) },
]

export const passwordIsValid = (password) => PASSWORD_RULES.every((rule) => rule.test(password))

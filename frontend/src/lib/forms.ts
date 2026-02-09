export type FormErrors<T extends string> = Partial<Record<T, string>>

export function isEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)
}

export function validateRequired<T extends string>(
  fields: Record<T, string>,
): FormErrors<T> {
  const errors: FormErrors<T> = {}
  for (const [key, value] of Object.entries(fields) as [T, string][]) {
    if (!value.trim()) {
      errors[key as T] = 'This field is required'
    }
  }
  return errors
}

export function hasErrors<T extends string>(errors: FormErrors<T>) {
  return Object.values(errors).some(Boolean)
}

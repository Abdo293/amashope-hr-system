export { cn } from "cn"

export function getErrorMessage(error: unknown, fallback = 'حدث خطأ غير متوقع') {
  return error instanceof Error ? error.message : fallback
}

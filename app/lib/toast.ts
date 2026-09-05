import { toast as herouiToast } from '@heroui/react'

type AppToast = typeof herouiToast & {
  error: typeof herouiToast.danger
}

/** App toast helper — maps former sonner `error` to HeroUI `danger`. */
export const toast = Object.assign(
  (message: Parameters<typeof herouiToast>[0], options?: Parameters<typeof herouiToast>[1]) =>
    herouiToast(message, options),
  {
    success: herouiToast.success.bind(herouiToast),
    warning: herouiToast.warning.bind(herouiToast),
    info: herouiToast.info.bind(herouiToast),
    danger: herouiToast.danger.bind(herouiToast),
    error: herouiToast.danger.bind(herouiToast),
    clear: herouiToast.clear?.bind(herouiToast),
  },
) as AppToast

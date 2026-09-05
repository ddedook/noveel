export const name = '@noveel/plugin-host'

export function apply(ctx: unknown) {
  // Tools registered in-process via lib/main/dsh/noveel-tools when DSH host boots in Electron main.
  void ctx
}

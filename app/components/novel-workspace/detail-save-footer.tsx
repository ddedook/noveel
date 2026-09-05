import { Button } from '@heroui/react'

type DetailSaveFooterProps = {
  onSave: () => void
  saving?: boolean
  disabled?: boolean
}

export function DetailSaveFooter({ onSave, saving, disabled }: DetailSaveFooterProps) {
  return (
    <div className="sticky bottom-0 mt-auto border-t border-border bg-background/95 py-3 backdrop-blur-sm">
      <Button
        type="button"
        onPress={onSave}
        isDisabled={disabled || saving}
        className="active:scale-[0.96]"
      >
        {saving ? '保存中…' : '保存'}
      </Button>
    </div>
  )
}

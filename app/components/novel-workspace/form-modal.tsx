import type { FormEvent, ReactNode } from 'react'
import { Button, Modal } from '@heroui/react'
import { cn } from '@/app/lib/utils'

export const FORM_MODAL_WIDTH = 'sm:max-w-2xl'

export const FORM_MODAL_SECTION_CLASS = 'rounded-md border border-border p-4'

export const FORM_MODAL_FOOTER_CLASS =
  'mx-0 mb-0 gap-2 border-t border-border bg-background px-6 py-4 sm:flex-row sm:justify-end'

const FORM_MODAL_SCROLL_CLASS =
  'max-h-[min(70vh,720px)] overflow-y-auto overscroll-contain pr-1 [scrollbar-width:thin]'

export type FormModalProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  children: ReactNode
  footer?: ReactNode
  /** When set, wraps scroll body in `<form id={formId}>` for footer submit buttons. */
  formId?: string
  onSubmit?: (e: FormEvent<HTMLFormElement>) => void
  widthClass?: string
  className?: string
}

export function FormModalFooter(props: {
  onCancel: () => void
  submitLabel?: string
  cancelLabel?: string
  submitDisabled?: boolean
  submitLoading?: boolean
  formId?: string
}) {
  const {
    onCancel,
    submitLabel = '确定',
    cancelLabel = '取消',
    submitDisabled,
    submitLoading,
    formId,
  } = props

  return (
    <>
      <Button type="button" variant="outline" onPress={onCancel}>
        {cancelLabel}
      </Button>
      <Button
        type="submit"
        form={formId}
        isDisabled={submitDisabled || submitLoading}
      >
        {submitLoading ? `${submitLabel}…` : submitLabel}
      </Button>
    </>
  )
}

export function FormModal({
  open,
  onOpenChange,
  title,
  children,
  footer,
  formId,
  onSubmit,
  widthClass = FORM_MODAL_WIDTH,
  className,
}: FormModalProps) {
  const body = (
    <div className={cn(FORM_MODAL_SCROLL_CLASS, 'px-6 py-4')}>{children}</div>
  )

  return (
    <Modal>
      <Modal.Backdrop isOpen={open} onOpenChange={onOpenChange}>
        <Modal.Container>
          <Modal.Dialog
            className={cn('novel-form-modal app-no-drag gap-0 p-0 text-sm', widthClass, className)}
          >
            <Modal.Header className="border-b border-border px-6 py-4">
              <Modal.Heading className="text-sm font-medium">{title}</Modal.Heading>
            </Modal.Header>
            <Modal.Body className="p-0">
              {formId ? (
                <form id={formId} onSubmit={onSubmit} className="contents">
                  {body}
                </form>
              ) : (
                body
              )}
            </Modal.Body>
            {footer ? (
              <Modal.Footer className={FORM_MODAL_FOOTER_CLASS}>{footer}</Modal.Footer>
            ) : null}
          </Modal.Dialog>
        </Modal.Container>
      </Modal.Backdrop>
    </Modal>
  )
}

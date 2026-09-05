import type { ReactNode } from 'react'
import { Separator } from '@heroui/react'
import { SingleCombobox } from '@/app/components/single-combobox'
import { cn } from '@/app/lib/utils'

export const SETTINGS_PORTAL_LAYER = 'noveel-settings-alert-layer'

export function SettingsFieldRow(props: {
  title: string
  description?: string
  children: ReactNode
  showSeparator?: boolean
}) {
  return (
    <>
      <div className="flex flex-col gap-4 py-5 sm:flex-row sm:items-start">
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium">{props.title}</p>
          {props.description ? (
            <p className="text-muted text-sm">{props.description}</p>
          ) : null}
        </div>
        <div className="shrink-0 pt-0.5">{props.children}</div>
      </div>
      {props.showSeparator !== false ? <Separator /> : null}
    </>
  )
}

export type SettingsChoiceOption<T extends string = string> = {
  value: T
  label: string
  description?: string
  icon?: ReactNode
  swatch?: string
}

export function SettingsChoiceCards<T extends string>(props: {
  value: T
  disabled?: boolean
  columns?: 1 | 2 | 3
  onChange: (value: T) => void
  options: SettingsChoiceOption<T>[]
}) {
  const columns = props.columns ?? (props.options.length <= 2 ? 2 : 3)

  return (
    <div
      role="radiogroup"
      className={cn(
        'grid gap-2',
        columns === 1 && 'grid-cols-1',
        columns === 2 && 'grid-cols-2',
        columns === 3 && 'grid-cols-1 sm:grid-cols-3',
      )}
    >
      {props.options.map((opt) => {
        const selected = props.value === opt.value
        return (
          <button
            key={opt.value}
            type="button"
            role="radio"
            aria-checked={selected}
            disabled={props.disabled}
            onClick={() => {
              if (props.disabled || selected) return
              props.onChange(opt.value)
            }}
            className={cn(
              'relative flex flex-col gap-1.5 rounded-xl p-3 ring-1 transition-[background-color,box-shadow,transform] hover:bg-default/50 active:scale-[0.96]',
              opt.icon || opt.swatch ? 'items-center text-center' : 'items-start text-left',
              selected
                ? 'bg-accent-soft text-accent-soft-foreground ring-accent/40'
                : 'bg-surface ring-foreground/10',
              props.disabled && 'pointer-events-none opacity-50',
            )}
          >
            {opt.swatch ? (
              <span
                className="size-5 shrink-0 rounded-full ring-1 ring-foreground/10"
                style={{ backgroundColor: opt.swatch }}
                aria-hidden
              />
            ) : opt.icon ? (
              <div className={cn(selected ? 'text-accent-soft-foreground' : 'text-muted')}>
                {opt.icon}
              </div>
            ) : null}
            <span className="text-sm font-medium leading-snug">{opt.label}</span>
            {opt.description ? (
              <span
                className={cn(
                  'text-xs leading-normal',
                  selected ? 'text-accent-soft-foreground/80' : 'text-muted',
                )}
              >
                {opt.description}
              </span>
            ) : null}
          </button>
        )
      })}
    </div>
  )
}

export function SettingsChoiceField<T extends string>(props: {
  title: string
  description?: string
  showSeparator?: boolean
  value: T
  disabled?: boolean
  columns?: 1 | 2 | 3
  onChange: (value: T) => void
  options: SettingsChoiceOption<T>[]
}) {
  return (
    <>
      <div className="flex flex-col gap-4 py-5">
        <div>
          <p className="text-sm font-medium">{props.title}</p>
          {props.description ? (
            <p className="text-muted text-sm">{props.description}</p>
          ) : null}
        </div>
        <SettingsChoiceCards
          value={props.value}
          disabled={props.disabled}
          columns={props.columns}
          onChange={props.onChange}
          options={props.options}
        />
      </div>
      {props.showSeparator !== false ? <Separator /> : null}
    </>
  )
}

type SettingsSelectOption = {
  value: string
  label: string
  disabled?: boolean
}

export function SettingsSelect(props: {
  value: string
  disabled?: boolean
  placeholder?: string
  triggerClassName?: string
  onChange: (value: string) => void
  options: SettingsSelectOption[]
}) {
  return (
    <SingleCombobox
      value={props.value}
      disabled={props.disabled}
      placeholder={props.placeholder}
      className={cn('min-w-50', props.triggerClassName)}
      contentClassName={SETTINGS_PORTAL_LAYER}
      onValueChange={props.onChange}
      options={props.options.map((opt) => ({
        value: opt.value,
        label: opt.label,
        disabled: opt.disabled,
      }))}
    />
  )
}

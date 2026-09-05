import { useState } from 'react'
import { Chip, Input, Label, Switch, TextField } from '@heroui/react'

type SettingsNamespace = {
  ns: string
  value?: unknown
  revision?: number
}

type SettingsSectionBodyProps = {
  namespace: SettingsNamespace
  writable: boolean
  onSaved: () => void
}

type FlatField = {
  path: string[]
  key: string
  value: unknown
}

export function SettingsSectionBody({ namespace, writable, onSaved }: SettingsSectionBodyProps) {
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const fields = flattenValue(namespace.value)

  async function updateField(path: string[], nextValue: unknown) {
    if (!writable) return
    setSaving(true)
    setError(null)
    try {
      await window.ipcApi.dsh.settingsMutate({
        ns: namespace.ns,
        ops: [{ op: 'set', path, value: nextValue }],
        expectedRevision: namespace.revision,
      })
      onSaved()
    } catch (err) {
      setError(err instanceof Error ? err.message : '保存失败')
    } finally {
      setSaving(false)
    }
  }

  if (fields.length === 0) {
    return <p className="text-muted text-sm">此分区暂无可编辑项。</p>
  }

  return (
    <div>
      <div className="flex flex-col gap-4">
        {fields.map((field) => (
          <div key={field.key} className="flex flex-row items-center gap-4">
            <Label htmlFor={field.key}>{field.key}</Label>
            <FieldEditor
              id={field.key}
              value={field.value}
              disabled={!writable || saving}
              onChange={(value) => void updateField(field.path, value)}
            />
          </div>
        ))}
      </div>
      {error ? <p className="text-danger mt-2 text-sm">{error}</p> : null}
    </div>
  )
}

function FieldEditor(props: {
  id: string
  value: unknown
  disabled?: boolean
  onChange: (value: unknown) => void
}) {
  const { id, value, disabled, onChange } = props

  if (typeof value === 'boolean') {
    return (
      <Switch
        id={id}
        isSelected={value}
        isDisabled={disabled}
        onChange={onChange}
      >
        <Switch.Control>
          <Switch.Thumb />
        </Switch.Control>
      </Switch>
    )
  }

  if (typeof value === 'number') {
    return (
      <TextField
        id={id}
        value={String(value)}
        isDisabled={disabled}
        onChange={(next) => onChange(Number(next))}
        className="min-w-0 flex-1"
      >
        <Input type="number" />
      </TextField>
    )
  }

  if (typeof value === 'string') {
    return (
      <TextField
        id={id}
        value={value}
        isDisabled={disabled}
        onChange={onChange}
        className="min-w-0 flex-1"
      >
        <Input type="text" />
      </TextField>
    )
  }

  return (
    <Chip variant="tertiary" className="font-mono text-xs">
      {JSON.stringify(value)}
    </Chip>
  )
}

function flattenValue(value: unknown, path: string[] = [], acc: FlatField[] = []): FlatField[] {
  if (value === null || value === undefined) return acc
  if (typeof value !== 'object' || Array.isArray(value)) {
    acc.push({ path, key: path.join('.') || 'value', value })
    return acc
  }

  for (const [key, child] of Object.entries(value as Record<string, unknown>)) {
    const nextPath = [...path, key]
    if (child !== null && typeof child === 'object' && !Array.isArray(child)) {
      flattenValue(child, nextPath, acc)
    } else {
      acc.push({ path: nextPath, key: nextPath.join('.'), value: child })
    }
  }
  return acc
}

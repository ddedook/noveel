/**
 * 极简 Markdown → HTML 转换器。
 * 仅处理技能编辑器中常用的语法。
 */
export function simpleMarkdownToHtml(md: string): string {
  let html = md
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')

  html = html.replace(/```(\w*)\n([\s\S]*?)```/g, (_, _lang, code) => {
    const escaped = code.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    return `<pre class="bg-default rounded-md p-3 overflow-auto text-sm leading-relaxed font-mono"><code>${escaped}</code></pre>`
  })

  html = html.replace(/(?:^|\n)((?:\|.+\|\n)+)/g, (block) => {
    const lines = block.trim().split('\n').map((l: string) => l.trim()).filter(Boolean)
    if (lines.length < 2) return block
    const isSep = (line: string) => /^\|?\s*:?-{3,}:?\s*(\|\s*:?-{3,}:?\s*)+\|?$/.test(line)
    const sepIdx = lines.findIndex(isSep)
    if (sepIdx < 1) return block
    const splitRow = (line: string) =>
      line.replace(/^\|/, '').replace(/\|$/, '').split('|').map((c: string) => c.trim())
    const header = splitRow(lines[0]!)
    const body = lines.slice(sepIdx + 1).map(splitRow)
    const th = header.map((c) => `<th class="border border-border px-2 py-1.5 text-left font-semibold">${c}</th>`).join('')
    const trs = body
      .map(
        (cells: string[]) =>
          `<tr>${cells.map((c) => `<td class="border border-border px-2 py-1.5 align-top">${c}</td>`).join('')}</tr>`,
      )
      .join('')
    return `\n<div class="my-2 w-full overflow-x-auto"><table class="w-full border-collapse text-left text-sm"><thead class="bg-default"><tr>${th}</tr></thead><tbody>${trs}</tbody></table></div>\n`
  })

  html = html.replace(/`([^`]+)`/g, '<code class="bg-default rounded px-1 text-sm font-mono">$1</code>')
  html = html.replace(/!\[([^\]]*)\]\(([^)]+)\)/g, '<img src="$2" alt="$1" class="max-w-full rounded-md my-2" />')
  html = html.replace(
    /\[([^\]]+)\]\(([^)]+)\)/g,
    '<a href="$2" class="text-accent underline" target="_blank" rel="noopener noreferrer">$1</a>',
  )
  html = html.replace(/^(---|\*\*\*|___)\s*$/gm, '<hr class="my-4 border-border" />')
  html = html.replace(/^#{6}\s+(.+)$/gm, '<h6 class="text-sm font-semibold mt-4 mb-1">$1</h6>')
  html = html.replace(/^#{5}\s+(.+)$/gm, '<h5 class="text-base font-semibold mt-4 mb-1">$1</h5>')
  html = html.replace(/^#{4}\s+(.+)$/gm, '<h4 class="text-lg font-semibold mt-4 mb-1">$1</h4>')
  html = html.replace(/^#{3}\s+(.+)$/gm, '<h3 class="text-xl font-semibold mt-4 mb-1">$1</h3>')
  html = html.replace(/^#{2}\s+(.+)$/gm, '<h2 class="text-xl font-bold mt-5 mb-2">$1</h2>')
  html = html.replace(/^#{1}\s+(.+)$/gm, '<h1 class="text-2xl font-bold mt-5 mb-2">$1</h1>')
  html = html.replace(/\*\*\*(.+?)\*\*\*/g, '<strong><em>$1</em></strong>')
  html = html.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
  html = html.replace(/\*(.+?)\*/g, '<em>$1</em>')
  html = html.replace(/~~(.+?)~~/g, '<del>$1</del>')
  html = html.replace(/^>\s+(.+)$/gm, '<blockquote class="border-l-4 border-accent pl-3 my-2 italic">$1</blockquote>')
  html = html.replace(/^[\s]*[-*+]\s+(.+)$/gm, '<li class="ml-4 list-disc">$1</li>')
  html = html.replace(/^[\s]*\d+\.\s+(.+)$/gm, '<li class="ml-4 list-decimal">$1</li>')

  const lines = html.split('\n')
  const result: string[] = []
  let inPre = false
  let inList = false

  for (const line of lines) {
    if (line.startsWith('<pre')) {
      inPre = true
      result.push(line)
      continue
    }
    if (line.startsWith('</pre>')) {
      inPre = false
      result.push(line)
      continue
    }
    if (inPre) {
      result.push(line)
      continue
    }
    const trimmed = line.trim()
    if (!trimmed) {
      if (inList) inList = false
      result.push('')
      continue
    }
    if (
      trimmed.startsWith('<h') ||
      trimmed.startsWith('<hr') ||
      trimmed.startsWith('<blockquote') ||
      trimmed.startsWith('<li') ||
      trimmed.startsWith('<div') ||
      trimmed.startsWith('<table') ||
      trimmed.startsWith('</') ||
      trimmed.startsWith('<thead') ||
      trimmed.startsWith('<tbody') ||
      trimmed.startsWith('<tr') ||
      trimmed.startsWith('<th') ||
      trimmed.startsWith('<td') ||
      trimmed.startsWith('<img') ||
      trimmed.startsWith('<a') ||
      trimmed.startsWith('<pre')
    ) {
      if (trimmed.startsWith('<li')) inList = true
      result.push(line)
      continue
    }
    result.push(`<p class="my-1 leading-relaxed">${line}</p>`)
  }

  return result.join('\n').replace(/\n{3,}/g, '\n\n')
}

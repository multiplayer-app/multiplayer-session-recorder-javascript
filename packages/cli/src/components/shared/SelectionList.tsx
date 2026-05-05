import { useState, type ReactElement } from 'react'
import { tuiAttrs } from '../../lib/tuiAttrs.js'
import { clickHandler } from './clickHandler.js'
import { Divider } from './Divider.js'
import {
  BORDER_SUBTLE,
  BG_SURFACE_DEEP,
  BG_SURFACE_ROW_HOVER,
  FG_BODY_EMPHASIS,
  FG_DIM,
  FG_SELECTION_LABEL
} from './tuiTheme.js'

export interface SelectionItem {
  key: string
  icon: string
  iconColor?: string
  label: string
  labelColor?: string
  description?: string
}

interface SelectionListProps {
  items: SelectionItem[]
  selectedIndex: number
  onSelect: (index: number) => void
  flexGrow?: number
}

/**
 * A bordered selection list with icons, hover/active row highlights, dividers,
 * and click support. Used for model selection, auth method selection, etc.
 */
export function SelectionList({ items, selectedIndex, onSelect, flexGrow }: SelectionListProps): ReactElement {
  const [hoveredRow, setHoveredRow] = useState<number | null>(null)

  return (
    <box
      flexDirection='column'
      border={true}
      borderStyle='rounded'
      borderColor={BORDER_SUBTLE}
      flexGrow={flexGrow}
      overflow={'hidden' as const}
    >
      {items.map((item, i) => {
        const isActive = i === selectedIndex
        const isHovered = hoveredRow === i
        const isLast = i === items.length - 1
        const labelFg = isActive ? FG_BODY_EMPHASIS : (item.labelColor ?? FG_SELECTION_LABEL)

        const mouse = {
          onMouseUp: clickHandler(() => onSelect(i)),
          onMouseOver: () => setHoveredRow(i),
          onMouseOut: () => setHoveredRow((v: number | null) => (v === i ? null : v))
        }

        const bg = isActive ? BG_SURFACE_DEEP : isHovered ? BG_SURFACE_ROW_HOVER : undefined

        return (
          <box key={item.key} flexDirection='column'>
            <box flexDirection='row' paddingLeft={1} paddingRight={1} backgroundColor={bg} {...mouse}>
              <box width={3} flexShrink={0}>
                <text fg={item.iconColor}>{item.icon}</text>
              </box>
              <text fg={labelFg} attributes={tuiAttrs({ bold: isActive })}>
                {item.label}
              </text>
            </box>
            {item.description && (
              <box flexDirection='row' paddingLeft={1} paddingRight={1} backgroundColor={bg} {...mouse}>
                <box width={3} flexShrink={0}>
                  <text> </text>
                </box>
                <text fg={FG_DIM}>{item.description}</text>
              </box>
            )}
            {!isLast && <Divider />}
          </box>
        )
      })}
    </box>
  ) as ReactElement
}

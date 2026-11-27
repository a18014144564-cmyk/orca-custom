import React from 'react'
import {
  ArrowDown,
  ArrowUp,
  ArrowUpToLine,
  Bot,
  Laptop,
  Layers,
  Monitor,
  RotateCcw,
  Users
} from 'lucide-react'
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger
} from '@/components/ui/context-menu'
import {
  APP_RAIL_ICON_SIZE,
  APP_RAIL_ICON_STROKE_WIDTH,
  AppRailButton,
  RailItem,
  type AppRailItemId
} from './AppRailButton'
import { WORKSPACE_LIST_REGION_ID } from './app-rail-layout'
import {
  DEFAULT_SIDEBAR_ZONE_ORDER,
  moveSidebarZoneByOffset,
  moveSidebarZoneInOrder,
  moveSidebarZoneToFirst,
  normalizeSidebarZoneOrder,
  type SidebarZoneMode
} from '@/components/sidebar/four-zone/sidebar-four-zone-model'
import {
  resetSidebarZoneOrder,
  setSidebarZoneOrder
} from '@/components/sidebar/four-zone/sidebar-zone-store'

export type ZoneRailItemId = 'zone-teams' | 'zone-bots' | 'zone-win' | 'zone-mac' | 'workspaces'

type ZoneRailItemSpec = {
  itemId: ZoneRailItemId
  zone: SidebarZoneMode
  label: string
  renderIcon: () => React.ReactNode
}

const ZONE_RAIL_SPEC_BY_MODE: Record<SidebarZoneMode, ZoneRailItemSpec> = {
  teams: {
    itemId: 'zone-teams',
    zone: 'teams',
    label: 'Bot 团队',
    renderIcon: () => (
      <Users size={APP_RAIL_ICON_SIZE} strokeWidth={APP_RAIL_ICON_STROKE_WIDTH} aria-hidden />
    )
  },
  bots: {
    itemId: 'zone-bots',
    zone: 'bots',
    label: '单独 Bot',
    renderIcon: () => (
      <Bot size={APP_RAIL_ICON_SIZE} strokeWidth={APP_RAIL_ICON_STROKE_WIDTH} aria-hidden />
    )
  },
  win: {
    itemId: 'zone-win',
    zone: 'win',
    label: 'Win 主机',
    renderIcon: () => (
      <Monitor size={APP_RAIL_ICON_SIZE} strokeWidth={APP_RAIL_ICON_STROKE_WIDTH} aria-hidden />
    )
  },
  mac: {
    itemId: 'zone-mac',
    zone: 'mac',
    label: 'Mac 主机',
    renderIcon: () => (
      <Laptop size={APP_RAIL_ICON_SIZE} strokeWidth={APP_RAIL_ICON_STROKE_WIDTH} aria-hidden />
    )
  },
  all: {
    itemId: 'workspaces',
    zone: 'all',
    label: '全部',
    renderIcon: () => (
      <Layers size={APP_RAIL_ICON_SIZE} strokeWidth={APP_RAIL_ICON_STROKE_WIDTH} aria-hidden />
    )
  }
}

export function getOrderedZoneRailItems(
  botsEnabled: boolean,
  zoneOrder: readonly SidebarZoneMode[] = DEFAULT_SIDEBAR_ZONE_ORDER
): ZoneRailItemSpec[] {
  const normalized = normalizeSidebarZoneOrder(zoneOrder)
  const visibleModes = botsEnabled
    ? normalized
    : normalized.filter((mode) => mode !== 'teams' && mode !== 'bots')
  return visibleModes.map((mode) => ZONE_RAIL_SPEC_BY_MODE[mode])
}

export function getZoneRailItemIds(
  botsEnabled: boolean,
  zoneOrder: readonly SidebarZoneMode[] = DEFAULT_SIDEBAR_ZONE_ORDER
): readonly ZoneRailItemId[] {
  return getOrderedZoneRailItems(botsEnabled, zoneOrder).map((item) => item.itemId)
}

export function AppRailZoneButtons({
  botsEnabled,
  zoneOrder,
  workspacesActive,
  workspacesLabel,
  zoneMode,
  listShowsWorkspaces,
  listVisible,
  listRegionPresent,
  tabStopItem,
  onSelectZone
}: {
  botsEnabled: boolean
  zoneOrder: readonly SidebarZoneMode[]
  workspacesActive: boolean
  workspacesLabel: string
  zoneMode: SidebarZoneMode
  listShowsWorkspaces: boolean
  listVisible: boolean
  listRegionPresent: boolean
  tabStopItem: AppRailItemId
  onSelectZone: (zone: SidebarZoneMode) => void
}): React.JSX.Element {
  const items = getOrderedZoneRailItems(botsEnabled, zoneOrder)
  const isDefaultOrder = DEFAULT_SIDEBAR_ZONE_ORDER.every(
    (mode, index) => zoneOrder[index] === mode
  )

  return (
    <>
      {items.map((item, visibleIndex) => {
        const active = workspacesActive && zoneMode === item.zone
        const label = item.zone === 'all' ? `${workspacesLabel}（全部）` : item.label
        const isFirstVisible = visibleIndex === 0
        const isLastVisible = visibleIndex === items.length - 1

        return (
          <ContextMenu key={item.itemId}>
            <ContextMenuTrigger asChild>
              <span className="inline-flex">
                <RailItem tooltip={`${label}（右键可调整顺序）`}>
                  <AppRailButton
                    itemId={item.itemId}
                    icon={item.renderIcon()}
                    label={item.zone === 'all' ? workspacesLabel : item.label}
                    active={active}
                    aria-expanded={active && listShowsWorkspaces ? listVisible : undefined}
                    aria-controls={
                      listShowsWorkspaces && listRegionPresent
                        ? WORKSPACE_LIST_REGION_ID
                        : undefined
                    }
                    tabStop={tabStopItem === item.itemId}
                    onClick={() => onSelectZone(item.zone)}
                  />
                </RailItem>
              </span>
            </ContextMenuTrigger>
            <ContextMenuContent className="w-40">
              <ContextMenuItem
                disabled={isFirstVisible}
                onSelect={() => setSidebarZoneOrder(moveSidebarZoneToFirst(zoneOrder, item.zone))}
              >
                <ArrowUpToLine className="size-3.5" />
                放到第一个
              </ContextMenuItem>
              <ContextMenuItem
                disabled={isFirstVisible}
                onSelect={() => {
                  const prev = items[visibleIndex - 1]
                  if (prev) {
                    setSidebarZoneOrder(moveSidebarZoneInOrder(zoneOrder, item.zone, prev.zone))
                  } else {
                    setSidebarZoneOrder(moveSidebarZoneByOffset(zoneOrder, item.zone, -1))
                  }
                }}
              >
                <ArrowUp className="size-3.5" />
                上移一位
              </ContextMenuItem>
              <ContextMenuItem
                disabled={isLastVisible}
                onSelect={() => {
                  const next = items[visibleIndex + 1]
                  if (next) {
                    setSidebarZoneOrder(moveSidebarZoneInOrder(zoneOrder, item.zone, next.zone))
                  } else {
                    setSidebarZoneOrder(moveSidebarZoneByOffset(zoneOrder, item.zone, 1))
                  }
                }}
              >
                <ArrowDown className="size-3.5" />
                下移一位
              </ContextMenuItem>
              <ContextMenuSeparator />
              <ContextMenuItem disabled={isDefaultOrder} onSelect={() => resetSidebarZoneOrder()}>
                <RotateCcw className="size-3.5" />
                恢复默认顺序
              </ContextMenuItem>
            </ContextMenuContent>
          </ContextMenu>
        )
      })}
    </>
  )
}

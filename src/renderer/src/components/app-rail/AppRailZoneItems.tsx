import React from 'react'
import { Bot, Laptop, Monitor, Users } from 'lucide-react'
import {
  APP_RAIL_ICON_SIZE,
  APP_RAIL_ICON_STROKE_WIDTH,
  AppRailButton,
  RailItem,
  type AppRailItemId
} from './AppRailButton'
import { WORKSPACE_LIST_REGION_ID } from './app-rail-layout'
import type { SidebarZoneMode } from '@/components/sidebar/four-zone/sidebar-four-zone-model'

export type ZoneRailItemId = 'zone-teams' | 'zone-bots' | 'zone-win' | 'zone-mac'

type ZoneRailItemSpec = {
  itemId: ZoneRailItemId
  zone: Exclude<SidebarZoneMode, 'all'>
  label: string
  renderIcon: () => React.ReactNode
}

const ALL_ZONE_RAIL_ITEMS: readonly ZoneRailItemSpec[] = [
  {
    itemId: 'zone-teams',
    zone: 'teams',
    label: 'Bot 团队',
    renderIcon: () => (
      <Users size={APP_RAIL_ICON_SIZE} strokeWidth={APP_RAIL_ICON_STROKE_WIDTH} aria-hidden />
    )
  },
  {
    itemId: 'zone-bots',
    zone: 'bots',
    label: '单独 Bot',
    renderIcon: () => (
      <Bot size={APP_RAIL_ICON_SIZE} strokeWidth={APP_RAIL_ICON_STROKE_WIDTH} aria-hidden />
    )
  },
  {
    itemId: 'zone-win',
    zone: 'win',
    label: 'Win 主机',
    renderIcon: () => (
      <Monitor size={APP_RAIL_ICON_SIZE} strokeWidth={APP_RAIL_ICON_STROKE_WIDTH} aria-hidden />
    )
  },
  {
    itemId: 'zone-mac',
    zone: 'mac',
    label: 'Mac 主机',
    renderIcon: () => (
      <Laptop size={APP_RAIL_ICON_SIZE} strokeWidth={APP_RAIL_ICON_STROKE_WIDTH} aria-hidden />
    )
  }
]

export function getZoneRailItemIds(botsEnabled: boolean): readonly ZoneRailItemId[] {
  return (botsEnabled ? ALL_ZONE_RAIL_ITEMS : ALL_ZONE_RAIL_ITEMS.slice(2)).map(
    (item) => item.itemId
  )
}

export function AppRailZoneButtons({
  botsEnabled,
  workspacesActive,
  zoneMode,
  listShowsWorkspaces,
  listVisible,
  listRegionPresent,
  tabStopItem,
  onSelectZone
}: {
  botsEnabled: boolean
  workspacesActive: boolean
  zoneMode: SidebarZoneMode
  listShowsWorkspaces: boolean
  listVisible: boolean
  listRegionPresent: boolean
  tabStopItem: AppRailItemId
  onSelectZone: (zone: Exclude<SidebarZoneMode, 'all'>) => void
}): React.JSX.Element {
  const items = botsEnabled ? ALL_ZONE_RAIL_ITEMS : ALL_ZONE_RAIL_ITEMS.slice(2)
  return (
    <>
      {items.map((item) => {
        const active = workspacesActive && zoneMode === item.zone
        return (
          <RailItem key={item.itemId} tooltip={item.label}>
            <AppRailButton
              itemId={item.itemId}
              icon={item.renderIcon()}
              label={item.label}
              active={active}
              aria-expanded={active && listShowsWorkspaces ? listVisible : undefined}
              aria-controls={
                listShowsWorkspaces && listRegionPresent ? WORKSPACE_LIST_REGION_ID : undefined
              }
              tabStop={tabStopItem === item.itemId}
              onClick={() => onSelectZone(item.zone)}
            />
          </RailItem>
        )
      })}
    </>
  )
}

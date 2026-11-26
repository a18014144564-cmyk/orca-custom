import React from 'react'
import { Bot, Laptop, LayoutGrid, Monitor, Users } from 'lucide-react'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { cn } from '@/lib/class-names'
import type { SidebarZoneMode } from './sidebar-four-zone'

type SidebarZoneSwitcherProps = {
  mode: SidebarZoneMode
  onChange: (mode: SidebarZoneMode) => void
  botsEnabled: boolean
  teamCount: number
  botCount: number
  winHostCount: number
  macHostCount: number
}

type ZoneItem = {
  id: Exclude<SidebarZoneMode, 'all'>
  label: string
  tooltip: string
  icon: React.ComponentType<{ className?: string }>
  count?: number
  disabled?: boolean
}

export const SidebarZoneSwitcher = React.memo(function SidebarZoneSwitcher({
  mode,
  onChange,
  botsEnabled,
  teamCount,
  botCount,
  winHostCount,
  macHostCount
}: SidebarZoneSwitcherProps): React.JSX.Element {
  const zones: ZoneItem[] = [
    {
      id: 'teams',
      label: '团队',
      tooltip: 'Bot 团队群聊列表',
      icon: Users,
      count: teamCount,
      disabled: !botsEnabled
    },
    {
      id: 'bots',
      label: 'Bot',
      tooltip: '单独 Bot 列表',
      icon: Bot,
      count: botCount,
      disabled: !botsEnabled
    },
    {
      id: 'win',
      label: 'Win',
      tooltip: `Windows 主机工作区（${winHostCount} 台主机）`,
      icon: Monitor,
      count: winHostCount
    },
    {
      id: 'mac',
      label: 'Mac',
      tooltip: `Mac 主机工作区（${macHostCount} 台主机）`,
      icon: Laptop,
      count: macHostCount
    }
  ]

  const isClassic = mode === 'all'

  return (
    <div
      data-sidebar-zone-switcher=""
      role="tablist"
      aria-label="侧边栏四区切换"
      className="mx-2 mt-1.5 mb-0.5 flex shrink-0 items-center gap-1 rounded-md bg-foreground/[0.045] p-0.5 dark:bg-foreground/[0.06]"
    >
      <div className="grid min-w-0 flex-1 grid-cols-4 gap-0.5">
        {zones.map((zone) => {
          const Icon = zone.icon
          const active = mode === zone.id
          return (
            <Tooltip key={zone.id}>
              <TooltipTrigger asChild>
                <button
                  type="button"
                  role="tab"
                  aria-selected={active}
                  disabled={zone.disabled}
                  data-sidebar-zone-tab={zone.id}
                  onClick={() => onChange(zone.id)}
                  className={cn(
                    'flex h-7 min-w-0 items-center justify-center gap-1 rounded-[5px] px-1 text-[11px] font-medium transition-colors select-none',
                    active
                      ? 'bg-background text-foreground shadow-2xs ring-1 ring-foreground/[0.08] dark:bg-foreground/12 dark:ring-foreground/12'
                      : 'text-muted-foreground hover:bg-foreground/[0.05] hover:text-foreground',
                    zone.disabled && 'cursor-not-allowed opacity-40'
                  )}
                >
                  <Icon className="size-3 shrink-0" />
                  <span className="truncate">{zone.label}</span>
                  {zone.count !== undefined && zone.count > 0 ? (
                    <span
                      className={cn(
                        'shrink-0 text-[10px] tabular-nums',
                        active ? 'text-foreground/70' : 'text-muted-foreground/70'
                      )}
                    >
                      {zone.count}
                    </span>
                  ) : null}
                </button>
              </TooltipTrigger>
              <TooltipContent side="bottom" sideOffset={6}>
                {zone.tooltip}
              </TooltipContent>
            </Tooltip>
          )
        })}
      </div>

      <Tooltip>
        <TooltipTrigger asChild>
          <button
            type="button"
            role="tab"
            aria-selected={isClassic}
            aria-label="经典全部视图"
            data-sidebar-zone-tab="all"
            onClick={() => onChange(isClassic ? 'teams' : 'all')}
            className={cn(
              'flex size-7 shrink-0 items-center justify-center rounded-[5px] transition-colors',
              isClassic
                ? 'bg-background text-foreground shadow-2xs ring-1 ring-foreground/[0.08] dark:bg-foreground/12'
                : 'text-muted-foreground hover:bg-foreground/[0.05] hover:text-foreground'
            )}
          >
            <LayoutGrid className="size-3.5" />
          </button>
        </TooltipTrigger>
        <TooltipContent side="bottom" sideOffset={6}>
          {isClassic ? '当前：官方经典混合视图（点击切回四区）' : '切换为官方经典混合视图'}
        </TooltipContent>
      </Tooltip>
    </div>
  )
})

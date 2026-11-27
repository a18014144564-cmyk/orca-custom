import { ActionSheetModal } from '../../components/sheets/ActionSheetModal'
import { FOUR_ZONE_HOME_TABS, type FourZoneHomeTabId } from './home-tabs'
import { moveMobileTabByOffset, moveMobileTabToFirst } from './mobile-tab-order'

const FOUR_ZONE_TAB_LABELS: Record<FourZoneHomeTabId, string> = {
  teams: '团队',
  bots: 'Bot',
  projects: '项目',
  usage: '使用情况'
}

export function MobileTabOrderSheet(props: {
  target: FourZoneHomeTabId | null
  order: readonly FourZoneHomeTabId[]
  onReorder: (next: readonly FourZoneHomeTabId[]) => void
  onReset: () => void
  onClose: () => void
}) {
  const { target, order, onReorder, onReset, onClose } = props
  const actions: { label: string; onPress: () => void }[] = []
  if (target) {
    const idx = order.indexOf(target)
    const isDefaultOrder = FOUR_ZONE_HOME_TABS.every((id, i) => order[i] === id)
    if (idx > 0) {
      actions.push({
        label: '放到第一个',
        onPress: () => onReorder(moveMobileTabToFirst(order, target))
      })
      actions.push({
        label: '向左移一位',
        onPress: () => onReorder(moveMobileTabByOffset(order, target, -1))
      })
    }
    if (idx !== -1 && idx < order.length - 1) {
      actions.push({
        label: '向右移一位',
        onPress: () => onReorder(moveMobileTabByOffset(order, target, 1))
      })
    }
    if (!isDefaultOrder) {
      actions.push({
        label: '恢复默认顺序',
        onPress: onReset
      })
    }
  }

  return (
    <ActionSheetModal
      visible={target != null}
      title={target ? `调整「${FOUR_ZONE_TAB_LABELS[target]}」顺序` : undefined}
      message="排在第一个的标签页会作为启动默认首页"
      actions={actions}
      onClose={onClose}
    />
  )
}

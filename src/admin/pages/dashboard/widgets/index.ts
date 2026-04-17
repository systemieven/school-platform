/**
 * Re-exports dos widgets reutilizáveis do dashboard.
 * Tanto o DashboardPage (super_admin) quanto o SharedDashboard
 * (demais perfis) consomem a partir deste barrel.
 */
export { DashboardHeader, periodDays, periodStart, pctChange } from './DashboardHeader';
export type { Period } from './DashboardHeader';

export { StatCard } from './StatCard';
export type { StatCardProps } from './StatCard';

export { BarChart } from './BarChart';
export type { BarChartProps, GroupCount } from './BarChart';

export { WaStatsWidget } from './WaStatsWidget';
export type { WaStatsWidgetProps, WaStats } from './WaStatsWidget';

export { OverdueContactsWidget } from './OverdueContactsWidget';
export type { OverdueContactsWidgetProps, OverdueContact } from './OverdueContactsWidget';

export { UpcomingVisitsWidget } from './UpcomingVisitsWidget';
export type { UpcomingVisitsWidgetProps, UpcomingAppointment } from './UpcomingVisitsWidget';

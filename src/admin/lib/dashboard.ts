/**
 * Standard hover animations for dashboard primitives.
 *
 * Apply these classes to every KPI card and chart/widget container in dashboards
 * to keep interaction feedback consistent across the admin.
 *
 * Usage:
 *   import { DASH_CARD_HOVER, DASH_CHART_HOVER } from '../../lib/dashboard';
 *
 *   // KPI / stat card
 *   <div className={`bg-white rounded-2xl ... ${DASH_CARD_HOVER}`}>
 *
 *   // Chart or widget container
 *   <div className={`bg-white rounded-2xl ... ${DASH_CHART_HOVER}`}>
 */

/** Subtle lift + shadow on hover — for small KPI/stat cards */
export const DASH_CARD_HOVER =
  'hover:-translate-y-0.5 hover:shadow-lg transition-all duration-200';

/** Shadow elevation on hover — for larger chart / widget containers */
export const DASH_CHART_HOVER =
  'hover:shadow-md transition-shadow duration-200';

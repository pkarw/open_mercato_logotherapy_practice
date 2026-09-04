export const metadata = {
  requireAuth: true,
  requireFeatures: ['logotherapy.manage'],
  pageTitle: 'Book therapy visit',
  pageTitleKey: 'logotherapy.visits.createTitle',
  pageGroup: 'Logotherapy',
  pageGroupKey: 'logotherapy.nav.group',
  pageOrder: 11,
  navHidden: true,
  breadcrumb: [
    { label: 'Therapy visits', labelKey: 'logotherapy.visits.title', href: '/backend/visits' },
    { label: 'Book visit', labelKey: 'logotherapy.visits.createTitle' },
  ],
}

import type { ModuleInfo } from '@open-mercato/shared/modules/registry'

export const metadata: ModuleInfo = {
  name: 'logotherapy',
  title: 'Logotherapy',
  version: '0.1.0',
  description: 'Therapy visit booking and room scheduling.',
  requires: ['customers', 'staff', 'resources', 'entities'],
}

export const features = [
  { id: 'logotherapy.view', title: 'View logotherapy visits', module: 'logotherapy' },
  { id: 'logotherapy.manage', title: 'Manage logotherapy visits', module: 'logotherapy', dependsOn: ['logotherapy.view'] },
  { id: 'logotherapy.configure', title: 'Configure logotherapy', module: 'logotherapy', dependsOn: ['logotherapy.view'] },
]

export default features

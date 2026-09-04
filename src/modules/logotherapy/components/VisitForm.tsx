"use client"
import * as React from 'react'
import { CrudForm, type CrudField } from '@open-mercato/ui/backend/CrudForm'
import { createCrud } from '@open-mercato/ui/backend/utils/crud'
import { useT } from '@open-mercato/shared/lib/i18n/context'

export default function VisitForm() {
  const t = useT()
  const fields = React.useMemo<CrudField[]>(() => [
    { id: 'customerId', label: t('logotherapy.visits.customer'), type: 'select', required: true, optionsUrl: '/api/customers/people' },
    { id: 'therapyType', label: t('logotherapy.visits.therapyType'), type: 'select', required: true, options: [
      { value: 'logotherapy', label: t('logotherapy.visits.therapyType.logotherapy', 'Logotherapy') },
      { value: 'sensory_integration', label: t('logotherapy.visits.therapyType.sensoryIntegration', 'Sensory Integration') },
    ] },
    { id: 'employeeId', label: t('logotherapy.visits.employee'), type: 'select', required: true, optionsUrl: '/api/staff/team-members' },
    { id: 'resourceId', label: t('logotherapy.visits.room'), type: 'select', required: true, optionsUrl: '/api/resources/resources' },
    { id: 'startAt', label: t('logotherapy.visits.startAt'), type: 'datetime', required: true },
    { id: 'endAt', label: t('logotherapy.visits.endAt'), type: 'datetime', required: true },
    { id: 'notes', label: t('logotherapy.visits.notes'), type: 'textarea' },
  ], [t])
  return <CrudForm
    title={t('logotherapy.visits.createTitle')}
    backHref="/backend/visits"
    cancelHref="/backend/visits"
    entityId="logotherapy:logotherapy_visit"
    fields={fields}
    submitLabel={t('logotherapy.visits.save')}
    onSubmit={async (values) => { await createCrud('logotherapy/visits', values) }}
  />
}

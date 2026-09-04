"use client"
import * as React from 'react'
import Link from 'next/link'
import type { LegacyColumnDef as ColumnDef } from '@tanstack/react-table/legacy'
import { DataTable } from '@open-mercato/ui/backend/DataTable'
import { Button } from '@open-mercato/ui/primitives/button'
import { fetchCrudList } from '@open-mercato/ui/backend/utils/crud'
import { useT } from '@open-mercato/shared/lib/i18n/context'
import type { VisitRow } from '../types'

type VisitResponse = { items: VisitRow[]; total: number; page: number; pageSize: number; totalPages: number }

export default function VisitsTable() {
  const t = useT()
  const [search, setSearch] = React.useState('')
  const [page, setPage] = React.useState(1)
  const [data, setData] = React.useState<VisitResponse>({ items: [], total: 0, page: 1, pageSize: 50, totalPages: 0 })
  const [loading, setLoading] = React.useState(true)
  const [error, setError] = React.useState<string | null>(null)

  React.useEffect(() => {
    let cancelled = false
    setLoading(true)
    fetchCrudList<VisitRow>('logotherapy/visits', { page, pageSize: 50, search })
      .then((result) => { if (!cancelled) setData(result as VisitResponse) })
      .catch(() => { if (!cancelled) setError(t('logotherapy.visits.loadError', 'Unable to load visits.')) })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [page, search, t])

  const columns = React.useMemo<ColumnDef<VisitRow>[]>(() => [
    { accessorKey: 'therapy_type', header: t('logotherapy.visits.therapyType') },
    { accessorKey: 'customer_id', header: t('logotherapy.visits.customer') },
    { accessorKey: 'employee_id', header: t('logotherapy.visits.employee') },
    { accessorKey: 'resource_id', header: t('logotherapy.visits.room') },
    { accessorKey: 'start_at', header: t('logotherapy.visits.startAt') },
    { accessorKey: 'status', header: t('logotherapy.visits.status') },
  ], [t])

  return <DataTable<VisitRow>
    title={t('logotherapy.visits.title')}
    actions={<Button asChild><Link href="/backend/visits/create">{t('logotherapy.visits.create')}</Link></Button>}
    columns={columns}
    data={data.items}
    entityId="logotherapy:logotherapy_visit"
    searchValue={search}
    onSearchChange={(value) => { setSearch(value); setPage(1) }}
    isLoading={loading}
    error={error}
    pagination={{ page, pageSize: 50, total: data.total, totalPages: data.totalPages, onPageChange: setPage }}
  />
}

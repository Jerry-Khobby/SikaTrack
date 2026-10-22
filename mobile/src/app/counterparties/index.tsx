import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { ScrollView, View } from 'react-native';

import { Card } from '@/components/atoms';
import { CounterpartyRow, EmptyState, ErrorState, FilterChip, SearchField } from '@/components/molecules';
import { DetailTemplate } from '@/components/templates';
import { requestIdOf } from '@/api/query-client';
import { useGoBack } from '@/hooks/use-go-back';
import { useMe } from '@/hooks/use-me';
import { useCounterparties } from '@/hooks/queries';
import type { CounterpartyKind } from '@/services/categories';
import { COUNTERPARTY_KIND_FILTERS } from '@/services/counterparties';
import { formatDayHeader } from '@/utils/dates';
import { formatMoney } from '@/utils/format';

const SEARCH_DELAY_MS = 300;

/** S21 · Everyone: every person and place you've paid, searchable and by kind. */
export default function CounterpartiesScreen() {
  const router = useRouter();
  const goBack = useGoBack('/spending');
  const me = useMe();
  const [search, setSearch] = useState('');
  const [q, setQ] = useState('');
  const [kind, setKind] = useState<CounterpartyKind | null>(null);
  const list = useCounterparties(q, kind);
  const currency = me?.settings.currency ?? '';

  useEffect(() => {
    const timer = setTimeout(() => setQ(search), SEARCH_DELAY_MS);
    return () => clearTimeout(timer);
  }, [search]);

  return (
    <DetailTemplate title="People and places" onBack={goBack} gutter="narrow" refreshing={list.isRefetching} onRefresh={() => list.refetch()}>
      <SearchField value={search} onChangeText={setSearch} placeholder="Search people and shops" />
      <ScrollView horizontal showsHorizontalScrollIndicator={false} className="-mx-4" contentContainerClassName="gap-2 px-4">
        <FilterChip label="All" active={kind === null} onPress={() => setKind(null)} />
        {COUNTERPARTY_KIND_FILTERS.map((filter) => (
          <FilterChip key={filter.kind} label={filter.label} active={kind === filter.kind} onPress={() => setKind(filter.kind)} />
        ))}
      </ScrollView>

      {list.isError ? (
        <ErrorState title="We couldn't load everyone" requestId={requestIdOf(list.error)} onRetry={() => list.refetch()} />
      ) : list.isPending ? (
        <View className="h-[360px] rounded-[20px] bg-skeleton" />
      ) : list.data.length === 0 ? (
        <EmptyState
          icon="search"
          title="Nobody matches"
          message={q ? `No one called "${q}". Try part of the name as the SMS writes it.` : 'Try another kind.'}
        />
      ) : (
        <Card padded={false} className="overflow-hidden">
          {list.data.map((c, index) => (
            <CounterpartyRow
              key={c.id}
              kind={c.kind}
              name={c.name}
              amount={formatMoney(c.moneyOut, currency)}
              detail={`${c.transactions} payment${c.transactions === 1 ? '' : 's'}${c.lastSeenAt ? ` · last paid ${formatDayHeader(c.lastSeenAt)}` : ''}`}
              onPress={() => router.push(`/counterparties/${c.id}`)}
              divider={index < list.data.length - 1}
            />
          ))}
        </Card>
      )}
    </DetailTemplate>
  );
}

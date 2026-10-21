import { useMutation } from '@tanstack/react-query';

import { Button, ThemedText } from '@/components/atoms';
import { InfoCard, InfoNote } from '@/components/molecules';
import { DetailTemplate } from '@/components/templates';
import { useAppConfig } from '@/hooks/use-app-config';
import { useGoBack } from '@/hooks/use-go-back';
import { requestExport } from '@/services/me';

/**
 * Export my data (phase 7). Shows what an export holds and how it arrives. Until
 * the server turns `features.export` on, the request button waits with a note.
 */
export default function ExportScreen() {
  const goBack = useGoBack('/more');
  const config = useAppConfig();
  const request = useMutation({ mutationFn: requestExport });
  const available = config?.features.export === true;

  return (
    <DetailTemplate
      title="Export my data"
      onBack={goBack}
      footer={
        request.isSuccess ? (
          <Button variant="secondary" label="Done" onPress={goBack} />
        ) : (
          <Button
            label={available ? 'Request my export' : 'Coming soon'}
            onPress={() => request.mutate()}
            disabled={!available}
            loading={request.isPending}
          />
        )
      }>
      <ThemedText type="bodySmall" themeColor="textSecondary" className="mb-1">
        A copy of everything SikaTrack has built from your MoMo SMS, to keep or to open in a spreadsheet.
      </ThemedText>
      <InfoCard icon="list" title="Your transactions" body="Every payment in and out, as a CSV file: date, amount, fees, who, category and your notes." />
      <InfoCard icon="sliders" title="Your settings" body="Your wallets, budgets, names and categories you chose, as a JSON file." />
      <InfoCard
        icon="bell"
        title="How you get it"
        body="We put it together in the background and send you a notification with a download link. The link stops working after a while, so download it soon."
      />
      {!available && (
        <InfoNote
          tone="warning"
          icon="clock"
          text="Export isn't ready yet. We're still building it, and this button will work as soon as it is."
        />
      )}
      {request.isSuccess && (
        <InfoNote icon="check" text="We're preparing your export. You'll get a notification with the download link." />
      )}
      {request.isError && <InfoNote tone="warning" icon="alert" text="We couldn't ask for your export. Try again in a moment." />}
    </DetailTemplate>
  );
}

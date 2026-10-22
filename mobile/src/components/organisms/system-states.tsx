import { useQueryClient } from '@tanstack/react-query';
import { useEffect, useRef, useState } from 'react';
import { View } from 'react-native';

import { clearSession } from '@/api/session';
import { onSystemEvent } from '@/api/system-events';
import { Toast } from '@/components/molecules';
import { meQueryKey } from '@/hooks/use-me';
import { requestOtp } from '@/services/auth';
import type { Me } from '@/services/me';
import { formatPhoneNumber } from '@/utils/phone';

import { ServiceUnavailable } from './service-unavailable';
import { SessionExpiredDialog } from './session-expired-dialog';

export type SystemStatesProps = {
  /** G6: any call said this version is too old. */
  onUpdateRequired: () => void;
  /** G2: a new code went to the number; open S05 with these. */
  onCodeSent: (params: { phoneNumber: string; otpRequestId: string; expiresIn: string; resendAfter: string }) => void;
  onUseAnotherNumber: () => void;
};

const TOAST_MS = 4000;

/**
 * The app-wide states from docs/ui-spec.md §11, over whatever screen is open:
 * G2 session expired, G4 slow down, G5 servers away, G6 update required.
 * G1 (offline) is the banner the templates show. Mount it once, at the root.
 */
export function SystemStates({ onUpdateRequired, onCodeSent, onUseAnotherNumber }: SystemStatesProps) {
  const client = useQueryClient();
  const [session, setSession] = useState<{ phoneNumber: string | null } | null>(null);
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState<string>();
  const [toast, setToast] = useState<string | null>(null);
  const [unavailable, setUnavailable] = useState(false);
  const [retrying, setRetrying] = useState(false);
  const toastTimer = useRef<ReturnType<typeof setTimeout>>(undefined);

  useEffect(
    () =>
      onSystemEvent((event) => {
        switch (event.type) {
          case 'session_expired':
            setSession((current) => {
              if (current) return current;
              // Keep the number for "We'll text a new code to …", then forget the account.
              const phoneNumber = client.getQueryData<Me>(meQueryKey)?.phoneNumber ?? null;
              clearSession();
              client.clear();
              return { phoneNumber };
            });
            break;
          case 'rate_limited':
            clearTimeout(toastTimer.current);
            setToast(`Slow down a little. Try again in ${event.retryAfter} seconds.`);
            toastTimer.current = setTimeout(() => setToast(null), TOAST_MS);
            break;
          case 'unavailable':
            setUnavailable(true);
            break;
          case 'update_required':
            onUpdateRequired();
            break;
        }
      }),
    [client, onUpdateRequired],
  );

  useEffect(() => () => clearTimeout(toastTimer.current), []);

  const sendCode = async () => {
    if (!session?.phoneNumber) return;
    setSending(true);
    setSendError(undefined);
    try {
      const request = await requestOtp(session.phoneNumber);
      setSession(null);
      onCodeSent({
        phoneNumber: session.phoneNumber,
        otpRequestId: request.otpRequestId,
        expiresIn: String(request.expiresIn),
        resendAfter: String(request.resendAfter),
      });
    } catch {
      setSendError("We couldn't send a code. Try again.");
    } finally {
      setSending(false);
    }
  };

  const retry = async () => {
    setRetrying(true);
    await client.refetchQueries({ type: 'active' });
    setRetrying(false);
    // Stays up while a screen still has nothing to show.
    const stillDown = client
      .getQueryCache()
      .findAll({ type: 'active' })
      .some((query) => query.state.status === 'error' && query.state.data === undefined);
    setUnavailable(stillDown);
  };

  return (
    <>
      {toast && (
        <View pointerEvents="none" className="absolute inset-x-4 bottom-24">
          <Toast icon="clock" message={toast} />
        </View>
      )}
      {unavailable && !session && (
        <ServiceUnavailable retrying={retrying} onRetry={retry} onDismiss={() => setUnavailable(false)} />
      )}
      {session && (
        <SessionExpiredDialog
          phoneNumber={session.phoneNumber ? formatPhoneNumber(session.phoneNumber) : null}
          sending={sending}
          error={sendError}
          onSendCode={sendCode}
          onUseAnotherNumber={() => {
            setSession(null);
            onUseAnotherNumber();
          }}
        />
      )}
    </>
  );
}

import { Linking } from 'react-native';

import { Button } from '@/components/atoms';
import { MessageTemplate } from '@/components/templates';
import { PLAY_STORE_URL } from '@/services/launch';

/** S02 · Update required. There is no way past it. */
export default function UpdateRequiredScreen() {
  return (
    <MessageTemplate
      icon="phone-update"
      title="Time for an update"
      message="This version of SikaTrack no longer works with our servers."
      action={<Button label="Update on Play Store" onPress={() => Linking.openURL(PLAY_STORE_URL)} />}
    />
  );
}

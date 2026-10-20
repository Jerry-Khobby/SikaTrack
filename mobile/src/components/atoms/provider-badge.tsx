import { Text, View } from 'react-native';

import { ProviderBrands } from '@/theme';

export type ProviderBadgeProps = {
  /** The provider `code` from the server config, e.g. `mtn_momo`. */
  code: string;
  /** Its display name, used for the initials when the brand isn't known. */
  name: string;
  size?: number;
  muted?: boolean;
  /** `tile`: a square. `tag`: a short inline label, as in transaction rows. */
  variant?: 'tile' | 'tag';
};

function initials(name: string) {
  return name
    .split(/\s+/)
    .map((word) => word[0])
    .join('')
    .slice(0, 3)
    .toUpperCase();
}

/** A wallet provider's small coloured tile, the one place its brand colour appears. */
export function ProviderBadge({ code, name, size = 36, muted, variant = 'tile' }: ProviderBadgeProps) {
  const brand = muted ? undefined : ProviderBrands[code];
  const tag = variant === 'tag';

  return (
    <View
      accessible={false}
      className={`items-center justify-center ${brand ? '' : 'bg-line'}`}
      style={[
        tag
          ? { height: size, paddingHorizontal: 5, borderRadius: 4 }
          : { width: size, height: size, borderRadius: Math.round(size * 0.28) },
        brand ? { backgroundColor: brand.background } : null,
      ]}>
      <Text
        className={`font-sans-extrabold ${brand ? '' : 'text-content-disabled'}`}
        style={[
          { fontSize: tag ? Math.round(size * 0.56) : Math.max(8, Math.round(size * 0.3)) },
          brand ? { color: brand.text } : null,
        ]}>
        {brand?.short ?? initials(name)}
      </Text>
    </View>
  );
}

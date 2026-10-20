import { ThemedText } from '@/components/atoms';

export type ScreenTitleProps = {
  title: string;
};

/** A tab's big title, e.g. "Transactions". */
export function ScreenTitle({ title }: ScreenTitleProps) {
  return (
    <ThemedText type="none" accessibilityRole="header" className="mb-3 ml-1 font-sans-extrabold text-[24px] leading-[30px]">
      {title}
    </ThemedText>
  );
}

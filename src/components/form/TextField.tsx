import { TextInput, type TextInputProps } from 'react-native';

import { useAppTheme } from '../../theme';

type TextFieldProps = TextInputProps & {
  /** Draws the border in the error colour. */
  invalid?: boolean;
  className?: string;
};

/** Single-line text input in the app's style. */
export function TextField({ invalid = false, className = '', ...rest }: TextFieldProps) {
  const { palette } = useAppTheme();
  return (
    <TextInput
      placeholderTextColor={palette.placeholder}
      {...rest}
      className={`h-11 rounded-xl border bg-white px-3.5 text-sm text-slate-900 outline-none dark:bg-white/5 dark:text-slate-100 ${
        invalid
          ? 'border-rose-400 dark:border-rose-400/70'
          : 'border-slate-200 focus:border-indigo-400 dark:border-white/15 dark:focus:border-indigo-400'
      } ${className}`}
    />
  );
}

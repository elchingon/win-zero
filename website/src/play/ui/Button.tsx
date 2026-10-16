// Buttons from the prototype: amber primary with the amber-deep ledge that presses down, ghost
// outline, a flare variant for destructive actions, and an underlined text link.
import type { ReactNode } from 'react';
import { Link } from 'react-router';

type Variant = 'primary' | 'ghost' | 'danger';

function classes(variant: Variant, small?: boolean, extra?: string): string {
  return `btn btn-${variant}${small ? ' small' : ''}${extra ? ` ${extra}` : ''}`;
}

export function Button(props: {
  label: string;
  onPress: () => void;
  variant?: Variant;
  small?: boolean;
  disabled?: boolean;
  hint?: string;
  className?: string;
}) {
  const { label, onPress, variant = 'primary', small, disabled, hint, className } = props;
  return (
    <button
      type="button"
      className={classes(variant, small, className)}
      disabled={disabled}
      title={hint}
      onClick={onPress}
    >
      {label}
    </button>
  );
}

/** A button-looking link to another screen of the app. */
export function ButtonLink(props: { label: string; to: string; variant?: Variant; small?: boolean; className?: string }) {
  return (
    <Link className={classes(props.variant ?? 'primary', props.small, props.className)} to={props.to}>
      {props.label}
    </Link>
  );
}

export function LinkButton(props: { label: string; onPress: () => void; tone?: 'flare'; hint?: string; children?: ReactNode }) {
  return (
    <button type="button" className={`link-btn${props.tone ? ` tone-${props.tone}` : ''}`} title={props.hint} onClick={props.onPress}>
      {props.children ?? props.label}
    </button>
  );
}

/** An underlined text link to another screen of the app. */
export function TextLink(props: { label: string; to: string }) {
  return (
    <Link className="link-btn" to={props.to}>
      {props.label}
    </Link>
  );
}

// Small pieces from the prototype CSS, as on the app: eyebrow labels, chips, stat tiles, cards,
// form fields and setting rows.
import { useId, type ReactNode } from 'react';
import { Link } from 'react-router';

/** A small uppercase label. `header` makes it a heading, for screen readers' heading navigation. */
export function Eyebrow({ children, header, className }: { children: ReactNode; header?: boolean; className?: string }) {
  const cls = `eyebrow${className ? ` ${className}` : ''}`;
  return header ? <h2 className={cls}>{children}</h2> : <p className={cls}>{children}</p>;
}

export function Fine({ children, tone, center }: { children: ReactNode; tone?: 'flare'; center?: boolean }) {
  return <p className={`fine${tone ? ` tone-${tone}` : ''}${center ? ' center' : ''}`}>{children}</p>;
}

export function Lede({ children }: { children: ReactNode }) {
  return <p className="lede">{children}</p>;
}

/** Amber emphasis inside a heading, like the prototype's h1 em. */
export function Em({ children, tone = 'amber' }: { children: ReactNode; tone?: 'amber' | 'teal' }) {
  return <em className={`em tone-${tone}`}>{children}</em>;
}

export function Chip(props: { label: string; selected: boolean; onPress: () => void }) {
  return (
    <button type="button" className={`chip${props.selected ? ' on' : ''}`} aria-pressed={props.selected} onClick={props.onPress}>
      {props.label}
    </button>
  );
}

/** A number with its label, and an optional caption under it (say, the dates it covers). */
export function StatTile(props: { label: string; value: string; hero?: boolean; caption?: string; spoken?: string }) {
  const spoken = props.spoken ?? `${props.label}: ${props.value}${props.caption ? `, ${props.caption}` : ''}`;
  return (
    <div className="stat" role="group" aria-label={spoken}>
      <span className="stat-label" aria-hidden="true">
        {props.label}
      </span>
      <span className={`stat-value${props.hero ? ' hero' : ''}`} aria-hidden="true">
        {props.value}
      </span>
      {props.caption ? (
        <span className="fine stat-caption" aria-hidden="true">
          {props.caption}
        </span>
      ) : null}
    </div>
  );
}

export function Card({ children, tone, className }: { children: ReactNode; tone?: 'flare'; className?: string }) {
  return <div className={`card${tone ? ` tone-${tone}` : ''}${className ? ` ${className}` : ''}`}>{children}</div>;
}

/** A labelled field. The label is tied to the control rendered by `children(id)`. */
export function Field(props: { label: string; hint?: string; error?: string | null; children: (id: string, describedBy?: string) => ReactNode }) {
  const id = useId();
  const noteId = `${id}-note`;
  const note = props.error ?? props.hint;
  return (
    <div className="field">
      <label className="eyebrow" htmlFor={id}>
        {props.label}
      </label>
      {props.children(id, note ? noteId : undefined)}
      {note ? (
        <p id={noteId} className={`fine${props.error ? ' tone-flare' : ''}`}>
          {note}
        </p>
      ) : null}
    </div>
  );
}

/** An on/off setting, shown as a switch. */
export function ToggleRow(props: { label: string; detail?: string; value: boolean; onChange: (v: boolean) => void }) {
  const id = useId();
  return (
    <div className="row">
      <div className="row-text">
        <label className="row-label" htmlFor={id}>
          {props.label}
        </label>
        {props.detail ? (
          <span className="row-detail" id={`${id}-detail`}>
            {props.detail}
          </span>
        ) : null}
      </div>
      <input
        id={id}
        type="checkbox"
        role="switch"
        className="switch"
        checked={props.value}
        aria-describedby={props.detail ? `${id}-detail` : undefined}
        onChange={(e) => props.onChange(e.target.checked)}
      />
    </div>
  );
}

/** A plain settings row: label and detail on the left, anything on the right. */
export function Row(props: { label: string; detail?: string; right?: ReactNode }) {
  return (
    <div className="row">
      <div className="row-text">
        <span className="row-label">{props.label}</span>
        {props.detail ? <span className="row-detail">{props.detail}</span> : null}
      </div>
      {props.right}
    </div>
  );
}

/**
 * A settings row that is itself a link: `to` for another screen of the app, `href` for the
 * site's pages, phone numbers and email.
 */
export function LinkRow(props: { label: string; detail?: string; action: string; to?: string; href?: string; hint?: string }) {
  const body = (
    <>
      <span className="row-text">
        <span className="row-label">{props.label}</span>
        {props.detail ? <span className="row-detail">{props.detail}</span> : null}
      </span>
      <span className="row-action" aria-hidden="true">
        {props.action}
      </span>
    </>
  );
  const label = `${props.label}${props.detail ? `. ${props.detail}` : ''}${props.hint ? `. ${props.hint}` : ''}`;
  return props.to ? (
    <Link className="row row-link" to={props.to} aria-label={label}>
      {body}
    </Link>
  ) : (
    <a className="row row-link" href={props.href} aria-label={label}>
      {body}
    </a>
  );
}

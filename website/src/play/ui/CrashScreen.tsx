// What a render crash shows instead of a blank page: plain words that nothing is lost, and one
// way back.
import { Em, Eyebrow, Lede } from './bits';
import { Button } from './Button';
import { Screen } from './Screen';

export function CrashScreen(props: {
  eyebrow: string;
  title: [before: string, em: string];
  body: string[];
  action: string;
  onAction: () => void;
  error?: unknown;
}) {
  const { eyebrow, title, body, action, onAction, error } = props;
  return (
    <Screen centered>
      <div className="block">
        <Eyebrow>{eyebrow}</Eyebrow>
        <h1 className="h2">
          {title[0]}
          <Em>{title[1]}</Em>
        </h1>
      </div>
      <div className="block">
        {body.map((line) => (
          <Lede key={line}>{line}</Lede>
        ))}
      </div>
      <Button label={action} onPress={onAction} />
      {import.meta.env.DEV && error instanceof Error ? <p className="fine">{error.message}</p> : null}
    </Screen>
  );
}

// How it works: the rules in plain words, shared with the phone app (without its lines about
// notifications), plus what's different on the web.
import { howItWorks } from '@/ui/copy/rules';

import { ROUTES } from '../nav';
import { Em, Lede } from '../ui/bits';
import { TextLink } from '../ui/Button';
import { Screen } from '../ui/Screen';
import { TopBar } from '../ui/TopBar';

const SECTIONS = [
  ...howItWorks({ notifications: false }),
  {
    title: 'On the web',
    body: [
      "Your progress stays in this browser. It doesn't sync with the phone app or with other browsers, and clearing this site's data erases it.",
      "The website can't send reminders, so come back at your check-in time. The phone app can remind you.",
    ],
  },
];

export function HowItWorks() {
  return (
    <Screen>
      <TopBar right={<TextLink label="Done" to={ROUTES.settings} />} />
      <h1 className="h2">
        How it <Em>works</Em>
      </h1>
      {SECTIONS.map((s) => (
        <section key={s.title} className="section">
          <h2 className="question">{s.title}</h2>
          <div className="stack-sm">
            {s.body.map((line) => (
              <Lede key={line}>{line}</Lede>
            ))}
          </div>
        </section>
      ))}
    </Screen>
  );
}

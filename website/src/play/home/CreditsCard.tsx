// Home's credits, as on the app: how many Game and Weapon credits there are, the bonus round
// waiting to be played or a way to start one, and a hint on each count that opens what the credit
// is, how it's used and how to earn one. Choosing a bonus round's size opens a form in place: a
// number, or one of a few ready-made sizes, then Start.
import { useId, useState } from 'react';

import { BONUS_MAX_N, type CreditKind, type CreditWallet, type GoalState } from '@/engine';
import { formatCount, parseCount } from '@/lib/format';
import type { BonusRound } from '@/store/types';
import {
  BONUS_DEFAULT_N,
  BONUS_PRESETS,
  BONUS_SHEET,
  creditCount,
  creditHelp,
  CREDITS_HELP,
  CREDITS_HOME,
  type CreditHelp,
} from '@/ui/copy/credits';

import { Card, Chip, Eyebrow, Field, Fine, Lede, StatTile } from '../ui/bits';
import { Button } from '../ui/Button';
import { Popup } from '../ui/Popup';

export function CreditsCard(props: {
  goal: GoalState;
  credits: CreditWallet;
  bonus: BonusRound | null;
  /** Spend a Game credit on a bonus round of `n` zeros and open it. */
  onStartBonus: (n: number) => void;
  /** Open the bonus round already paid for. */
  onPlayBonus: () => void;
}) {
  const { goal, credits, bonus, onStartBonus, onPlayBonus } = props;
  const [choosing, setChoosing] = useState(false);
  const [hint, setHint] = useState<CreditKind | null>(null);
  const { game, weapon } = credits.balance;
  const ready = bonus && !bonus.played ? bonus : null;
  const help = hint ? creditHelp(hint, credits, goal.bestStreak, ready !== null) : null;
  const helpFor = (kind: CreditKind) => ({ label: CREDITS_HELP.button(kind), onPress: () => setHint(kind) });

  return (
    <section className="section" aria-labelledby="credits-title">
      <Eyebrow header>
        <span id="credits-title">{CREDITS_HOME.title}</span>
      </Eyebrow>
      <div className="stats">
        <StatTile
          label={CREDITS_HELP.title.game}
          value={String(game)}
          spoken={creditCount('game', game)}
          help={helpFor('game')}
        />
        <StatTile
          label={CREDITS_HELP.title.weapon}
          value={String(weapon)}
          spoken={creditCount('weapon', weapon)}
          help={helpFor('weapon')}
        />
      </div>
      {ready ? (
        <Card>
          <p className="card-title">{CREDITS_HOME.bonusReady(ready.n)}</p>
          <Lede>{CREDITS_HOME.bonusReadyLede}</Lede>
          <Button label={CREDITS_HOME.playBonusNow} onPress={onPlayBonus} />
        </Card>
      ) : game > 0 && choosing ? (
        <BonusRoundForm
          onCancel={() => setChoosing(false)}
          onStart={(n) => {
            setChoosing(false);
            onStartBonus(n);
          }}
        />
      ) : game > 0 ? (
        <Button label={CREDITS_HOME.playBonus} variant="ghost" hint={CREDITS_HOME.playBonusHint} onPress={() => setChoosing(true)} />
      ) : null}
      {help ? <CreditHelpPopup help={help} onClose={() => setHint(null)} /> : null}
    </section>
  );
}

/** What a credit count's hint says, as on the app: what it is, where things stand, how to earn one. */
function CreditHelpPopup({ help, onClose }: { help: CreditHelp; onClose: () => void }) {
  const title = useId();
  return (
    <Popup onDismiss={onClose} labelledBy={title} fixed>
      <h2 id={title} className="popup-title">
        {help.title}
      </h2>
      <div className="hint-body">
        {help.lines.map((line) => (
          <p key={line} className="hint-line">
            {line}
          </p>
        ))}
        {help.status ? <p className="hint-line hint-status">{help.status}</p> : null}
        <Eyebrow>{CREDITS_HELP.earnTitle}</Eyebrow>
        <ul className="hint-ways">
          {help.ways.map((way) => (
            <li key={way.label} className={`hint-way${way.earned ? ' earned' : ''}`}>
              <span className="hint-ring" aria-hidden="true" />
              <span className="hint-way-label">{way.label}</span>
              {way.earned ? <span className="hint-earned">{CREDITS_HELP.earned}</span> : null}
            </li>
          ))}
        </ul>
        <Fine>{CREDITS_HELP.footer}</Fine>
      </div>
      <Button label={CREDITS_HELP.close} onPress={onClose} />
    </Popup>
  );
}

function BonusRoundForm({ onStart, onCancel }: { onStart: (n: number) => void; onCancel: () => void }) {
  const [text, setText] = useState(String(BONUS_DEFAULT_N));
  const n = parseCount(text, BONUS_MAX_N);
  return (
    <Card>
      <form
        className="form"
        aria-label={BONUS_SHEET.title}
        onSubmit={(e) => {
          e.preventDefault();
          if (n) onStart(n);
        }}
        onKeyDown={(e) => {
          if (e.key === 'Escape') onCancel();
        }}
      >
        <p className="card-title">{BONUS_SHEET.title}</p>
        <Field label={BONUS_SHEET.field} hint={BONUS_SHEET.hint} error={n ? null : BONUS_SHEET.invalid}>
          {(id, describedBy) => (
            <input
              id={id}
              className="input"
              inputMode="numeric"
              autoComplete="off"
              maxLength={String(BONUS_MAX_N).length}
              value={text}
              onChange={(e) => setText(e.target.value)}
              aria-describedby={describedBy}
              aria-invalid={!n}
              // The form opens on a tap of Play a bonus round, so the field is where to type next.
              autoFocus
            />
          )}
        </Field>
        <div className="chips">
          {BONUS_PRESETS.map((p) => (
            <Chip key={p} label={formatCount(p)} selected={n === p} onPress={() => setText(String(p))} />
          ))}
        </div>
        <div className="pair">
          <Button label={BONUS_SHEET.cancel} variant="ghost" onPress={onCancel} />
          <button type="submit" className="btn btn-primary" disabled={!n} title={BONUS_SHEET.startHint}>
            {BONUS_SHEET.start}
          </button>
        </div>
      </form>
    </Card>
  );
}

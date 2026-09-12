// The emoji and stakes pickers shared by New circle and Edit circle.
import { FORFEIT_PRESETS, GROUP_EMOJI } from '@/lib/groups';
import { Chip, Input, Txt } from '@/ui';

/** A preset string, 'custom' (text in `custom`), or null for no stakes. */
export type StakeChoice = string | 'custom' | null;

export function stakeText(stake: StakeChoice, custom: string): string | null {
  return stake === 'custom' ? custom.trim() || null : stake;
}

/** Split a stored forfeit_text back into the picker's state. */
export function stakeFromText(text: string | null): { stake: StakeChoice; custom: string } {
  if (!text) return { stake: null, custom: '' };
  if ((FORFEIT_PRESETS as readonly string[]).includes(text)) return { stake: text, custom: '' };
  return { stake: 'custom', custom: text };
}

export function EmojiField({ value, onChange }: { value: string | null; onChange: (v: string | null) => void }) {
  return (
    <div className="flex flex-col gap-1.5">
      <Txt variant="footnote" tone="secondary" weight={600}>
        Emoji
      </Txt>
      <div className="flex gap-2 flex-wrap">
        {GROUP_EMOJI.map((e) => (
          <Chip key={e} label={e} selected={value === e} onClick={() => onChange(value === e ? null : e)} />
        ))}
      </div>
    </div>
  );
}

export function StakesField({ stake, custom, onStake, onCustom }: { stake: StakeChoice; custom: string; onStake: (v: StakeChoice) => void; onCustom: (v: string) => void }) {
  return (
    <div className="flex flex-col gap-1.5">
      <Txt variant="footnote" tone="secondary" weight={600}>
        Stakes
      </Txt>
      <div className="flex gap-2 flex-wrap">
        {FORFEIT_PRESETS.map((p) => (
          <Chip key={p} label={p} selected={stake === p} onClick={() => onStake(p)} />
        ))}
        <Chip label="Custom" selected={stake === 'custom'} onClick={() => onStake('custom')} />
        <Chip label="No stakes" selected={stake === null} onClick={() => onStake(null)} />
      </div>
      {stake === 'custom' ? <Input value={custom} onChange={(e) => onCustom(e.target.value.slice(0, 80))} placeholder="e.g. carries everyone's bags to class" autoFocus /> : null}
    </div>
  );
}

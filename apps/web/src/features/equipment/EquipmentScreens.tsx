import { Plural, Trans, useLingui } from '@lingui/react/macro';
import { Link, useNavigate } from '@tanstack/react-router';
import { Plus, Star } from 'lucide-react';
import { useEffect, useState } from 'react';

import type { AffectedSlot, EquipmentProfileError } from '@powr/application/planning';
import type { EquipmentProfile, PresetId } from '@powr/domain';

import { ActionBar } from '#ui/action-bar';
import { Badge, Callout } from '#ui/badge';
import { Button, buttonClass } from '#ui/button';
import { ChoiceCards } from '#ui/choice';
import { Card, Screen } from '#ui/screen';
import { Sheet } from '#ui/sheet';
import { UnsavedChangesGuard } from '#ui/unsaved-changes';

import {
  useActivePlan,
  useCatalog,
  useEquipmentProfiles,
  usePlanning,
  useProfile,
} from '../../hooks/use-planning';
import { EquipmentEditor } from './EquipmentEditor';
import { itemCount, sameEquipment } from './inventory';
import { SubstitutionReview, type Substitution } from './SubstitutionReview';

/** Settings → Equipment: the profiles (default, rename, delete) and adding one from a preset. */
export function EquipmentListScreen({ saved }: { saved?: 'equipment' | 'plan' | undefined }) {
  const { t } = useLingui();
  const profiles = useEquipmentProfiles();
  const plan = useActivePlan();
  const run = usePlanning();
  const navigate = useNavigate();
  const [adding, setAdding] = useState(false);
  const [deleting, setDeleting] = useState<EquipmentProfile | null>(null);
  const [message, setMessage] = useState<string | null>(
    saved === 'plan'
      ? t`Equipment saved and your plan updated.`
      : saved === 'equipment'
        ? t`Equipment saved.`
        : null,
  );

  const errorText = (error: EquipmentProfileError) =>
    error.kind === 'inUse'
      ? t`Your active plan uses this equipment. Make another profile the plan's equipment first.`
      : error.kind === 'lastProfile'
        ? t`You need at least one equipment profile.`
        : t`This profile no longer exists.`;

  return (
    <Screen title={t`Equipment`}>
      <p className="text-fg-muted">
        <Trans>Plans and exercise suggestions only use what your default equipment has.</Trans>
      </p>
      <output className="block empty:hidden">{message}</output>
      {profiles.loaded && profiles.value.length === 0 ? (
        <Card>
          <p>
            <Trans>No equipment yet. Add what your gym has.</Trans>
          </p>
        </Card>
      ) : null}
      <ul className="flex flex-col gap-3">
        {(profiles.loaded ? profiles.value : []).map((profile) => (
          <li key={profile.id}>
            <Card>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h2 className="text-lg font-bold">{profile.name}</h2>
                {profile.isDefault ? (
                  <Badge tone="ok" icon={Star}>
                    {t`Default`}
                  </Badge>
                ) : null}
              </div>
              <p className="text-fg-muted">
                <Plural value={itemCount(profile)} one="# item" other="# items" />
                {plan.loaded && plan.value?.equipmentProfileId === profile.id ? (
                  <>
                    {' · '}
                    <Trans>used by your plan</Trans>
                  </>
                ) : null}
              </p>
              <div className="flex flex-wrap gap-2">
                <Link
                  to="/settings/equipment/$profileId"
                  params={{ profileId: profile.id }}
                  className={buttonClass({ variant: 'primary' })}
                  aria-label={t`Edit ${profile.name}`}
                >
                  <Trans>Edit</Trans>
                </Link>
                {profile.isDefault ? null : (
                  <Button
                    onClick={() =>
                      void run((planning, deps) =>
                        planning.setDefaultEquipmentProfile(deps, profile.id),
                      ).then(() => setMessage(t`${profile.name} is now your default equipment.`))
                    }
                  >
                    <Trans>Make default</Trans>
                  </Button>
                )}
                <Button variant="ghost" onClick={() => setDeleting(profile)}>
                  <Trans>Delete</Trans>
                </Button>
              </div>
            </Card>
          </li>
        ))}
      </ul>
      <Button size="lg" onClick={() => setAdding(true)}>
        <Plus aria-hidden="true" />
        <Trans>Add equipment</Trans>
      </Button>

      <Sheet
        open={adding}
        onOpenChange={setAdding}
        title={t`Start from a preset`}
        closeLabel={t`Close`}
      >
        <PresetPicker
          onPick={(presetId) => {
            setAdding(false);
            void navigate({
              to: '/settings/equipment/$profileId',
              params: { profileId: 'new' },
              search: { preset: presetId },
            });
          }}
        />
      </Sheet>

      <Sheet
        open={deleting !== null}
        onOpenChange={(open) => (open ? null : setDeleting(null))}
        title={t`Delete ${deleting?.name ?? ''}?`}
        closeLabel={t`Close`}
      >
        <p>
          <Trans>Your logged training stays. This only removes the equipment list.</Trans>
        </p>
        <Button
          variant="danger"
          size="lg"
          onClick={() => {
            const target = deleting;
            if (!target) return;
            void run((planning, deps) => planning.deleteEquipmentProfile(deps, target.id)).then(
              (result) => {
                setDeleting(null);
                setMessage(result.ok ? t`${target.name} deleted.` : errorText(result.error));
              },
            );
          }}
        >
          <Trans>Delete</Trans>
        </Button>
        <Button size="lg" onClick={() => setDeleting(null)}>
          <Trans>Cancel</Trans>
        </Button>
      </Sheet>
    </Screen>
  );
}

/** EQP-02: the six presets; one tap to pick, one to confirm (≤ 3 taps). */
export function PresetPicker({
  onPick,
  initial = null,
  confirmLabel,
}: {
  onPick: (presetId: PresetId) => void;
  initial?: PresetId | null;
  confirmLabel?: string;
}) {
  const { t } = useLingui();
  const presets = useCatalog().equipment().presets;
  const [value, setValue] = useState<PresetId | null>(initial);
  return (
    <div className="flex flex-col gap-3">
      <ChoiceCards<PresetId>
        legend={t`Where do you train?`}
        value={value}
        onChange={setValue}
        options={presets.map((preset) => ({
          value: preset.id,
          label: preset.name.en,
          description: preset.description.en,
        }))}
      />
      <Button
        variant="primary"
        size="lg"
        disabled={value === null}
        onClick={() => (value ? onPick(value) : undefined)}
      >
        {confirmLabel ?? t`Use this preset`}
      </Button>
    </div>
  );
}

/** Edit one profile; a change that affects the active plan goes through EQP-05's review. */
export function EquipmentEditScreen({
  profileId,
  presetId,
}: {
  profileId: string;
  presetId: PresetId | undefined;
}) {
  const { t } = useLingui();
  const profiles = useEquipmentProfiles();
  const user = useProfile();
  const plan = useActivePlan();
  const run = usePlanning();
  const navigate = useNavigate();
  // The user's edits; until the first edit, the stored profile (or the new one) is the draft.
  const [edited, setDraft] = useState<EquipmentProfile | null>(null);
  const [created, setCreated] = useState<EquipmentProfile | null>(null);
  const [review, setReview] = useState<readonly AffectedSlot[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const ready = profiles.loaded && user.loaded;
  const stored = profiles.loaded
    ? profiles.value.find((profile) => profile.id === profileId)
    : undefined;
  const isFirst = profiles.loaded && profiles.value.length === 0;
  const unit = user.loaded ? (user.value?.units.load ?? 'kg') : 'kg';
  const newName = t`My equipment`;
  const draft = edited ?? (profileId === 'new' ? created : (stored ?? null));
  // A new profile starts from a preset (EQP-02), built by the use case once the data is there.
  useEffect(() => {
    if (!ready || profileId !== 'new' || created !== null) return undefined;
    let cancelled = false;
    void run((planning, deps) =>
      planning.equipmentProfileFromPreset(deps, {
        presetId: presetId ?? ('preset.custom' as PresetId),
        unit,
        name: newName,
      }),
    ).then((result) => {
      if (!cancelled && result.ok) setCreated({ ...result.value, isDefault: isFirst });
    });
    return () => {
      cancelled = true;
    };
  }, [ready, created, profileId, run, presetId, unit, newName, isFirst]);

  const dayName = (dayKey: string) =>
    (plan.loaded ? plan.value : undefined)?.mesocycles
      .flatMap((mesocycle) => mesocycle.days)
      .find((day) => day.key === dayKey)?.name.en ?? dayKey;

  // Saved: leaving loses nothing, so the unsaved-changes guard does not ask.
  const done = (saved: 'equipment' | 'plan') =>
    void navigate({ to: '/settings/equipment', search: { saved }, ignoreBlocker: true });
  // PWA-12, TD-68 (M6c): a change the user made and has not saved.
  const base = profileId === 'new' ? created : (stored ?? null);
  const unsaved = edited !== null && !sameEquipment(edited, base);
  const guard = (
    <UnsavedChangesGuard
      when={unsaved}
      description={t`Your changes to this equipment are not saved. If you leave now, they are lost.`}
    />
  );

  const save = async () => {
    if (!draft) return;
    setBusy(true);
    setError(null);
    const preview = await run((planning, deps) => planning.previewEquipmentChange(deps, draft));
    if (preview.affected.length > 0) {
      setReview(preview.affected);
      setBusy(false);
      return;
    }
    const saved = await run((planning, deps) => planning.saveEquipmentProfile(deps, draft));
    setBusy(false);
    if (saved.ok) done('equipment');
    else setError(t`Check the highlighted fields: every item needs a name.`);
  };

  const apply = async (substitutions: Substitution[]) => {
    if (!draft) return;
    setBusy(true);
    const result = await run((planning, deps) =>
      planning.applyEquipmentChange(deps, { profile: draft, substitutions }),
    );
    setBusy(false);
    if (result.ok) done('plan');
    else setError(t`The plan could not be updated. Try again from the plan editor.`);
  };

  if (review) {
    return (
      <Screen title={t`Review plan changes`}>
        {guard}
        <SubstitutionReview
          affected={review}
          dayName={dayName}
          busy={busy}
          onApply={(substitutions) => void apply(substitutions)}
          onCancel={() => setReview(null)}
        />
      </Screen>
    );
  }

  return (
    <Screen title={profileId === 'new' ? t`New equipment` : t`Edit equipment`}>
      {guard}
      {draft ? (
        <>
          {error ? <Callout tone="danger">{error}</Callout> : null}
          <EquipmentEditor profile={draft} onChange={setDraft} />
          <ActionBar>
            <Button variant="primary" size="lg" disabled={busy} onClick={() => void save()}>
              <Trans>Save equipment</Trans>
            </Button>
            <Link to="/settings/equipment" className={buttonClass({ size: 'lg' })}>
              <Trans>Cancel</Trans>
            </Link>
          </ActionBar>
        </>
      ) : (
        <p className="text-fg-muted">
          {profiles.loaded && profileId !== 'new' ? (
            <Trans>This equipment profile does not exist.</Trans>
          ) : (
            <Trans>Loading…</Trans>
          )}
        </p>
      )}
    </Screen>
  );
}

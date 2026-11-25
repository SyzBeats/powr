import { Trans } from '@lingui/react/macro';

import { LEGAL_DETAILS } from '../publisher';
import { Bullets, EmailLink, Section } from './parts';

/**
 * The health and safety notice in full (LEG-01, PRD §8.1). Plain language and a calm tone
 * (MOT-10); no medical claims (LEG-07): POWR gives general fitness information and does not
 * diagnose, treat or prevent anything. A draft for the legal review (V-05, V-06).
 */
export function DisclaimerText() {
  return (
    <>
      <Section title={<Trans>What POWR is, and what it is not</Trans>}>
        <p>
          <Trans>
            POWR is a training planner and log for healthy people aged 16 and over. It gives general
            fitness information and training suggestions based on published research and on what you
            enter.
          </Trans>
        </p>
        <p>
          <Trans>
            POWR is not medical advice. It does not diagnose, treat or prevent any illness or
            injury, and it does not replace a doctor, physiotherapist, dietitian or qualified coach.
          </Trans>
        </p>
      </Section>

      <Section title={<Trans>Before you start</Trans>}>
        <p>
          <Trans>
            Talk to a doctor before you start or change a training or nutrition programme,
            especially if:
          </Trans>
        </p>
        <Bullets>
          <li>
            <Trans>
              you have a known health condition, for example of the heart, blood pressure, lungs or
              joints;
            </Trans>
          </li>
          <li>
            <Trans>you are pregnant or have recently given birth;</Trans>
          </li>
          <li>
            <Trans>you have had an injury or an operation, or you take regular medication;</Trans>
          </li>
          <li>
            <Trans>you have not been active for a long time.</Trans>
          </li>
        </Bullets>
      </Section>

      <Section title={<Trans>Stop and get help</Trans>}>
        <p>
          <Trans>
            Stop training straight away and get medical help if you feel chest pain or pressure,
            dizziness or faintness, unusual shortness of breath, an irregular heartbeat, or sudden
            or sharp pain. In an emergency, call your local emergency number (112 in Switzerland and
            the EU).
          </Trans>
        </p>
      </Section>

      <Section title={<Trans>Lifting safely</Trans>}>
        <p>
          <Trans>
            Lifting weights, and heavy weights in particular, carries a risk of injury. You can
            lower it:
          </Trans>
        </p>
        <Bullets>
          <li>
            <Trans>learn the technique of an exercise with light weights first;</Trans>
          </li>
          <li>
            <Trans>warm up before heavy sets;</Trans>
          </li>
          <li>
            <Trans>
              use a spotter or safety equipment such as rack safeties and collars, especially near
              your limit;
            </Trans>
          </li>
          <li>
            <Trans>stay within what you can lift with good form.</Trans>
          </li>
        </Bullets>
        <p>
          <Trans>
            Suggested weights are estimates from what you logged. If a weight feels wrong on the
            day, use less: you can always change a suggestion.
          </Trans>
        </p>
      </Section>

      <Section title={<Trans>Pain, check-ins and readiness</Trans>}>
        <p>
          <Trans>
            Pain notes and check-ins are for your own overview. They are not a diagnosis, and POWR
            does not predict injuries. If pain does not go away or gets worse, see a doctor or
            physiotherapist.
          </Trans>
        </p>
      </Section>

      <Section title={<Trans>Nutrition and bodyweight</Trans>}>
        <p>
          <Trans>
            Bodyweight goals and nutrition guidance are estimates for healthy adults. They are not
            suitable for people with an eating disorder or a history of one, during pregnancy or
            breastfeeding, or for anyone under 18. For people under 18, POWR limits these features.
          </Trans>
        </p>
      </Section>

      <Section title={<Trans>Your decisions</Trans>}>
        <p>
          <Trans>
            POWR suggests; you decide. You are responsible for what you do with its suggestions.
            Change or skip anything that does not feel right for you on the day.
          </Trans>
        </p>
        <p>
          <Trans>
            Questions about this notice: <EmailLink details={LEGAL_DETAILS} />
          </Trans>
        </p>
      </Section>
    </>
  );
}

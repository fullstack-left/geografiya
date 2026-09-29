import { useTranslation } from 'react-i18next';
import { Seo } from '@/components/ui';
import type { Country } from '@/data/types';
import { GameLoader } from '../shared/GameLoader';
import { QuizGame } from '../quiz/QuizGame';
import { shapeSpec } from '../quiz/engine';
import { outlineConsistent } from '../area-scaler/pairs';

/** Recognisable outline: consistent with the official area and big enough at 1:50m. */
const shapeOk = (minKm2: number, maxKm2 = Infinity) => (c: Country) =>
  outlineConsistent(c) && c.area.value >= minKm2 && c.area.value < maxKm2;

export const SHAPE_MODES = {
  shapesEasy: shapeOk(500_000),
  shapesMedium: shapeOk(60_000),
  shapesHard: shapeOk(1_000, 200_000),
};

export function ShapesPage() {
  const { t } = useTranslation();
  return (
    <>
      <Seo title={t('games.shapes.name')} description={t('quiz.intro.shapes')} />
      <GameLoader needs={{ world: true }}>
        {(data) => (
          <QuizGame
            gameId="shapes"
            data={data}
            needsWorld
            modes={Object.entries(SHAPE_MODES).map(([id, eligible]) => ({
              id,
              // distractors: any country with an outline, so options aren't a size giveaway
              spec: { ...shapeSpec(eligible), distractorPool: (c: Country) => c.hasGeometry },
            }))}
          />
        )}
      </GameLoader>
    </>
  );
}

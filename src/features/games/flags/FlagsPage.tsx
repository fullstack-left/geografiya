import { useTranslation } from 'react-i18next';
import { Seo } from '@/components/ui';
import { GameLoader } from '../shared/GameLoader';
import { QuizGame } from '../quiz/QuizGame';
import { flagSpecs } from '../quiz/engine';

export function FlagsPage() {
  const { t } = useTranslation();
  return (
    <>
      <Seo title={t('games.flags.name')} description={t('quiz.intro.flags')} />
      <GameLoader>
        {(data) => (
          <QuizGame
            gameId="flags"
            data={data}
            modes={[
              { id: 'flagToCountry', spec: flagSpecs.flagToCountry },
              { id: 'countryToFlag', spec: flagSpecs.countryToFlag },
            ]}
          />
        )}
      </GameLoader>
    </>
  );
}

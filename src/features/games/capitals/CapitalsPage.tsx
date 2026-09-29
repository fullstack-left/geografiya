import { useTranslation } from 'react-i18next';
import { Seo } from '@/components/ui';
import { GameLoader } from '../shared/GameLoader';
import { QuizGame } from '../quiz/QuizGame';
import { capitalSpecs } from '../quiz/engine';

export function CapitalsPage() {
  const { t } = useTranslation();
  return (
    <>
      <Seo title={t('games.capitals.name')} description={t('quiz.intro.capitals')} />
      <GameLoader>
        {(data) => (
          <QuizGame
            gameId="capitals"
            data={data}
            modes={[
              { id: 'countryToCapital', spec: capitalSpecs.countryToCapital },
              { id: 'capitalToCountry', spec: capitalSpecs.capitalToCountry },
            ]}
          />
        )}
      </GameLoader>
    </>
  );
}

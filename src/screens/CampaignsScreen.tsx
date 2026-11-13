import { useRouter } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, View, type LayoutChangeEvent } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';

import { CampaignCard, NewCampaignCard } from '../components/campaigns/CampaignCard';
import { AppHeader } from '../components/layout/AppHeader';
import { ScreenContainer } from '../components/layout/ScreenContainer';
import { STAGGER_MS } from '../components/ui/motion';
import { useI18n } from '../i18n';
import { useWorkspace } from '../state/WorkspaceProvider';
import { useAppTheme } from '../theme';

const GRID_GAP = 16;
const CARD_STAGGER_MS = STAGGER_MS;

/** Columns that fit the measured width: three on a desktop, two on a tablet, one on a phone. */
function columnsFor(width: number) {
  if (width >= 960) return 3;
  if (width >= 600) return 2;
  return 1;
}

/** Every active campaign, each opening its pipeline board. */
export function CampaignsScreen() {
  const { t } = useI18n();
  const { palette } = useAppTheme();
  const router = useRouter();
  const { summary } = useWorkspace();
  const [gridWidth, setGridWidth] = useState(0);

  const campaigns = summary?.campaigns ?? [];
  const atRisk = campaigns.filter((campaign) => campaign.health !== 'on_track').length;
  const columns = columnsFor(gridWidth);
  // Rounded down so rounding never pushes the last card of a row onto the next one.
  const cardWidth = gridWidth > 0 ? Math.floor((gridWidth - GRID_GAP * (columns - 1)) / columns) : 0;

  return (
    <ScreenContainer>
      <AppHeader
        title={t.campaignsPage.title}
        subtitle={summary ? t.campaignsPage.subtitle(summary.activeCampaigns, atRisk) : ''}
      />
      {!summary ? (
        <ActivityIndicator className="mt-24" color={palette.indigo} />
      ) : (
        <View
          className="mt-6 flex-row flex-wrap"
          style={{ gap: GRID_GAP }}
          onLayout={(event: LayoutChangeEvent) => setGridWidth(event.nativeEvent.layout.width)}
        >
          {cardWidth > 0 &&
            campaigns.map((campaign, index) => (
              <Animated.View
                key={campaign.id}
                entering={FadeInDown.delay(80 + index * CARD_STAGGER_MS).duration(420)}
                style={{ width: cardWidth }}
              >
                <CampaignCard
                  campaign={campaign}
                  enterDelay={200 + index * CARD_STAGGER_MS}
                  onPress={() => router.navigate({ pathname: '/candidates', params: { campaign: campaign.id } })}
                />
              </Animated.View>
            ))}
          {cardWidth > 0 && (
            <Animated.View
              entering={FadeInDown.delay(80 + campaigns.length * CARD_STAGGER_MS).duration(420)}
              style={{ width: cardWidth }}
            >
              <NewCampaignCard onPress={() => router.navigate('/campaigns/new')} />
            </Animated.View>
          )}
        </View>
      )}
    </ScreenContainer>
  );
}

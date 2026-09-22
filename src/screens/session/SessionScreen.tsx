import { SessionHeaderArea } from "./_area/SessionHeader.area";
import { SessionHeroArea } from "./_area/SessionHero.area";
import { SessionFeatureArea } from "./_area/SessionFeature.area";
import { SessionStepsArea } from "./_area/SessionSteps.area";
import { SessionFooterArea } from "./_area/SessionFooter.area";
export default function SessionScreen() {
  return (
    <div className="studio-landing">
      <SessionHeaderArea />
      <div className="landing-body">
        <main>
          <SessionHeroArea />
          <SessionFeatureArea />
          <SessionStepsArea />
        </main>
        <SessionFooterArea />
      </div>
    </div>
  );
}

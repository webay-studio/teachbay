import { SessionBackdropAction } from "./_action/SessionBackdrop.action";
import { SessionHeroArea } from "./_area/SessionHero.area";
import { SessionStepsArea } from "./_area/SessionSteps.area";
export default function SessionScreen() {
  return (
    <div className="studio-landing">
      <SessionBackdropAction />
      <div className="landing-body">
        <main>
          <SessionHeroArea />
          <SessionStepsArea />
        </main>
      </div>
    </div>
  );
}

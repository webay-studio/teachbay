import { Shell } from "@ui/shared";
import { RegistrationStoreProvider } from "./_state/useRegistrationStore";
import { RegistrationHandler } from "./_handler/Registration.handler";
import { RegistrationWorkspaceArea } from "./_area/RegistrationWorkspace.area";
import { RegistrationModalAction } from "./_action/RegistrationModal.action";
export default function RegistrationScreen({
  modal = false,
}: {
  modal?: boolean;
}) {
  const content = (
    <RegistrationStoreProvider>
      <RegistrationHandler>
        {modal ? (
          <RegistrationModalAction>
            <RegistrationWorkspaceArea />
          </RegistrationModalAction>
        ) : (
          <RegistrationWorkspaceArea />
        )}
      </RegistrationHandler>
    </RegistrationStoreProvider>
  );
  return modal ? content : <Shell>{content}</Shell>;
}

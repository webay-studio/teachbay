import { Shell } from "@ui/shared";
import { RegistrationStoreProvider } from "./_state/useRegistrationStore";
import { RegistrationHandler } from "./_handler/Registration.handler";
import { RegistrationWorkspaceArea } from "./_area/RegistrationWorkspace.area";
export default function RegistrationScreen() {
  return (
    <Shell>
      <RegistrationStoreProvider>
        <RegistrationHandler>
          <RegistrationWorkspaceArea />
        </RegistrationHandler>
      </RegistrationStoreProvider>
    </Shell>
  );
}

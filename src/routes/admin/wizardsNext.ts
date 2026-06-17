/*
 * Created on Tue Jun 16 2026
 *
 * Author: Massimiliano Fanciulli
 *
 * GitHub: https://github.com/fanciulli
 */
import { Route } from "../../types/route.js";
import { HttpMethods } from "../../misc/constants.js";
import { WizardNextSchema } from "../../types/api/wizards.js";
import { WizardViewDbModel } from "../../types/db/wizardView.js";
import { listWizardFiles, loadWizard } from "../../utils/wizardLoader.js";

export default class WizardsNext extends Route {
  method = HttpMethods.GET;
  url = "/admin/wizards/next";
  schema = WizardNextSchema;
  requiresAuth = true;

  handler = async (request: any, response: any) => {
    const username = this.getUsername(request);
    const db = this.getDatabase();

    const files = await listWizardFiles();

    for (const file of files) {
      const wizard = await loadWizard(file);
      if (!wizard) {
        continue;
      }

      if (await WizardViewDbModel.hasBeenShown(db, username, wizard.id)) {
        continue;
      }

      // Atomically claim the wizard. If a concurrent request already
      // claimed it, treat it as already shown and move on.
      const recorded = await WizardViewDbModel.markShown(
        db,
        username,
        wizard.id,
      );
      if (!recorded) {
        continue;
      }

      return response.send({ id: wizard.id, steps: wizard.steps });
    }

    return response.code(204).send();
  };
}

import Future = require("fibers/future");
import * as assert from "assert";
import * as helpers from "../common/helpers";

export class KendoUIBaseCommand implements ICommand {

	constructor(protected $errors: IErrors,
		protected $project: Project.IProject,
		protected $kendoUIService: IKendoUIService,
		protected $loginManager: ILoginManager,
		protected $options: IOptions) {	}

	allowedParameters: ICommandParameter[] = [];

	canExecute(args: string[]): IFuture<boolean> {
		return ((): boolean => {
			if(args && args.length > 0) {
				this.$errors.fail("This command does not accept parameters.");
			}

			if(this.$options.core && this.$options.professional) {
				this.$errors.fail("You cannot set the --core and the --professional flags simultaneously.");
			}

			return true;
		}).future<boolean>()();
	}

	execute(args: string[]): IFuture<void> {
		assert.fail("","", "You should never get here. Please contact Telerik support and send the output of your command, executed with `--log trace`.");
		return Future.fromResult();
	}

	public getKendoPackages(configuration?: { withReleaseNotesOnly: boolean }): IFuture<Server.IKendoDownloadablePackageData[]>{
		return (() => {
			this.$loginManager.ensureLoggedIn().wait();
			this.$project.ensureCordovaProject();
			if (!this.$project.capabilities.updateKendo) {
				this.$errors.fail(`This operation is not applicable to ${this.$project.projectData.Framework} projects.`);
			}

			let kendoFilterOptions: IKendoUIFilterOptions = {
				core: this.$options.core,
				professional: this.$options.professional,
				verified: this.$options.verified,
				latest: this.$options.latest,
				withReleaseNotesOnly: configuration && configuration.withReleaseNotesOnly
			};

			let packages = this.$kendoUIService.getKendoPackages(kendoFilterOptions).wait();

			if (packages.length === 0) {
				let message = "Cannot find Kendo UI packages that match the provided parameters.";
				if (this.$options.professional) {
					message += " Verify that your subscription plan provides 'Kendo UI Professional'.";
				}
				this.$errors.failWithoutHelp(message);
			}

			return packages;
		}).future<Server.IKendoDownloadablePackageData[]>()();
	}

	public getKendoPackagesAsTable(packages: Server.IKendoDownloadablePackageData[]): string {
		let packageData: string[][] = [];

		_.each(packages,(update: Server.IKendoDownloadablePackageData, idx: number) => packageData.push([
			(idx + 1).toString().cyan.toString(),
			update.Name,
			update.Version,
			(update.VersionTags || []).join(", ").cyan.toString()
		]));

		let table = helpers.createTable(["#", "KendoUI", "Version", "Tags"], packageData);

		return table.toString();
	}
}

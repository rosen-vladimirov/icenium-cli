///<reference path="../.d.ts"/>
"use strict";

import MobileHelper = require("../common/mobile/mobile-helper");
import constants = require("../common/mobile/constants");
import util = require("util");
import options = require("../options");

class AppManagerUploadCommand implements ICommand {
	constructor(
		private $config: IConfiguration,
		private $server: Server.IServer,
		private $errors: IErrors,
		private $logger: ILogger,
		private $project: Project.IProject,
		private $loginManager: ILoginManager,
		private $opener: IOpener,
		private $buildService: Project.IBuildService) {}

	execute(args: string[]): IFuture<void> {
		return (() => {
			var platform = MobileHelper.validatePlatformName(args[0], this.$errors);
			this.$project.ensureProject();
			this.$loginManager.ensureLoggedIn().wait();

			this.$logger.info("Accessing Telerik AppManager store.");
			this.$server.tam.verifyStoreCreated().wait();

			this.$logger.info("Building release package.");
			var buildResult = this.$buildService.build({
				platform: platform,
				configuration: "Release",
				provisionTypes: [constants.ProvisionType.Development, constants.ProvisionType.Enterprise, constants.ProvisionType.AdHoc],
				showWp8SigningMessage: false,
				buildForTAM: true,
				downloadFiles: options.download
			}).wait();

			if (!buildResult[0] || !buildResult[0].solutionPath) {
				this.$errors.fail({formatStr: "Build failed.", suppressCommandHelp: true});
			}

			this.$logger.info("Uploading package to Telerik AppManager.");
			var projectName = this.$project.projectData.ProjectName;
			var solutionPath = buildResult[0].solutionPath;
			var projectPath = solutionPath.substr(solutionPath.indexOf("/") + 1);
			this.$server.tam.uploadApplication(projectName, projectName, projectPath).wait();

			this.$logger.info("Successfully uploaded package.");

			var tamUrl = util.format("%s://%s/appbuilder/Services/tam", this.$config.AB_SERVER_PROTO, this.$config.AB_SERVER);
			this.$logger.info("Go to %s to manage your apps.", tamUrl);
			this.$opener.open(tamUrl);
		}).future<void>()();
	}

	allowedParameters : ICommandParameter[] = [new PlatformNameCommandParameter(this.$errors)];
}
$injector.registerCommand("appmanager|upload", AppManagerUploadCommand);

class PlatformNameCommandParameter implements ICommandParameter {
	constructor(private $errors: IErrors) { }
	mandatory = true;
	validate(value: string, errorMessage?: string): IFuture<boolean> {
		return ((): boolean => {
			MobileHelper.validatePlatformName(value, this.$errors);
			return true;
		}).future<boolean>()();
	}
}

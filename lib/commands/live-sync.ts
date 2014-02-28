///<reference path="../.d.ts"/>

import util = require("util");
import path = require("path");
import watchr = require("watchr");
import options = require("./../options");
import helpers = require("./../helpers");
import _ = require("underscore");
import MobileHelper = require("./../mobile/mobile-helper");

export class LiveSyncCommand implements ICommand {
	private excludedProjectDirsAndFiles = ["app_resources", "plugins"];

	constructor(private $devicesServices: Mobile.IDevicesServices,
		private $logger: ILogger,
		private $fs: IFileSystem,
		private $errors: IErrors,
		private $project: Project.IProject) {
	}

	public execute(args: string[]): IFuture<void> {
		return (() => {
			var platform = args[0];

			this.$project.ensureProject();
			var projectDir = this.$project.getProjectDir();
			var appIdentifier = this.$project.projectData.AppIdentifier;

			if (this.$devicesServices.hasDevices(platform)) {
				if (options.watch) {
					this.liveSyncDevices(platform, projectDir, appIdentifier);
				} else {
					if (options.file) {
						var isExistFile = this.$fs.exists((options.file)).wait();
						if(isExistFile) {
							var projectFiles = [path.resolve(options.file)];
							this.sync(platform, appIdentifier, projectDir, projectFiles).wait();
						} else {
							this.$errors.fail("The file %s does not exist.", options.file);
						}
					} else {
						var projectFiles = this.$project.enumerateProjectFiles(this.excludedProjectDirsAndFiles);
						this.sync(platform, appIdentifier, projectDir, projectFiles).wait();
					}
				}
			}
		}).future<void>()();
	}

	private sync(platform: string, appIdentifier: string, projectDir: string, projectFiles: string[]): IFuture<void> {
		return(() => {
			var action = (device: Mobile.IDevice): IFuture<void> => {
				return (() => {
					var platformSpecificProjectPath = device.getDeviceProjectPath(appIdentifier);
					var localDevicePaths = this.getLocalToDevicePaths(projectDir, projectFiles, platformSpecificProjectPath);
					device.sync(localDevicePaths, appIdentifier).wait();
				}).future<void>()();
			};

			if(options.device) {
				this.$devicesServices.executeOnDevice(action, options.device).wait();
			} else {
				this.$devicesServices.executeOnAllConnectedDevices(action, platform).wait();
			}
		}).future<void>()();
	}

	public getLocalToDevicePaths(localProjectPath, projectFiles, deviceProjectPath): MobileHelper.LocalToDevicePathData[] {
		var localToDevicePaths = _.map(projectFiles, (projectFile: string) => {
			var relativeToProjectBasePath: string = helpers.getRelativeToRootPath(localProjectPath, projectFile);
			var deviceDirPath : string = path.dirname(path.join(deviceProjectPath, relativeToProjectBasePath));
			return new MobileHelper.LocalToDevicePathData(projectFile, helpers.fromWindowsRelativePathToUnix(deviceDirPath), relativeToProjectBasePath);
		});

		return localToDevicePaths;
	}

	private liveSyncDevices(platform, projectDir, appIdentifier) {
		watchr.watch({
			paths: [projectDir],
			listeners: {
				error: (error) => {
					this.$errors.fail(error);
				},
				change: (changeType, filePath) => {
					if (!this.$project.isProjectFileExcluded(projectDir, filePath, this.excludedProjectDirsAndFiles)) {
						this.$logger.trace("Syncing %s", filePath);
						this.sync(platform, appIdentifier, projectDir, [filePath]);
					}
				},
				next: (error, watchers) => {
					if(error) {
						this.$errors.fail(error);
					}
					this.$logger.trace("File system watchers are stopping.");
					for (var i = 0; i < watchers.length; i++) {
						watchers[i].close();
					}
					this.$logger.trace("File system watchers are stopped.");
				}
			}
		});
	}
}
$injector.registerCommand("live-sync", LiveSyncCommand);



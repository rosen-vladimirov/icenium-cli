import constants = require("../../common/constants");
import {EOL} from "os";

export class LiveSyncService implements ILiveSyncService {
	private excludedProjectDirsAndFiles = ["app_resources", "plugins", ".*.tmp", ".ab"];

	constructor(private $devicesService: Mobile.IDevicesService,
		private $errors: IErrors,
		private $devicePlatformsConstants: Mobile.IDevicePlatformsConstants,
		private $project: Project.IProject,
		private $logger: ILogger,
		private $mobileHelper: Mobile.IMobileHelper,
		private $options: IOptions,
		private $injector: IInjector) { }

	public livesync(platform?: string): IFuture<void> {
		return (() => {
			this.$project.ensureProject();
			let $liveSyncServiceBase = this.$injector.resolve("$liveSyncServiceBase");
			platform = $liveSyncServiceBase.getPlatform(platform).wait();

			if (!this.$mobileHelper.getPlatformCapabilities(platform).companion && this.$options.companion) {
				this.$errors.failWithoutHelp("The AppBuilder Companion app is not available on %s devices.", platform);
			}

			if (!this.$devicesService.hasDevices) {
				this.$errors.failWithoutHelp(constants.ERROR_NO_DEVICES);
			}

			if (!this.$project.capabilities.livesync && !this.$options.companion) {
				this.$errors.failWithoutHelp("Use $ appbuilder livesync cloud to sync your application to Telerik Nativescript Companion App. You will be able to LiveSync %s based applications in a future release of the Telerik AppBuilder CLI.", this.$project.projectData.Framework);
			}

			if (!this.$project.capabilities.livesyncCompanion && this.$options.companion) {
				this.$errors.failWithoutHelp("You will be able to LiveSync %s based applications to the Companion app in a future release of the Telerik AppBuilder CLI.", this.$project.projectData.Framework);
			}

			let projectDir = this.$project.getProjectDir().wait();

			let livesyncData: ILiveSyncData = {
				platform: platform,
				appIdentifier: this.$project.projectData.AppIdentifier,
				projectFilesPath: projectDir,
				syncWorkingDirectory: projectDir,
				excludedProjectDirsAndFiles: this.excludedProjectDirsAndFiles,
				additionalConfigurations: this.$project.projectInformation.configurations
			};

			let deviceConfigurationInfos: Mobile.IApplicationInfo[] = [];

			let configurations = this.$project.getConfigurationsSpecifiedByUser();
			if (!configurations.length) {
				this.$devicesService.execute(device => (() => {
					let configInfo = device.getApplicationInfo(livesyncData.appIdentifier).wait();
					if (configInfo) {
						deviceConfigurationInfos.push(configInfo);
					}
				}).future<void>()()).wait();

				let deviceConfigurations = _.reduce(deviceConfigurationInfos, (result, dci) => result + `${EOL}device: ${dci.applicationIdentifier} has "${dci.configuration}" configuration`, "");
				if (deviceConfigurations && _.uniq(deviceConfigurationInfos, dci => dci.configuration).length !== 1) {
						this.$errors.failWithoutHelp("Cannot LiveSync because application is deployed with different configurations across the devices.", deviceConfigurations);
				}

				livesyncData.configuration = deviceConfigurationInfos && deviceConfigurationInfos[0] && deviceConfigurationInfos[0].configuration;
				if (livesyncData.configuration) {
					this.$options.config = [livesyncData.configuration];
				}

			$liveSyncServiceBase.sync(livesyncData).wait();
			} else {
				configurations.forEach(configuration => {
					livesyncData.configuration = configuration;
					livesyncData.appIdentifier = this.$project.projectInformation.configurationSpecificData[configuration.toLowerCase()].AppIdentifier;
					this.$devicesService.execute(device => (() => {
						let configInfo = device.getApplicationInfo(livesyncData.appIdentifier).wait();
						if (configInfo) {
							deviceConfigurationInfos.push(configInfo);
						}
					}).future<void>()()).wait();

					livesyncData.canExecute = (device: Mobile.IDevice): boolean => {
						let deviceConfigurationInfo = _.find(deviceConfigurationInfos, dci => dci.deviceIdentifier === device.deviceInfo.identifier);
						if (deviceConfigurationInfo && deviceConfigurationInfo.configuration && deviceConfigurationInfo.configuration.toLowerCase() !== configuration.toLowerCase() && !this.$options.companion) {
							this.$logger.warn(`LiveSync will not be performed on device with identifier ${device.deviceInfo.identifier}. You are trying to LiveSync in configuration ${configuration} but the device was deployed in configuration ${deviceConfigurationInfo.configuration}.`);
							return false;
						}

						return true;
					};

					$liveSyncServiceBase.sync(livesyncData).wait();
				});
			}
		}).future<void>()();
	}
}
$injector.register("liveSyncService", LiveSyncService);

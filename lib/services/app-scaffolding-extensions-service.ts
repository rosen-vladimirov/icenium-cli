import {ExtensionsServiceBase} from "./extensions-service-base";
import * as path from "path";
import Future = require("fibers/future");

export class AppScaffoldingExtensionsService extends ExtensionsServiceBase implements IAppScaffoldingExtensionsService {
	private static APP_SCAFFOLDING_NAME = "app-scaffolding";
	private static SCREEN_BUILDER_BUCKET_NAME = "http://s3.amazonaws.com/screenbuilder-cli";
	private static DEFAULT_CACHED_VERSION = "0.0.0";

	constructor(private $childProcess: IChildProcess,
		private $config: IConfiguration,
		private $dependencyConfigService: IDependencyConfigService,
		private $progressIndicator: IProgressIndicator,
		protected $fs: IFileSystem,
		protected $httpClient: Server.IHttpClient,
		protected $logger: ILogger,
		protected $options: IOptions) {
		super($options.screenBuilderCacheDir, $fs, $httpClient, $logger, $options);
	}

	public get appScaffoldingPath(): string {
		return this.getExtensionPath(AppScaffoldingExtensionsService.APP_SCAFFOLDING_NAME);
	}

	public prepareAppScaffolding(): IFuture<void> {
		return (() => {
			let appScaffoldingConfig = this.$dependencyConfigService.getAppScaffoldingConfig().wait();
			appScaffoldingConfig.pathToSave = this.$options.screenBuilderCacheDir;
			let afterPrepareAction = () => {
				return (() => {
					// HACK: Some of screen builder's dependencies generate paths which are too long for Windows OS to handle
					// this is why we pre-install them so that they're at the highest point in the dependency depth.
					// This leads to shortening the paths just enough to be safe about it.
					// Note that if one of these modules' versions is changed this needs to be reflected in the code too!
					["vinyl-fs@2.2.1", "gulp-decompress@1.2.0"].forEach(dependency => { this.npmInstall(dependency).wait(); });

					let generatorBaseDependencies = require(path.join(this.appScaffoldingPath, "node_modules", "screen-builder-base-generator", "package.json")).dependencies;
					Future.wait(_.map(generatorBaseDependencies, (value, key) => this.npmInstall(`${key}@${value}`)));
					this.npmInstall().wait();
					this.npmDedupe().wait();
				}).future<void>()();
			};
			this.prepareDependencyExtension(AppScaffoldingExtensionsService.APP_SCAFFOLDING_NAME, appScaffoldingConfig, afterPrepareAction).wait();
		}).future<void>()();
	}

	public prepareDependencyExtension(dependencyExtensionName: string, dependencyConfig: IDependencyConfig, afterPrepareAction?: () => IFuture<void>): IFuture<void> {
		return (() => {
			let extensionVersion = this.getExtensionVersion(dependencyExtensionName);
			let cachedVersion = extensionVersion || AppScaffoldingExtensionsService.DEFAULT_CACHED_VERSION;
			let downloadUrl = this.$config.ON_PREM ? `${this.$config.AB_SERVER}/downloads/sb/generators/${dependencyExtensionName}/${dependencyConfig.version}` : `${AppScaffoldingExtensionsService.SCREEN_BUILDER_BUCKET_NAME}/v${dependencyConfig.version}/${dependencyExtensionName}.zip`;

			this.$logger.trace("prepareDependencyExtension: Download url: %s, cached version: %s", downloadUrl, cachedVersion);

			if (this.shouldUpdatePackage(cachedVersion, dependencyConfig.version)) {
				this.$logger.out("Please, wait while Screen Builder and its dependencies are being configured.");
				this.$logger.out("Preparing %s", dependencyExtensionName);

				let dependencyExtensionData = {
					packageName: dependencyExtensionName,
					version: dependencyConfig.version,
					downloadUri: downloadUrl,
					pathToSave: dependencyConfig.pathToSave
				};

				this.$progressIndicator.showProgressIndicator(this.prepareExtensionBase(dependencyExtensionData, cachedVersion, {afterDownloadAction: () => this.$progressIndicator.showProgressIndicator(afterPrepareAction(), 100)}), 5000).wait();
			}
		}).future<void>()();
	}

	protected npmInstall(packageToInstall?: string): IFuture<void> {
		packageToInstall = packageToInstall || "";
		let command = `npm install ${packageToInstall} --production`;
		return this.$childProcess.exec(command, {cwd: this.appScaffoldingPath });
	}

	protected npmDedupe(): IFuture<void> {
		return this.$childProcess.exec("npm dedupe", {cwd: this.appScaffoldingPath});
	}
}
$injector.register("appScaffoldingExtensionsService", AppScaffoldingExtensionsService);

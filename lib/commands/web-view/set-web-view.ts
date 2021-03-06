import semver = require("semver");

export class SetWebViewCommand implements ICommand {
	constructor(private $webViewService: IWebViewService,
		private $injector: IInjector,
		private $errors: IErrors,
		private $logger: ILogger,
		private $project: Project.IProject) { }

	public execute(args: string[]): IFuture<void> {
		return (() => {
			this.$webViewService.enableWebView(args[0], args[1]).wait();
			this.$logger.out(`Operation completed successfully. Your project now uses the ${args[1]} web view for ${args[0]}.`);
		}).future<void>()();
	}

	public canExecute(args: string[]): IFuture<boolean> {
		return (() => {
			this.$project.ensureCordovaProject();

			if(!args[0] || !args[1]) {
				this.$errors.fail(`You must specify target platform and web view name.`);
			}

			let supportedWebViews = this.$webViewService.supportedWebViews;

			// Validate platform
			let platform = args[0].toLowerCase();
			let platforms = _.keys(supportedWebViews);
			if(!_.contains(platforms, platform)) {
				this.$errors.failWithoutHelp(`Invalid platform. You can set the web view for the following platforms: ${platforms.join(", ")}`);
			}

			// Validate webView
			let webViewName = args[1].toLowerCase();
			let webViewNames = this.$webViewService.getWebViewNames(platform);
			if(!_.contains(webViewNames, webViewName)) {
				this.$errors.failWithoutHelp(`Invalid web view. The valid ${platform} web views are: ${webViewNames.join(", ")}`);
			}

			// Validate project version
			let currentProjectVersion = this.$project.projectData.FrameworkVersion;
			let webView = this.$webViewService.getWebView(platform, webViewName);
			if(semver.lt(currentProjectVersion, webView.minSupportedVersion)) {
				this.$errors.failWithoutHelp(`You cannot set the ${webViewName} web view for projects that target Apache Cordova ${currentProjectVersion}. Your project must target Apache Cordova ${webView.minSupportedVersion} or later. Run \`$ appbuilder mobileframework\` set to change your target framework version.`);
			}

			return true;

		}).future<boolean>()();
	}

	public allowedParameters: ICommandParameter[] = [];
}
$injector.registerCommand("webview|set", SetWebViewCommand);

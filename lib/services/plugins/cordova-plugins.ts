///<reference path="../../.d.ts"/>
"use strict";

import * as path from "path";
import PluginsDataLib = require("./../../plugins-data");

export class CordovaPluginsService implements ICordovaPluginsService {
	constructor(private $project: Project.IProject,
		private $fs: IFileSystem,
		private $config: IConfiguration,
		private $server: Server.IServer,
		private $projectConstants: Project.IConstants,
		private $resources: IResourceLoader) { }

	// HACK: Information for this plugin is never returned from the server, so keep it here.
	// TODO: Remove the LivePatch HACK when the server returns correct results.
	// HACK: Platforms should be Server.DevicePlatform.Android, etc. but this fails at runtime that Server is not defined.
	// 		 That's why the plugin type is declared as any insted of Server.CordovaPluginData
	private livePatchPlugin: any = {
		"Name": "Telerik AppManager LiveSync",
		"Identifier": "com.telerik.LivePatch",
		"Version": "1.0.0",
		"Description": "This plugin adds Telerik AppManager LiveSync functionality",
		"Url": "",
		"Assets": [],
		"Platforms": ["Android", "iOS", "WP8"],
		"Variables": [],
		"AndroidRequiredPermissions": ["android.permission.INTERNET"]
	};

	public getAvailablePlugins(): IFuture<Server.CordovaPluginData[]> {
		return ((): Server.CordovaPluginData[] => {
			this.$project.ensureCordovaProject();
			// TODO: Remove the LivePatch HACK when the server returns correct results. Also check the tests.
			return this.$server.cordova.getPlugins(this.$project.projectData.FrameworkVersion).wait().concat([this.livePatchPlugin]);
		}).future<Server.CordovaPluginData[]>()();
	}

	public createPluginData(plugin: IMarketplacePluginData): IPlugin[] {
		this.$project.ensureCordovaProject();
		return [new PluginsDataLib.CordovaPluginData(plugin, this.getPluginTypeByIdentifier(plugin.Identifier), this.$project, this.$projectConstants)];
	}

	private getPluginTypeByIdentifier(pluginIdentifier: string): PluginsDataLib.PluginType {
		let pluginType = PluginsDataLib.PluginType.AdvancedPlugin;
		let corePluginRegex = require(path.join(this.$resources.resolvePath("Cordova"), "cordova-migration-data.json")).corePluginRegex;
		let isCorePlugin = new RegExp(corePluginRegex).test(pluginIdentifier);
		if (isCorePlugin) {
			pluginType = PluginsDataLib.PluginType.CorePlugin;
		}

		return pluginType;
	}
}

$injector.register("cordovaPluginsService", CordovaPluginsService);

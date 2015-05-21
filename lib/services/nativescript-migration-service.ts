///<reference path="../.d.ts"/>
"use strict";

import Future = require("fibers/future");
import path = require("path");
import helpers = require("./../helpers");

export class NativeScriptMigrationService implements IFrameworkMigrationService {
	private static TYPESCRIPT_ABBREVIATION = "TS";
	private static JAVASCRIPT_ABBREVIATION = "JS";
	private static SUPPORTED_LANGUAGES = [NativeScriptMigrationService.JAVASCRIPT_ABBREVIATION, NativeScriptMigrationService.TYPESCRIPT_ABBREVIATION];
	private static REMOTE_NATIVESCRIPT_MIGRATION_DATA_FILENAME = "NativeScript.json";
	private nativeScriptResourcesDir: string;
	private nativeScriptMigrationFile: string;
	private tnsModulesDirectoryPath: string;
	private remoteNativeScriptResourcesPath: string;

	private _nativeScriptMigrationData: INativeScriptMigrationData;
	private get nativeScriptMigrationData(): IFuture<INativeScriptMigrationData> {
		return ((): INativeScriptMigrationData => {
			this._nativeScriptMigrationData = this._nativeScriptMigrationData || this.$fs.readJson(this.nativeScriptMigrationFile).wait();
			return this._nativeScriptMigrationData;
		}).future<INativeScriptMigrationData>()();
	}

	constructor(private $fs: IFileSystem,
		private $server: Server.IServer,
		private $errors: IErrors,
		private $logger: ILogger,
		private $project: Project.IProject,
		private $resources: IResourceLoader,
		private $config: IConfiguration,
		private $httpClient: Server.IHttpClient) {
			this.nativeScriptResourcesDir = this.$resources.resolvePath("NativeScript");
			this.tnsModulesDirectoryPath = path.join(this.nativeScriptResourcesDir, "tns_modules");
			this.remoteNativeScriptResourcesPath = `http://${this.$config.AB_SERVER}/appbuilder/Resources/NativeScript`;
			this.nativeScriptMigrationFile =  path.join(this.nativeScriptResourcesDir, "nativeScript-migration-data.json");
		}

	public downloadMigrationData(): IFuture<void> {
		return (() => {
			this.$fs.deleteDirectory(this.nativeScriptResourcesDir).wait();
			this.$fs.createDirectory(this.nativeScriptResourcesDir).wait();

			// Make sure to download this file first, as data from it is used for fileDownloadFutures
			this.downloadNativeScriptMigrationFile().wait();

			let fileDownloadFutures = _(this.nativeScriptMigrationData.wait().supportedVersions)
									.map(supportedVersion => _.map(NativeScriptMigrationService.SUPPORTED_LANGUAGES, language => this.downloadTnsModules(language, supportedVersion.version)))
									.flatten<IFuture<void>>()
									.value();
			Future.wait(fileDownloadFutures);
		}).future<void>()();
	}

	public getSupportedVersions(): IFuture<string[]> {
		return ((): string[] => {
			let migrationData = this.nativeScriptMigrationData.wait();
			return _.map(migrationData.supportedVersions, supportedVersion => supportedVersion.version);
		}).future<string[]>()();
	}

	public getSupportedFrameworks(): IFuture<IFrameworkVersion[]> {
		return ((): IFrameworkVersion[] => {
			let migrationData = this.nativeScriptMigrationData.wait();
			return migrationData.supportedVersions;
		}).future<IFrameworkVersion[]>()();
	}

	public getDisplayNameForVersion(version: string): IFuture<string>{
		return ((): string => {
			let framework = _.find(this.getSupportedFrameworks().wait(), (fw: IFrameworkVersion) => fw.version === version);
			if(framework) {
				return framework.displayName;
			}

			this.$errors.failWithoutHelp("Cannot find version %s in the supported versions.", version);
		}).future<string>()();
	}
	
	public onFrameworkVersionChanging(newVersion: string): IFuture<void> {
		return (() => {
			let projectDir = this.$project.getProjectDir().wait();
			let tnsModulesProjectPath = path.join(projectDir, "app", "tns_modules");
			let backupName = `${tnsModulesProjectPath}.backup`;
			// Check if current version is supported one. We cannot migrate ObsoleteVersions
			let currentFrameworkVersion = this.$project.projectData.FrameworkVersion;
			if(!_.contains(this.getSupportedVersions().wait(), currentFrameworkVersion)) {
				if(_.contains(this.getObsoleteVersions().wait(), currentFrameworkVersion)) {
					this.$errors.failWithoutHelp(`You can still build your project, but you cannot migrate from version '${currentFrameworkVersion}'. Consider creating a new NativeScript project.`)
				} else {
					this.$errors.failWithoutHelp(`You cannot migrate from version ${currentFrameworkVersion}.`)
				}
			}

			try {
				this.$fs.rename(tnsModulesProjectPath, backupName).wait();
				this.$fs.createDirectory(tnsModulesProjectPath).wait();
				let projectType = this.$project.isTypeScriptProject().wait() ? NativeScriptMigrationService.TYPESCRIPT_ABBREVIATION : NativeScriptMigrationService.JAVASCRIPT_ABBREVIATION;
				let pathToNewTnsModules = path.join(this.tnsModulesDirectoryPath, projectType, this.getFileNameByVersion(newVersion));
				this.$fs.unzip(pathToNewTnsModules, tnsModulesProjectPath).wait();
				this.$fs.deleteDirectory(backupName).wait();
			} catch(err) {
				this.$logger.trace("Error during migration. Trying to restore previous state.");
				this.$logger.trace(err);
				this.$fs.deleteDirectory(tnsModulesProjectPath).wait();
				this.$fs.rename(backupName, tnsModulesProjectPath).wait();
				this.$errors.failWithoutHelp("Error during migration. Restored original state of the project.");
			}
		}).future<void>()();
	}

	private downloadNativeScriptMigrationFile(): IFuture<void> {
		return (() => {
			let remoteFilePath = `${this.remoteNativeScriptResourcesPath}/${NativeScriptMigrationService.REMOTE_NATIVESCRIPT_MIGRATION_DATA_FILENAME}`;
			this.downloadResourceFromServer(remoteFilePath, this.nativeScriptMigrationFile).wait();
		}).future<void>()();
		
	}

	private downloadTnsModules(language: string, version: string): IFuture<void> {
		let fileName = this.getFileNameByVersion(version);
		let remotePathUrl = `${this.remoteNativeScriptResourcesPath}/tns_modules/${language}/${fileName}`;
		let filePath = path.join(this.tnsModulesDirectoryPath, language, fileName);
		return this.downloadResourceFromServer(remotePathUrl, filePath);
	}

	private downloadResourceFromServer(remotePath: string, targetPath: string): IFuture<void> {
		return (() => {
			this.$fs.writeFile(targetPath, "").wait();
			let file = this.$fs.createWriteStream(targetPath);
			let fileEnd = this.$fs.futureFromEvent(file, "finish");
			this.$logger.trace(`Downloading resource from server. Remote path is: '${remotePath}'. TargetPath is: '${targetPath}'.`)
			this.$httpClient.httpRequest({ url:remotePath, pipeTo: file}).wait();
			fileEnd.wait();
		}).future<void>()();
	}
	private getFileNameByVersion(version: string): string {
		return `${version}.zip`;
	}
	
	private getObsoleteVersions(): IFuture<string[]> {
		return ((): string[] => {
			let migrationData = this.nativeScriptMigrationData.wait();
			return _.map(migrationData.obsoleteVersions, obsoleteVersion => obsoleteVersion.version);
		}).future<string[]>()();
	}
}
$injector.register("nativeScriptMigrationService", NativeScriptMigrationService);

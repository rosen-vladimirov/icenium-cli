import * as helpers from "./common/helpers";

export class ProcessInfo implements IProcessInfo {
	constructor(private $childProcess: IChildProcess,
		private $hostInfo: IHostInfo) { }

	public isRunning(name: string): IFuture<boolean> {
		return (() => {
			let result: boolean;

			if (this.$hostInfo.isWindows) {
				if (!_.endsWith(name.toLowerCase(), ".exe")) {
					name = name + ".exe";
				}
				// windows returns localized text whether the app is running or not. But when it is running, the name of the process is in the output
				result = this.$childProcess.spawnFromEvent("tasklist.exe", ["/fi", 'imagename eq ' + name], "close").wait().stdout.indexOf(name) !== -1;
			} else if (this.$hostInfo.isDarwin) {
				result = this.$childProcess.spawnFromEvent("ps", ["xc"], "close").wait().stdout.indexOf(name) !== -1;
			} else if (this.$hostInfo.isLinux) {
				result = !helpers.isNullOrWhitespace(this.$childProcess.spawnFromEvent("ps", ["--no-headers", "-C", name], "close").wait().stdout);
			}

			return result;
		}).future<boolean>()();
	}
}

$injector.register("processInfo", ProcessInfo);

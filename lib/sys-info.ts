///<reference path=".d.ts"/>
"use strict";

import {SysInfoBase} from "./common/sys-info-base";

export class SysInfo extends SysInfoBase {
	constructor(protected $childProcess: IChildProcess,
				protected $hostInfo: IHostInfo,
				protected $iTunesValidator: Mobile.IiTunesValidator,
				protected $logger: ILogger) {
		super($childProcess, $hostInfo, $iTunesValidator, $logger);
	}

	public getSysInfo(androidToolsInfo?: {pathToAdb: string, pathToAndroid: string}): IFuture<ISysInfoData> {
		return ((): ISysInfoData => {
			let defaultAndroidToolsInfo = {
				pathToAdb: "adb",
				pathToAndroid: "android" + (this.$hostInfo.isWindows ? ".bat" : "")
			};

			return super.getSysInfo(androidToolsInfo || defaultAndroidToolsInfo).wait();
		}).future<ISysInfoData>()();
	}
}
$injector.register("sysInfo", SysInfo);
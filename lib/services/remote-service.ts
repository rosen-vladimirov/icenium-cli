///<reference path="../.d.ts"/>
"use strict";

import { Request, Response } from "express";
import * as path from "path";
import * as os from "os";
import * as minimatch from "minimatch";
import * as ip from "ip";

export class RemoteService implements IRemoteService {
	private appBuilderDir: string;
	private packageLocation: string;

	constructor(private $logger: ILogger,
				private $fs: IFileSystem,
				private $express: IExpress,
				private $iOSEmulatorServices: Mobile.IEmulatorPlatformServices,
				private $domainNameSystem: IDomainNameSystem,
				private $options: IOptions) {
		this.appBuilderDir = path.join(os.tmpdir(), 'AppBuilder');
		this.packageLocation = path.join(this.appBuilderDir, 'package.zip');
	}

	public startApiServer(portNumber: number): IFuture<void> {
		return (() => {
			this.$fs.ensureDirectoryExists(this.appBuilderDir).wait();

			this.$express.post("/launch", (req: Request, res: Response) => this.onLaunchRequest(req, res));
			let domain = this.$domainNameSystem.getDomains().wait()[0];

			this.$express.listen(portNumber, () => {
				let ipAddress = ip.address();
				this.$logger.info("Listening on port " + portNumber);
				if(domain) {
					this.$logger.info("In the AppBuilder Windows client or the extension for Visual Studio, provide the connection information for this server in one of the following formats:\n" +
						" - Address: http://" + ipAddress + " Port: " + portNumber + "\n" +
						" - Address: http://" + domain + " Port: " + portNumber);
				} else {
					this.$logger.info("In the AppBuilder Windows client or the extension for Visual Studio, provide the connection information for this server in the following format:\n" +
						" - Address: http://" + ipAddress + " Port: " + portNumber);
				}
			});
			this.$express.run();
		}).future<void>()();
	}

	private onLaunchRequest(req: Request, res: Response): IFuture<void> {
		return (() => {
			this.$logger.info("launch simulator request received ... ");
			// Clean the tempdir before new launch
			this.$fs.deleteDirectory(this.appBuilderDir).wait();
			this.$fs.createDirectory(this.appBuilderDir).wait();

			let deviceFamily = req.query.deviceFamily.toLowerCase();
			let archive = this.$fs.createWriteStream(this.packageLocation);
			archive.on('error', (err: Error) => {
				this.$logger.error('Could not save the uploaded file. ' + err);
				res.status(500).send('Could not save the uploaded file. ' + err).end();
			});

			req.pipe(archive);
			this.$fs.futureFromEvent(archive, 'finish').wait();

			this.$fs.unzip(this.packageLocation, this.appBuilderDir).wait();

			let appLocation = path.join(this.appBuilderDir, this.$fs.readDirectory(this.appBuilderDir).wait().filter(minimatch.filter("*.app"))[0]);

			this.$iOSEmulatorServices.checkAvailability(false).wait();
			let mappedDeviceName = RemoteService.AppBuilderClientToSimulatorDeviceNameMapping[deviceFamily] || deviceFamily;
			this.$iOSEmulatorServices.startEmulator(appLocation, {deviceType: mappedDeviceName}).wait();

			res.status(200).end();
		}).future<void>()();
	}

	private static AppBuilderClientToSimulatorDeviceNameMapping: IStringDictionary = {
		"iphoneandipod"	: "iPhone-4s",
		"ipad": "iPad-2"
	}
}

$injector.register("remoteService", RemoteService);

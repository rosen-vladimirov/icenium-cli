///<reference path=".d.ts"/>
"use strict";

import stubs = require("./stubs");
import yok = require("../lib/common/yok");
import optionsLib = require("../lib/options");
import remoteProjectsServiceLib = require("../lib/services/remote-projects-service");
import projectConstantsLib = require("../lib/project/project-constants");
import os = require("os");

let assert = require("chai").assert;
import Future = require("fibers/future");
import util = require("util");

function createTestInjector(): IInjector {
	let testInjector = new yok.Yok();
	testInjector.register("errors", stubs.ErrorsStub);
	testInjector.register("userDataStore", {
		getUser: () =>  Future.fromResult({tenant: {id: "id"}}),
	});
	testInjector.register("serviceProxy", {
		setSolutionSpaceName: (tenantId: string) => {}
	});
	testInjector.register("server", {
		tap: {
			getExistingClientSolutions: () => {
				return Future.fromResult(
				[{
					"id": "id2",
					"name": "Sln2",
					"accountId": "accountId",
					"workspaceId": "workspaceId2",
					"description": "AppBuilder cross platform project"
				},{
					"id": "id1",
					"name": "Sln1",
					"accountId": "accountId",
					"workspaceId": "workspaceId1",
					"description": "AppBuilder cross platform project"
				}]);
			}
		}, 
		projects: {
			getSolution: (projectName: string, checkUpgradability: boolean) => {
				return Future.fromResult({
					"Name": "Sln1",
					"Items": [
						{
							"Name": "BlankProj",
							"RelativePath": "BlankProj",
							"Items": [
								{
									"Type": "Content",
									"Identifier": ".abignore"
								}
							],
							"Properties": {
								"ProjectName": "BlankProj",
								"Framework": "Cordova"
							}
						},
						{
							"Name": "ABlankProjMobileTesting",
							"RelativePath": "ABlankProjMobileTesting",
							"Items": [
								{
									"Type": "Content",
									"Identifier": ".abignore"
								},
								{
									"Type": "Content",
									"Identifier": "MobileTestingSuite1.js"
								}
							],
							"Properties": {
								"ProjectName": "ABlankProjMobileTesting",
								"Framework": "MobileTesting"
							},
							"PerConfigurationProperties": {}
						}
					],
					"IsUpgradeable": false
				});
			}
		}
	});
	testInjector.register("project", {
		getNewProjectDir:() => "proj dir",
		createProjectFile: (projectDir: string, properties: any) => Future.fromResult()
	});
	testInjector.register("projectConstants", projectConstantsLib.ProjectConstants);
	testInjector.register("fs", {
		exists: (path: string) => {
			if(path.indexOf("abproject") !== -1) {
				return Future.fromResult(true);
			} else {
				return Future.fromResult(false);
			}
		},
		createWriteStream: (path: string) => {},
		unzip: (zipFile: string, destinationDir: string) => Future.fromResult(),
		readDirectory: (projectDir: string) => Future.fromResult([])
	});
	testInjector.register("logger", stubs.LoggerStub);
	return testInjector;
}

describe("remote project service", () => {
	let testInjector: IInjector;
		let remoteProjectService: IRemoteProjectService;
		beforeEach(() => {
			testInjector = createTestInjector();
			remoteProjectService = testInjector.resolve(remoteProjectsServiceLib.RemoteProjectService);
		});
	
	it("getSolutions returns correct sorted results", () => {
		let solutions = remoteProjectService.getSolutions().wait();
		let expectedResult = ["Sln1", "Sln2"];
		assert.deepEqual(expectedResult, solutions.map(sln => sln.name));
	});
	
	describe("getProjectsForSolution", () => {
		it("fails when solution name does not exist", () => {
			assert.throws( () => remoteProjectService.getProjectsForSolution("Invalid name").wait() );
		});
	
		it("returns correct sorted result when name is correct", () => {
			let projects = remoteProjectService.getProjectsForSolution("Sln1").wait();
			let expectedResult = ["ABlankProjMobileTesting", "BlankProj"];
			assert.deepEqual(expectedResult, projects.map(pr => pr.Name));
		});

		it("returns correct sorted result when passed index is correct", () => {
			let projects = remoteProjectService.getProjectsForSolution("1").wait();
			let expectedResult = ["ABlankProjMobileTesting", "BlankProj"];
			assert.deepEqual(expectedResult, projects.map(pr => pr.Name));
		});

		it("fails when solution index is out of range", () => {
			assert.throws( () => remoteProjectService.getProjectsForSolution("5").wait() );
		});
	});

	describe("getProjectProperties", () => {
		let expectedPropertiesResult = {
			"ProjectName": "BlankProj",
			"Framework": "Cordova"
		};

		it("fails when solution name is not correct", () => {
			assert.throws( () => remoteProjectService.getProjectProperties("Invalid name", "BlankProj").wait() );
		});

		it("fails when solution index is not correct", () => {
			assert.throws( () => remoteProjectService.getProjectProperties("5", "BlankProj").wait() );
		});

		it("fails when project name is not correct", () => {
			assert.throws( () => remoteProjectService.getProjectProperties("Sln1", "Invalid name").wait() );
		});

		it("fails when project index is not correct", () => {
			assert.throws( () => remoteProjectService.getProjectProperties("Sln1", "5").wait() );
		});

		it("returns correct properties when solution name and project name are correct", () => {
			let properties = remoteProjectService.getProjectProperties("Sln1", "BlankProj").wait();
			assert.deepEqual(expectedPropertiesResult, properties);
		});

		it("returns correct properties when solution id and project name are correct", () => {
			let properties = remoteProjectService.getProjectProperties("1", "BlankProj").wait();
			assert.deepEqual(expectedPropertiesResult, properties);
		});

		it("returns correct properties when solution name and project id are correct", () => {
			let properties = remoteProjectService.getProjectProperties("Sln1", "2").wait();
			assert.deepEqual(expectedPropertiesResult, properties);
		});

		it("returns correct properties when solution name and project id are correct", () => {
			let properties = remoteProjectService.getProjectProperties("1", "2").wait();
			assert.deepEqual(expectedPropertiesResult, properties);
		});
	});

	describe("getSolutionName", () => {
		let expectedResult = "Sln1";

		it("fails when solution name is not correct", () => {
			assert.throws( () => remoteProjectService.getSolutionName("Invalid name").wait() );
		});

		it("fails when solution index is not correct", () => {
			assert.throws( () => remoteProjectService.getSolutionName("5").wait() );
		});

		it("returns correct name when solution name is correct", () => {
			let properties = remoteProjectService.getSolutionName("Sln1").wait();
			assert.deepEqual(expectedResult, properties);
		});

		it("returns correct name when solution name is correct", () => {
			let properties = remoteProjectService.getSolutionName("1").wait();
			assert.deepEqual(expectedResult, properties);
		});
	});
	
	describe("getProjectName", () => {
		let expectedResult = "BlankProj";
		it("fails when solution name is not correct", () => {
			assert.throws( () => remoteProjectService.getProjectName("Invalid name", "BlankProj").wait() );
		});

		it("fails when solution index is not correct", () => {
			assert.throws( () => remoteProjectService.getProjectName("5", "BlankProj").wait() );
		});

		it("fails when solution name is correct but project name is not", () => {
			assert.throws( () => remoteProjectService.getProjectName("Sln1", "Invalid name").wait() );
		});

		it("fails when solution name is correct but project id is not", () => {
			assert.throws( () => remoteProjectService.getProjectName("Sln1", "5").wait() );
		});

		it("returns correct name when solution name and project name are correct", () => {
			let projName = remoteProjectService.getProjectName("Sln1", "BlankProj").wait();
			assert.deepEqual(expectedResult, projName);
		});

		it("returns correct name when solution id and project name are correct", () => {
			let projName = remoteProjectService.getProjectName("1", "BlankProj").wait();
			assert.deepEqual(expectedResult, projName);
		});

		it("returns correct name when solution name and project id are correct", () => {
			let projName = remoteProjectService.getProjectName("Sln1", "2").wait();
			assert.deepEqual(expectedResult, projName);
		});
	});
});